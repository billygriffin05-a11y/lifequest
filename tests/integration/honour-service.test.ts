import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addStarterActions,
  createAction,
  getDailyTrend,
  getLoggedTodayActionIds,
  getSummary,
  getTodayEntries,
  listActions,
  logAction,
  setArchived,
  undoEntry,
  updateAction,
} from "@/features/honour/server/service";
import { createPrismaClient } from "@/server/db/factory";
import { makeTempDataDir, migrate } from "../support/temp-data-dir";

const { paths, cleanup } = makeTempDataDir("honour");
let db: ReturnType<typeof createPrismaClient>;

beforeAll(() => {
  migrate(paths);
  db = createPrismaClient(paths.dbFile);
});
afterAll(async () => {
  await db.$disconnect();
  cleanup();
});

const NOW = new Date("2026-11-18T12:00:00Z");
const YESTERDAY = new Date("2026-11-17T12:00:00Z");
const TOMORROW = new Date("2026-11-19T12:00:00Z");
const log = (actionId: string, at: Date, key = randomUUID()) => logAction(db, { actionId, idempotencyKey: key }, at);

describe("honour service", () => {
  it("custom actions persist across restarts (stay in the list the next day)", async () => {
    await createAction(db, { name: "Gym session", kind: "good", points: 20, icon: "🏋️", category: "Fitness" });
    await createAction(db, { name: "Takeaway", kind: "bad", points: 15, icon: "🍔", category: "Nutrition" });
    const fresh = createPrismaClient(paths.dbFile);
    try {
      expect((await listActions(fresh)).map((a) => a.name)).toEqual(["Gym session", "Takeaway"]);
    } finally {
      await fresh.$disconnect();
    }
  });

  it("logging computes Honour and XP server-side", async () => {
    const [gym, takeaway] = await listActions(db);
    await log(gym.id, NOW);
    await log(takeaway.id, NOW);
    expect(await getSummary(db, NOW)).toEqual({ honour: 5, xp: 20, today: { good: 20, bad: 15, net: 5 } });
  });

  it("a retried log with the same idempotency key does not double-count", async () => {
    const [gym] = await listActions(db);
    const key = randomUUID();
    const a = await log(gym.id, YESTERDAY, key);
    const b = await log(gym.id, YESTERDAY, key);
    expect(b.id).toBe(a.id);
    expect((await getSummary(db, NOW)).honour).toBe(25);
  });

  it("each action counts at most once per day", async () => {
    const [gym, takeaway] = await listActions(db);
    await expect(log(gym.id, NOW)).rejects.toThrow(/Already logged today/);
    await expect(log(takeaway.id, NOW)).rejects.toThrow(/Already logged today/);
    expect(await getLoggedTodayActionIds(db, NOW)).toEqual(new Set([gym.id, takeaway.id]));
    // A new day is a fresh start.
    expect(await getLoggedTodayActionIds(db, TOMORROW)).toEqual(new Set());
  });

  it("undo writes a reversal, can only happen once, keeps history, and frees the action for today", async () => {
    const [gym] = await listActions(db);
    const entry = await db.pointEntry.findFirstOrThrow({ where: { actionId: gym.id, occurredOn: "2026-11-18", reversesEntryId: null } });
    await undoEntry(db, { entryId: entry.id, idempotencyKey: randomUUID() }, NOW);
    await expect(undoEntry(db, { entryId: entry.id, idempotencyKey: randomUUID() }, NOW)).rejects.toThrow(/already/);
    const today = await getTodayEntries(db, NOW);
    expect(today.find((e) => e.id === entry.id)?.undone).toBe(true);
    expect((await getSummary(db, NOW)).honour).toBe(5);
    expect(await db.pointEntry.count()).toBe(4); // nothing deleted: 3 originals + 1 reversal
    expect((await getLoggedTodayActionIds(db, NOW)).has(gym.id)).toBe(false);

    await log(gym.id, NOW); // allowed again after the undo
    expect((await getSummary(db, NOW)).honour).toBe(25);
  });

  it("editing an action changes future logs only", async () => {
    const [gym] = await listActions(db);
    await updateAction(db, gym.id, { name: "Gym session", kind: "good", points: 50, icon: "🏋️", category: "Fitness" });
    await log(gym.id, TOMORROW);
    const entries = await db.pointEntry.findMany({ where: { actionId: gym.id, reversesEntryId: null } });
    expect(entries.map((e) => e.honourDelta).sort((x, y) => x - y)).toEqual([20, 20, 20, 50]);
  });

  it("archived actions keep history but cannot be logged until restored", async () => {
    const [, takeaway] = await listActions(db);
    await setArchived(db, takeaway.id, true);
    expect((await listActions(db)).map((a) => a.name)).toEqual(["Gym session"]);
    await expect(log(takeaway.id, TOMORROW)).rejects.toThrow(/archived/);
    expect(await db.pointEntry.count({ where: { actionId: takeaway.id } })).toBe(1);
    await setArchived(db, takeaway.id, false);
    expect((await listActions(db)).length).toBe(2);
  });

  it("starter examples are only added to an empty list", async () => {
    expect(await addStarterActions(db)).toBe(0);
  });

  it("every ledger write is audited with an idempotency key", async () => {
    expect(await db.auditEvent.count({ where: { action: "honour.log" } })).toBe(5);
    expect(await db.auditEvent.count({ where: { action: "honour.undo" } })).toBe(1);
  });

  it("daily trend returns one good and one bad value per day for the range", async () => {
    const trend = await getDailyTrend(db, 7, NOW);
    expect(trend).toHaveLength(7);
    expect(trend[6].date).toBe("2026-11-18");
    const fromLedger = await db.pointEntry.findMany({ where: { occurredOn: "2026-11-18" } });
    expect(trend[6].good).toBe(fromLedger.filter((e) => e.kind === "good").reduce((n, e) => n + e.honourDelta, 0));
    expect(trend[6].bad).toBe(-fromLedger.filter((e) => e.kind === "bad").reduce((n, e) => n + e.honourDelta, 0));
    expect(trend[5]).toEqual({ date: "2026-11-17", good: 20, bad: 0 });
    expect(trend.slice(0, 5).every((d) => d.good === 0 && d.bad === 0)).toBe(true);
  });

  it("entries are counted on the Europe/London day", async () => {
    const [gym] = await listActions(db);
    // 23:30 UTC on 31 May = 00:30 BST on 1 June
    const e = await log(gym.id, new Date("2026-05-31T23:30:00Z"));
    expect(e.occurredOn).toBe("2026-06-01");
  });
});
