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

// ── Forgiving streaks: shields ───────────────────────────────────────────────

/** A shield is earned for every 7 days in a row; at most this many are banked. */
export const SHIELD_EVERY = 7;
export const MAX_SHIELDS = 2;

export interface StreakTimeline {
  /** Current streak in done days (shield-covered days don't count as done). */
  current: number;
  /** Longest streak ever, in done days. */
  best: number;
  /** Shields banked right now. */
  shields: number;
  /** Done-day count of every streak (for bonus XP). */
  runs: number[];
  /** Days a shield covered. */
  covered: string[];
}

/**
 * Walk day by day from the first done day to today. A single missed day is
 * covered by a banked shield (the streak survives); a second miss in a row,
 * or a miss with no shield, ends the streak and its shields. Today not being
 * done yet never breaks anything (you have until midnight).
 */
export function streakTimeline(days: ReadonlySet<string>, todayKey: string): StreakTimeline {
  const sorted = [...days].filter((d) => d <= todayKey).sort();
  if (!sorted.length) return { current: 0, best: 0, shields: 0, runs: [], covered: [] };
  const runs: number[] = [];
  const covered: string[] = [];
  let run = 0;
  let sinceShield = 0;
  let shields = 0;
  let missed = 0;
  const end = toUtc(todayKey);
  for (let ms = toUtc(sorted[0]); ms <= end; ms += DAY) {
    const key = fromUtc(ms);
    if (days.has(key)) {
      run++;
      sinceShield++;
      missed = 0;
      if (sinceShield === SHIELD_EVERY) {
        shields = Math.min(MAX_SHIELDS, shields + 1);
        sinceShield = 0;
      }
      continue;
    }
    if (key === todayKey) break;
    missed++;
    if (missed === 1 && shields > 0 && run > 0) {
      shields--;
      covered.push(key);
      continue;
    }
    if (run > 0) runs.push(run);
    run = 0;
    sinceShield = 0;
    shields = 0;
  }
  if (run > 0) runs.push(run);
  // The last run is "current" only if it reaches yesterday/today (possibly via a shield).
  const alive = run > 0;
  return { current: alive ? run : 0, best: Math.max(0, ...runs), shields: alive ? shields : 0, runs, covered };
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
  /** Streak shields banked. */
  shields: number;
}

