/**
 * Find repeating payments (bills, subscriptions) in spending. Pure; amounts in
 * integer pence. A payment repeats when the same payee appears 3+ times (or
 * twice for yearly) at a steady interval with a similar amount.
 * Tests: tests/unit/habits-c.test.ts
 */

export type Cadence = "weekly" | "monthly" | "yearly";

export interface SpendFact {
  occurredOn: string;
  amountPence: number; // positive = money out
  description: string;
}

export interface Recurring {
  payee: string;
  cadence: Cadence;
  /** Typical (median) amount per payment, pence. */
  amountPence: number;
  /** Estimated cost per year, pence. */
  yearlyPence: number;
  lastOn: string;
  nextOn: string;
  count: number;
}

const DAY = 86_400_000;
const toMs = (k: string) => Date.parse(`${k}T12:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Payee key: lower-case words without card refs, dates and long numbers. */
export function payeeKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/\b(card|ref|pos|dd|so|fp|bgc|vis|contactless|payment|to|from)\b/g, " ")
    .replace(/[0-9]{2,}[^ ]*/g, " ")
    .replace(/[^a-z& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

const CADENCES: { cadence: Cadence; min: number; max: number; days: number; perYear: number; minCount: number }[] = [
  { cadence: "weekly", min: 5, max: 9, days: 7, perYear: 52, minCount: 3 },
  { cadence: "monthly", min: 26, max: 35, days: 0, perYear: 12, minCount: 3 },
  { cadence: "yearly", min: 350, max: 380, days: 365, perYear: 1, minCount: 2 },
];

function addMonth(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return fromMs(Date.UTC(y, m, Math.min(d, last), 12));
}

export function findRecurring(spend: readonly SpendFact[]): Recurring[] {
  const groups = new Map<string, { name: string; rows: SpendFact[] }>();
  for (const s of spend) {
    if (s.amountPence <= 0) continue;
    const key = payeeKey(s.description);
    if (key.length < 2) continue;
    const g = groups.get(key) ?? { name: s.description.trim(), rows: [] };
    g.rows.push(s);
    groups.set(key, g);
  }
  const out: Recurring[] = [];
  for (const { name, rows } of groups.values()) {
    // One payment per day per payee.
    const byDay = new Map<string, SpendFact>();
    for (const r of rows) if (!byDay.has(r.occurredOn)) byDay.set(r.occurredOn, r);
    const list = [...byDay.values()].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
    if (list.length < 2) continue;
    const gaps = list.slice(1).map((r, i) => Math.round((toMs(r.occurredOn) - toMs(list[i].occurredOn)) / DAY));
    const gap = median(gaps);
    const c = CADENCES.find((x) => gap >= x.min && gap <= x.max);
    if (!c || list.length < c.minCount) continue;
    // Most gaps must fit the cadence, and amounts must be steady (within 20% of the median).
    if (gaps.filter((g) => g >= c.min && g <= c.max).length < Math.ceil(gaps.length * 0.75)) continue;
    const amounts = list.map((r) => r.amountPence);
    const typical = median(amounts);
    if (amounts.some((a) => Math.abs(a - typical) > typical * 0.2)) continue;
    const lastOn = list[list.length - 1].occurredOn;
    const nextOn = c.cadence === "monthly" ? addMonth(lastOn) : fromMs(toMs(lastOn) + c.days * DAY);
    out.push({ payee: name, cadence: c.cadence, amountPence: typical, yearlyPence: typical * c.perYear, lastOn, nextOn, count: list.length });
  }
  return out.sort((a, b) => b.yearlyPence - a.yearlyPence);
}

/** Next due date on or after `today` (rolls forward missed cycles). */
export function nextDue(r: Pick<Recurring, "cadence" | "nextOn">, today: string): string {
  let next = r.nextOn;
  for (let i = 0; i < 60 && next < today; i++) {
    next = r.cadence === "monthly" ? addMonth(next) : fromMs(toMs(next) + (r.cadence === "weekly" ? 7 : 365) * DAY);
  }
  return next;
}
