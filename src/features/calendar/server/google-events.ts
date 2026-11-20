/**
 * Read the owner's own Google Calendar events for a date range.
 * Never stored in the database or logged; a tiny in-memory cache (2 minutes)
 * avoids refetching while flicking between views.
 */
import { GoogleApiError, listCalendars, listEvents } from "../google/api";
import { mapEvent, safeColour, type CalEvent } from "../google/event-mapping";
import { getAccessToken, type CalendarDeps } from "./service";

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
      (c) => c.id !== row.calendarId && c.selected !== false && !c.hidden,
    );
    // Pad by a day either side for time zones, then keep only London days in range.
    const timeMin = utcStartOf(from, -1);
    const timeMax = utcStartOf(to, 2);
    const lists = await Promise.all(
      calendars.map(async (c) => {
        const items = await listEvents(deps.fetchImpl, token, c.id, timeMin, timeMax);
        const name = c.summaryOverride ?? c.summary ?? "Calendar";
        return items.flatMap((e) => mapEvent(e, name, safeColour(c.backgroundColor), from, to));
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
