/**
 * Mind rules: spaced repetition, reading progress, mood and reward maths. Pure.
 * Tests: tests/unit/mind.test.ts
 */

// ── Spaced repetition (Leitner) ──────────────────────────────────────────────

/** Days until next review for each box. Box 1 = tomorrow. */
export const BOX_INTERVALS = [1, 2, 4, 8, 16] as const;
export const MAX_BOX = BOX_INTERVALS.length;

export function addDays(dayKey: string, n: number): string {
  const d = new Date(`${dayKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Right → move up a box (max 5); wrong → back to box 1. Returns new box and due day. */
export function nextReview(box: number, correct: boolean, today: string): { box: number; dueOn: string } {
  const next = correct ? Math.min(MAX_BOX, Math.max(1, box) + 1) : 1;
  return { box: next, dueOn: addDays(today, BOX_INTERVALS[next - 1]) };
}

// ── Reading ──────────────────────────────────────────────────────────────────

export function readingPercent(pagesRead: number, totalPages: number): number {
  return totalPages > 0 ? Math.min(100, Math.floor((pagesRead / totalPages) * 100)) : 0;
}

// ── Mood ─────────────────────────────────────────────────────────────────────

export const MOODS = [
  { value: 1, emoji: "😞", label: "Rough" },
  { value: 2, emoji: "😕", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
] as const;

export const moodFor = (v: number) => MOODS.find((m) => m.value === v) ?? null;

/** Average to one decimal, or null when nothing logged. */
export function averageMood(values: readonly number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((n, v) => n + v, 0) / values.length) * 10) / 10;
}

// ── Focus ────────────────────────────────────────────────────────────────────

export const FOCUS_LENGTHS = [15, 25, 50] as const;
export const MAX_FOCUS_MINUTES_PER_DAY = 12 * 60;

// ── Rewards (derived; mood is never rewarded or judged) ──────────────────────

export const READING_DAY_XP = 5;
export const BOOK_FINISHED_XP = 50;
export const STUDY_DAY_XP = 5; // a day with 10+ card reviews
export const STUDY_DAY_MIN_REVIEWS = 10;
export const FOCUS_XP_PER_25 = 5; // per 25 focus minutes in a day
export const JOURNAL_DAY_XP = 3;

export function mindXp(facts: {
  readingDays: Iterable<string>;
  booksFinished: number;
  reviewDays: Iterable<string>; // one entry per review
  focus: Iterable<{ day: string; minutes: number }>;
  journalDays: Iterable<string>;
}) {
  const out = new Map<string, number>();
  const add = (k: string, n: number) => n && out.set(k, (out.get(k) ?? 0) + n);

  add("Reading", new Set(facts.readingDays).size * READING_DAY_XP + facts.booksFinished * BOOK_FINISHED_XP);

  const reviewsPerDay = new Map<string, number>();
  for (const d of facts.reviewDays) reviewsPerDay.set(d, (reviewsPerDay.get(d) ?? 0) + 1);
  const studyDays = [...reviewsPerDay.values()].filter((n) => n >= STUDY_DAY_MIN_REVIEWS).length;

  const focusPerDay = new Map<string, number>();
  for (const f of facts.focus) focusPerDay.set(f.day, Math.min(MAX_FOCUS_MINUTES_PER_DAY, (focusPerDay.get(f.day) ?? 0) + f.minutes));
  const focusBlocks = [...focusPerDay.values()].reduce((n, m) => n + Math.floor(m / 25), 0);

  add("Study", studyDays * STUDY_DAY_XP + focusBlocks * FOCUS_XP_PER_25);
  add("Habits", new Set(facts.journalDays).size * JOURNAL_DAY_XP);
  return out;
}
