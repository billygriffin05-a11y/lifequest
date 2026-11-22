import { describe, expect, it } from "vitest";
import { planFor, PLANS } from "@/features/dragons/body-plans";
import { spriteLayers } from "@/features/dragons/sprite";
import { partyStats, statLevel } from "@/features/dragons/stats";
import { activityDamageByWeek, bossBattle, BOSS_HP } from "@/features/honour/progress";
import { DEFAULT_PREFS, dueReminders } from "@/features/notifications/rules";
import { seasonEnds, seasonFor } from "@/features/treasury/seasons";

describe("activity-powered boss", () => {
  it("adds training, wellbeing and study damage per week", () => {
    const d = activityDamageByWeek({
      workoutDays: ["2026-11-16", "2026-11-16", "2026-11-17"], // same day counts once
      runs: ["2026-11-18"],
      waterDays: ["2026-11-16"],
      sleepNights: ["2026-11-16", "2026-11-17"],
      focus: [
        { day: "2026-11-18", minutes: 30 },
        { day: "2026-11-18", minutes: 20 }, // 50 min = 2 × 25
      ],
      reviewDays: Array(12).fill("2026-11-19"),
    }).get("2026-11-16")!;
    expect(d).toEqual({ training: 45, wellbeing: 15, study: 15, total: 75 });
  });

  it("activity can finish off a boss that deeds alone wouldn't", () => {
    expect(bossBattle("2026-11-16", BOSS_HP - 50, 0).defeated).toBe(false);
    const activity = { total: 60, training: 60, wellbeing: 0, study: 0 };
    expect(bossBattle("2026-11-16", BOSS_HP - 50, 0, activity)).toMatchObject({ defeated: true, hpLeft: 0, damage: BOSS_HP - 50 });
  });
});

describe("party stats", () => {
  it("levels up quickly then slows", () => {
    expect(statLevel(0)).toMatchObject({ level: 0, nextAt: 5 });
    expect(statLevel(20).level).toBe(2);
    expect(statLevel(500).level).toBe(10);
  });

  it("maps areas to the five stats", () => {
    const s = partyStats(new Map([["fitness", 125], ["study", 10], ["reading", 10], ["finance", -5]]));
    expect(Object.fromEntries(s.map((x) => [x.id, x.xp]))).toEqual({ might: 125, wisdom: 20, vigour: 0, resolve: 0, fortune: 0 });
    expect(s.find((x) => x.id === "might")?.level).toBe(5);
  });
});

describe("seasons", () => {
  it("knows the UK seasons and when they end", () => {
    expect(seasonFor("2026-11-21")).toBe("autumn");
    expect(seasonFor("2026-12-01")).toBe("winter");
    expect(seasonFor("2027-02-28")).toBe("winter");
    expect(seasonEnds("2026-12-10")).toBe("2027-02-28");
    expect(seasonEnds("2028-01-10")).toBe("2028-02-29");
    expect(seasonEnds("2026-11-21")).toBe("2026-11-30");
  });
});

describe("evolution paths", () => {
  it("only reshape a dragon from stage 10", () => {
    expect(planFor("fire", 9, "armoured")).toBe(PLANS.fire);
    expect(planFor("fire", 10, "swift").wingSpan).toBeGreaterThan(PLANS.fire.wingSpan);
    expect(planFor("air", 10, "armoured").back).toBe("plates");
  });

  it("changes the drawn dragon", () => {
    const px = (p: "armoured" | "swift" | null) =>
      JSON.stringify(spriteLayers(14, "content", "fire", p).body) + JSON.stringify(spriteLayers(14, "content", "fire", p).wing);
    expect(px("armoured")).not.toBe(px(null));
    expect(px("swift")).not.toBe(px("armoured"));
  });
});

describe("weekly review reminder", () => {
  const base = { today: "2026-11-22", month: "2026-11", nowTime: "18:10", streaksAtRisk: 0, cardsDue: 0, budgetsNearLimit: [], plans: [], weekStart: "2026-11-16" };
  it("nudges on Sunday evening until the review is done", () => {
    expect(dueReminders(DEFAULT_PREFS, { ...base, isSunday: true, reviewDone: false })[0]?.key).toBe("review:2026-11-16");
    expect(dueReminders(DEFAULT_PREFS, { ...base, isSunday: true, reviewDone: true })).toEqual([]);
    expect(dueReminders(DEFAULT_PREFS, { ...base, isSunday: false, reviewDone: false })).toEqual([]);
  });
});
