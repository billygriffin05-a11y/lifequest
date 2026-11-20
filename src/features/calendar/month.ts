/**
 * Month grid for the in-app calendar (pure). Weeks run Monday→Sunday; days
 * outside the month are included to fill whole weeks. Tests: tests/unit/month.test.ts
 */

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const toKey = (d: Date) => d.toISOString().slice(0, 10);

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** Weeks of day keys covering the month, each starting on Monday. */
export function monthGrid(month: string): string[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1, 12));
  const offset = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(first);
  start.setUTCDate(1 - offset);
  const last = new Date(Date.UTC(y, m, 0, 12));
  const weeks: string[][] = [];
  const cur = new Date(start);
  while (cur <= last) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(toKey(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export interface DayActivity {
  good: number;
  bad: number;
  net: number;
  active: boolean; // workout or run
  reading: boolean;
  focusMinutes: number;
  spentPence: number;
  mood: number | null;
  journal: boolean;
}

export const emptyDay = (): DayActivity => ({
  good: 0,
  bad: 0,
  net: 0,
  active: false,
  reading: false,
  focusMinutes: 0,
  spentPence: 0,
  mood: null,
  journal: false,
});

/** Short screen-reader summary of a day. */
export function describeDay(a: DayActivity): string {
  const parts: string[] = [];
  if (a.good) parts.push(`${a.good} good deed${a.good === 1 ? "" : "s"}`);
  if (a.bad) parts.push(`${a.bad} bad habit${a.bad === 1 ? "" : "s"}`);
  if (a.active) parts.push("exercised");
  if (a.reading) parts.push("read");
  if (a.focusMinutes) parts.push(`${a.focusMinutes} min focus`);
  if (a.journal) parts.push("journal");
  return parts.length ? parts.join(", ") : "nothing logged";
}
