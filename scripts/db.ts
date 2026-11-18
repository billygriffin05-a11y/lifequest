/**
 * LIFEQUEST local database CLI.
 *
 *   npm run db -- <command> [--env=production|development|test] [--yes]
 *
 * Commands: info | migrate | backup | list | verify <file> | restore <file> --yes | export
 *
 * Defaults to the DEVELOPMENT data set. Pass --env=production to act on your
 * real personal data (%LOCALAPPDATA%\LIFEQUEST).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { checkDataRootSafety, ensureDataDirs, getDataPaths, resolveLifequestEnv } from "../src/server/config/paths";
import { loadServerSettings } from "../src/server/config/settings";
import {
  createBackup,
  exportToJson,
  listBackups,
  restoreBackup,
  verifyBackup,
  verifyDatabaseFile,
} from "../src/server/backup/backup";

const args = process.argv.slice(2);
const envFlag = args.find((a) => a.startsWith("--env="))?.slice(6);
if (envFlag) process.env.LIFEQUEST_ENV = envFlag;
const positional = args.filter((a) => !a.startsWith("--"));
const [command, target] = positional;
const yes = args.includes("--yes");

const paths = getDataPaths();
const lqEnv = resolveLifequestEnv();
const settings = loadServerSettings();

function out(msg: string) {
  process.stdout.write(`${msg}\n`);
}

async function main() {
  const { warnings } = checkDataRootSafety(paths.root);
  warnings.forEach((w) => out(`WARNING: ${w}`));
  ensureDataDirs(paths);
  out(`[lifequest:${lqEnv}] data directory: ${paths.root}`);

  switch (command) {
    case "info": {
      const exists = fs.existsSync(paths.dbFile);
      out(`database: ${paths.dbFile} (${exists ? "exists" : "not created yet"})`);
      if (exists) {
        const v = verifyDatabaseFile(paths.dbFile);
        out(`integrity: ${v.ok ? "ok" : v.errors.join("; ")}`);
        out(`migrations applied: ${v.migrations.length ? v.migrations.join(", ") : "none"}`);
      }
      out(`backups: ${listBackups(paths).length} in ${paths.backupsDir}`);
      return;
    }
    case "migrate": {
      // Never let a migration silently destroy data: back up first.
      if (fs.existsSync(paths.dbFile)) {
        const m = await createBackup(paths, { reason: "pre-migrate" });
        out(`pre-migrate backup: ${m.file}`);
      }
      const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
      const res = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
        stdio: "inherit",
        env: process.env,
      });
      if (res.status !== 0) throw new Error("prisma migrate deploy failed — the pre-migrate backup is intact.");
      const db = new Database(paths.dbFile);
      db.pragma("journal_mode = WAL");
      db.close();
      const v = verifyDatabaseFile(paths.dbFile);
      out(`post-migrate integrity: ${v.ok ? "ok" : v.errors.join("; ")}`);
      return;
    }
    case "backup": {
      const m = await createBackup(paths, { reason: "manual", retain: settings.LIFEQUEST_BACKUP_RETAIN });
      out(`backup created: ${m.file} (${m.sizeBytes} bytes, sha256 ${m.sha256.slice(0, 12)}…)`);
      return;
    }
    case "auto-backup": {
      // Used by the Windows scheduled task: respects the configured interval.
      const { maybeAutoBackup } = await import("../src/server/backup/backup");
      const m = await maybeAutoBackup(paths, {
        intervalHours: settings.LIFEQUEST_BACKUP_INTERVAL_HOURS,
        retain: settings.LIFEQUEST_BACKUP_RETAIN,
      });
      out(m ? `automatic backup created: ${m.file}` : "automatic backup not due yet");
      return;
    }
    case "list": {
      for (const m of listBackups(paths)) out(`${m.createdAt}  ${m.reason.padEnd(11)}  ${m.file}`);
      return;
    }
    case "verify": {
      if (!target) throw new Error("Usage: db verify <backup-file-name>");
      const v = verifyBackup(paths, target);
      out(v.ok ? "backup OK" : `backup INVALID: ${v.errors.join("; ")}`);
      if (!v.ok) process.exitCode = 1;
      return;
    }
    case "restore": {
      if (!target) throw new Error("Usage: db restore <backup-file-name> --yes");
      if (!yes) throw new Error("Restore replaces the current database. Re-run with --yes to confirm.");
      const r = await restoreBackup(paths, target);
      out(`restored ${r.restored}; previous database saved as ${r.safetyBackup ?? "(none existed)"}`);
      return;
    }
    case "export": {
      out(`exported to ${exportToJson(paths)}`);
      return;
    }
    default:
      out("Commands: info | migrate | backup | auto-backup | list | verify <file> | restore <file> --yes | export");
      process.exitCode = command ? 1 : 0;
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
