import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDragons } from "@/features/dragons/server/service";
import { createAction, getPlayerProgress, getTodayEntries, logAction, setEntryNote, undoEntry } from "@/features/honour/server/service";
import { createPrismaClient } from "@/server/db/factory";
import { makeTempDataDir, migrate } from "../support/temp-data-dir";

const { paths, cleanup } = makeTempDataDir("progress");
let db: ReturnType<typeof createPrismaClient>;

beforeAll(() => {
  migrate(paths);
  db = createPrismaClient(paths.dbFile);
});
afterAll(async () => {
  await db.$disconnect();
  cleanup();
});

const day = (d: number) => new Date(Date.UTC(2026, 10, d, 12));
const log = (actionId: string, at: Date) => logAction(db, { actionId, idempotencyKey: randomUUID() }, at);

describe("streaks, bonus XP and rank", () => {
  it("a 7-day streak adds +25 bonus XP to the player and the area dragon", async () => {
    const gym = await createAction(db, { name: "Gym", kind: "good", points: 10, icon: "🏋️", category: "Fitness" });
    for (let d = 1; d <= 7; d++) await log(gym.id, day(d));
    const p = await getPlayerProgress(db, day(7));
    expect(p).toMatchObject({ baseXp: 70, bonusXp: 25, totalXp: 95 });
    expect(p.streaks[gym.id]).toBe(7);
    expect(p.rank.title).toBe("Peasant");
    const fitness = (await getDragons(db, day(7))).find((d) => d.area.id === "fitness")!;
    expect(fitness.growth.xp).toBe(95);
  });

  it("undoing a day in the middle removes the bonus", async () => {
    const mid = await db.pointEntry.findFirstOrThrow({ where: { occurredOn: "2026-11-04" } });
    await undoEntry(db, { entryId: mid.id, idempotencyKey: randomUUID() }, day(7));
    const p = await getPlayerProgress(db, day(7));
    expect(p).toMatchObject({ baseXp: 60, bonusXp: 0 });
    expect(Object.values(p.streaks)).toEqual([3]);
  });

  it("rank rises with XP", async () => {
    const big = await createAction(db, { name: "Marathon", kind: "good", points: 200, icon: "🏃", category: "Fitness" });
    await log(big.id, day(8));
    expect((await getPlayerProgress(db, day(8))).rank.title).toBe("Squire");
  });
});

describe("notes", () => {
  it("adds, edits and clears a note without changing scores", async () => {
    const [entry] = await getTodayEntries(db, day(8));
    const before = await getPlayerProgress(db, day(8));
    await setEntryNote(db, entry.id, "26.2 miles!");
    expect((await getTodayEntries(db, day(8)))[0].note).toBe("26.2 miles!");
    await setEntryNote(db, entry.id, null);
    expect((await getTodayEntries(db, day(8)))[0].note).toBeNull();
    expect(await getPlayerProgress(db, day(8))).toEqual(before);
    expect(await db.auditEvent.count({ where: { action: "honour.note" } })).toBe(2);
  });

  it("can't be put on an undo row", async () => {
    const reversal = await db.pointEntry.findFirstOrThrow({ where: { reversesEntryId: { not: null } } });
    await expect(setEntryNote(db, reversal.id, "nope")).rejects.toThrow(/undo/);
  });
});
