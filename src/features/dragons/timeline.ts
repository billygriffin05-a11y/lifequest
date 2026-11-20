/**
 * Pure: when did a dragon reach each stage? (tests: tests/unit/dragon-timeline.test.ts)
 * Uses the area's deed XP day by day (undos included). Streak/weekly bonus XP
 * has no single date, so a stage reached only thanks to bonus shows no date.
 */
import { STAGES } from "./rules";

export interface DayXp {
  occurredOn: string;
  xpDelta: number;
}

export interface StageReached {
  stage: number;
  name: string;
  minXp: number;
  reachedOn: string | null;
}

export function stageTimeline(rows: readonly DayXp[]): StageReached[] {
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.occurredOn, (byDay.get(r.occurredOn) ?? 0) + r.xpDelta);
  const days = [...byDay.keys()].sort();
  let total = 0;
  const reached = new Map<number, string>();
  for (const day of days) {
    total += byDay.get(day)!;
    STAGES.forEach((s, i) => {
      if (i > 0 && !reached.has(i) && total >= s.minXp) reached.set(i, day);
    });
  }
  return STAGES.map((s, i) => ({ stage: i, name: s.name, minXp: s.minXp, reachedOn: i === 0 ? (days[0] ?? null) : (reached.get(i) ?? null) }));
}

export const MAX_DRAGON_NAME = 24;
