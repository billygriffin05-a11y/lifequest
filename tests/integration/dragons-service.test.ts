import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDragons } from "@/features/dragons/server/service";
import { createAction, logAction, undoEntry } from "@/features/honour/server/service";
import { createPrismaClient } from "@/server/db/factory";
import { makeTempDataDir, migrate } from "../support/temp-data-dir";

const { paths, cleanup } = makeTempDataDir("dragons");
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
const log = (actionId: string, at = NOW) => logAction(db, { actionId, idempotencyKey: randomUUID() }, at);
const dragon = async (id: string, at = NOW) => (await getDragons(db, at)).find((d) => d.area.id === id)!;

describe("dragons service", () => {
  it("starts with 8 restless eggs", async () => {
    const all = await getDragons(db, NOW);
    expect(all).toHaveLength(8);
    expect(all.every((d) => d.growth.stage === 0 && d.mood === "restless")).toBe(true);
  });

  it("good actions grow only their own area's dragon", async () => {
    const gym = await createAction(db, { name: "Gym", kind: "good", points: 40, icon: "🏋️", category: "Fitness" });
    await log(gym.id);
    await log(gym.id);
    const fitness = await dragon("fitness");
    expect(fitness.growth).toMatchObject({ xp: 80, stage: 2, stageName: "Hatchling" });
    expect(fitness.mood).toBe("joyful");
    expect((await dragon("finance")).growth.xp).toBe(0);
  });

  it("bad actions sour the mood but never shrink the dragon", async () => {
    const takeaway = await createAction(db, { name: "Takeaway", kind: "bad", points: 100, icon: "🍔", category: "fitness" });
    await log(takeaway.id);
    const fitness = await dragon("fitness");
    expect(fitness.growth.xp).toBe(80);
    expect(fitness.mood).toBe("grumpy");
    expect(fitness.recentHonour).toBe(-20);
  });

  it("an undo of a bad entry restores the mood", async () => {
    const bad = await db.pointEntry.findFirstOrThrow({ where: { kind: "bad" } });
    await undoEntry(db, { entryId: bad.id, idempotencyKey: randomUUID() }, NOW);
    expect((await dragon("fitness")).mood).toBe("joyful");
  });

  it("unknown categories feed the Other dragon", async () => {
    const garden = await createAction(db, { name: "Gardening", kind: "good", points: 25, icon: "🌱", category: "Garden" });
    await log(garden.id);
    expect((await dragon("other")).growth.xp).toBe(25);
  });

  it("mood only counts the last 7 days; growth counts all time", async () => {
    const tenDaysLater = new Date(NOW.getTime() + 10 * 86_400_000);
    const fitness = await dragon("fitness", tenDaysLater);
    expect(fitness.mood).toBe("restless");
    expect(fitness.growth.xp).toBe(80);
  });

  it("the entry keeps its category even if the action is recategorised later", async () => {
    const entry = await db.pointEntry.findFirstOrThrow({ where: { actionName: "Gym" } });
    expect(entry.actionCategory).toBe("Fitness");
  });
});
