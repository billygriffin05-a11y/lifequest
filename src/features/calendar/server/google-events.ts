/**
 * Read the owner's own Google Calendar events for a date range.
 * Never stored in the database or logged; a tiny in-memory cache (2 minutes)
 * avoids refetching while flicking between views.
 */
import { GoogleApiError, listCalendars, listEvents, searchEvents, type GoogleEventItem } from "../google/api";
import { mapEvent, safeColour, type CalEvent } from "../google/event-mapping";
import { getAccessToken, type CalendarDeps } from "./service";

/** Deeds and the daily reminder that LIFEQUEST wrote itself (tagged privately when created). */
export function madeByLifequest(e: GoogleEventItem): boolean {
  const p = e.extendedProperties?.private;
  return Boolean(p?.lifequestEntryId || p?.lifequestReminder);
}

export type GoogleEventsResult =
  | { status: "ok"; events: CalEvent[] }
  | { status: "not-configured" | "not-linked" | "needs-relink" | "error"; events: [] };

const TTL_MS = 2 * 60_000;
const cache = new Map<string, { at: number; events: CalEvent[] }>();

function utcStartOf(dayKey: string, shiftDays: number): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + shiftDays);
  return d.toISOString();
}

export function clearGoogleEventsCache() {
  cache.clear();
}

export interface CalendarOverviewRow {
  name: string;
  colour: string | null;
  primary: boolean;
  /** Shown in the in-app calendar? */
  included: boolean;
  /** Why not, when not. */
  reason: "lifequest" | "hidden" | null;
  /** Events Google returned for the range (null when not read). */
  events: number | null;
}

export type CalendarOverview =
  | { status: "ok"; calendars: CalendarOverviewRow[] }
  | { status: "not-configured" | "not-linked" | "needs-relink" | "error"; calendars: [] };

/**
 * Which of the owner's Google calendars LIFEQUEST can see, and how many events
 * each has in a range — so the owner can tell why something isn't showing.
 * Names only; nothing is stored or logged.
 */
export async function getCalendarOverview(deps: CalendarDeps, from: string, to: string): Promise<CalendarOverview> {
  if (!deps.cfg) return { status: "not-configured", calendars: [] };
  const row = await deps.db.googleConnection.findUnique({ where: { id: "google" } });
  if (!row) return { status: "not-linked", calendars: [] };
  try {
    const token = await getAccessToken(deps);
    const all = await listCalendars(deps.fetchImpl, token);
    const calendars = await Promise.all(
      all.map(async (c): Promise<CalendarOverviewRow> => {
        const reason = null;
        const items = await listEvents(deps.fetchImpl, token, c.id, utcStartOf(from, -1), utcStartOf(to, 2));
        const events = (c.id === row.calendarId ? items.filter((e) => !madeByLifequest(e)) : items).length;
        return {
          name: c.summaryOverride ?? c.summary ?? "Calendar",
          colour: safeColour(c.backgroundColor),
          primary: Boolean(c.primary),
          included: reason === null,
          reason,
          events,
        };
      }),
    );
    calendars.sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name));
    return { status: "ok", calendars };
  } catch (err) {
    if (err instanceof GoogleApiError && (err.status === 403 || err.status === 401)) return { status: "needs-relink", calendars: [] };
    console.error("[calendar] could not read Google calendar list");
    return { status: "error", calendars: [] };
  }
}

export async function getGoogleEvents(deps: CalendarDeps, from: string, to: string): Promise<GoogleEventsResult> {
  if (!deps.cfg) return { status: "not-configured", events: [] };
  const row = await deps.db.googleConnection.findUnique({ where: { id: "google" } });
  if (!row) return { status: "not-linked", events: [] };

  const key = `${from}|${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return { status: "ok", events: hit.events };

  try {
    const token = await getAccessToken(deps);
    const calendars = (await listCalendars(deps.fetchImpl, token)).filter(
      // Every calendar on the account. "Unticked" calendars are included too: ticks are per device,
      // so something unticked on the web may be shown on the phone. In LIFEQUEST's own calendar only
      // the owner's events are shown (deeds already come from the local ledger).
      () => true,
    );
    // Pad by a day either side for time zones, then keep only London days in range.
    const timeMin = utcStartOf(from, -1);
    const timeMax = utcStartOf(to, 2);
    const lists = await Promise.all(
      calendars.map(async (c) => {
        const items = await listEvents(deps.fetchImpl, token, c.id, timeMin, timeMax);
        const name = c.summaryOverride ?? c.summary ?? "Calendar";
        const own = c.id === row.calendarId ? items.filter((e) => !madeByLifequest(e)) : items;
        return own.flatMap((e) => mapEvent(e, name, safeColour(c.backgroundColor), from, to));
      }),
    );
    const events = lists.flat();
    cache.set(key, { at: Date.now(), events });
    if (cache.size > 50) cache.delete(cache.keys().next().value!);
    return { status: "ok", events };
  } catch (err) {
    if (err instanceof GoogleApiError && (err.status === 403 || err.status === 401)) return { status: "needs-relink", events: [] };
    console.error("[calendar] could not read Google events");
    return { status: "error", events: [] };
  }
}

export interface FoundEvent {
  calendar: string;
  title: string;
  /** YYYY-MM-DD or ISO date-time of the (first) start. */
  start: string;
  repeats: boolean;
  type: string;
  status: string;
}

export type FindResult =
  | { status: "ok"; calendars: number; found: FoundEvent[] }
  | { status: "not-configured" | "not-linked" | "needs-relink" | "error"; calendars: 0; found: [] };

/** Search every calendar on the linked account, a year either side of today. Nothing is stored or logged. */
export async function findEvents(deps: CalendarDeps, query: string, today: string): Promise<FindResult> {
  const q = query.trim().slice(0, 60);
  if (!deps.cfg) return { status: "not-configured", calendars: 0, found: [] };
  const row = await deps.db.googleConnection.findUnique({ where: { id: "google" } });
  if (!row) return { status: "not-linked", calendars: 0, found: [] };
  try {
    const token = await getAccessToken(deps);
    const cals = await listCalendars(deps.fetchImpl, token);
    const lists = await Promise.all(
      cals.map(async (c) => {
        const items = await searchEvents(deps.fetchImpl, token, c.id, q, utcStartOf(today, -400), utcStartOf(today, 400));
        const name = c.summaryOverride ?? c.summary ?? "Calendar";
        return items.map(
          (e): FoundEvent => ({
            calendar: name,
            title: (e.summary ?? "").trim() || "(No title)",
            start: e.start?.date ?? e.start?.dateTime ?? "",
            repeats: Boolean(e.recurrence?.length || e.recurringEventId),
            type: e.eventType ?? "default",
            status: e.status ?? "confirmed",
          }),
        );
      }),
    );
    return { status: "ok", calendars: cals.length, found: lists.flat().slice(0, 40) };
  } catch (err) {
    if (err instanceof GoogleApiError && (err.status === 403 || err.status === 401)) return { status: "needs-relink", calendars: 0, found: [] };
    console.error("[calendar] event search failed");
    return { status: "error", calendars: 0, found: [] };
  }
}
