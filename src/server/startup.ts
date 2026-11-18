/**
 * Node.js server startup (loaded from src/instrumentation.ts).
 * - Ensures the local data directory exists and is safe.
 * - Writes a lock file so offline restore refuses to run while the app is up.
 * - Runs automatic backups on the configured interval.
 * Logs never include personal data — only paths, counts and status.
 */
import { checkDataRootSafety, ensureDataDirs, getDataPaths } from "./config/paths";
import { loadServerSettings } from "./config/settings";
import { maybeAutoBackup, removeAppLock, writeAppLock } from "./backup/backup";

const paths = getDataPaths();
const settings = loadServerSettings();

const { warnings } = checkDataRootSafety(paths.root);
warnings.forEach((w) => console.warn(`[lifequest] ${w}`));
ensureDataDirs(paths);
writeAppLock(paths);
process.once("exit", () => removeAppLock(paths));
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.once(sig, () => {
    removeAppLock(paths);
    process.exit(0);
  });
}

async function runAutoBackup() {
  try {
    const m = await maybeAutoBackup(paths, {
      intervalHours: settings.LIFEQUEST_BACKUP_INTERVAL_HOURS,
      retain: settings.LIFEQUEST_BACKUP_RETAIN,
    });
    if (m) console.info(`[lifequest] automatic backup created (${m.file})`);
  } catch (err) {
    console.error(`[lifequest] automatic backup failed: ${err instanceof Error ? err.message : "unknown error"}`);
  }
}

void runAutoBackup();
setInterval(runAutoBackup, 60 * 60 * 1000).unref();
