/**
 * Reading the owner's own Google events, against a temp database and a FAKE
 * Google (no network). Covers: LIFEQUEST's own calendar skipped, hidden
 * calendars skipped, recurring "Pay rent" shown, old-scope connections asked
 * to re-link, and not-linked state.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Fetch } from "@/features/calendar/google/api";
import { clearGoogleEventsCache, getGoogleEvents } from "@/features/calendar/server/google-events";
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
        { id: "primary@x", summary: "Billy", backgroundColor: "#7986cb", selected: true },
        { id: "lq@group", summary: "LIFEQUEST", selected: true },
        { id: "hidden@x", summary: "Old", selected: false },
      ],
    });
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

  it("shows the owner's events, skipping LIFEQUEST's own and hidden calendars", async () => {
    await saveConnection(deps, { accessToken: "a", refreshToken: "r", expiresAt: new Date(Date.now() + 3_600_000) });
    const r = await getGoogleEvents(deps, "2026-11-01", "2026-11-30");
    expect(r.status).toBe("ok");
    expect(r.events.map((e) => [e.day, e.title, e.start])).toEqual([
      ["2026-11-01", "Pay rent", null],
      ["2026-11-20", "Dentist", "09:30"],
    ]);
    expect(r.events[0]).toMatchObject({ calendar: "Billy", colour: "#7986cb", allDay: true });
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
