import { connection } from "next/server";
import { calendarDeps } from "@/features/calendar/server/runtime";
import { getWidgetFeed } from "@/features/widgets/server/feed";
import { prisma } from "@/server/db/client";

/** Read-only summary for phone widgets. Host allow-list (proxy.ts) keeps it to localhost/Tailscale. */
export async function GET() {
  await connection();
  try {
    const feed = await getWidgetFeed(prisma, calendarDeps());
    return Response.json(feed, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("[widget] feed failed");
    return Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
