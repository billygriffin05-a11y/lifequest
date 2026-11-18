/**
 * Pure Honour/XP rules. No I/O — unit tested in tests/unit/honour-rules.test.ts.
 *
 * - Good action: +points Honour and +points XP.
 * - Bad action: -points Honour, no XP change (bad points never cost levels).
 * - Reversal (undo): the exact negation of the original entry.
 */
import type { ActionKind } from "./schemas";

export interface Deltas {
  honourDelta: number;
  xpDelta: number;
}

export function deltasFor(kind: ActionKind, points: number): Deltas {
  if (!Number.isInteger(points) || points < 1) throw new Error("points must be a positive integer");
  return kind === "good" ? { honourDelta: points, xpDelta: points } : { honourDelta: -points, xpDelta: 0 };
}

export function reversalOf(entry: Deltas): Deltas {
  return { honourDelta: -entry.honourDelta, xpDelta: -entry.xpDelta };
}

export const LIFEQUEST_TIME_ZONE = "Europe/London";

/** Local calendar day in Europe/London as YYYY-MM-DD (handles GMT/BST). */
export function londonDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LIFEQUEST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** The `n` calendar-day keys ending at `todayKey` (oldest first). Pure calendar maths, DST-safe. */
export function lastNDateKeys(todayKey: string, n: number): string[] {
  const [y, m, d] = todayKey.split("-").map(Number);
  return Array.from({ length: n }, (_, i) =>
    new Date(Date.UTC(y, m - 1, d - (n - 1 - i), 12)).toISOString().slice(0, 10),
  );
}

export interface DailyPoint {
  date: string;
  /** Good points earned that day (net of undos). */
  good: number;
  /** Bad points lost that day, as a positive number (net of undos). */
  bad: number;
}

/** One point per day for the given keys; days with nothing logged are 0. */
export function buildDailySeries(
  rows: readonly { occurredOn: string; kind: string; honourDelta: number }[],
  keys: readonly string[],
): DailyPoint[] {
  const byDay = new Map(keys.map((k) => [k, { date: k, good: 0, bad: 0 }]));
  for (const r of rows) {
    const p = byDay.get(r.occurredOn);
    if (!p) continue;
    if (r.kind === "good") p.good += r.honourDelta;
    else p.bad -= r.honourDelta;
  }
  return keys.map((k) => byDay.get(k)!);
}

export interface LedgerRow extends Deltas {
  kind: string;
  occurredOn: string;
}

export interface HonourSummary {
  honour: number;
  xp: number;
  today: { good: number; bad: number; net: number };
}

/** Derive totals from ledger rows (reversals are included as negative rows). */
export function summarise(rows: readonly LedgerRow[], todayKey: string): HonourSummary {
  let honour = 0;
  let xp = 0;
  let good = 0;
  let bad = 0;
  for (const r of rows) {
    honour += r.honourDelta;
    xp += r.xpDelta;
    if (r.occurredOn === todayKey) {
      if (r.kind === "good") good += r.honourDelta;
      else bad += -r.honourDelta;
    }
  }
  return { honour, xp, today: { good, bad, net: good - bad } };
}
