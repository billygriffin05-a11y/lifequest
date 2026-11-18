import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addStarterActions,
  createAction,
  getSummary,
  getTodayEntries,
  listActions,
  logAction,
  setArchived,
  undoEntry,
  updateAction,
} from "@/features/honour/server/service";
import { createPrismaClient } from "@/server/db/factory";
import { makeTempDataDir, migrate } from "../support/temp-data-dir";

const { paths, cleanup } = makeTempDataDir("honour");
let db: ReturnType<typeof createPrismaClient>;

beforeAll(() => {
  migrate(paths);
  db = createPrismaClient(paths.dbFile);
});
afterAll(async () => {
  await db.$disconnect();
  cleanup();
});

const NOW = new Date("2026-11-18T12:00:00Z");

describe("honour service", () => {
  it("custom actions persist across restarts (stay in the list the next day)", async () => {
    await createAction(db, { name: "Gym session", kind: "good", points: 20, icon: "🏋️", category: "Fitness" });
    await createAction(db, { name: "Takeaway", kind: "bad", points: 15, icon: "🍔", category: "Nutrition" });
    const fresh = createPrismaClient(paths.dbFile);
    try {
      const names = (await listActions(fresh)).map((a) => a.name);
      expect(names).toEqual(["Gym session", "Takeaway"]);
    } finally {
      await fresh.$disconnect();
    }
  });

  it("logging computes Honour and XP server-side", async () => {
    const [gym, takeaway] = await listActions(db);
    await logAction(db, { actionId: gym.id, idempotencyKey: randomUUID() }, NOW);
    await logAction(db, { actionId: takeaway.id, idempotencyKey: randomUUID() }, NOW);
    expect(await getSummary(db, NOW)).toEqual({ honour: 5, xp: 20, today: { good: 20, bad: 15, net: 5 } });
  });

  it("a retried log with the same idempotency key does not double-count", async () => {
    const [gym] = await listActions(db);
    const key = randomUUID();
    const a = await logAction(db, { actionId: gym.id, idempotencyKey: key }, NOW);
    const b = await logAction(db, { actionId: gym.id, idempotencyKey: key }, NOW);
    expect(b.id).toBe(a.id);
    expect((await getSummary(db, NOW)).honour).toBe(25);
  });

  it("undo writes a reversal, can only happen once, and keeps history", async () => {
    const [entry] = await getTodayEntries(db, NOW);
    await undoEntry(db, { entryId: entry.id, idempotencyKey: randomUUID() }, NOW);
    await expect(undoEntry(db, { entryId: entry.id, idempotencyKey: randomUUID() }, NOW)).rejects.toThrow(/already/);
    const after = await getTodayEntries(db, NOW);
    expect(after.find((e) => e.id === entry.id)?.undone).toBe(true);
    expect((await getSummary(db, NOW)).honour).toBe(5);
    // Ledger rows are never deleted: originals + reversal remain.
    expect(await db.pointEntry.count()).toBe(4);
  });

  it("editing an action changes future logs only", async () => {
    const [gym] = await listActions(db);
    await updateAction(db, gym.id, { name: "Gym session", kind: "good", points: 50, icon: "🏋️", category: "Fitness" });
    await logAction(db, { actionId: gym.id, idempotencyKey: randomUUID() }, NOW);
    const entries = await db.pointEntry.findMany({ where: { actionId: gym.id, reversesEntryId: null } });
    expect(entries.map((e) => e.honourDelta).sort((x, y) => x - y)).toEqual([20, 20, 50]);
  });

  it("archived actions keep history but cannot be logged until restored", async () => {
    const [, takeaway] = await listActions(db);
    await setArchived(db, takeaway.id, true);
    expect((await listActions(db)).map((a) => a.name)).toEqual(["Gym session"]);
    await expect(logAction(db, { actionId: takeaway.id, idempotencyKey: randomUUID() }, NOW)).rejects.toThrow(/archived/);
    expect(await db.pointEntry.count({ where: { actionId: takeaway.id } })).toBe(1);
    await setArchived(db, takeaway.id, false);
    expect((await listActions(db)).length).toBe(2);
  });

  it("starter examples are only added to an empty list", async () => {
    expect(await addStarterActions(db)).toBe(0);
  });

  it("every ledger write is audited with an idempotency key", async () => {
    const logs = await db.auditEvent.count({ where: { action: "honour.log" } });
    const undos = await db.auditEvent.count({ where: { action: "honour.undo" } });
    expect(logs).toBe(4);
    expect(undos).toBe(1);
  });

  it("entries are counted on the Europe/London day", async () => {
    const [gym] = await listActions(db);
    // 23:30 UTC on 31 May = 00:30 BST on 1 June
    const e = await logAction(db, { actionId: gym.id, idempotencyKey: randomUUID() }, new Date("2026-05-31T23:30:00Z"));
    expect(e.occurredOn).toBe("2026-06-01");
  });
});
