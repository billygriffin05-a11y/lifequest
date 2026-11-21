/**
 * Party stats: five RPG attributes derived from your dragons' XP, so real
 * effort in each life area shows up as a character stat. Pure.
 * Tests: tests/unit/habits-b.test.ts
 */

export const STATS = [
  { id: "might", name: "Might", icon: "💪", areas: ["fitness"], blurb: "Workouts, runs and Fitness deeds" },
  { id: "wisdom", name: "Wisdom", icon: "🧠", areas: ["study", "reading"], blurb: "Study, cards, focus and reading" },
  { id: "vigour", name: "Vigour", icon: "💧", areas: ["sleep", "nutrition"], blurb: "Sleep, water and nutrition" },
  { id: "resolve", name: "Resolve", icon: "🛡️", areas: ["habits", "other"], blurb: "Habits, journalling and reviews" },
  { id: "fortune", name: "Fortune", icon: "🪙", areas: ["finance"], blurb: "Budgets kept and Finance deeds" },
] as const;

export type StatId = (typeof STATS)[number]["id"];

/** Level from XP: grows quickly at first, then slows (level n needs 5·n² XP). */
export function statLevel(xp: number): { level: number; percent: number; nextAt: number } {
  const x = Math.max(0, xp);
  const level = Math.floor(Math.sqrt(x / 5));
  const cur = 5 * level * level;
  const next = 5 * (level + 1) * (level + 1);
  return { level, percent: Math.floor(((x - cur) / (next - cur)) * 100), nextAt: next };
}

export function partyStats(xpByArea: ReadonlyMap<string, number>) {
  return STATS.map((s) => {
    const xp = s.areas.reduce((n, a) => n + Math.max(0, xpByArea.get(a) ?? 0), 0);
    return { ...s, xp, ...statLevel(xp) };
  });
}
