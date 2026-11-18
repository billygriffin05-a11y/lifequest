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
