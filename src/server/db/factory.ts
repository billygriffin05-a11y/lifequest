import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

/** Create a Prisma client bound to a specific local SQLite file. */
export function createPrismaClient(dbFile: string): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: dbFile });
  return new PrismaClient({ adapter });
}
