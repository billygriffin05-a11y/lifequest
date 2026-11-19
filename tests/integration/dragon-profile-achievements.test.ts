import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAchievements } from "@/features/achievements/server/service";
import { getDragonDetail, getDragons, renameDragon } from "@/features/dragons/server/service";
import { createAction, getPlayerProgress, logAction, undoEntry, updateAction } from "@/features/honour/server/service";
import { createPrismaClient } from "@/server/db/factory";
import { makeTempDataDir, migrate } from "../support/temp-data-dir";

const { paths, cleanup } = makeTempDataDir("profile");
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
const log = (id: string, at: Date) => logAction(db, { actionId: id, idempotencyKey: randomUUID() }, at);

describe("weekly targets", () => {
  it("shows this week's progress and pays +15 when met", async () => {
    const gym = await createAction(db, { name: "Gym", kind: "good", points: 10, icon: "🏋️", category: "Fitness", weeklyTarget: 3 });
    await log(gym.id, day(16));
    await log(gym.id, day(18));
    let p = await getPlayerProgress(db, day(18));
    expect(p.weekly[gym.id]).toEqual({ done: 2, target: 3 });
    expect(p.bonusXp).toBe(0);
    await log(gym.id, day(19));
    p = await getPlayerProgress(db, day(19));
    expect(p.weekly[gym.id]).toEqual({ done: 3, target: 3 });
    expect(p.bonusXp).toBe(15);
  });

  it("bad actions can't have a weekly goal", async () => {
    const bad = await createAction(db, { name: "Takeaway", kind: "bad", points: 5, icon: "🍔", category: "Nutrition", weeklyTarget: 2 });
    expect(bad.weeklyTarget).toBeNull();
    const edited = await updateAction(db, bad.id, { name: "Takeaway", kind: "bad", points: 5, icon: "🍔", category: "Nutrition", weeklyTarget: 4 });
    expect(edited.weeklyTarget).toBeNull();
  });
});

describe("dragon names and detail", () => {
  it("renames a dragon and resets to default with an empty name", async () => {
    await renameDragon(db, { areaId: "fitness", name: "  Sparky  " });
    let fitness = (await getDragons(db, day(19))).find((d) => d.area.id === "fitness")!;
    expect(fitness).toMatchObject({ displayName: "Sparky", customName: "Sparky" });
    await renameDragon(db, { areaId: "fitness", name: "" });
    fitness = (await getDragons(db, day(19))).find((d) => d.area.id === "fitness")!;
    expect(fitness).toMatchObject({ displayName: "Emberclaw", customName: null });
  });

  it("rejects unknown areas and over-long names", async () => {
    await expect(renameDragon(db, { areaId: "nope", name: "x" })).rejects.toThrow();
    await expect(renameDragon(db, { areaId: "fitness", name: "x".repeat(25) })).rejects.toThrow();
  });

  it("detail page has a timeline and recent deeds for that area only", async () => {
    const d = (await getDragonDetail(db, "fitness", day(19)))!;
    expect(d.timeline[0].reachedOn).toBe("2026-11-16");
    expect(d.recent.map((e) => e.actionName)).toEqual(["Gym", "Gym", "Gym"]);
    expect(await getDragonDetail(db, "nope", day(19))).toBeNull();
  });
});

describe("achievements", () => {
  it("unlocks from real progress and re-locks after an undo", async () => {
    let byId = Object.fromEntries((await getAchievements(db, day(19))).map((a) => [a.id, a]));
    expect(byId["first-deed"].unlocked).toBe(true);
    expect(byId["weekly"].unlocked).toBe(true);
    expect(byId["hatch"].unlocked).toBe(true); // 45 XP fitness → Hatching
    const last = await db.pointEntry.findFirstOrThrow({ where: { occurredOn: "2026-11-19" } });
    await undoEntry(db, { entryId: last.id, idempotencyKey: randomUUID() }, day(19));
    byId = Object.fromEntries((await getAchievements(db, day(19))).map((a) => [a.id, a]));
    expect(byId["weekly"].unlocked).toBe(false);
  });
});
