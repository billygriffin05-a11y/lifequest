import { describe, expect, it } from "vitest";
import { liftSuggestions } from "@/features/body/rules";
import { byTopic, scaledScore, shuffle } from "@/features/mind/exam";
import { intervalFor, nextState, retrievability, schedule } from "@/features/mind/fsrs";
import { findRecurring, nextDue, occurrences, payeeKey } from "@/features/finance/recurring";

describe("FSRS scheduling", () => {
  it("new cards: Again tomorrow, Good a few days, Easy longest", () => {
    const fresh = { stability: null, difficulty: null, lastReviewOn: null };
    const again = schedule(fresh, 1, "2026-11-21");
    const good = schedule(fresh, 3, "2026-11-21");
    const easy = schedule(fresh, 4, "2026-11-21");
    expect(again.dueOn).toBe("2026-11-22");
    expect(good.interval).toBeGreaterThanOrEqual(3);
    expect(easy.interval).toBeGreaterThan(good.interval);
  });

  it("intervals grow with successful reviews and shrink on a lapse", () => {
    let s = schedule({ stability: null, difficulty: null, lastReviewOn: null }, 3, "2026-11-01");
    const first = s.interval;
    s = schedule(s, 3, s.dueOn);
    expect(s.interval).toBeGreaterThan(first);
    const lapse = nextState({ stability: s.stability, difficulty: s.difficulty }, 1, s.interval);
    expect(lapse.stability).toBeLessThan(s.stability);
    expect(lapse.difficulty).toBeGreaterThan(s.difficulty);
  });

  it("targets 90% recall: at the interval, retrievability ≈ 0.9", () => {
    expect(retrievability(intervalFor(10), 10)).toBeCloseTo(0.9, 1);
    expect(intervalFor(10_000)).toBe(365);
  });
});

describe("mock exam scoring", () => {
  it("scales linearly to 100–900 and groups by topic", () => {
    expect(scaledScore(0, 10)).toBe(100);
    expect(scaledScore(10, 10)).toBe(900);
    expect(scaledScore(81, 100)).toBe(748);
    expect(byTopic([{ topic: "B", correct: true }, { topic: "A", correct: false }, { topic: "B", correct: false }])).toEqual([
      { topic: "A", total: 1, correct: 0 },
      { topic: "B", total: 2, correct: 1 },
    ]);
  });

  it("shuffles deterministically without losing items", () => {
    const xs = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(xs, 42)).toEqual(shuffle(xs, 42));
    expect([...shuffle(xs, 42)].sort((a, b) => a - b)).toEqual(xs);
    expect(shuffle(xs, 42)).not.toEqual(xs);
  });
});

describe("lift suggestions (double progression)", () => {
  it("adds a rep, then weight at the top of the range", () => {
    const s = liftSuggestions([
      { occurredOn: "2026-11-10", exercise: "Bench", sets: 3, reps: 10, weightGrams: 60000 },
      { occurredOn: "2026-11-12", exercise: "bench ", sets: 3, reps: 8, weightGrams: 62500 },
      { occurredOn: "2026-11-12", exercise: "Squat", sets: 3, reps: 10, weightGrams: 80000 },
      { occurredOn: "2026-11-11", exercise: "Pull-up", sets: 3, reps: 7, weightGrams: 0 },
    ]);
    const by = Object.fromEntries(s.map((x) => [x.exercise.toLowerCase(), x]));
    expect(by.bench.next).toEqual({ weightGrams: 62500, reps: 9, sets: 3 });
    expect(by.squat).toMatchObject({ reason: "add-weight", next: { weightGrams: 82500, reps: 6 } });
    expect(by["pull-up"]).toMatchObject({ reason: "bodyweight", next: { reps: 8 } });
  });
});

describe("bills and subscriptions finder", () => {
  const month = (desc: string, pence: number, days: string[]) => days.map((d) => ({ occurredOn: d, amountPence: pence, description: desc }));

  it("finds monthly and weekly payments, ignoring one-offs and income", () => {
    const r = findRecurring([
      ...month("NETFLIX.COM 4029357733", 1099, ["2026-08-03", "2026-09-03", "2026-10-03", "2026-11-03"]),
      ...month("Pay rent", 65000, ["2026-09-01", "2026-10-01", "2026-11-01"]),
      ...month("Gym Club", 2500, ["2026-11-01", "2026-11-08", "2026-11-15"]),
      ...month("Amazon", 1999, ["2026-09-14"]),
      ...month("Salary", -200000, ["2026-09-28", "2026-10-28", "2026-11-28"]),
    ]);
    expect(r.map((x) => [x.cadence, x.amountPence, x.yearlyPence])).toEqual([
      ["monthly", 65000, 780000],
      ["weekly", 2500, 130000],
      ["monthly", 1099, 13188],
    ]);
    expect(r[0].nextOn).toBe("2026-12-01");
  });

  it("ignores irregular amounts and gaps", () => {
    expect(findRecurring(month("Tesco", 3000, ["2026-09-01", "2026-09-04", "2026-10-20", "2026-11-01"]))).toEqual([]);
    expect(
      findRecurring([
        { occurredOn: "2026-09-01", amountPence: 1000, description: "Shop" },
        { occurredOn: "2026-10-01", amountPence: 5000, description: "Shop" },
        { occurredOn: "2026-11-01", amountPence: 1000, description: "Shop" },
      ]),
    ).toEqual([]);
  });

  it("normalises payees and rolls dates forward", () => {
    expect(payeeKey("CARD 1234 NETFLIX.COM 4029357733")).toBe(payeeKey("Netflix.com 99887766"));
    expect(nextDue({ cadence: "monthly", nextOn: "2026-10-31" }, "2026-11-21")).toBe("2026-11-30");
    expect(occurrences({ cadence: "weekly", nextOn: "2026-11-02" }, "2026-11-01", "2026-11-20")).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
  });
});
