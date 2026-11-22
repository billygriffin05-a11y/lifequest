import { describe, expect, it } from "vitest";
import { MAX_SHIELDS, streakTimeline } from "@/features/honour/progress";
import { DEFAULT_PREFS, dueReminders, inWindow, type ReminderFacts } from "@/features/notifications/rules";
import { subscriptionSchema } from "@/features/notifications/server/service";

const range = (from: string, n: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${from}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

describe("forgiving streaks (shields)", () => {
  it("earns a shield every 7 days, capped", () => {
    expect(streakTimeline(new Set(range("2026-11-01", 7)), "2026-11-07")).toMatchObject({ current: 7, shields: 1 });
    expect(streakTimeline(new Set(range("2026-11-01", 30)), "2026-11-30").shields).toBe(MAX_SHIELDS);
  });

  it("a shield covers one missed day and the streak continues (shield days don't count as done)", () => {
    const days = new Set([...range("2026-11-01", 7), ...range("2026-11-09", 3)]); // missed the 8th
    const t = streakTimeline(days, "2026-11-11");
    expect(t).toMatchObject({ current: 10, shields: 0, covered: ["2026-11-08"], runs: [10] });
  });

  it("two misses in a row, or a miss with no shield, break it", () => {
    const twoMisses = new Set([...range("2026-11-01", 7), ...range("2026-11-10", 2)]);
    expect(streakTimeline(twoMisses, "2026-11-11")).toMatchObject({ current: 2, runs: [7, 2] });
    const noShield = new Set([...range("2026-11-01", 3), ...range("2026-11-05", 2)]);
    expect(streakTimeline(noShield, "2026-11-06")).toMatchObject({ current: 2, runs: [3, 2] });
  });

  it("today not done yet doesn't break anything; yesterday missed uses a shield", () => {
    expect(streakTimeline(new Set(range("2026-11-01", 7)), "2026-11-08")).toMatchObject({ current: 7, shields: 1 });
    expect(streakTimeline(new Set(range("2026-11-01", 7)), "2026-11-09")).toMatchObject({ current: 7, shields: 0, covered: ["2026-11-08"] });
    expect(streakTimeline(new Set(range("2026-11-01", 3)), "2026-11-06")).toMatchObject({ current: 0, shields: 0 });
  });

  it("is empty for no days", () => {
    expect(streakTimeline(new Set(), "2026-11-06")).toEqual({ current: 0, best: 0, shields: 0, runs: [], covered: [] });
  });
});

const facts = (over: Partial<ReminderFacts> = {}): ReminderFacts => ({
  today: "2026-11-20",
  month: "2026-11",
  nowTime: "20:05",
  streaksAtRisk: 0,
  cardsDue: 0,
  budgetsNearLimit: [],
  plans: [],
  ...over,
});

describe("push reminder rules", () => {
  it("fires only after the time and within the late window", () => {
    expect(inWindow("20:00", "20:00")).toBe(true);
    expect(inWindow("19:59", "20:00")).toBe(false);
    expect(inWindow("23:01", "20:00")).toBe(false);
  });

  it("builds stable keys and messages without amounts", () => {
    const due = dueReminders(DEFAULT_PREFS, facts({ streaksAtRisk: 2, cardsDue: 0, budgetsNearLimit: ["c1"] }));
    expect(due.map((d) => d.key)).toEqual(["streak:2026-11-20", "budget:2026-11:c1"]);
    expect(due[1].body).not.toMatch(/£|\d/);
  });

  it("sends if-then plan reminders at their time", () => {
    const plan = { actionId: "a1", name: "Study", icon: "📚", cue: "After dinner", time: "19:30" };
    expect(dueReminders(DEFAULT_PREFS, facts({ plans: [plan] }))[0]).toMatchObject({ key: "plan:2026-11-20:a1", title: "📚 After dinner" });
    expect(dueReminders({ ...DEFAULT_PREFS, plans: false }, facts({ plans: [plan] }))).toEqual([]);
  });

  it("respects switched-off reminders", () => {
    expect(dueReminders({ ...DEFAULT_PREFS, streak: false }, facts({ streaksAtRisk: 3 }))).toEqual([]);
  });
});

describe("push subscriptions", () => {
  const keys = { p256dh: "B".repeat(87), auth: "A".repeat(22) };
  it("accepts real push services only", () => {
    expect(subscriptionSchema.safeParse({ endpoint: "https://web.push.apple.com/QGx", keys }).success).toBe(true);
    expect(subscriptionSchema.safeParse({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys }).success).toBe(true);
    expect(subscriptionSchema.safeParse({ endpoint: "https://evil.example.com/x", keys }).success).toBe(false);
    expect(subscriptionSchema.safeParse({ endpoint: "http://web.push.apple.com/x", keys }).success).toBe(false);
  });
});
