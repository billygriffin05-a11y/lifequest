import { connection } from "next/server";
import { prisma } from "@/server/db/client";

/** Liveness + local database check. Returns no personal data. */
export async function GET() {
  await connection();
  let database: "ok" | "unavailable" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "unavailable";
  }
  return Response.json(
    { status: database === "ok" ? "ok" : "degraded", database, time: new Date().toISOString() },
    { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
