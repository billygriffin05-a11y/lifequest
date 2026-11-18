/**
 * Storage acceptance tests (local-first requirement, section 12.H).
 * Runs against a throwaway data directory with the REAL migrations applied.
 */
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createBackup,
  exportToJson,
  listBackups,
  maybeAutoBackup,
  pruneBackups,
  restoreBackup,
  verifyBackup,
  writeAppLock,
  removeAppLock,
} from "@/server/backup/backup";
import { createPrismaClient } from "@/server/db/factory";
import { makeTempDataDir, migrate } from "../support/temp-data-dir";

const { paths, cleanup } = makeTempDataDir("storage");

beforeAll(() => migrate(paths));
afterAll(cleanup);

async function withDb<T>(fn: (db: ReturnType<typeof createPrismaClient>) => Promise<T>): Promise<T> {
  const db = createPrismaClient(paths.dbFile);
  try {
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}

describe("local SQLite storage", () => {
  it("1–3: data created on the PC persists in the local database file across restarts", async () => {
    await withDb((db) => db.appSetting.create({ data: { key: "profile.displayName", value: JSON.stringify("Hero") } }));
    // New client = simulated app restart.
    const row = await withDb((db) => db.appSetting.findUnique({ where: { key: "profile.displayName" } }));
    expect(row && JSON.parse(row.value)).toBe("Hero");
    expect(fs.existsSync(paths.dbFile)).toBe(true);
    expect(path.dirname(paths.dbFile).startsWith(paths.root)).toBe(true);
  });

  it("rejects duplicate processing via idempotency keys on audit events", async () => {
    await withDb(async (db) => {
      await db.auditEvent.create({ data: { actor: "system", action: "reward.grant", idempotencyKey: "reward-1" } });
      await expect(
        db.auditEvent.create({ data: { actor: "system", action: "reward.grant", idempotencyKey: "reward-1" } }),
      ).rejects.toThrow();
    });
  });

  it("4–5: backs up, verifies, and restores the database", async () => {
    const backup = await createBackup(paths, { reason: "manual" });
    expect(verifyBackup(paths, backup.file).ok).toBe(true);
    expect(backup.migrations.length).toBeGreaterThan(0);

    await withDb((db) => db.appSetting.update({ where: { key: "profile.displayName" }, data: { value: '"Changed"' } }));

    const result = await restoreBackup(paths, backup.file);
    expect(result.safetyBackup).toBeTruthy();

    const row = await withDb((db) => db.appSetting.findUnique({ where: { key: "profile.displayName" } }));
    expect(row && JSON.parse(row.value)).toBe("Hero");
    // The pre-restore safety backup still holds the changed value — nothing silently lost.
    expect(listBackups(paths).some((m) => m.reason === "pre-restore")).toBe(true);
  });

  it("detects a tampered backup and refuses to restore it", async () => {
    const backup = await createBackup(paths, { reason: "manual" });
    fs.appendFileSync(path.join(paths.backupsDir, backup.file), "tamper");
    expect(verifyBackup(paths, backup.file).ok).toBe(false);
    await expect(restoreBackup(paths, backup.file)).rejects.toThrow(/invalid backup/);
  });

  it("refuses path traversal in restore", async () => {
    await expect(restoreBackup(paths, "../db/lifequest.db")).rejects.toThrow();
  });

  it("refuses to restore while the app is running", async () => {
    const backup = await createBackup(paths, { reason: "manual" });
    // Simulate another running process by writing our parent's PID.
    fs.writeFileSync(path.join(paths.root, "app.lock"), String(process.ppid));
    await expect(restoreBackup(paths, backup.file)).rejects.toThrow(/running/);
    fs.rmSync(path.join(paths.root, "app.lock"));
    writeAppLock(paths);
    removeAppLock(paths);
  });

  it("automatic backups respect the interval and retention only prunes automatic backups", async () => {
    const t0 = new Date("2030-01-01T00:00:00Z");
    for (let i = 0; i < 4; i++) {
      await maybeAutoBackup(paths, { intervalHours: 0, retain: 100, now: new Date(t0.getTime() + i * 1000) });
    }
    const manualBefore = listBackups(paths).filter((m) => m.reason !== "auto").length;
    pruneBackups(paths, 2);
    expect(listBackups(paths).filter((m) => m.reason === "auto").length).toBe(2);
    expect(listBackups(paths).filter((m) => m.reason !== "auto").length).toBe(manualBefore);
    expect(await maybeAutoBackup(paths, { intervalHours: 24, retain: 2 })).toBeNull();
  });

  it("exports all application tables to JSON", () => {
    const file = exportToJson(paths);
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(Object.keys(data.tables)).toEqual(expect.arrayContaining(["AppSetting", "AuditEvent"]));
    expect(data.tables._prisma_migrations).toBeUndefined();
  });
});
