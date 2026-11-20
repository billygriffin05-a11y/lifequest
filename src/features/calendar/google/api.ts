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

// ── Read-only: the owner's own calendars ─────────────────────────────────────

export interface GoogleCalendarListEntry {
  id: string;
  primary?: boolean;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  selected?: boolean;
  hidden?: boolean;
}

export interface GoogleEventTime {
  date?: string;
  dateTime?: string;
}

export interface GoogleEventItem {
  id: string;
  status?: string;
  summary?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
}

/** Calendars shown in the owner's Google Calendar (needs calendarlist.readonly). */
export async function listCalendars(fetchImpl: Fetch, accessToken: string): Promise<GoogleCalendarListEntry[]> {
  const res = await calendarCall(fetchImpl, accessToken, "GET", "/users/me/calendarList?minAccessRole=reader&maxResults=100");
  if (!res.ok) throw new GoogleApiError(`Could not list calendars (${res.status})`, res.status);
  return ((await res.json()) as { items?: GoogleCalendarListEntry[] }).items ?? [];
}

/** Events in [timeMin, timeMax), recurring ones expanded (needs events.readonly). */
export async function listEvents(
  fetchImpl: Fetch,
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleEventItem[]> {
  const out: GoogleEventItem[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const q = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
    if (pageToken) q.set("pageToken", pageToken);
    const res = await calendarCall(fetchImpl, accessToken, "GET", `/calendars/${encodeURIComponent(calendarId)}/events?${q}`);
    if (!res.ok) throw new GoogleApiError(`Could not read events (${res.status})`, res.status);
    const json = (await res.json()) as { items?: GoogleEventItem[]; nextPageToken?: string };
    out.push(...(json.items ?? []));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return out;
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

/** Create-or-replace an event with a fixed id (also revives a previously deleted one). */
export async function upsertEvent(fetchImpl: Fetch, accessToken: string, calendarId: string, event: { id: string }): Promise<void> {
  const res = await calendarCall(
    fetchImpl,
    accessToken,
    "PUT",
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}`,
    event,
  );
  if (res.ok) return;
  if (res.status === 404) return insertEvent(fetchImpl, accessToken, calendarId, event);
  throw new GoogleApiError(`Google Calendar reminder update failed (${res.status})`, res.status);
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
