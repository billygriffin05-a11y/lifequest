import { defineConfig } from "prisma/config";
import { getDataPaths, ensureDataDirs, toSqliteUrl } from "./src/server/config/paths";

// The database location is derived from the local data directory
// (%LOCALAPPDATA%\LIFEQUEST by default, or LIFEQUEST_DATA_DIR) — never from
// a hard-coded path inside the repository.
const paths = getDataPaths();
ensureDataDirs(paths);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: toSqliteUrl(paths.dbFile),
  },
});
