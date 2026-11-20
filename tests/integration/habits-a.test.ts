import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAction, listActions } from "@/features/honour/server/service";
import { runReminders } from "@/features/notifications/server/runner";
import { getOrCreateVapidKeys, saveSubscription, type Sender } from "@/features/notifications/server/service";
import { createPrismaClient } from "@/server/db/factory";
import { makeTempDataDir, migrate } from "../support/temp-data-dir";

const { paths, cleanup } = makeTempDataDir("habits-a");
let db: ReturnType<typeof createPrismaClient>;
beforeAll(() => {
  migrate(paths);
  db = createPrismaClient(paths.dbFile);
});
afterAll(async () => {
  await db.$disconnect();
  cleanup();
});

describe("if-then plans", () => {
  it("saves a cue and time; the time is dropped without a cue", async () => {
    await createAction(db, { name: "Study", kind: "good", points: 10, icon: "📚", category: "Study", cue: "After dinner", cueTime: "19:30" });
    await createAction(db, { name: "Walk", kind: "good", points: 5, icon: "🚶", category: "Fitness", cue: "", cueTime: "08:00" });
    const [study, walk] = await listActions(db);
    expect(study).toMatchObject({ cue: "After dinner", cueTime: "19:30" });
    expect(walk).toMatchObject({ cue: null, cueTime: null });
    await expect(createAction(db, { name: "Bad", kind: "good", points: 5, icon: "x", category: "x", cueTime: "25:00", cue: "x" })).rejects.toThrow();
  });
});

describe("push reminders", () => {
  it("creates owner-only VAPID keys once", () => {
    const a = getOrCreateVapidKeys(paths);
    expect(getOrCreateVapidKeys(paths)).toEqual(a);
    expect(a.publicKey.length).toBeGreaterThan(40);
  });

  it("sends each due reminder once, and drops expired devices", async () => {
    // 19:45 London in November (GMT) — the 19:30 plan is due.
    const now = new Date("2026-11-20T19:45:00Z");
    const sent: string[] = [];
    const send: Sender = async (_sub, payload) => {
      sent.push(JSON.parse(payload).title);
    };
    expect(await runReminders(db, paths, now, send)).toEqual({ sent: 0 }); // no devices yet
    await saveSubscription(db, { endpoint: "https://web.push.apple.com/device-1", keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) } });
    expect(await runReminders(db, paths, now, send)).toEqual({ sent: 1 });
    expect(sent).toEqual(["📚 After dinner"]);
    expect(await runReminders(db, paths, now, send)).toEqual({ sent: 0 }); // not twice

    const gone: Sender = async () => {
      throw Object.assign(new Error("gone"), { statusCode: 410 });
    };
    await runReminders(db, paths, new Date("2026-11-21T19:45:00Z"), gone);
    expect(await db.pushSubscription.count()).toBe(0);
  });
});
