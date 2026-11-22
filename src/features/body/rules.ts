/**
 * Body rules: pure parsing, formatting, personal bests and reward maths.
 * Units are integers: grams, metres, seconds, minutes. Tests: tests/unit/body.test.ts
 */

export const WATER_GOAL = 8;
export const MAX_GLASSES = 30;
export const SLEEP_GOAL_MINUTES = 7 * 60;
export const ACTIVE_DAY_XP = 10; // Fitness: a day with a workout or run
export const WATER_DAY_XP = 5; // Nutrition: a day at the water goal
export const SLEEP_NIGHT_XP = 5; // Sleep: a night of 7h+

/** "82", "82.5", "82.55" kg → grams. Null if invalid or silly. */
export function parseKg(input: string): number | null {
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const grams = Number(m[1]) * 1000 + Number((m[2] ?? "0").padEnd(2, "0")) * 10;
  return grams <= 500_000 ? grams : null;
}

export function formatKg(grams: number): string {
  return `${parseFloat((grams / 1000).toFixed(2))} kg`;
}

/** "5", "5.2", "21.1" km → metres. */
export function parseKm(input: string): number | null {
  const m = /^(\d{1,3})(?:\.(\d{1,3}))?$/.exec(input.trim());
  if (!m) return null;
  const metres = Number(m[1]) * 1000 + Number((m[2] ?? "0").padEnd(3, "0"));
  return metres > 0 && metres <= 300_000 ? metres : null;
}

export function formatKm(metres: number): string {
  return `${(metres / 1000).toFixed(2)} km`;
}

