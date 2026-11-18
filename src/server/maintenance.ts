/**
 * Owner-requested maintenance operations on the local database.
 * Must not import Next.js or "server-only" (used by scripts/db.ts).
 */
import fs from "node:fs";
import Database from "better-sqlite3";
import { createBackup, isAppRunning } from "./backup/backup";
import type { DataPaths } from "./config/paths";

export interface ResetResult {
  backup: string;
  entriesRemoved: number;
}

/**
 * Reset Honour/XP progress: removes every ledger entry (so Honour, XP, the
 * chart and every dragon start again) but KEEPS the owner's good/bad action
 * list, settings and the audit trail.
 *
 * Always takes a "pre-reset" backup first (never auto-pruned), so the reset
 * can be undone with `db restore <file> --yes`.
 */
export async function resetProgress(paths: DataPaths): Promise<ResetResult> {
  if (!fs.existsSync(paths.dbFile)) throw new Error("No database exists yet — nothing to reset.");
  if (isAppRunning(paths)) throw new Error("LIFEQUEST is running. Stop the app before resetting progress.");

  const backup = await createBackup(paths, { reason: "pre-reset" });
  const db = new Database(paths.dbFile, { fileMustExist: true });
  try {
    const run = db.transaction(() => {
      const removed = db.prepare('DELETE FROM "PointEntry"').run().changes;
      db.prepare(
        'INSERT INTO "AuditEvent" ("id", "occurredAt", "actor", "action", "entityType", "details") VALUES (?, ?, ?, ?, ?, ?)',
      ).run(
        `reset-${Date.now().toString(36)}`,
        new Date().toISOString(),
        "owner",
        "honour.reset",
        "PointEntry",
        JSON.stringify({ entriesRemoved: removed, backup: backup.file }),
      );
      return removed;
    });
    return { backup: backup.file, entriesRemoved: run() };
  } finally {
    db.close();
  }
}
