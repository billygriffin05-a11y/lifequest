/**
 * Google Calendar sync against a real temp database and a FAKE Google
 * (no network). Verifies tokens are encrypted, the LIFEQUEST calendar is
 * created once, deeds sync idempotently, failures retry, and unlink revokes.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eventIdFor } from "@/features/calendar/events";
import type { Fetch } from "@/features/calendar/google/api";
import { googleConfig } from "@/features/calendar/google/config";
import {
  disconnect,
  enqueueCreate,
  enqueueDelete,
  enqueuePatch,
  getStatus,
  MAX_ATTEMPTS,
  processOutbox,
  saveConnection,
  type CalendarDeps,
} from "@/features/calendar/server/service";
import { createPrismaClient } from "@/server/db/factory";
import { makeTempDataDir, migrate } from "../support/temp-data-dir";

const { paths, cleanup } = makeTempDataDir("calendar");
let db: ReturnType<typeof createPrismaClient>;

interface Call {
  method: string;
  url: string;
  body?: string;
  auth?: string;
}

/** Tiny fake of the Google endpoints we use. */
function fakeGoogle() {
  const calls: Call[] = [];
  const events = new Map<string, unknown>();
  let failNext = 0;
  let accessCounter = 0;
  const impl: Fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : undefined;
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    calls.push({ method, url, body, auth });
    const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status });
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      accessCounter++;
      return json(200, { access_token: `access-${accessCounter}`, expires_in: 3600 });
    }
    if (url.startsWith("https://oauth2.googleapis.com/revoke")) return json(200, {});
    if (failNext > 0) {
      failNext--;
      return json(503, { error: "backendError" });
    }
    if (method === "POST" && url.endsWith("/calendars")) return json(200, { id: "lifequest-cal@group.calendar.google.com" });
    const ev = url.match(/\/events(?:\/([^/?]+))?$/);
    if (ev && method === "POST") {
      const id = (JSON.parse(body!) as { id: string }).id;
      if (events.has(id)) return json(409, { error: "duplicate" });
      events.set(id, JSON.parse(body!));
      return json(200, { id });
    }
    if (ev && method === "PATCH") {
      const id = decodeURIComponent(ev[1]!);
      if (!events.has(id)) return json(404, {});
      events.set(id, { ...(events.get(id) as object), ...JSON.parse(body!) });
      return json(200, { id });
    }
    if (ev && method === "DELETE") {
      const id = decodeURIComponent(ev[1]!);
      if (!events.delete(id)) return json(404, {});
      return new Response(null, { status: 204 });
    }
    return json(400, { error: "unexpected" });
  };
  return { impl, calls, events, failNextCalls: (n: number) => (failNext = n) };
}

const google = fakeGoogle();
const cfg = googleConfig({ GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret" });
let deps: CalendarDeps;

beforeAll(() => {
  migrate(paths);
  db = createPrismaClient(paths.dbFile);
  deps = { db, paths, cfg, fetchImpl: google.impl };
});
afterAll(async () => {
  await db.$disconnect();
  cleanup();
});

const deed = (id: string, kind = "good") => ({
  id,
  kind,
  actionName: kind === "good" ? "Gym session" : "Takeaway",
  actionIcon: "🏋️",
  honourDelta: kind === "good" ? 20 : -15,
  occurredAt: new Date("2026-11-18T09:00:00Z"),
});

describe("google calendar sync", () => {
  it("does nothing until linked", async () => {
    expect(await enqueueCreate(db, deed("before"))).toBe(false);
    expect(await processOutbox(deps)).toMatchObject({ skipped: "not-connected" });
    expect((await getStatus(db, cfg)).connected).toBe(false);
  });

  it("linking stores tokens encrypted and creates the LIFEQUEST calendar once", async () => {
    await saveConnection(deps, { accessToken: "access-0", refreshToken: "refresh-SECRET", expiresAt: new Date(Date.now() + 3_600_000) });
    const row = await db.googleConnection.findUniqueOrThrow({ where: { id: "google" } });
    expect(row.refreshTokenEncrypted).not.toContain("refresh-SECRET");
    expect(row.accessTokenEncrypted).not.toContain("access-0");
    expect(row.calendarId).toBe("lifequest-cal@group.calendar.google.com");
    expect(google.calls.filter((c) => c.url.endsWith("/calendars"))).toHaveLength(1);
    expect(await getStatus(db, cfg)).toMatchObject({ configured: true, connected: true, calendarReady: true });
  });

  it("logged deeds become calendar events; retries are idempotent", async () => {
    await enqueueCreate(db, deed("entry-1"));
    await enqueueCreate(db, deed("entry-1")); // duplicate queue item (e.g. retried request)
    await enqueueCreate(db, deed("entry-2", "bad"));
    expect(await processOutbox(deps)).toEqual({ sent: 3, failed: 0 });
    expect(google.events.size).toBe(2);
    expect((await getStatus(db, cfg)).pending).toBe(0);
  });

  it("a note updates the event description", async () => {
    await enqueuePatch(db, "entry-1", "good", "5k in 28 min");
    await processOutbox(deps);
    const ev = google.events.get(eventIdFor("entry-1")) as { description: string };
    expect(ev.description).toBe("5k in 28 min\n\nGood deed logged in LIFEQUEST.");
  });

  it("undo removes the event", async () => {
    await enqueueDelete(db, "entry-2");
    await processOutbox(deps);
    expect(google.events.size).toBe(1);
  });

  it("failures are retried later and reported without crashing", async () => {
    await enqueueCreate(db, deed("entry-3"));
    google.failNextCalls(1);
    expect(await processOutbox(deps)).toEqual({ sent: 0, failed: 1 });
    const status = await getStatus(db, cfg);
    expect(status.pending).toBe(1);
    expect(status.lastError).toMatch(/503/);
    expect(await processOutbox(deps)).toEqual({ sent: 1, failed: 0 });
    expect(google.events.size).toBe(2);
  });

  it("gives up after too many attempts", async () => {
    await enqueueCreate(db, deed("entry-4"));
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      google.failNextCalls(1);
      await processOutbox(deps);
    }
    expect((await getStatus(db, cfg)).failing).toBe(1);
    expect(await processOutbox(deps)).toEqual({ sent: 0, failed: 0 });
  });

  it("refreshes an expired access token and stores the new one encrypted", async () => {
    await db.googleConnection.update({ where: { id: "google" }, data: { accessTokenExpiresAt: new Date(0) } });
    await enqueueCreate(db, deed("entry-5"));
    await processOutbox(deps);
    const lastInsert = google.calls.filter((c) => c.method === "POST" && c.url.includes("/events")).at(-1)!;
    expect(lastInsert.auth).toMatch(/^Bearer access-\d+$/);
    expect(lastInsert.auth).not.toBe("Bearer access-0");
    const refreshCall = google.calls.find((c) => c.url.includes("/token"))!;
    expect(refreshCall.body).toContain("grant_type=refresh_token");
  });

  it("unlinking revokes at Google, forgets tokens and drops unsent items", async () => {
    await enqueueCreate(db, deed("entry-6"));
    await disconnect(deps);
    expect(google.calls.some((c) => c.url.includes("/revoke"))).toBe(true);
    expect(await db.googleConnection.count()).toBe(0);
    expect((await getStatus(db, cfg)).pending).toBe(0);
    expect(await db.auditEvent.count({ where: { action: { in: ["calendar.connect", "calendar.disconnect"] } } })).toBe(2);
  });

  it("is skipped entirely when no Google client is configured", async () => {
    expect(await processOutbox({ ...deps, cfg: null })).toMatchObject({ skipped: "not-configured" });
  });
});
