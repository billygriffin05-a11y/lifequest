/**
 * Money service: budgets, spending, savings, CSV import. All values integer
 * pence; everything stays in the local database. Deletes are soft.
 */
import { z } from "zod";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_CATEGORIES, guessCategory, rowsFromCsv } from "../csv-import";
import { budgetStatus, monthOf, monthRange, monthUnderBudget, type BudgetState } from "../money";

type Db = PrismaClient;
const audit = (db: Db, action: string, entityId?: string, details?: object) =>
  db.auditEvent.create({ data: { actor: "owner", action, entityType: "Money", entityId, details: details ? JSON.stringify(details) : null } });

export class MoneyError extends Error {}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PENCE = 100_000_000; // £1m sanity cap

// ── Categories ───────────────────────────────────────────────────────────────

export const categoryInput = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(30),
    icon: z.string().trim().min(1).max(16),
    monthlyLimitPence: z.number().int().min(0).max(MAX_PENCE),
  })
  .strict();

export function listCategories(db: Db, includeArchived = false) {
  return db.budgetCategory.findMany({ where: includeArchived ? {} : { archivedAt: null }, orderBy: { name: "asc" } });
}

export async function addStarterCategories(db: Db): Promise<number> {
  if ((await db.budgetCategory.count()) > 0) return 0;
  for (const c of DEFAULT_CATEGORIES) await db.budgetCategory.create({ data: { name: c.name, icon: c.icon, monthlyLimitPence: c.limitPence } });
  await audit(db, "money.categories.starter");
  return DEFAULT_CATEGORIES.length;
}

export async function saveCategory(db: Db, input: z.input<typeof categoryInput>, id?: string) {
  const data = categoryInput.parse(input);
  try {
    const row = id
      ? await db.budgetCategory.update({ where: { id }, data: { ...data, version: { increment: 1 } } })
      : await db.budgetCategory.create({ data });
    await audit(db, id ? "money.category.update" : "money.category.create", row.id);
    return row;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new MoneyError("A category with that name already exists.");
    throw err;
  }
}

export async function archiveCategory(db: Db, id: string, archived: boolean) {
  await db.budgetCategory.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await audit(db, archived ? "money.category.archive" : "money.category.restore", id);
}

// ── Transactions ─────────────────────────────────────────────────────────────

export const transactionInput = z
  .object({
    occurredOn: z.string().regex(DAY_RE, "Pick a date"),
    amountPence: z.number().int().refine((v) => v !== 0 && Math.abs(v) <= MAX_PENCE, "Enter an amount"),
    description: z.string().trim().min(1, "Add a description").max(200),
    categoryId: z.string().min(1).max(64).nullable(),
  })
  .strict();

export async function addTransaction(db: Db, input: z.input<typeof transactionInput>) {
  const data = transactionInput.parse(input);
  if (data.categoryId && !(await db.budgetCategory.findUnique({ where: { id: data.categoryId } }))) throw new MoneyError("Unknown category.");
  const row = await db.transaction.create({ data: { ...data, source: "manual" } });
  await audit(db, "money.tx.add", row.id);
  return row;
}

export async function setTransactionCategory(db: Db, id: string, categoryId: string | null) {
  if (categoryId && !(await db.budgetCategory.findUnique({ where: { id: categoryId } }))) throw new MoneyError("Unknown category.");
  await db.transaction.update({ where: { id }, data: { categoryId } });
}

export async function deleteTransaction(db: Db, id: string) {
  await db.transaction.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(db, "money.tx.delete", id);
}

export interface CsvImportSummary {
  imported: number;
  duplicates: number;
  skipped: number;
  categorised: number;
  error?: string;
}

/** Import a bank CSV. Re-importing the same file adds nothing (fingerprints). */
export async function importBankCsv(db: Db, text: string): Promise<CsvImportSummary> {
  const parsed = rowsFromCsv(text);
  if (parsed.error) return { imported: 0, duplicates: 0, skipped: parsed.skipped, categorised: 0, error: parsed.error };
  const categories = await listCategories(db);
  const byName = new Map(categories.map((c) => [c.name, c.id]));
  let imported = 0;
  let duplicates = 0;
  let categorised = 0;
  for (const r of parsed.rows) {
    const guess = guessCategory(r.description, [...byName.keys()]);
    try {
      await db.transaction.create({
        data: {
          occurredOn: r.occurredOn,
          amountPence: r.amountPence,
          description: r.description,
          importHash: r.importHash,
          source: "import",
          categoryId: guess ? byName.get(guess)! : null,
        },
      });
      imported++;
      if (guess) categorised++;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") duplicates++;
      else throw err;
    }
  }
  await audit(db, "money.import", undefined, { imported, duplicates, skipped: parsed.skipped });
  return { imported, duplicates, skipped: parsed.skipped, categorised };
}

// ── Month overview ───────────────────────────────────────────────────────────

export interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  limit: number;
  spent: number;
  state: BudgetState;
  percent: number;
  remaining: number;
  archived: boolean;
}

export async function getMonthOverview(db: Db, month: string) {
  const { from, to } = monthRange(month);
  const [categories, txs] = await Promise.all([
    listCategories(db, true),
    db.transaction.findMany({
      where: { deletedAt: null, occurredOn: { gte: from, lte: to } },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    }),
  ]);
  const spentBy = new Map<string | null, number>();
  let spent = 0;
  let income = 0;
  for (const t of txs) {
    if (t.amountPence > 0) spent += t.amountPence;
    else income -= t.amountPence;
    // Uncategorised money in (e.g. salary) must not cancel uncategorised spending.
    if (t.categoryId === null && t.amountPence < 0) continue;
    spentBy.set(t.categoryId, (spentBy.get(t.categoryId) ?? 0) + t.amountPence);
  }
  const rows: CategoryRow[] = categories
    .filter((c) => !c.archivedAt || spentBy.has(c.id))
    .map((c) => {
      const s = Math.max(0, spentBy.get(c.id) ?? 0);
      return { id: c.id, name: c.name, icon: c.icon, limit: c.monthlyLimitPence, spent: s, archived: !!c.archivedAt, ...budgetStatus(s, c.monthlyLimitPence) };
    });
  const totalLimit = categories.filter((c) => !c.archivedAt).reduce((n, c) => n + c.monthlyLimitPence, 0);
  return { month, categories: rows, uncategorised: Math.max(0, spentBy.get(null) ?? 0), spent, income, totalLimit, transactions: txs };
}

// ── Budget rewards (derived) ─────────────────────────────────────────────────

/** Finished months (before `currentMonth`) where every limited category stayed within budget. */
export async function getBudgetRewardMonths(db: Db, currentMonth: string): Promise<string[]> {
  const [categories, txs] = await Promise.all([
    db.budgetCategory.findMany({ select: { id: true, monthlyLimitPence: true, archivedAt: true } }),
    db.transaction.findMany({ where: { deletedAt: null }, select: { occurredOn: true, amountPence: true, categoryId: true } }),
  ]);
  const limits = new Map(categories.filter((c) => !c.archivedAt).map((c) => [c.id, c.monthlyLimitPence]));
  const byMonth = new Map<string, Map<string, number>>();
  for (const t of txs) {
    const m = monthOf(t.occurredOn);
    if (m >= currentMonth || !t.categoryId) continue;
    const mm = byMonth.get(m) ?? new Map<string, number>();
    mm.set(t.categoryId, (mm.get(t.categoryId) ?? 0) + t.amountPence);
    byMonth.set(m, mm);
  }
  return [...byMonth].filter(([, spent]) => monthUnderBudget(spent, limits)).map(([m]) => m).sort();
}

// ── Savings ──────────────────────────────────────────────────────────────────

export const goalInput = z
  .object({ name: z.string().trim().min(1).max(40), icon: z.string().trim().min(1).max(16), targetPence: z.number().int().min(1).max(MAX_PENCE) })
  .strict();

export async function listGoals(db: Db) {
  const goals = await db.savingsGoal.findMany({ where: { archivedAt: null }, include: { deposits: true }, orderBy: { createdAt: "asc" } });
  return goals.map((g) => {
    const saved = g.deposits.reduce((n, d) => n + d.amountPence, 0);
    return { id: g.id, name: g.name, icon: g.icon, target: g.targetPence, saved, percent: Math.min(100, Math.floor((saved / g.targetPence) * 100)) };
  });
}

export async function createGoal(db: Db, input: z.input<typeof goalInput>) {
  const g = await db.savingsGoal.create({ data: goalInput.parse(input) });
  await audit(db, "money.goal.create", g.id);
  return g;
}

/** Add (positive) or withdraw (negative). Can't withdraw more than is saved. */
export async function addDeposit(db: Db, goalId: string, amountPence: number, occurredOn: string) {
  if (!Number.isInteger(amountPence) || amountPence === 0 || Math.abs(amountPence) > MAX_PENCE) throw new MoneyError("Enter an amount.");
  if (!DAY_RE.test(occurredOn)) throw new MoneyError("Pick a date.");
  const goal = await db.savingsGoal.findUnique({ where: { id: goalId }, include: { deposits: true } });
  if (!goal) throw new MoneyError("Unknown goal.");
  const saved = goal.deposits.reduce((n, d) => n + d.amountPence, 0);
  if (saved + amountPence < 0) throw new MoneyError("You can't withdraw more than you've saved.");
  await db.savingsDeposit.create({ data: { goalId, amountPence, occurredOn } });
  await audit(db, amountPence > 0 ? "money.goal.deposit" : "money.goal.withdraw", goalId);
}

export async function archiveGoal(db: Db, id: string) {
  await db.savingsGoal.update({ where: { id }, data: { archivedAt: new Date() } });
}
