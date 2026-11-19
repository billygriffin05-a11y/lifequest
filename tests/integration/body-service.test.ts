import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addRun,
  addWorkoutSet,
  changeWater,
  deleteRun,
  deleteWorkoutSet,
  getBodyOverview,
  getBodyRewards,
  saveSleep,
  saveWeight,
} from "@/features/body/server/service";
import { getStreakBonusByCategory } from "@/features/honour/server/service";
import { createPrismaClient } from "@/server/db/factory";
import { makeTempDataDir, migrate } from "../support/temp-data-dir";

const { paths, cleanup } = makeTempDataDir("body");
let db: ReturnType<typeof createPrismaClient>;
beforeAll(() => {
  migrate(paths);
  db = createPrismaClient(paths.dbFile);
});
afterAll(async () => {
  await db.$disconnect();
  cleanup();
});

const TODAY = "2026-11-19";

describe("body service", () => {
  it("logs workouts with PBs and soft-deletes", async () => {
    await addWorkoutSet(db, { occurredOn: "2026-11-18", exercise: "Bench", sets: 3, reps: 8, weightGrams: 60000 });
    const heavy = await addWorkoutSet(db, { occurredOn: TODAY, exercise: "Bench", sets: 1, reps: 3, weightGrams: 80000 });
    expect((await getBodyOverview(db, TODAY)).pbs[0]).toMatchObject({ exercise: "Bench", weightGrams: 80000 });
    await deleteWorkoutSet(db, heavy.id);
    expect((await getBodyOverview(db, TODAY)).pbs[0].weightGrams).toBe(60000);
    await expect(addWorkoutSet(db, { occurredOn: TODAY, exercise: "", sets: 1, reps: 1, weightGrams: 0 })).rejects.toThrow();
  });

  it("logs runs with totals and PBs", async () => {
    await addRun(db, { occurredOn: TODAY, distanceMetres: 5000, durationSeconds: 1500 });
    const r = await addRun(db, { occurredOn: TODAY, distanceMetres: 2000, durationSeconds: 500 });
    let o = await getBodyOverview(db, TODAY);
    expect(o.runTotalMetres).toBe(7000);
    expect(o.runPbs.fastestPace?.distanceMetres).toBe(2000);
    await deleteRun(db, r.id);
    o = await getBodyOverview(db, TODAY);
    expect(o.runTotalMetres).toBe(5000);
  });

  it("counts water, clamped at zero", async () => {
    expect(await changeWater(db, TODAY, -1)).toBe(0);
    for (let i = 0; i < 8; i++) await changeWater(db, TODAY, 1);
    expect((await getBodyOverview(db, TODAY)).waterToday).toBe(8);
  });

  it("saves sleep and weight (saving again replaces the day)", async () => {
    expect(await saveSleep(db, TODAY, "23:00", "06:00")).toBe(420);
    await saveSleep(db, TODAY, "00:00", "06:00");
    await expect(saveSleep(db, TODAY, "bad", "06:00")).rejects.toThrow(/bed and wake/);
    expect((await getBodyOverview(db, TODAY)).sleepAvg).toBe(360);
    await saveWeight(db, "2026-11-01", 81000);
    await saveWeight(db, TODAY, 80000);
    await saveWeight(db, TODAY, 79500);
    expect((await getBodyOverview(db, TODAY)).weights).toEqual([
      { day: "2026-11-01", grams: 81000 },
      { day: TODAY, grams: 79500 },
    ]);
    await expect(saveWeight(db, TODAY, 5)).rejects.toThrow(/between/);
  });

  it("feeds Fitness, Nutrition and Sleep dragons", async () => {
    await saveSleep(db, "2026-11-18", "22:00", "06:30");
    const r = await getBodyRewards(db);
    expect(r.get("Fitness")).toBe(20); // 18th (workout) + 19th (run)
    expect(r.get("Nutrition")).toBe(5);
    expect(r.get("Sleep")).toBe(5); // only the 8h30 night
    const bonus = await getStreakBonusByCategory(db, new Date(`${TODAY}T12:00:00Z`));
    expect(bonus.get("Fitness")).toBeGreaterThanOrEqual(20);
  });
});
