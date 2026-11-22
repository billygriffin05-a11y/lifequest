/**
 * Reading the owner's own Google events, against a temp database and a FAKE
 * Google (no network). Covers: LIFEQUEST's own calendar skipped, hidden
 * calendars skipped, recurring "Pay rent" shown, old-scope connections asked
 * to re-link, and not-linked state.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Fetch } from "@/features/calendar/google/api";
import { clearGoogleEventsCache, findEvents, getCalendarOverview, getGoogleEvents } from "@/features/calendar/server/google-events";
import { saveConnection, type CalendarDeps } from "@/features/calendar/server/service";
import { createPrismaClient } from "@/server/db/factory";
import { makeTempDataDir, migrate } from "../support/temp-data-dir";

const { paths, cleanup } = makeTempDataDir("google-events");
let db: ReturnType<typeof createPrismaClient>;
const cfg = { clientId: "id", clientSecret: "secret", redirectUri: "http://localhost:3000/cb" };

let readStatus = 200;
const fetchImpl: Fetch = async (input, init) => {
  const url = String(input);
  const method = init?.method ?? "GET";
  const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status });
  if (url.startsWith("https://oauth2.googleapis.com/token")) return json(200, { access_token: "a", expires_in: 3600 });
  if (method === "POST" && url.endsWith("/calendars")) return json(200, { id: "lq@group" });
  if (readStatus !== 200) return json(readStatus, { error: { status: "PERMISSION_DENIED" } });
  if (url.includes("/users/me/calendarList")) {
    return json(200, {
      items: [
        { id: "primary@x", summary: "Billy", backgroundColor: "#7986cb", selected: true, primary: true },
        { id: "lq@group", summary: "LIFEQUEST", selected: true },
        { id: "hidden@x", summary: "Old", selected: false },
      ],
    });
  }
  if (url.includes("/events?") && url.includes("q=")) {
    if (!url.includes(encodeURIComponent("hidden@x"))) return json(200, { items: [] });
    return json(200, { items: [{ id: "r", summary: "Pay rent", start: { date: "2026-01-01" }, recurrence: ["RRULE:FREQ=MONTHLY"] }] });
  }
  if (url.includes(`/calendars/${encodeURIComponent("lq@group")}/events`)) {
    return json(200, {
      items: [
        { id: "lqdeed", summary: "✅ Gym", start: { dateTime: "2026-11-05T09:00:00Z" }, extendedProperties: { private: { lifequestEntryId: "e1" } } },
        { id: "lqremind0001_20261105", summary: "Log your deeds", start: { dateTime: "2026-11-05T20:00:00Z" }, extendedProperties: { private: { lifequestReminder: "daily" } } },
        { id: "own1", summary: "Rent (owner-made)", start: { date: "2026-11-01" }, end: { date: "2026-11-02" } },
      ],
    });
  }
  if (url.includes(`/calendars/${encodeURIComponent("hidden@x")}/events`)) {
    return json(200, { items: [{ id: "h1", summary: "Pay rent", start: { date: "2026-11-01" }, end: { date: "2026-11-02" } }] });
  }
  if (url.includes(`/calendars/${encodeURIComponent("primary@x")}/events`)) {
    return json(200, {
      items: [
        { id: "rent_20261201", summary: "Pay rent", start: { date: "2026-12-01" }, end: { date: "2026-12-02" } },
        { id: "rent_20261101", summary: "Pay rent", start: { date: "2026-11-01" }, end: { date: "2026-11-02" } },
        { id: "dentist", summary: "Dentist", start: { dateTime: "2026-11-20T09:30:00Z" }, end: { dateTime: "2026-11-20T10:00:00Z" } },
      ],
    });
  }
  throw new Error(`unexpected ${method} ${url}`);
};

let deps: CalendarDeps;
beforeAll(() => {
  migrate(paths);
  db = createPrismaClient(paths.dbFile);
  deps = { db, paths, cfg, fetchImpl };
});
afterAll(async () => {
  await db.$disconnect();
  cleanup();
});

describe("Google events in the in-app calendar", () => {
  it("says not linked before Google is connected", async () => {
    expect((await getGoogleEvents(deps, "2026-11-01", "2026-11-30")).status).toBe("not-linked");
    expect((await getGoogleEvents({ ...deps, cfg: null }, "2026-11-01", "2026-11-30")).status).toBe("not-configured");
  });

  it("shows the owner's events, skipping only LIFEQUEST's own calendar", async () => {
    await saveConnection(deps, { accessToken: "a", refreshToken: "r", expiresAt: new Date(Date.now() + 3_600_000) });
    const r = await getGoogleEvents(deps, "2026-11-01", "2026-11-30");
    expect(r.status).toBe("ok");
    expect(r.events.map((e) => [e.day, e.title, e.calendar])).toEqual([
      ["2026-11-01", "Pay rent", "Billy"],
      ["2026-11-20", "Dentist", "Billy"],
      ["2026-11-01", "Rent (owner-made)", "LIFEQUEST"],
      ["2026-11-01", "Pay rent", "Old"],
    ]);
    expect(r.events[0]).toMatchObject({ calendar: "Billy", colour: "#7986cb", allDay: true });
  });

  it("explains which calendars are read and how many events each has", async () => {
    const o = await getCalendarOverview(deps, "2026-11-01", "2026-11-30");
    expect(o.status).toBe("ok");
    expect(o.calendars).toEqual([
      { name: "Billy", colour: "#7986cb", primary: true, included: true, reason: null, events: 3 },
      { name: "LIFEQUEST", colour: null, primary: false, included: true, reason: null, events: 1 },
      { name: "Old", colour: null, primary: false, included: true, reason: null, events: 1 },
    ]);
  });

  it("finds an event across every calendar, including unticked ones", async () => {
    const f = await findEvents(deps, "rent", "2026-11-21");
    expect(f).toMatchObject({ status: "ok", calendars: 3, found: [{ calendar: "Old", title: "Pay rent", start: "2026-01-01", repeats: true }] });
  });

  it("asks to re-link when the old connection lacks read access", async () => {
    clearGoogleEventsCache();
    readStatus = 403;
    expect((await getGoogleEvents(deps, "2026-11-01", "2026-11-30")).status).toBe("needs-relink");
    readStatus = 500;
    expect((await getGoogleEvents(deps, "2026-12-01", "2026-12-31")).status).toBe("error");
    readStatus = 200;
  });
});
