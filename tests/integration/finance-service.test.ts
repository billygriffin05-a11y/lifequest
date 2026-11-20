import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUDGET_REWARD_XP } from "@/features/finance/money";
import {
  addDeposit,
  addStarterCategories,
  addTransaction,
  createGoal,
  deleteTransaction,
  getBudgetRewardMonths,
  getMonthOverview,
  importBankCsv,
  listCategories,
  listGoals,
  saveCategory,
  setTransactionCategory,
} from "@/features/finance/server/service";
import { getStreakBonusByCategory } from "@/features/honour/server/service";
import { createPrismaClient } from "@/server/db/factory";
import { makeTempDataDir, migrate } from "../support/temp-data-dir";

const { paths, cleanup } = makeTempDataDir("finance");
let db: ReturnType<typeof createPrismaClient>;
beforeAll(() => {
  migrate(paths);
  db = createPrismaClient(paths.dbFile);
});
afterAll(async () => {
  await db.$disconnect();
  cleanup();
});

const NOW = new Date(Date.UTC(2026, 10, 19, 12));
const idOf = async (name: string) => (await listCategories(db)).find((c) => c.name === name)!.id;

describe("money service", () => {
  it("adds starter categories once and rejects duplicate names", async () => {
    expect(await addStarterCategories(db)).toBe(8);
    expect(await addStarterCategories(db)).toBe(0);
    await expect(saveCategory(db, { name: "Groceries", icon: "🛒", monthlyLimitPence: 1 })).rejects.toThrow(/already exists/);
  });

  it("imports a bank CSV, auto-sorts and skips re-imports", async () => {
    const csv = "Date,Description,Amount\n03/10/2026,TESCO STORES,-40.00\n04/10/2026,NETFLIX.COM,-10.99\n05/10/2026,Salary,1500.00\n";
    const first = await importBankCsv(db, csv);
    expect(first).toMatchObject({ imported: 3, duplicates: 0, categorised: 2 });
    const again = await importBankCsv(db, csv);
    expect(again).toMatchObject({ imported: 0, duplicates: 3 });
    expect((await importBankCsv(db, "nope")).error).toBe("no-header");
  });

  it("builds a month overview with budgets, spending and income", async () => {
    const o = await getMonthOverview(db, "2026-10");
    expect(o.spent).toBe(5099);
    expect(o.income).toBe(150000);
    const groceries = o.categories.find((c) => c.name === "Groceries")!;
    expect(groceries).toMatchObject({ spent: 4000, limit: 25000, state: "ok" });
  });

  it("re-categorises and soft-deletes transactions", async () => {
    const tx = await addTransaction(db, { occurredOn: "2026-10-10", amountPence: 9000, description: "Big meal", categoryId: null });
    expect((await getMonthOverview(db, "2026-10")).uncategorised).toBe(9000);
    await setTransactionCategory(db, tx.id, await idOf("Eating out"));
    const eating = (await getMonthOverview(db, "2026-10")).categories.find((c) => c.name === "Eating out")!;
    expect(eating.state).toBe("over");
    await deleteTransaction(db, tx.id);
    expect((await getMonthOverview(db, "2026-10")).spent).toBe(5099);
  });

  it("rewards finished months that stayed in budget with Finance XP", async () => {
    expect(await getBudgetRewardMonths(db, "2026-11")).toEqual(["2026-10"]);
    expect(await getBudgetRewardMonths(db, "2026-10")).toEqual([]); // current month never counts
    const bonus = await getStreakBonusByCategory(db, NOW);
    expect(bonus.get("Finance") ?? 0).toBeGreaterThanOrEqual(BUDGET_REWARD_XP);

    await addTransaction(db, { occurredOn: "2026-09-02", amountPence: 99999, description: "Splurge", categoryId: await idOf("Shopping") });
    expect(await getBudgetRewardMonths(db, "2026-11")).toEqual(["2026-10"]);
  });

  it("tracks savings goals and blocks overdrawing", async () => {
    const g = await createGoal(db, { name: "Holiday", icon: "🏖️", targetPence: 50000 });
    await addDeposit(db, g.id, 20000, "2026-11-01");
    await addDeposit(db, g.id, -5000, "2026-11-02");
    expect((await listGoals(db))[0]).toMatchObject({ saved: 15000, percent: 30 });
    await expect(addDeposit(db, g.id, -20000, "2026-11-03")).rejects.toThrow(/withdraw more/);
  });
});
