import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlayerProgress } from "@/features/honour/server/service";
import { getReview, getReviewRewardWeeks, resurfacedEntry, saveReview } from "@/features/report/server/review";
import { buyItem, TreasuryError } from "@/features/treasury/server/service";
import { setDragonPath } from "@/features/dragons/server/service";
import { createPrismaClient } from "@/server/db/factory";
import { makeTempDataDir, migrate } from "../support/temp-data-dir";

const { paths, cleanup } = makeTempDataDir("habits-b");
let db: ReturnType<typeof createPrismaClient>;
beforeAll(() => {
  migrate(paths);
  db = createPrismaClient(paths.dbFile);
});
afterAll(async () => {
  await db.$disconnect();
  cleanup();
});

describe("weekly review", () => {
  it("saves, validates and rewards a completed review", async () => {
    const before = (await getPlayerProgress(db, new Date("2026-11-22T12:00:00Z"))).bonusXp;
    await saveReview(db, "2026-11-16", { win: "Ran 5k", obstacle: "", change: "Sleep earlier" });
    expect(await getReview(db, "2026-11-16")).toMatchObject({ win: "Ran 5k", change: "Sleep earlier" });
    expect(await getReviewRewardWeeks(db)).toBe(1);
    expect((await getPlayerProgress(db, new Date("2026-11-22T12:00:00Z"))).bonusXp).toBe(before + 10);
    await expect(saveReview(db, "2026-11-16", { win: "x".repeat(301), obstacle: "", change: "" })).rejects.toThrow();
    await expect(saveReview(db, "not-a-week", { win: "", obstacle: "", change: "" })).rejects.toThrow();
  });

  it("resurfaces an older journal entry", async () => {
    expect(await resurfacedEntry(db, "2026-11-16")).toBeNull();
    await db.reflection.create({ data: { day: "2026-09-01", entry: "First week of training." } });
    expect(await resurfacedEntry(db, "2026-11-16")).toEqual({ day: "2026-09-01", entry: "First week of training." });
  });
});

describe("seasonal shop and paths", () => {
  it("refuses out-of-season items", async () => {
    // Winter item in autumn — refused before any gold check.
    await expect(buyItem(db, "snow-cap", new Date("2026-11-21T12:00:00Z"))).rejects.toThrow(/Frost Festival/);
    await expect(buyItem(db, "snow-cap", new Date("2026-11-21T12:00:00Z"))).rejects.toBeInstanceOf(TreasuryError);
  });

  it("only lets a grown dragon choose a path", async () => {
    await expect(setDragonPath(db, "fitness", "swift")).rejects.toThrow(/Not old enough/);
    await expect(setDragonPath(db, "fitness", "flying-pig")).rejects.toThrow();
  });
});
