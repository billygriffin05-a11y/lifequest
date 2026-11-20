import { describe, expect, it } from "vitest";
import { describeDay, emptyDay, monthGrid, shiftMonth } from "@/features/calendar/month";

describe("month grid", () => {
  it("covers the month in Monday-first weeks", () => {
    const g = monthGrid("2026-11"); // 1 Nov 2026 is a Sunday
    expect(g[0]).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(g.at(-1)?.at(-1)).toBe("2026-12-06");
    expect(g).toHaveLength(6);
    expect(g.every((w) => w.length === 7)).toBe(true);
  });

  it("handles a month starting on Monday and February", () => {
    expect(monthGrid("2026-06")[0][0]).toBe("2026-06-01");
    const feb = monthGrid("2027-02"); // starts Monday, 28 days
    expect(feb).toHaveLength(4);
    expect(feb.flat()).toContain("2027-02-28");
  });

  it("shifts months across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("describes a day for screen readers", () => {
    expect(describeDay(emptyDay())).toBe("nothing logged");
    expect(describeDay({ ...emptyDay(), good: 2, bad: 1, active: true, focusMinutes: 25 })).toBe(
      "2 good deeds, 1 bad habit, exercised, 25 min focus",
    );
  });
});
