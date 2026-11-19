import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, evaluate, hasCleanWeek, type AchievementStats } from "@/features/achievements/rules";

const none: AchievementStats = {
  goodDeeds: 0,
  bestStreak: 0,
  dragonsHatched: 0,
  rankLevel: 1,
  notes: 0,
  weeksMet: 0,
  areas: 0,
  cleanWeek: false,
};

describe("achievements", () => {
  it("has unique ids", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it("everything is locked for a new player", () => {
    expect(evaluate(none).every((a) => !a.unlocked)).toBe(true);
  });

  it("unlocks badges from stats and reports progress", () => {
    const list = evaluate({ ...none, goodDeeds: 12, bestStreak: 8, notes: 3, rankLevel: 3 });
    const by = Object.fromEntries(list.map((a) => [a.id, a]));
    expect(by["first-deed"].unlocked).toBe(true);
    expect(by["streak-7"].unlocked).toBe(true);
    expect(by["knight"].unlocked).toBe(true);
    expect(by["streak-30"]).toMatchObject({ unlocked: false, current: 8, goal: 30 });
    expect(by["scribe"]).toMatchObject({ unlocked: false, current: 3, goal: 10 });
  });
});

describe("clean week", () => {
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `2026-11-${String(from + i).padStart(2, "0")}`);

  it("needs 7 consecutive good days with no bad habits", () => {
    expect(hasCleanWeek(new Set(range(1, 7)), new Set())).toBe(true);
    expect(hasCleanWeek(new Set(range(1, 6)), new Set())).toBe(false);
    expect(hasCleanWeek(new Set(range(1, 7)), new Set(["2026-11-04"]))).toBe(false);
    expect(hasCleanWeek(new Set(range(1, 14)), new Set(["2026-11-04"]))).toBe(true); // 5th–14th is clean
  });
});