export function streaksByAction(
  rows: readonly LedgerFact[],
  todayKey: string,
  targets: ReadonlyMap<string, number | null> = new Map(),
): Map<string, StreakInfo> {
  const out = new Map<string, StreakInfo>();
  const thisMonday = weekStart(todayKey);
  for (const [actionId, { days, category }] of goodDaysByAction(rows)) {
    const tl = streakTimeline(days, todayKey);
    const weekly = weeklyBonus(days, targets.get(actionId) ?? null);
    out.set(actionId, {
      current: tl.current,
      best: tl.best,
      shields: tl.shields,
      bonusXp: tl.runs.reduce((n, len) => n + bonusForRun(len), 0) + weekly.bonusXp,
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

// ── Daily quests ─────────────────────────────────────────────────────────────

export const QUEST_COUNT = 3;
export const QUEST_BONUS = 20;

export interface QuestCandidate {
  id: string;
  /** Day the action was created (YYYY-MM-DD) — only existing actions can be a quest. */
  createdOn: string;
  category: string;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Deterministic 3 quests for a day, picked from good actions that existed that day. */
export function questsForDay(candidates: readonly QuestCandidate[], dayKey: string): QuestCandidate[] {
  return candidates
    .filter((c) => c.createdOn <= dayKey)
    .map((c) => ({ c, k: hash(`${dayKey}:${c.id}`) }))
    .sort((a, b) => a.k - b.k || a.c.id.localeCompare(b.c.id))
    .slice(0, QUEST_COUNT)
    .map((x) => x.c);
}

/** Bonus XP per category for every quest completed, from the first logged day to today. */
export function questBonusByCategory(
  candidates: readonly QuestCandidate[],
  goodDays: ReadonlyMap<string, { days: Set<string> }>,
  todayKey: string,
): Map<string, number> {
  const out = new Map<string, number>();
  const allDays = new Set<string>();
  for (const { days } of goodDays.values()) for (const d of days) if (d <= todayKey) allDays.add(d);
  for (const day of allDays) {
    for (const q of questsForDay(candidates, day)) {
      if (goodDays.get(q.id)?.days.has(day)) out.set(q.category, (out.get(q.category) ?? 0) + QUEST_BONUS);
    }
  }
  return out;
}

// ── Habit heatmap ────────────────────────────────────────────────────────────

/** The last `weeks` full Mon–Sun weeks ending with the current week, oldest first (columns of 7). */
export function heatmapWeeks(todayKey: string, weeks = 12): string[][] {
  const monday = toUtc(weekStart(todayKey));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => fromUtc(monday - (weeks - 1 - w) * 7 * DAY + d * DAY)),
  );
}

// ── Weekly boss battle ───────────────────────────────────────────────────────

export const BOSSES = [
  { name: "Sloth the Couch Wyrm", emoji: "🦥" },
  { name: "Gorgon of Doomscroll", emoji: "📱" },
  { name: "The Takeaway Troll", emoji: "🍔" },
  { name: "Procrastinor the Grey", emoji: "⏳" },
  { name: "The Midnight Lich", emoji: "🌙" },
  { name: "Impulse Imp", emoji: "🛍️" },
  { name: "Lord Excuse", emoji: "🤥" },
  { name: "The Fog Hydra", emoji: "🌫️" },
] as const;

export const BOSS_HP = 300;
export const BOSS_XP_REWARD = 100;
export const BOSS_GOLD_REWARD = 50;

export interface BossBattle {
  weekStart: string;
  name: string;
  emoji: string;
  hp: number;
  /** Good-deed Honour dealt this week. */
  damage: number;
  /** Extra damage from training, wellbeing and study this week. */
  activity: ActivityDamage;
  /** Bad-habit Honour healed this week. */
  healed: number;
  hpLeft: number;
  defeated: boolean;
}

export function bossForWeek(weekKey: string) {
  return BOSSES[hash(`boss:${weekKey}`) % BOSSES.length];
}

/** Good deeds and training hit the boss; bad habits heal it. Defeated when net damage ≥ HP. */
export function bossBattle(weekKey: string, goodHonour: number, badHonour: number, activity: ActivityDamage = NO_ACTIVITY): BossBattle {
  const boss = bossForWeek(weekKey);
  const net = Math.max(0, goodHonour + activity.total - badHonour);
  return {
    weekStart: weekKey,
    name: boss.name,
    emoji: boss.emoji,
    hp: BOSS_HP,
    damage: goodHonour,
    activity,
    healed: badHonour,
    hpLeft: Math.max(0, BOSS_HP - net),
    defeated: net >= BOSS_HP,
  };
}

// ── Training damage (body + mind activity) ───────────────────────────────────

export const ACTIVITY_DAMAGE = { workoutDay: 15, run: 15, waterDay: 5, sleepNight: 5, focus25: 5, reviews10: 5 } as const;

export interface ActivityFacts {
  workoutDays: Iterable<string>;
  runs: Iterable<string>;
  waterDays: Iterable<string>;
  sleepNights: Iterable<string>;
  focus: Iterable<{ day: string; minutes: number }>;
  reviewDays: Iterable<string>;
}

export interface ActivityDamage {
  total: number;
  training: number; // workouts + runs
  wellbeing: number; // water + sleep
  study: number; // focus + card reviews
}

export const NO_ACTIVITY: ActivityDamage = { total: 0, training: 0, wellbeing: 0, study: 0 };

/** Boss damage per week (keyed by Monday) from body and mind activity. */
export function activityDamageByWeek(f: ActivityFacts): Map<string, ActivityDamage> {
  const out = new Map<string, ActivityDamage>();
  const add = (day: string, part: "training" | "wellbeing" | "study", n: number) => {
    const w = weekStart(day);
    const cur = out.get(w) ?? { ...NO_ACTIVITY };
    cur[part] += n;
    cur.total += n;
    out.set(w, cur);
  };
  for (const d of new Set(f.workoutDays)) add(d, "training", ACTIVITY_DAMAGE.workoutDay);
  for (const d of f.runs) add(d, "training", ACTIVITY_DAMAGE.run);
  for (const d of new Set(f.waterDays)) add(d, "wellbeing", ACTIVITY_DAMAGE.waterDay);
  for (const d of new Set(f.sleepNights)) add(d, "wellbeing", ACTIVITY_DAMAGE.sleepNight);
  const focusByDay = new Map<string, number>();
  for (const x of f.focus) focusByDay.set(x.day, (focusByDay.get(x.day) ?? 0) + x.minutes);
  for (const [d, m] of focusByDay) if (m >= 25) add(d, "study", Math.floor(m / 25) * ACTIVITY_DAMAGE.focus25);
  const reviewsByDay = new Map<string, number>();
  for (const d of f.reviewDays) reviewsByDay.set(d, (reviewsByDay.get(d) ?? 0) + 1);
  for (const [d, n] of reviewsByDay) if (n >= 10) add(d, "study", Math.floor(n / 10) * ACTIVITY_DAMAGE.reviews10);
  return out;
}

/** Per-week good/bad Honour (undo-netted) from ledger rows. */
export function honourByWeek(rows: readonly { kind: string; occurredOn: string; honourDelta: number }[]) {
  const out = new Map<string, { good: number; bad: number }>();
  for (const r of rows) {
    const w = weekStart(r.occurredOn);
    const acc = out.get(w) ?? { good: 0, bad: 0 };
    if (r.kind === "good") acc.good += r.honourDelta;
    else acc.bad -= r.honourDelta;
    out.set(w, acc);
  }
  return out;
}
