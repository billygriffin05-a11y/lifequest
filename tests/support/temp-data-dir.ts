import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDataPaths, ensureDataDirs, type DataPaths } from "@/server/config/paths";

/** Create an isolated LIFEQUEST data directory in the OS temp folder. Never touches real data. */
export function makeTempDataDir(label: string): { paths: DataPaths; cleanup: () => void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `lifequest-${label}-`));
  const paths = getDataPaths({ LIFEQUEST_DATA_DIR: root });
  ensureDataDirs(paths);
  return { paths, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

/** Apply the real Prisma migrations to the temp database via `prisma migrate deploy`. */
export function migrate(paths: DataPaths): void {
  const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  const res = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    env: { ...process.env, LIFEQUEST_DATA_DIR: paths.root },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`prisma migrate deploy failed:\n${res.stdout}\n${res.stderr}`);
}
