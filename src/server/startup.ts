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

// Google Calendar outbox retry (deeds logged while offline get pushed later).
// Lazy imports: only touches Prisma/Google when the owner has set it up.
async function runCalendarSync() {
  try {
    const [{ googleConfig }, { processOutbox }, { createPrismaClient }] = await Promise.all([
      import("@/features/calendar/google/config"),
      import("@/features/calendar/server/service"),
      import("./db/factory"),
    ]);
    const cfg = googleConfig();
    if (!cfg) return;
    const db = createPrismaClient(paths.dbFile);
    try {
      const r = await processOutbox({ db, paths, cfg, fetchImpl: fetch });
      if (r.sent || r.failed) console.info(`[lifequest] calendar sync: ${r.sent} sent, ${r.failed} failed`);
    } finally {
      await db.$disconnect();
    }
  } catch {
    console.error("[lifequest] calendar sync failed");
  }
}
setInterval(runCalendarSync, 5 * 60 * 1000).unref();
