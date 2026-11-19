import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/features/calendar/google/api";
import { loadGoogleConfig } from "@/features/calendar/google/client-file";
import { getDataPaths } from "@/server/config/paths";
import { calendarDeps } from "@/features/calendar/server/runtime";
import { saveConnection } from "@/features/calendar/server/service";

const COOKIE_PATH = "/api/integrations/google";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Only fixed reason codes are ever put in the URL (no reflected text). */
function done(request: NextRequest, result: "connected" | "denied" | "invalid-state" | "error") {
  const res = NextResponse.redirect(new URL(`/settings?google=${result}`, request.url));
  for (const name of ["lq_google_state", "lq_google_verifier"]) res.cookies.set(name, "", { path: COOKIE_PATH, maxAge: 0 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(request: NextRequest) {
  const cfg = loadGoogleConfig(getDataPaths());
  if (!cfg) return NextResponse.redirect(new URL("/settings?google=not-configured", request.url));

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return done(request, "denied");

  const state = params.get("state") ?? "";
  const code = params.get("code") ?? "";
  const expected = request.cookies.get("lq_google_state")?.value ?? "";
  const verifier = request.cookies.get("lq_google_verifier")?.value ?? "";
  if (!state || !expected || !verifier || !code || !safeEqual(state, expected)) return done(request, "invalid-state");

  try {
    const tokens = await exchangeCode(fetch, cfg, code, verifier);
    await saveConnection(calendarDeps(), tokens);
  } catch (err) {
    console.error(`[calendar] connect failed: ${err instanceof Error ? err.message : "unknown"}`);
    return done(request, "error");
  }
  return done(request, "connected");
}
