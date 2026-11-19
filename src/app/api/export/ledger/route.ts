import { connection } from "next/server";
import { ledgerToCsv } from "@/features/honour/csv";
import { londonDateKey } from "@/features/honour/rules";
import { listLedger } from "@/features/honour/server/service";
import { prisma } from "@/server/db/client";

/** Download the whole Honour ledger as CSV (local only — the proxy allows only this PC / tailnet). */
export async function GET() {
  await connection();
  const csv = ledgerToCsv(await listLedger(prisma));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lifequest-ledger-${londonDateKey(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
