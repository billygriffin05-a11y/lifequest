import { describe, expect, it } from "vitest";
import { addDays, averageMood, mindXp, nextReview, readingPercent } from "@/features/mind/rules";
import { STARTER_DECK } from "@/features/mind/starter-deck";

describe("spaced repetition", () => {
  it("moves right answers up a box with growing gaps", () => {
    expect(nextReview(1, true, "2026-11-19")).toEqual({ box: 2, dueOn: "2026-11-21" });
    expect(nextReview(4, true, "2026-11-19")).toEqual({ box: 5, dueOn: "2026-12-05" });
    expect(nextReview(5, true, "2026-11-19")).toEqual({ box: 5, dueOn: "2026-12-05" });
  });

  it("sends misses back to box 1 for tomorrow", () => {
    expect(nextReview(5, false, "2026-12-31")).toEqual({ box: 1, dueOn: "2027-01-01" });
  });

  it("adds days across month and BST changes", () => {
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("mind helpers", () => {
  it("reading percent is capped and safe", () => {
    expect(readingPercent(50, 200)).toBe(25);
    expect(readingPercent(300, 200)).toBe(100);
    expect(readingPercent(1, 0)).toBe(0);
  });

  it("averages mood to one decimal", () => {
    expect(averageMood([])).toBeNull();
    expect(averageMood([3, 4, 4])).toBe(3.7);
  });

  it("starter deck has unique keys across all five domains", () => {
    expect(new Set(STARTER_DECK.map((c) => c.key)).size).toBe(STARTER_DECK.length);
    expect(new Set(STARTER_DECK.map((c) => c.topic)).size).toBe(5);
  });
});

describe("mind rewards", () => {
  it("counts reading days once, books, study days and focus blocks", () => {
    const xp = mindXp({
      readingDays: ["a", "a", "b"],
      booksFinished: 1,
      reviewDays: [...Array(10).fill("a"), ...Array(9).fill("b")],
      focus: [
        { day: "a", minutes: 25 },
        { day: "a", minutes: 25 },
        { day: "b", minutes: 15 },
        { day: "b", minutes: 15 },
      ],
      journalDays: ["a", "a"],
    });
    expect(xp.get("Reading")).toBe(10 + 50);
    expect(xp.get("Study")).toBe(5 + 3 * 5); // 1 study day; focus a=50m→2 blocks, b=30m→1 block
    expect(xp.get("Habits")).toBe(3);
  });

  it("caps focus at 12 hours a day", () => {
    const focus = Array.from({ length: 40 }, () => ({ day: "a", minutes: 50 }));
    expect(mindXp({ readingDays: [], booksFinished: 0, reviewDays: [], focus, journalDays: [] }).get("Study")).toBe((720 / 25 | 0) * 5);
  });
});
