/**
 * LIFEQUEST local data directory resolution.
 *
 * The user's Windows PC is the primary owner of all LIFEQUEST data. The
 * database, backups, exports and logs live in a per-user application data
 * directory that is deliberately OUTSIDE the project folder, so that:
 *  - personal data is never committed to Git,
 *  - personal data is never served from `public/`,
 *  - a cloud-synced project folder (e.g. OneDrive) does not silently copy the
 *    database to a third-party cloud.
 *
 * This module must stay free of Next.js / "server-only" imports because it is
 * also used by `prisma.config.ts` and the CLI scripts in `scripts/`.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface DataPaths {
  /** Root of all LIFEQUEST data, e.g. %LOCALAPPDATA%\LIFEQUEST */
  root: string;
  dbDir: string;
  /** The primary SQLite database file. */
  dbFile: string;
  backupsDir: string;
  exportsDir: string;
  logsDir: string;
}

type Env = Record<string, string | undefined>;

export const DB_FILE_NAME = "lifequest.db";

export type LifequestEnv = "production" | "development" | "test";

/**
 * Which data set to use. `production` is the user's real personal data.
 * Development and tests NEVER touch it unless explicitly told to.
 * Resolution: LIFEQUEST_ENV, else NODE_ENV=production|test, else development.
 */
export function resolveLifequestEnv(env: Env = process.env): LifequestEnv {
  const explicit = env.LIFEQUEST_ENV?.trim();
  if (explicit === "production" || explicit === "development" || explicit === "test") {
    return explicit;
  }
  if (env.NODE_ENV === "production" || env.NODE_ENV === "test") return env.NODE_ENV;
  return "development";
}

/** Resolve the data root for the current OS, honouring LIFEQUEST_DATA_DIR. */
export function resolveDataRoot(
  env: Env = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  const override = env.LIFEQUEST_DATA_DIR?.trim();
  if (override) return path.resolve(override);

  const lqEnv = resolveLifequestEnv(env);
  const folder = lqEnv === "production" ? "LIFEQUEST" : `LIFEQUEST-${lqEnv}`;

  const home = os.homedir();
  if (platform === "win32") {
    const localAppData = env.LOCALAPPDATA?.trim() || path.join(home, "AppData", "Local");
    return path.join(localAppData, folder);
  }
  if (platform === "darwin") {
    return path.join(home, "Library", "Application Support", folder);
  }
  const xdg = env.XDG_DATA_HOME?.trim() || path.join(home, ".local", "share");
  return path.join(xdg, folder.toLowerCase());
}

export function getDataPaths(env: Env = process.env): DataPaths {
  const root = resolveDataRoot(env);
  const dbDir = path.join(root, "db");
  return {
    root,
    dbDir,
    dbFile: path.join(dbDir, DB_FILE_NAME),
    backupsDir: path.join(root, "backups"),
    exportsDir: path.join(root, "exports"),
    logsDir: path.join(root, "logs"),
  };
}

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

const CLOUD_SYNC_MARKERS = ["onedrive", "dropbox", "google drive", "icloud"];

/**
 * Refuse data locations that would leak personal data, and return warnings
 * for locations that are risky but not forbidden.
 */
export function checkDataRootSafety(
  root: string,
  projectRoot: string = process.cwd(),
): { warnings: string[] } {
  if (isInside(root, projectRoot)) {
    throw new Error(
      `Refusing to use a data directory inside the project folder (${root}). ` +
        "Personal data must live outside the repository and outside public/.",
    );
  }
  const warnings: string[] = [];
  const lower = root.toLowerCase();
  if (CLOUD_SYNC_MARKERS.some((m) => lower.includes(m))) {
    warnings.push(
      "The data directory appears to be inside a cloud-synced folder. " +
        "LIFEQUEST data would be copied to that cloud provider. Prefer %LOCALAPPDATA%\\LIFEQUEST.",
    );
  }
  return { warnings };
}

export function ensureDataDirs(paths: DataPaths): void {
  for (const dir of [paths.root, paths.dbDir, paths.backupsDir, paths.exportsDir, paths.logsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Prisma/SQLite connection URL for a database file (forward slashes for Windows). */
export function toSqliteUrl(dbFile: string): string {
  return `file:${dbFile.replace(/\\/g, "/")}`;
}
