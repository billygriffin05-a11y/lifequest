import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { getDataPaths } from "../config/paths";
import { createPrismaClient } from "./factory";

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { lifequestPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.lifequestPrisma ?? createPrismaClient(getDataPaths().dbFile);

if (process.env.NODE_ENV !== "production") globalForPrisma.lifequestPrisma = prisma;
