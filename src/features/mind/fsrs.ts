/**
 * FSRS-4.5 spaced repetition (the scheduler modern Anki uses), with the
 * published default parameters and a 90% target retention. Pure.
 * Grades: 1 Again, 2 Hard, 3 Good, 4 Easy.
 * Tests: tests/unit/habits-c.test.ts
 */
import { addDays } from "./rules";

export type Grade = 1 | 2 | 3 | 4;
export const GRADES: readonly { grade: Grade; label: string }[] = [
  { grade: 1, label: "Again" },
  { grade: 2, label: "Hard" },
  { grade: 3, label: "Good" },
  { grade: 4, label: "Easy" },
];

const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755] as const;
const DECAY = -0.5;
const FACTOR = 19 / 81;
export const TARGET_RETENTION = 0.9;
export const MAX_INTERVAL = 365;

const clampD = (d: number) => Math.min(10, Math.max(1, d));

/** Chance of recalling a card `elapsed` days after review with stability `s`. */
export function retrievability(elapsed: number, s: number): number {
  return Math.pow(1 + (FACTOR * Math.max(0, elapsed)) / s, DECAY);
}

/** Days until recall probability drops to the target. */
export function intervalFor(s: number, retention = TARGET_RETENTION): number {
  const days = (s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return Math.min(MAX_INTERVAL, Math.max(1, Math.round(days)));
}

const initD = (g: Grade) => clampD(W[4] - (g - 3) * W[5]);

export interface MemoryState {
  stability: number;
  difficulty: number;
}

/** Next memory state after a review. `prev` null = first review of this card. */
export function nextState(prev: MemoryState | null, grade: Grade, elapsedDays: number): MemoryState {
  if (!prev) return { stability: W[grade - 1], difficulty: initD(grade) };
  const { stability: s, difficulty: d } = prev;
  const r = retrievability(elapsedDays, s);
  const d1 = d - W[6] * (grade - 3);
  const difficulty = clampD(W[7] * initD(4) + (1 - W[7]) * d1);
  if (grade === 1) {
    const stability = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
    return { stability: Math.min(stability, s), difficulty };
  }
  const hard = grade === 2 ? W[15] : 1;
  const easy = grade === 4 ? W[16] : 1;
  const stability = s * (Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy + 1);
  return { stability, difficulty };
}

/** Leitner-style box (1–5) for display, from the interval. */
export function boxFor(intervalDays: number): number {
  return intervalDays <= 1 ? 1 : intervalDays <= 3 ? 2 : intervalDays <= 7 ? 3 : intervalDays <= 21 ? 4 : 5;
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/** Schedule a review: new state, due day, display box. "Again" always comes back tomorrow. */
export function schedule(
  card: { stability: number | null; difficulty: number | null; lastReviewOn: string | null },
  grade: Grade,
  today: string,
) {
  const prev = card.stability && card.difficulty ? { stability: card.stability, difficulty: card.difficulty } : null;
  const elapsed = card.lastReviewOn ? Math.max(0, daysBetween(card.lastReviewOn, today)) : 0;
  const state = nextState(prev, grade, elapsed);
  const interval = grade === 1 ? 1 : intervalFor(state.stability);
  return { ...state, dueOn: addDays(today, interval), box: boxFor(interval), interval, lastReviewOn: today };
}
