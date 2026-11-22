/**
 * Weekly report maths (pure). Week = Monday..Sunday, Europe/London day keys.
 * Tests: tests/unit/report.test.ts
 */
import { areaForCategory } from "@/features/dragons/areas";
import { bossBattle, type ActivityDamage, type BossBattle } from "@/features/honour/progress";

export interface DeedFact {
  actionName: string;
  actionIcon: string;
  actionCategory: string;
  kind: string;
  honourDelta: number;
  xpDelta: number;
  occurredOn: string;
  undone: boolean;
  isReversal: boolean;
}

export interface CountedAction {
  name: string;
  icon: string;
  count: number;
  honour: number;
}

export interface WeekHonour {
  good: number;
  bad: number;
  goodDeeds: number;
  badDeeds: number;
  bestDay: { day: string; net: number } | null;
  daysActive: number;
  wins: CountedAction[];
  misses: CountedAction[];
  dragons: { areaId: string; name: string; xp: number }[];
  boss: BossBattle;
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${weekStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function tally(rows: DeedFact[]): CountedAction[] {
  const m = new Map<string, CountedAction>();
  for (const r of rows) {
    const k = `${r.actionIcon}|${r.actionName}`;
    const cur = m.get(k) ?? { name: r.actionName, icon: r.actionIcon, count: 0, honour: 0 };
    cur.count++;
    cur.honour += Math.abs(r.honourDelta);
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || b.honour - a.honour || a.name.localeCompare(b.name));
}

/** Honour side of the report. Undone deeds and their reversals are ignored. */
export function summariseWeek(deeds: readonly DeedFact[], weekStart: string, activity?: ActivityDamage): WeekHonour {
  const days = new Set(weekDays(weekStart));
  const live = deeds.filter((d) => days.has(d.occurredOn) && !d.undone && !d.isReversal);
  const good = live.filter((d) => d.kind === "good");
  const bad = live.filter((d) => d.kind === "bad");
  const goodHonour = good.reduce((n, d) => n + Math.abs(d.honourDelta), 0);
  const badHonour = bad.reduce((n, d) => n + Math.abs(d.honourDelta), 0);

  const netByDay = new Map<string, number>();
  for (const d of live) netByDay.set(d.occurredOn, (netByDay.get(d.occurredOn) ?? 0) + d.honourDelta);
  let bestDay: WeekHonour["bestDay"] = null;
  for (const [day, net] of [...netByDay].sort(([a], [b]) => a.localeCompare(b))) {
    if (!bestDay || net > bestDay.net) bestDay = { day, net };
  }

  const xpByArea = new Map<string, { areaId: string; name: string; xp: number }>();
  for (const d of good) {
    const area = areaForCategory(d.actionCategory);
    const cur = xpByArea.get(area.id) ?? { areaId: area.id, name: area.dragonName, xp: 0 };
    cur.xp += d.xpDelta;
    xpByArea.set(area.id, cur);
  }

  return {
    good: goodHonour,
    bad: badHonour,
    goodDeeds: good.length,
    badDeeds: bad.length,
    bestDay,
    daysActive: netByDay.size,
    wins: tally(good).slice(0, 5),
    misses: tally(bad).slice(0, 5),
    dragons: [...xpByArea.values()].filter((d) => d.xp > 0).sort((a, b) => b.xp - a.xp),
    boss: bossBattle(weekStart, goodHonour, badHonour, activity),
  };
}
