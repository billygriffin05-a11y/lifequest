/**
 * Security+ mock exam rules (pure). The real SY0-701 is up to 90 questions in
 * 90 minutes with a pass mark of 750 on a 100–900 scale. CompTIA's scaling is
 * not public, so the score here is a rough linear guide, labelled as such.
 * Tests: tests/unit/habits-c.test.ts
 */
export const EXAM_QUESTIONS = 90;
export const EXAM_SECONDS = 90 * 60;
export const PASS_SCALED = 750;

export interface TopicResult {
  topic: string;
  total: number;
  correct: number;
}

/** Rough guide only: maps % correct linearly onto 100–900. */
export function scaledScore(correct: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round(100 + 800 * (correct / total));
}

export function byTopic(answers: readonly { topic: string; correct: boolean }[]): TopicResult[] {
  const m = new Map<string, TopicResult>();
  for (const a of answers) {
    const t = a.topic || "Other";
    const r = m.get(t) ?? { topic: t, total: 0, correct: 0 };
    r.total++;
    if (a.correct) r.correct++;
    m.set(t, r);
  }
  return [...m.values()].sort((a, b) => a.topic.localeCompare(b.topic));
}

/** Deterministic shuffle (seeded), so a paper is stable for one sitting. */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let s = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
