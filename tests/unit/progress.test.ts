import { describe, expect, it } from "vitest";
import {
  bonusForRun,
  currentStreak,
  rankForXp,
  RANKS,
  runLengths,
  daysPerWeek,
  weekStart,
  weeklyBonus,
  WEEKLY_TARGET_BONUS,
  questsForDay,
  questBonusByCategory,
  QUEST_BONUS,
  heatmapWeeks,
  bossBattle,
  bossForWeek,
  honourByWeek,
  BOSS_HP,
  streaksByAction,
  type LedgerFact,
} from "@/features/honour/progress";

const days = (...keys: string[]) => new Set(keys);

describe("streaks", () => {
  it("counts consecutive days ending today", () => {
    expect(currentStreak(days("2026-11-16", "2026-11-17", "2026-11-18"), "2026-11-18")).toBe(3);
  });

  it("stays alive from yesterday until today is over", () => {
    expect(currentStreak(days("2026-11-16", "2026-11-17"), "2026-11-18")).toBe(2);
  });

  it("breaks after a missed day", () => {
    expect(currentStreak(days("2026-11-15", "2026-11-16"), "2026-11-18")).toBe(0);
  });

  it("works across month ends and UK clock changes", () => {
    expect(currentStreak(days("2026-02-27", "2026-02-28", "2026-03-01"), "2026-03-01")).toBe(3);
    expect(currentStreak(days("2026-03-28", "2026-03-29", "2026-03-30"), "2026-03-30")).toBe(3);
  });

  it("splits history into runs", () => {
    expect(runLengths(days("2026-11-01", "2026-11-02", "2026-11-05", "2026-11-06", "2026-11-07"))).toEqual([2, 3]);
    expect(runLengths(days())).toEqual([]);
  });

  it("bonus: +25 per full week, +100 per full 30 days", () => {
    expect(bonusForRun(6)).toBe(0);
    expect(bonusForRun(7)).toBe(25);
    expect(bonusForRun(14)).toBe(50);
    expect(bonusForRun(30)).toBe(4 * 25 + 100);
  });

  it("ignores bad actions and undone entries; bonus disappears when undone", () => {
    const rows: LedgerFact[] = [];
    for (let d = 1; d <= 7; d++) {
      rows.push({ id: `g${d}`, actionId: "gym", actionCategory: "Fitness", kind: "good", occurredOn: `2026-11-0${d}`, reversesEntryId: null });
    }
    rows.push({ id: "b1", actionId: "takeaway", actionCategory: "Nutrition", kind: "bad", occurredOn: "2026-11-07", reversesEntryId: null });
    let s = streaksByAction(rows, "2026-11-07");
    expect(s.get("gym")).toMatchObject({ current: 7, best: 7, bonusXp: 25, category: "Fitness" });
    expect(s.has("takeaway")).toBe(false);
    // Undo day 4 → two runs of 3, no bonus.
    rows.push({ id: "r4", actionId: "gym", actionCategory: "Fitness", kind: "good", occurredOn: "2026-11-04", reversesEntryId: "g4" });
    s = streaksByAction(rows, "2026-11-07");
    expect(s.get("gym")).toMatchObject({ current: 3, best: 3, bonusXp: 0, category: "Fitness" });
  });
});

describe("player rank", () => {
  it("has rising thresholds starting at Peasant", () => {
    expect(RANKS[0]).toEqual({ title: "Peasant", minXp: 0 });
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i].minXp).toBeGreaterThan(RANKS[i - 1].minXp);
  });

  it("maps XP to rank with progress", () => {
    expect(rankForXp(0)).toMatchObject({ title: "Peasant", level: 1, nextTitle: "Squire", nextAt: 100, percent: 0 });
    expect(rankForXp(250)).toMatchObject({ title: "Squire", level: 2, percent: 50 });
    expect(rankForXp(10_000)).toMatchObject({ title: "Legend", nextAt: null, percent: 100 });
    expect(rankForXp(-5).title).toBe("Peasant");
  });
});

