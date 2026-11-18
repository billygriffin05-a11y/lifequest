import { describe, expect, it } from "vitest";
import {
  buildDailySeries,
  deltasFor,
  lastNDateKeys,
  londonDateKey,
  reversalOf,
  summarise,
} from "@/features/honour/rules";

describe("daily good/bad series", () => {
  it("lists the last N calendar days, oldest first, across month ends and DST", () => {
    expect(lastNDateKeys("2026-03-02", 4)).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
    // UK clocks go forward on 29 Mar 2026: no day skipped or repeated
    expect(lastNDateKeys("2026-03-30", 3)).toEqual(["2026-03-28", "2026-03-29", "2026-03-30"]);
    expect(lastNDateKeys("2026-11-18", 30)).toHaveLength(30);
  });

  it("splits good and bad, nets undos, fills empty days with 0, ignores out-of-range rows", () => {
    const keys = ["2026-11-16", "2026-11-17", "2026-11-18"];
    const series = buildDailySeries(
      [
        { occurredOn: "2026-11-16", kind: "good", honourDelta: 20 },
        { occurredOn: "2026-11-16", kind: "bad", honourDelta: -15 },
        { occurredOn: "2026-11-18", kind: "good", honourDelta: 10 },
        { occurredOn: "2026-11-18", kind: "good", honourDelta: -10 }, // undo
        { occurredOn: "2026-11-18", kind: "bad", honourDelta: -5 },
        { occurredOn: "2026-10-01", kind: "good", honourDelta: 999 },
      ],
      keys,
    );
    expect(series).toEqual([
      { date: "2026-11-16", good: 20, bad: 15 },
      { date: "2026-11-17", good: 0, bad: 0 },
      { date: "2026-11-18", good: 0, bad: 5 },
    ]);
  });
});
import { actionInputSchema, logInputSchema } from "@/features/honour/schemas";

describe("honour rules", () => {
  it("good actions add Honour and XP", () => {
    expect(deltasFor("good", 20)).toEqual({ honourDelta: 20, xpDelta: 20 });
  });

  it("bad actions subtract Honour but never XP", () => {
    expect(deltasFor("bad", 15)).toEqual({ honourDelta: -15, xpDelta: 0 });
  });

  it("rejects non-positive or fractional points", () => {
    expect(() => deltasFor("good", 0)).toThrow();
    expect(() => deltasFor("bad", -5)).toThrow();
    expect(() => deltasFor("good", 1.5)).toThrow();
  });

  it("a reversal exactly cancels the original", () => {
    const d = deltasFor("good", 20);
    const r = reversalOf(d);
    expect(d.honourDelta + r.honourDelta).toBe(0);
    expect(d.xpDelta + r.xpDelta).toBe(0);
  });

  it("uses the Europe/London calendar day across GMT and BST", () => {
    // 23:30 UTC on 30 June = 00:30 BST on 1 July
    expect(londonDateKey(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
    // 23:30 UTC in January = 23:30 GMT, same day
    expect(londonDateKey(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-15");
  });

  it("summarises totals and today's good/bad, netting out reversals", () => {
    const today = "2026-11-18";
    const s = summarise(
      [
        { kind: "good", occurredOn: today, honourDelta: 20, xpDelta: 20 },
        { kind: "bad", occurredOn: today, honourDelta: -15, xpDelta: 0 },
        { kind: "good", occurredOn: today, honourDelta: 10, xpDelta: 10 },
        { kind: "good", occurredOn: today, honourDelta: -10, xpDelta: -10 }, // undo of the +10
        { kind: "good", occurredOn: "2026-11-17", honourDelta: 5, xpDelta: 5 },
      ],
      today,
    );
    expect(s).toEqual({ honour: 10, xp: 25, today: { good: 20, bad: 15, net: 5 } });
  });
});

describe("honour input validation", () => {
  const valid = { name: "Gym session", kind: "good", points: "20", icon: "🏋️", category: "Fitness" };

  it("accepts and normalises valid input", () => {
    expect(actionInputSchema.parse({ ...valid, name: "  Gym session  " })).toEqual({ ...valid, points: 20 });
  });

  it.each([
    ["empty name", { name: "   " }],
    ["unknown kind", { kind: "neutral" }],
    ["zero points", { points: "0" }],
    ["too many points", { points: "1001" }],
    ["fractional points", { points: "2.5" }],
    ["long category", { category: "x".repeat(31) }],
  ])("rejects %s", (_label, override) => {
    expect(actionInputSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it("rejects unexpected fields (no client-supplied totals)", () => {
    expect(actionInputSchema.safeParse({ ...valid, honourDelta: 9999 }).success).toBe(false);
  });

  it("requires a UUID idempotency key", () => {
    expect(logInputSchema.safeParse({ actionId: "a1", idempotencyKey: "not-a-uuid" }).success).toBe(false);
  });
});
