import { describe, expect, it } from "vitest";
import {
  bonusForRun,
  currentStreak,
  rankForXp,
  RANKS,
  runLengths,
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
    expect(s.get("gym")).toEqual({ current: 7, bonusXp: 25, category: "Fitness" });
    expect(s.has("takeaway")).toBe(false);
    // Undo day 4 → two runs of 3, no bonus.
    rows.push({ id: "r4", actionId: "gym", actionCategory: "Fitness", kind: "good", occurredOn: "2026-11-04", reversesEntryId: "g4" });
    s = streaksByAction(rows, "2026-11-07");
    expect(s.get("gym")).toEqual({ current: 3, bonusXp: 0, category: "Fitness" });
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
