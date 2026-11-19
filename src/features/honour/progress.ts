/**
 * Pure streak, bonus-XP and player-rank rules (tests: tests/unit/progress.test.ts).
 *
 * Everything here is DERIVED from the ledger, never stored — so an undo
 * automatically removes any streak or bonus it had created.
 */

export interface LedgerFact {
  id: string;
  actionId: string;
  actionCategory: string;
  kind: string;
  occurredOn: string;
  reversesEntryId: string | null;
}

/** Days (YYYY-MM-DD) on which each good action was done and not undone. */
export function goodDaysByAction(rows: readonly LedgerFact[]): Map<string, { days: Set<string>; category: string }> {
  const undone = new Set(rows.flatMap((r) => (r.reversesEntryId ? [r.reversesEntryId] : [])));
  const out = new Map<string, { days: Set<string>; category: string }>();
  for (const r of rows) {
    if (r.kind !== "good" || r.reversesEntryId || undone.has(r.id)) continue;
    const slot = out.get(r.actionId) ?? { days: new Set<string>(), category: r.actionCategory };
    slot.days.add(r.occurredOn);
    slot.category = r.actionCategory;
    out.set(r.actionId, slot);
  }
  return out;
}

const DAY = 86_400_000;
const toUtc = (key: string) => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10));
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Current streak: consecutive days up to today. If today isn't done yet the
 * streak is still alive from yesterday (you have until midnight).
 */
export function currentStreak(days: ReadonlySet<string>, todayKey: string): number {
  let cursor = toUtc(todayKey);
  if (!days.has(todayKey)) cursor -= DAY;
  let n = 0;
  while (days.has(fromUtc(cursor))) {
    n++;
    cursor -= DAY;
  }
  return n;
}

/** Lengths of every run of consecutive days. */
export function runLengths(days: ReadonlySet<string>): number[] {
  const sorted = [...days].map(toUtc).sort((a, b) => a - b);
  const runs: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] === DAY) runs[runs.length - 1]++;
    else runs.push(1);
  }
  return runs;
}

export const STREAK_BONUS = { every7: 25, every30: 100 } as const;

/** Bonus XP for one run: +25 for every full 7 days, +100 more for every full 30. */
export function bonusForRun(length: number): number {
  return Math.floor(length / 7) * STREAK_BONUS.every7 + Math.floor(length / 30) * STREAK_BONUS.every30;
}

// ── Weekly targets (Mon–Sun) ─────────────────────────────────────────────────

export const WEEKLY_TARGET_BONUS = 15;

/** Monday (YYYY-MM-DD) of the week containing `key`. */
export function weekStart(key: string): string {
  const ms = toUtc(key);
  const dow = new Date(ms).getUTCDay(); // 0 = Sunday
  return fromUtc(ms - ((dow + 6) % 7) * DAY);
}

/** Distinct done-days per week (keyed by Monday). */
export function daysPerWeek(days: ReadonlySet<string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of days) {
    const w = weekStart(d);
    out.set(w, (out.get(w) ?? 0) + 1);
  }
  return out;
}

/** Bonus for every week the target was met (target 1–7; null = no target). */
export function weeklyBonus(days: ReadonlySet<string>, target: number | null): { weeksMet: number; bonusXp: number } {
  if (!target) return { weeksMet: 0, bonusXp: 0 };
  let weeksMet = 0;
  for (const n of daysPerWeek(days).values()) if (n >= target) weeksMet++;
  return { weeksMet, bonusXp: weeksMet * WEEKLY_TARGET_BONUS };
}

export interface StreakInfo {
  current: number;
  /** Longest run ever. */
  best: number;
  /** Streak bonus + weekly-target bonus. */
  bonusXp: number;
  category: string;
  /** Days done this week (Mon–Sun). */
  thisWeek: number;
  weeksMet: number;
}

export function streaksByAction(
  rows: readonly LedgerFact[],
  todayKey: string,
  targets: ReadonlyMap<string, number | null> = new Map(),
): Map<string, StreakInfo> {
  const out = new Map<string, StreakInfo>();
  const thisMonday = weekStart(todayKey);
  for (const [actionId, { days, category }] of goodDaysByAction(rows)) {
    const runs = runLengths(days);
    const weekly = weeklyBonus(days, targets.get(actionId) ?? null);
    out.set(actionId, {
      current: currentStreak(days, todayKey),
      best: Math.max(0, ...runs),
      bonusXp: runs.reduce((n, len) => n + bonusForRun(len), 0) + weekly.bonusXp,
      category,
      thisWeek: daysPerWeek(days).get(thisMonday) ?? 0,
      weeksMet: weekly.weeksMet,
    });
  }
  return out;
}

// ── Player rank ──────────────────────────────────────────────────────────────

export const RANKS = [
  { title: "Peasant", minXp: 0 },
  { title: "Squire", minXp: 100 },
  { title: "Knight", minXp: 400 },
  { title: "Champion", minXp: 1000 },
  { title: "Warlord", minXp: 2500 },
  { title: "Dragonlord", minXp: 5000 },
  { title: "Legend", minXp: 10000 },
] as const;

export interface Rank {
  title: string;
  level: number;
  xp: number;
  nextTitle: string | null;
  nextAt: number | null;
  percent: number;
}

export function rankForXp(rawXp: number): Rank {
  const xp = Math.max(0, Math.floor(rawXp));
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (xp >= RANKS[k].minXp) i = k;
  const next = RANKS[i + 1];
  return {
    title: RANKS[i].title,
    level: i + 1,
    xp,
    nextTitle: next?.title ?? null,
    nextAt: next?.minXp ?? null,
    percent: next ? Math.floor(((xp - RANKS[i].minXp) / (next.minXp - RANKS[i].minXp)) * 100) : 100,
  };
}
