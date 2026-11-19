/**
 * Minimal Google OAuth 2.0 + Calendar v3 REST client. `fetchImpl` is injectable
 * so tests never touch the network. Error messages never include tokens.
 */
import crypto from "node:crypto";
import { CALENDAR_NAME, GOOGLE_SCOPES, type GoogleConfig } from "./config";

export type Fetch = typeof fetch;

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CAL_API = "https://www.googleapis.com/calendar/v3";

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// ── PKCE + state ─────────────────────────────────────────────────────────────

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function pkceChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function buildAuthUrl(cfg: GoogleConfig, state: string, verifier: string): string {
  const u = new URL(AUTH_URL);
  u.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
  }).toString();
  return u.toString();
}

// ── Tokens ───────────────────────────────────────────────────────────────────

export interface TokenSet {
  accessToken: string;
  expiresAt: Date;
  refreshToken?: string;
}

async function tokenRequest(fetchImpl: Fetch, body: Record<string, string>): Promise<TokenSet> {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    let reason = "";
    try {
      reason = ((await res.json()) as { error?: string }).error ?? "";
    } catch {
      /* ignore */
    }
    throw new GoogleApiError(`Google token request failed (${res.status}${reason ? `: ${reason}` : ""})`, res.status);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  return {
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + (json.expires_in - 60) * 1000),
    refreshToken: json.refresh_token,
  };
}

export function exchangeCode(fetchImpl: Fetch, cfg: GoogleConfig, code: string, verifier: string) {
  return tokenRequest(fetchImpl, {
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
}

export function refreshAccessToken(fetchImpl: Fetch, cfg: GoogleConfig, refreshToken: string) {
  return tokenRequest(fetchImpl, {
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
  });
}

export async function revokeToken(fetchImpl: Fetch, token: string): Promise<void> {
  await fetchImpl(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }).toString(),
  });
}

// ── Calendar ─────────────────────────────────────────────────────────────────

async function calendarCall(fetchImpl: Fetch, accessToken: string, method: string, path: string, body?: unknown) {
  return fetchImpl(`${CAL_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function createLifequestCalendar(fetchImpl: Fetch, accessToken: string): Promise<string> {
  const res = await calendarCall(fetchImpl, accessToken, "POST", "/calendars", {
    summary: CALENDAR_NAME,
    description: "Good deeds and bad habits logged in LIFEQUEST.",
    timeZone: "Europe/London",
  });
  if (!res.ok) throw new GoogleApiError(`Could not create the LIFEQUEST calendar (${res.status})`, res.status);
  return ((await res.json()) as { id: string }).id;
}

/** Insert with a client-chosen id: a retry of the same event returns 409, which counts as success. */
export async function insertEvent(fetchImpl: Fetch, accessToken: string, calendarId: string, event: object): Promise<void> {
  const res = await calendarCall(fetchImpl, accessToken, "POST", `/calendars/${encodeURIComponent(calendarId)}/events`, event);
  if (res.ok || res.status === 409) return;
  throw new GoogleApiError(`Google Calendar insert failed (${res.status})`, res.status);
}

/** Patch fields of an existing event (e.g. description after a note is added). */
export async function patchEvent(fetchImpl: Fetch, accessToken: string, calendarId: string, eventId: string, fields: object): Promise<void> {
  const res = await calendarCall(
    fetchImpl,
    accessToken,
    "PATCH",
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    fields,
  );
  // Event deleted meanwhile (undo) → nothing to update.
  if (res.ok || res.status === 404 || res.status === 410) return;
  throw new GoogleApiError(`Google Calendar update failed (${res.status})`, res.status);
}

/** Delete by id: already gone (404/410) counts as success. */
export async function deleteEvent(fetchImpl: Fetch, accessToken: string, calendarId: string, eventId: string): Promise<void> {
  const res = await calendarCall(
    fetchImpl,
    accessToken,
    "DELETE",
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
  );
  if (res.ok || res.status === 404 || res.status === 410) return;
  throw new GoogleApiError(`Google Calendar delete failed (${res.status})`, res.status);
}
