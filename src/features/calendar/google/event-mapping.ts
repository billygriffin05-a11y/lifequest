/**
 * Turn Google events into per-day items for the in-app calendar (pure).
 * Days are Europe/London. All-day `end.date` is exclusive (Google's rule).
 * Tests: tests/unit/google-event-mapping.test.ts
 */
import type { GoogleEventItem } from "./api";

export interface CalEvent {
  id: string;
  title: string;
  calendar: string;
  /** Calendar colour (#rrggbb) or null. */
  colour: string | null;
  day: string;
  allDay: boolean;
  /** "HH:MM" London time for timed events on their first day, else null. */
  start: string | null;
  end: string | null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const londonDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });
const londonTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false });

function addDays(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function safeColour(c: string | undefined): string | null {
  return c && HEX.test(c) ? c : null;
}

/** Expand one Google event into one item per London day it touches, within [from, to]. */
export function mapEvent(e: GoogleEventItem, calendar: string, colour: string | null, from: string, to: string): CalEvent[] {
  if (e.status === "cancelled" || !e.start) return [];
  const title = (e.summary ?? "").trim() || "(No title)";
  const out: CalEvent[] = [];
  const push = (day: string, allDay: boolean, start: string | null, end: string | null) => {
    if (day >= from && day <= to) out.push({ id: `${e.id}:${day}`, title, calendar, colour, day, allDay, start, end });
  };

  if (e.start.date) {
    const first = e.start.date;
    const lastExclusive = e.end?.date && e.end.date > first ? e.end.date : addDays(first, 1);
    for (let d = first, n = 0; d < lastExclusive && n < 62; d = addDays(d, 1), n++) push(d, true, null, null);
    return out;
  }
  if (!e.start.dateTime) return [];
  const s = new Date(e.start.dateTime);
  const en = e.end?.dateTime ? new Date(e.end.dateTime) : s;
  if (Number.isNaN(s.getTime())) return [];
  const firstDay = londonDay.format(s);
  // An event ending exactly at midnight doesn't spill into the next day.
  const lastDay = londonDay.format(new Date(Math.max(s.getTime(), en.getTime() - 1)));
  for (let d = firstDay, n = 0; d <= lastDay && n < 62; d = addDays(d, 1), n++) {
    const isFirst = d === firstDay;
    const isLast = d === lastDay;
    push(d, !isFirst && !isLast, isFirst ? londonTime.format(s) : null, isLast ? londonTime.format(en) : null);
  }
  return out;
}

/** Group by day; all-day first, then by start time, then title. */
export function groupByDay(events: readonly CalEvent[]): Map<string, CalEvent[]> {
  const m = new Map<string, CalEvent[]>();
  for (const e of events) {
    const list = m.get(e.day) ?? [];
    list.push(e);
    m.set(e.day, list);
  }
  for (const list of m.values()) {
    list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || (a.start ?? "").localeCompare(b.start ?? "") || a.title.localeCompare(b.title));
  }
  return m;
}
