import { NextResponse, type NextRequest } from "next/server";
import { buildAuthUrl, randomToken } from "@/features/calendar/google/api";
import { googleConfig } from "@/features/calendar/google/config";

const COOKIE_PATH = "/api/integrations/google";

/** Starts Google OAuth (authorization code + PKCE + state). */
export async function GET(request: NextRequest) {
  const cfg = googleConfig();
  if (!cfg) return NextResponse.redirect(new URL("/settings?google=not-configured", request.url));

  // The OAuth cookies must live on the same origin as the registered redirect
  // (e.g. localhost vs 127.0.0.1), so hop there first if needed.
  const redirectOrigin = new URL(cfg.redirectUri).origin;
  if (request.nextUrl.origin !== redirectOrigin) {
    return NextResponse.redirect(new URL(request.nextUrl.pathname, redirectOrigin));
  }

  const state = randomToken();
  const verifier = randomToken(48);
  const res = NextResponse.redirect(buildAuthUrl(cfg, state, verifier));
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: request.nextUrl.protocol === "https:",
    path: COOKIE_PATH,
    maxAge: 600,
  };
  res.cookies.set("lq_google_state", state, opts);
  res.cookies.set("lq_google_verifier", verifier, opts);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