/** "25:30" (mm:ss) or "1:02:03" (h:mm:ss) or "45" (minutes) → seconds. */
export function parseDuration(input: string): number | null {
  const s = input.trim();
  let total: number;
  if (/^\d{1,3}$/.test(s)) total = Number(s) * 60;
  else {
    const m = /^(?:(\d{1,2}):)?(\d{1,3}):([0-5]\d)$/.exec(s);
    if (!m) return null;
    if (m[1] !== undefined && Number(m[2]) > 59) return null;
    total = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  return total > 0 && total <= 24 * 3600 ? total : null;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** Seconds per km, rounded. */
export function paceSecondsPerKm(metres: number, seconds: number): number {
  return Math.round((seconds * 1000) / metres);
}

export function formatPace(secPerKm: number): string {
  return `${formatDuration(secPerKm)} /km`;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes asleep from bed "23:30" to wake "07:00", crossing midnight if needed. */
export function sleepMinutes(bed: string, wake: string): number | null {
  const b = TIME_RE.exec(bed);
  const w = TIME_RE.exec(wake);
  if (!b || !w) return null;
  const start = Number(b[1]) * 60 + Number(b[2]);
  const end = Number(w[1]) * 60 + Number(w[2]);
  const mins = (end - start + 24 * 60) % (24 * 60);
  return mins === 0 ? null : mins;
}

export function formatHours(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export interface SetFact {
  occurredOn: string;
  exercise: string;
  reps: number;
  weightGrams: number;
}

export interface LiftPb {
  exercise: string;
  weightGrams: number;
  reps: number;
  occurredOn: string;
}

/** Heaviest weight per exercise (ties → more reps, then earliest). Exercise names compare case-insensitively. */
export function liftPbs(sets: readonly SetFact[]): LiftPb[] {
  const best = new Map<string, LiftPb>();
  for (const s of sets) {
    const key = s.exercise.trim().toLowerCase();
    const cur = best.get(key);
    const better =
      !cur ||
      s.weightGrams > cur.weightGrams ||
      (s.weightGrams === cur.weightGrams && s.reps > cur.reps) ||
      (s.weightGrams === cur.weightGrams && s.reps === cur.reps && s.occurredOn < cur.occurredOn);
    if (better) best.set(key, { exercise: s.exercise.trim(), weightGrams: s.weightGrams, reps: s.reps, occurredOn: s.occurredOn });
  }
  return [...best.values()].sort((a, b) => a.exercise.localeCompare(b.exercise));
}

export interface RunFact {
  occurredOn: string;
  distanceMetres: number;
  durationSeconds: number;
}

export interface RunPbs {
  longest: RunFact | null;
  fastestPace: RunFact | null; // runs of 1 km or more
  fastest5k: RunFact | null; // best pace among runs of 5 km or more
}

export function runPbs(runs: readonly RunFact[]): RunPbs {
  const pace = (r: RunFact) => r.durationSeconds / r.distanceMetres;
  let longest: RunFact | null = null;
  let fastestPace: RunFact | null = null;
  let fastest5k: RunFact | null = null;
  for (const r of runs) {
    if (!longest || r.distanceMetres > longest.distanceMetres) longest = r;
    if (r.distanceMetres >= 1000 && (!fastestPace || pace(r) < pace(fastestPace))) fastestPace = r;
    if (r.distanceMetres >= 5000 && (!fastest5k || pace(r) < pace(fastest5k))) fastest5k = r;
  }
  return { longest, fastestPace, fastest5k };
}

/** Derived bonus XP by dragon area name. Each day / night counts once. */
export function bodyXp(facts: { activeDays: Iterable<string>; waterDays: Iterable<string>; sleepNights: Iterable<string> }) {
  const out = new Map<string, number>();
  const add = (k: string, n: number) => n && out.set(k, (out.get(k) ?? 0) + n);
  add("Fitness", new Set(facts.activeDays).size * ACTIVE_DAY_XP);
  add("Nutrition", new Set(facts.waterDays).size * WATER_DAY_XP);
  add("Sleep", new Set(facts.sleepNights).size * SLEEP_NIGHT_XP);
  return out;
}

// ── Next-session suggestions (double progression) ───────────────────────────

/** Rep range for double progression: add reps up to the top, then add weight and drop to the bottom. */
export const REP_RANGE = { low: 6, high: 10 } as const;
export const WEIGHT_STEP_GRAMS = 2500;

export interface LiftSuggestion {
  exercise: string;
  last: { weightGrams: number; reps: number; sets: number; occurredOn: string };
  next: { weightGrams: number; reps: number; sets: number };
  reason: "add-weight" | "add-rep" | "bodyweight";
}

/**
 * For each exercise's most recent session: if you reached the top of the rep
 * range, add 2.5 kg and go back to the bottom; otherwise aim for one more rep
 * at the same weight. Bodyweight work (0 kg) just adds a rep.
 */
export function liftSuggestions(sets: readonly (SetFact & { sets: number })[]): LiftSuggestion[] {
  const latest = new Map<string, SetFact & { sets: number }>();
  for (const s of sets) {
    const key = s.exercise.trim().toLowerCase();
    const cur = latest.get(key);
    // Most recent day; on the same day, the heaviest work set.
    if (!cur || s.occurredOn > cur.occurredOn || (s.occurredOn === cur.occurredOn && s.weightGrams > cur.weightGrams)) latest.set(key, s);
  }
  return [...latest.values()]
    .map((s): LiftSuggestion => {
      const last = { weightGrams: s.weightGrams, reps: s.reps, sets: s.sets, occurredOn: s.occurredOn };
      if (s.weightGrams === 0) return { exercise: s.exercise.trim(), last, next: { weightGrams: 0, reps: s.reps + 1, sets: s.sets }, reason: "bodyweight" };
      if (s.reps >= REP_RANGE.high) {
        return { exercise: s.exercise.trim(), last, next: { weightGrams: s.weightGrams + WEIGHT_STEP_GRAMS, reps: REP_RANGE.low, sets: s.sets }, reason: "add-weight" };
      }
      return { exercise: s.exercise.trim(), last, next: { weightGrams: s.weightGrams, reps: s.reps + 1, sets: s.sets }, reason: "add-rep" };
    })
    .sort((a, b) => b.last.occurredOn.localeCompare(a.last.occurredOn) || a.exercise.localeCompare(b.exercise));
}
