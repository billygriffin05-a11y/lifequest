/**
 * Money helpers. Amounts are ALWAYS integer pence — never floats.
 * Tests: tests/unit/finance.test.ts
 */

/** Parse "12", "12.3", "12.34", "£1,234.50", "-4.99" into integer pence. Returns null if invalid. */
export function parsePounds(input: string): number | null {
  const s = input.trim().replace(/^£/, "").replace(/,/g, "");
  const m = /^(-)?(\d{1,9})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const pounds = Number(m[2]);
  const pence = Number((m[3] ?? "0").padEnd(2, "0"));
  const total = pounds * 100 + pence;
  return m[1] ? -total : total;
}

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function formatPence(pence: number): string {
  return gbp.format(pence / 100);
}

/** "YYYY-MM" for a "YYYY-MM-DD" day key. */
export function monthOf(dayKey: string): string {
  return dayKey.slice(0, 7);
}

/** First and last day keys of a "YYYY-MM" month. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export type BudgetState = "none" | "ok" | "warn" | "over";

/** Status of one category: warn at 80%, over when spent > limit. */
export function budgetStatus(spentPence: number, limitPence: number): { state: BudgetState; percent: number; remaining: number } {
  if (limitPence <= 0) return { state: "none", percent: 0, remaining: 0 };
  const percent = Math.round((Math.max(0, spentPence) / limitPence) * 100);
  const state: BudgetState = spentPence > limitPence ? "over" : percent >= 80 ? "warn" : "ok";
  return { state, percent, remaining: limitPence - spentPence };
}

export const BUDGET_REWARD_XP = 50;

/**
 * A finished month earns the reward if it had spending and every category
 * with a limit stayed within it.
 */
export function monthUnderBudget(spentByCategory: ReadonlyMap<string, number>, limits: ReadonlyMap<string, number>): boolean {
  const limited = [...limits].filter(([, l]) => l > 0);
  if (limited.length === 0) return false;
  const anySpend = [...spentByCategory.values()].some((v) => v > 0);
  return anySpend && limited.every(([id, limit]) => (spentByCategory.get(id) ?? 0) <= limit);
}
