import { describe, expect, it } from "vitest";
import { summariseWeek, weekDays, type DeedFact } from "@/features/report/rules";

const deed = (over: Partial<DeedFact>): DeedFact => ({
  actionName: "Gym",
  actionIcon: "🏋️",
  actionCategory: "Fitness",
  kind: "good",
  honourDelta: 10,
  xpDelta: 10,
  occurredOn: "2026-11-16",
  undone: false,
  isReversal: false,
  ...over,
});

describe("weekly report", () => {
  it("lists the seven days of a week", () => {
    expect(weekDays("2026-11-16")).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]);
    expect(weekDays("2026-12-28").at(-1)).toBe("2027-01-03");
  });

  it("totals wins and misses, ignoring undone deeds and other weeks", () => {
    const r = summariseWeek(
      [
        deed({}),
        deed({ occurredOn: "2026-11-18" }),
        deed({ actionName: "Read", actionIcon: "📖", actionCategory: "Reading", honourDelta: 5, xpDelta: 5, occurredOn: "2026-11-18" }),
        deed({ kind: "bad", actionName: "Junk food", actionIcon: "🍔", honourDelta: -8, xpDelta: 0, occurredOn: "2026-11-19" }),
        deed({ undone: true }),
        deed({ isReversal: true, honourDelta: -10 }),
        deed({ occurredOn: "2026-11-23" }), // next week
      ],
      "2026-11-16",
    );
    expect(r).toMatchObject({ good: 25, bad: 8, goodDeeds: 3, badDeeds: 1, daysActive: 3 });
    expect(r.bestDay).toEqual({ day: "2026-11-18", net: 15 });
    expect(r.wins[0]).toMatchObject({ name: "Gym", count: 2, honour: 20 });
    expect(r.misses).toEqual([{ name: "Junk food", icon: "🍔", count: 1, honour: 8 }]);
    expect(r.dragons.map((d) => [d.areaId, d.xp])).toEqual([
      ["fitness", 20],
      ["reading", 5],
    ]);
    expect(r.boss).toMatchObject({ weekStart: "2026-11-16", defeated: false, hpLeft: 300 - 17 });
  });

  it("handles an empty week", () => {
    const r = summariseWeek([], "2026-11-16");
    expect(r).toMatchObject({ good: 0, bad: 0, bestDay: null, wins: [], misses: [], dragons: [] });
  });
});
