/**
 * Local SQLite backup, verification, restore and export.
 *
 * Uses better-sqlite3 directly (not Prisma) so it works from CLI scripts,
 * scheduled tasks and the Next.js server alike. Must not import Next.js or
 * "server-only".
 *
 * Safety rules enforced here:
 *  - Backups use SQLite's online backup API (consistent even while in use).
 *  - Every backup is integrity-checked and SHA-256 fingerprinted; a manifest
 *    (<file>.json) is written alongside it.
 *  - Retention pruning only deletes AUTOMATIC backups. Manual, pre-migrate and
 *    pre-restore backups are kept until the user deletes them.
 *  - Restore verifies the backup first, refuses while the app is running,
 *    always takes a "pre-restore" backup of the current database, and swaps
 *    files atomically.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { DataPaths } from "../config/paths";

export type BackupReason = "auto" | "manual" | "pre-migrate" | "pre-restore";
const PRUNABLE: ReadonlySet<BackupReason> = new Set(["auto"]);

export interface BackupManifest {
  formatVersion: 1;
  file: string;
  createdAt: string;
  reason: BackupReason;
  sizeBytes: number;
  sha256: string;
  migrations: string[];
}

export interface VerifyResult {
  ok: boolean;
  errors: string[];
  migrations: string[];
}

function sha256File(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** Open a SQLite file read-only and run PRAGMA integrity_check. */
export function verifyDatabaseFile(file: string): VerifyResult {
  const errors: string[] = [];
  let migrations: string[] = [];
  if (!fs.existsSync(file)) return { ok: false, errors: [`File not found: ${file}`], migrations };
  let db: Database.Database | undefined;
  try {
    db = new Database(file, { readonly: true, fileMustExist: true });
    const rows = db.prepare("PRAGMA integrity_check").all() as { integrity_check: string }[];
    const results = rows.map((r) => r.integrity_check);
    if (!(results.length === 1 && results[0] === "ok")) errors.push(...results);
    const hasMigrations = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_prisma_migrations'")
      .get();
    if (hasMigrations) {
      migrations = (
        db
          .prepare(
            "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name",
          )
          .all() as { migration_name: string }[]
      ).map((r) => r.migration_name);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  } finally {
    db?.close();
  }
  return { ok: errors.length === 0, errors, migrations };
}

function timestamp(d = new Date()): string {
  return d.toISOString().replace(/[:.]/g, "-");
}

export async function createBackup(
  paths: DataPaths,
  opts: { reason: BackupReason; retain?: number },
): Promise<BackupManifest> {
  if (!fs.existsSync(paths.dbFile)) {
    throw new Error("No database exists yet — nothing to back up.");
  }
  fs.mkdirSync(paths.backupsDir, { recursive: true });
  // Random suffix guarantees uniqueness even for backups in the same millisecond.
  const name = `lifequest-${timestamp()}-${opts.reason}-${crypto.randomBytes(3).toString("hex")}.db`;
  const dest = path.join(paths.backupsDir, name);

  const source = new Database(paths.dbFile, { fileMustExist: true });
  try {
    await source.backup(dest);
  } finally {
    source.close();
  }

  const check = verifyDatabaseFile(dest);
  if (!check.ok) {
    fs.rmSync(dest, { force: true });
    throw new Error(`Backup failed integrity check: ${check.errors.join("; ")}`);
  }

  const manifest: BackupManifest = {
    formatVersion: 1,
    file: name,
    createdAt: new Date().toISOString(),
    reason: opts.reason,
    sizeBytes: fs.statSync(dest).size,
    sha256: sha256File(dest),
    migrations: check.migrations,
  };
  fs.writeFileSync(`${dest}.json`, JSON.stringify(manifest, null, 2));

  if (opts.retain !== undefined) pruneBackups(paths, opts.retain);
  return manifest;
}

export function listBackups(paths: DataPaths): BackupManifest[] {
  if (!fs.existsSync(paths.backupsDir)) return [];
  return fs
    .readdirSync(paths.backupsDir)
    .filter((f) => f.endsWith(".db.json"))
    .flatMap((f) => {
      try {
        return [JSON.parse(fs.readFileSync(path.join(paths.backupsDir, f), "utf8")) as BackupManifest];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Delete the oldest AUTOMATIC backups beyond `retain`. Returns deleted file names. */
export function pruneBackups(paths: DataPaths, retain: number): string[] {
  const auto = listBackups(paths).filter((m) => PRUNABLE.has(m.reason));
  const toDelete = auto.slice(Math.max(retain, 1));
  for (const m of toDelete) {
    const file = path.join(paths.backupsDir, m.file);
    fs.rmSync(file, { force: true });
    fs.rmSync(`${file}.json`, { force: true });
  }
  return toDelete.map((m) => m.file);
}

/** Verify a backup against its manifest (checksum) and SQLite integrity. */
export function verifyBackup(paths: DataPaths, fileName: string): VerifyResult {
  const file = resolveBackupFile(paths, fileName);
  const manifestFile = `${file}.json`;
  const errors: string[] = [];
  if (!fs.existsSync(manifestFile)) errors.push("Manifest missing");
  else {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as BackupManifest;
    if (fs.existsSync(file) && sha256File(file) !== manifest.sha256) {
      errors.push("Checksum mismatch — backup file has been modified or corrupted");
    }
  }
  const integrity = verifyDatabaseFile(file);
  return { ok: errors.length === 0 && integrity.ok, errors: [...errors, ...integrity.errors], migrations: integrity.migrations };
}

/** Only allow restoring files that live in the backups directory (no path traversal). */
function resolveBackupFile(paths: DataPaths, fileName: string): string {
  const base = path.basename(fileName);
  if (base !== fileName || !base.endsWith(".db")) {
    throw new Error("Backup must be referenced by its file name inside the backups directory.");
  }
  return path.join(paths.backupsDir, base);
}

const LOCK_FILE = "app.lock";

export function writeAppLock(paths: DataPaths): void {
  fs.mkdirSync(paths.root, { recursive: true });
  fs.writeFileSync(path.join(paths.root, LOCK_FILE), String(process.pid));
}

export function removeAppLock(paths: DataPaths): void {
  const file = path.join(paths.root, LOCK_FILE);
  try {
    if (fs.readFileSync(file, "utf8").trim() === String(process.pid)) fs.rmSync(file, { force: true });
  } catch {
    /* already gone */
  }
}

export function isAppRunning(paths: DataPaths): boolean {
  const file = path.join(paths.root, LOCK_FILE);
  if (!fs.existsSync(file)) return false;
  const pid = Number(fs.readFileSync(file, "utf8").trim());
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false; // stale lock
  }
}

export async function restoreBackup(
  paths: DataPaths,
  fileName: string,
): Promise<{ restored: string; safetyBackup: string | null }> {
  if (isAppRunning(paths)) {
    throw new Error("LIFEQUEST is running. Stop the app before restoring a backup.");
  }
  const file = resolveBackupFile(paths, fileName);
  const check = verifyBackup(paths, fileName);
  if (!check.ok) throw new Error(`Refusing to restore an invalid backup: ${check.errors.join("; ")}`);

  let safetyBackup: string | null = null;
  if (fs.existsSync(paths.dbFile)) {
    safetyBackup = (await createBackup(paths, { reason: "pre-restore" })).file;
  }

  fs.mkdirSync(paths.dbDir, { recursive: true });
  const tmp = `${paths.dbFile}.restoring`;
  fs.copyFileSync(file, tmp);
  const tmpCheck = verifyDatabaseFile(tmp);
  if (!tmpCheck.ok) {
    fs.rmSync(tmp, { force: true });
    throw new Error(`Copied backup failed verification: ${tmpCheck.errors.join("; ")}`);
  }
  for (const suffix of ["-wal", "-shm", "-journal"]) fs.rmSync(`${paths.dbFile}${suffix}`, { force: true });
  fs.renameSync(tmp, paths.dbFile);

  const after = verifyDatabaseFile(paths.dbFile);
  if (!after.ok) throw new Error(`Restored database failed verification: ${after.errors.join("; ")}`);
  return { restored: path.basename(file), safetyBackup };
}

/** Create an automatic backup if the newest backup is older than `intervalHours`. */
export async function maybeAutoBackup(
  paths: DataPaths,
  opts: { intervalHours: number; retain: number; now?: Date },
): Promise<BackupManifest | null> {
  if (!fs.existsSync(paths.dbFile)) return null;
  const latest = listBackups(paths)[0];
  const now = opts.now ?? new Date();
  if (latest && now.getTime() - Date.parse(latest.createdAt) < opts.intervalHours * 3_600_000) {
    return null;
  }
  return createBackup(paths, { reason: "auto", retain: opts.retain });
}

/** Export every application table to a single JSON file in the exports directory. */
export function exportToJson(paths: DataPaths): string {
  const db = new Database(paths.dbFile, { readonly: true, fileMustExist: true });
  try {
    const tables = (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations' ORDER BY name",
        )
        .all() as { name: string }[]
    ).map((t) => t.name);
    const data: Record<string, unknown[]> = {};
    for (const t of tables) data[t] = db.prepare(`SELECT * FROM "${t.replace(/"/g, '""')}"`).all();
    fs.mkdirSync(paths.exportsDir, { recursive: true });
    const out = path.join(paths.exportsDir, `lifequest-export-${timestamp()}.json`);
    fs.writeFileSync(out, JSON.stringify({ formatVersion: 1, exportedAt: new Date().toISOString(), tables: data }, null, 2));
    return out;
  } finally {
    db.close();
  }
}