describe("weekly targets", () => {
  it("weeks start on Monday", () => {
    expect(weekStart("2026-11-19")).toBe("2026-11-16"); // Thursday → Monday
    expect(weekStart("2026-11-16")).toBe("2026-11-16");
    expect(weekStart("2026-11-22")).toBe("2026-11-16"); // Sunday belongs to the same week
  });

  it("counts done-days per week and pays +15 for each week the target is met", () => {
    const d = days("2026-11-16", "2026-11-18", "2026-11-20", "2026-11-23");
    expect(daysPerWeek(d)).toEqual(new Map([["2026-11-16", 3], ["2026-11-23", 1]]));
    expect(weeklyBonus(d, 3)).toEqual({ weeksMet: 1, bonusXp: WEEKLY_TARGET_BONUS });
    expect(weeklyBonus(d, 4)).toEqual({ weeksMet: 0, bonusXp: 0 });
    expect(weeklyBonus(d, null)).toEqual({ weeksMet: 0, bonusXp: 0 });
  });

  it("streak info includes this week's count and the weekly bonus", () => {
    const rows = ["2026-11-16", "2026-11-18", "2026-11-19"].map((k, i) => ({
      id: `e${i}`, actionId: "gym", actionCategory: "Fitness", kind: "good", occurredOn: k, reversesEntryId: null,
    }));
    const s = streaksByAction(rows, "2026-11-19", new Map([["gym", 3]])).get("gym")!;
    expect(s).toMatchObject({ thisWeek: 3, weeksMet: 1, bonusXp: WEEKLY_TARGET_BONUS, current: 2, best: 2 });
  });
});

describe("daily quests", () => {
  const cands = ["a", "b", "c", "d", "e"].map((id) => ({ id, createdOn: "2026-11-01", category: id === "a" ? "Fitness" : "Study" }));

  it("picks 3 deterministic quests per day, varying by day", () => {
    const q1 = questsForDay(cands, "2026-11-19").map((q) => q.id);
    expect(q1).toHaveLength(3);
    expect(questsForDay(cands, "2026-11-19").map((q) => q.id)).toEqual(q1);
    const differs = ["2026-11-20", "2026-11-21", "2026-11-22"].some((d) => questsForDay(cands, d).map((q) => q.id).join() !== q1.join());
    expect(differs).toBe(true);
  });

  it("only uses actions that existed that day", () => {
    const late = [{ id: "z", createdOn: "2026-11-30", category: "X" }];
    expect(questsForDay(late, "2026-11-19")).toEqual([]);
  });

  it("pays +20 per completed quest, by category", () => {
    const day = "2026-11-19";
    const quests = questsForDay(cands, day);
    const done = new Map(quests.map((q) => [q.id, { days: new Set([day]) }]));
    const bonus = questBonusByCategory(cands, done, day);
    const total = [...bonus.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(3 * QUEST_BONUS);
  });
});

describe("heatmap weeks", () => {
  it("returns 12 Monday-first weeks ending this week", () => {
    const w = heatmapWeeks("2026-11-19");
    expect(w).toHaveLength(12);
    expect(w[11][0]).toBe("2026-11-16");
    expect(w[11][6]).toBe("2026-11-22");
    expect(w[0][0]).toBe("2026-08-31");
  });
});

describe("weekly boss", () => {
  it("is the same boss all week and changes between weeks", () => {
    expect(bossForWeek("2026-11-16")).toEqual(bossForWeek("2026-11-16"));
    const names = new Set(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"].map((w) => bossForWeek(w).name));
    expect(names.size).toBeGreaterThan(1);
  });

  it("good deeds damage, bad habits heal, defeat at 300 net", () => {
    expect(bossBattle("2026-11-16", 200, 50)).toMatchObject({ hpLeft: 150, defeated: false });
    expect(bossBattle("2026-11-16", 340, 40)).toMatchObject({ hpLeft: 0, defeated: true });
    expect(bossBattle("2026-11-16", 10, 90)).toMatchObject({ hpLeft: BOSS_HP, defeated: false });
  });

  it("sums Honour per week with undos netted", () => {
    const w = honourByWeek([
      { kind: "good", occurredOn: "2026-11-17", honourDelta: 20 },
      { kind: "good", occurredOn: "2026-11-17", honourDelta: -20 },
      { kind: "bad", occurredOn: "2026-11-18", honourDelta: -15 },
      { kind: "good", occurredOn: "2026-11-23", honourDelta: 10 },
    ]);
    expect(w.get("2026-11-16")).toEqual({ good: 0, bad: 15 });
    expect(w.get("2026-11-23")).toEqual({ good: 10, bad: 0 });
  });
});
