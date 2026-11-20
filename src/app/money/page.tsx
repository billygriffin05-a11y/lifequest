import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CategorySelect } from "@/features/finance/components/category-select";
import { BUDGET_REWARD_XP, formatPence, MONTH_RE, shiftMonth } from "@/features/finance/money";
import {
  addStarterCategoriesAction,
  addTransactionAction,
  archiveCategoryAction,
  createGoalAction,
  deleteTransactionAction,
  depositAction,
  importCsvAction,
  saveCategoryAction,
} from "@/features/finance/server/actions";
import { getBudgetRewardMonths, getMonthOverview, listCategories, listGoals } from "@/features/finance/server/service";
import { londonDateKey } from "@/features/honour/rules";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "Money · LIFEQUEST" };

const card = "rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-5";
const input =
  "mt-1 block min-h-11 w-full rounded-lg border border-obsidian-600 bg-obsidian-950 px-3 text-silver-100 placeholder:text-silver-500 focus-visible:outline-2 focus-visible:outline-emerald-400";
const btn =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";
const barColour = { none: "bg-silver-500", ok: "bg-emerald-400", warn: "bg-gold-400", over: "bg-ember-500" } as const;
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const monthName = (m: string) => monthFmt.format(new Date(`${m}-15T12:00:00Z`));

async function Money({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const sp = await searchParams;
  const today = londonDateKey(new Date());
  const month = typeof sp.m === "string" && MONTH_RE.test(sp.m) ? sp.m : today.slice(0, 7);
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const err = typeof sp.err === "string" ? sp.err : null;
  const [overview, categories, goals, rewardMonths] = await Promise.all([
    getMonthOverview(prisma, month),
    listCategories(prisma),
    listGoals(prisma),
    getBudgetRewardMonths(prisma, today.slice(0, 7)),
  ]);
  const options = categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon }));
  const isCurrent = month === today.slice(0, 7);

  return (
    <div className="grid gap-6">
      {(ok || err) && (
        <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${ok ? "border-emerald-500/40 text-emerald-300" : "border-ember-500/40 text-ember-300"}`}>
          {ok ?? err}
        </p>
      )}

      {/* Month header */}
      <section aria-labelledby="month-heading" className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/money?m=${shiftMonth(month, -1)}`} className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
            ← {monthName(shiftMonth(month, -1))}
          </Link>
          <h2 id="month-heading" className="font-display text-2xl text-gold-300">
            {monthName(month)}
          </h2>
          {isCurrent ? (
            <span className="w-24" />
          ) : (
            <Link href={`/money?m=${shiftMonth(month, 1)}`} className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
              {monthName(shiftMonth(month, 1))} →
            </Link>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <dt className="text-xs uppercase tracking-wider text-silver-300">Spent</dt>
            <dd className="font-display text-2xl text-silver-100" data-testid="month-spent">
              {formatPence(overview.spent)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-silver-300">Budget</dt>
            <dd className="font-display text-2xl text-silver-100">{overview.totalLimit ? formatPence(overview.totalLimit) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-silver-300">Money in</dt>
            <dd className="font-display text-2xl text-emerald-300">{formatPence(overview.income)}</dd>
          </div>
        </dl>
      </section>

      {/* Budgets */}
      <section aria-labelledby="budgets-heading" className={card}>
        <h2 id="budgets-heading" className="font-display text-xl text-gold-300">
          Budgets
        </h2>
        {categories.length === 0 ? (
          <form action={addStarterCategoriesAction} className="mt-3">
            <input type="hidden" name="m" value={month} />
            <p className="text-silver-300">No categories yet.</p>
            <button type="submit" className={`${btn} mt-2 bg-gold-500 text-obsidian-950 hover:bg-gold-400`}>
              Add starter categories
            </button>
          </form>
        ) : (
          <ul className="mt-3 grid gap-3" aria-label="Budget categories">
            {overview.categories.map((c) => (
              <li key={c.id} data-testid={`budget-${c.name}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-silver-100">
                    <span aria-hidden="true">{c.icon}</span> {c.name}
                    {c.archived && <span className="text-silver-500"> (archived)</span>}
                  </span>
                  <span className={c.state === "over" ? "text-ember-300" : "text-silver-300"}>
                    {formatPence(c.spent)}
                    {c.limit > 0 ? ` of ${formatPence(c.limit)}` : " (no limit)"}
                    {c.state === "over" ? " — over budget" : c.limit > 0 ? ` · ${formatPence(c.remaining)} left` : ""}
                  </span>
                </div>
                {c.limit > 0 && (
                  <div
                    role="progressbar"
                    aria-label={`${c.name} budget used`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, c.percent)}
                    className="mt-1 h-2 overflow-hidden rounded-full bg-obsidian-700"
                  >
                    <div className={`h-full rounded-full ${barColour[c.state]}`} style={{ width: `${Math.min(100, c.percent)}%` }} />
                  </div>
                )}
              </li>
            ))}
            {overview.uncategorised > 0 && <li className="text-sm text-silver-300">Uncategorised: {formatPence(overview.uncategorised)}</li>}
          </ul>
        )}
        <p className="mt-4 text-sm text-silver-300">
          Stay within every budget for a whole month to earn <strong className="text-gold-300">+{BUDGET_REWARD_XP} XP</strong> for your
          Finance dragon.{" "}
          {rewardMonths.length > 0 && <span className="text-emerald-300">Earned for {rewardMonths.map(monthName).join(", ")}.</span>}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Add spending */}
        <section aria-labelledby="add-heading" className={card}>
          <h2 id="add-heading" className="font-display text-xl text-gold-300">
            Add money in / out
          </h2>
          <form action={addTransactionAction} className="mt-3 grid gap-3 sm:grid-cols-2" aria-label="Add transaction">
            <input type="hidden" name="m" value={month} />
            <fieldset className="sm:col-span-2">
              <legend className="text-sm text-silver-300">Type</legend>
              <div className="mt-1 flex gap-3 text-sm">
                <label className="flex min-h-11 items-center gap-2 text-silver-100">
                  <input type="radio" name="direction" value="out" defaultChecked /> Money out
                </label>
                <label className="flex min-h-11 items-center gap-2 text-silver-100">
                  <input type="radio" name="direction" value="in" /> Money in
                </label>
              </div>
            </fieldset>
            <div>
              <label htmlFor="tx-amount" className="text-sm text-silver-300">
                Amount (£)
              </label>
              <input id="tx-amount" name="amount" inputMode="decimal" required placeholder="12.50" className={input} />
            </div>
            <div>
              <label htmlFor="tx-date" className="text-sm text-silver-300">
                Date
              </label>
              <input id="tx-date" name="date" type="date" required defaultValue={isCurrent ? today : `${month}-01`} className={input} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="tx-desc" className="text-sm text-silver-300">
                Description
              </label>
              <input id="tx-desc" name="description" required maxLength={200} placeholder="e.g. Tesco food shop" className={input} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="tx-cat" className="text-sm text-silver-300">
                Category
              </label>
              <select id="tx-cat" name="categoryId" className={input}>
                <option value="">Uncategorised</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.icon} {o.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={`${btn} bg-gold-500 text-obsidian-950 hover:bg-gold-400 sm:col-span-2`}>
              Save
            </button>
          </form>
        </section>

        {/* Import */}
        <section aria-labelledby="import-heading" className={card}>
          <h2 id="import-heading" className="font-display text-xl text-gold-300">
            Import a bank statement
          </h2>
          <p className="mt-1 text-sm text-silver-300">
            Download a CSV statement from your bank&apos;s website or app (Monzo, Starling, Barclays, HSBC, Nationwide, Lloyds…) and import it
            here. It stays on this PC; duplicates are skipped and familiar shops are sorted automatically. No bank login needed.
          </p>
          <form action={importCsvAction} className="mt-3 grid gap-3" aria-label="Import CSV">
            <input type="hidden" name="m" value={month} />
            <label htmlFor="csv-file" className="text-sm text-silver-300">
              CSV file
            </label>
            <input id="csv-file" name="csv" type="file" accept=".csv,text/csv" required className="text-sm text-silver-300" />
            <button type="submit" className={`${btn} border border-emerald-500/50 text-emerald-300 hover:bg-emerald-700/20`}>
              Import
            </button>
          </form>
        </section>
      </div>

      {/* Transactions */}
      <section aria-labelledby="tx-heading" className={card}>
        <h2 id="tx-heading" className="font-display text-xl text-gold-300">
          Transactions · {monthName(month)}
        </h2>
        {overview.transactions.length === 0 ? (
          <p className="mt-3 text-silver-300">Nothing yet this month.</p>
        ) : (
          <ul className="mt-3 divide-y divide-obsidian-700" data-testid="transactions">
            {overview.transactions.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="w-14 text-silver-300">{dayFmt.format(new Date(`${t.occurredOn}T12:00:00Z`))}</span>
                <span className="min-w-0 flex-1 truncate text-silver-100">{t.description}</span>
                <span className={`tabular-nums ${t.amountPence > 0 ? "text-silver-100" : "text-emerald-300"}`}>
                  {t.amountPence > 0 ? "−" : "+"}
                  {formatPence(Math.abs(t.amountPence))}
                </span>
                <CategorySelect id={t.id} value={t.categoryId} options={options} label={`Category for ${t.description}`} />
                <form action={deleteTransactionAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="m" value={month} />
                  <button type="submit" aria-label={`Remove ${t.description}`} className="min-h-11 px-2 text-silver-300 hover:text-ember-300">
                    ✕
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Savings */}
        <section aria-labelledby="savings-heading" className={card}>
          <h2 id="savings-heading" className="font-display text-xl text-gold-300">
            Savings goals
          </h2>
          <ul className="mt-3 grid gap-4">
            {goals.map((g) => (
              <li key={g.id} data-testid={`goal-${g.name}`}>
                <p className="flex justify-between text-sm">
                  <span className="text-silver-100">
                    <span aria-hidden="true">{g.icon}</span> {g.name}
                  </span>
                  <span className="text-silver-300">
                    {formatPence(g.saved)} of {formatPence(g.target)}
                  </span>
                </p>
                <div
                  role="progressbar"
                  aria-label={`${g.name} saved`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={g.percent}
                  className="mt-1 h-2 overflow-hidden rounded-full bg-obsidian-700"
                >
                  <div className="h-full rounded-full bg-gold-400" style={{ width: `${g.percent}%` }} />
                </div>
                <form action={depositAction} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="goalId" value={g.id} />
                  <input type="hidden" name="m" value={month} />
                  <label htmlFor={`dep-${g.id}`} className="sr-only">
                    Amount for {g.name}
                  </label>
                  <input id={`dep-${g.id}`} name="amount" inputMode="decimal" placeholder="25" required className={`${input} mt-0 w-24`} />
                  <button type="submit" name="mode" value="deposit" className={`${btn} border border-emerald-500/50 text-emerald-300`}>
                    Add
                  </button>
                  <button type="submit" name="mode" value="withdraw" className={`${btn} border border-silver-500/40 text-silver-300`}>
                    Withdraw
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <form action={createGoalAction} className="mt-4 grid gap-2 sm:grid-cols-[1fr_6rem_6rem_auto]" aria-label="New savings goal">
            <input type="hidden" name="m" value={month} />
            <label className="sr-only" htmlFor="goal-name">
              Goal name
            </label>
            <input id="goal-name" name="name" required maxLength={40} placeholder="e.g. Holiday" className={`${input} mt-0`} />
            <label className="sr-only" htmlFor="goal-icon">
              Goal icon
            </label>
            <input id="goal-icon" name="icon" maxLength={16} defaultValue="🐷" className={`${input} mt-0`} />
            <label className="sr-only" htmlFor="goal-target">
              Target (£)
            </label>
            <input id="goal-target" name="target" inputMode="decimal" required placeholder="£ target" className={`${input} mt-0`} />
            <button type="submit" className={`${btn} bg-gold-500 text-obsidian-950 hover:bg-gold-400`}>
              New goal
            </button>
          </form>
        </section>

        {/* Manage categories */}
        <section aria-labelledby="cats-heading" className={card}>
          <h2 id="cats-heading" className="font-display text-xl text-gold-300">
            Categories &amp; limits
          </h2>
          <ul className="mt-3 grid gap-2">
            {categories.map((c) => (
              <li key={c.id}>
                <form action={saveCategoryAction} className="flex flex-wrap items-center gap-2" aria-label={`Edit ${c.name}`}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="m" value={month} />
                  <input type="hidden" name="icon" value={c.icon} />
                  <span aria-hidden="true">{c.icon}</span>
                  <label className="sr-only" htmlFor={`cat-name-${c.id}`}>
                    Name
                  </label>
                  <input id={`cat-name-${c.id}`} name="name" defaultValue={c.name} maxLength={30} className={`${input} mt-0 w-36 flex-1`} />
                  <label className="sr-only" htmlFor={`cat-limit-${c.id}`}>
                    Monthly limit for {c.name} (£)
                  </label>
                  <input
                    id={`cat-limit-${c.id}`}
                    name="limit"
                    inputMode="decimal"
                    defaultValue={(c.monthlyLimitPence / 100).toFixed(2)}
                    className={`${input} mt-0 w-24`}
                  />
                  <button type="submit" className={`${btn} border border-emerald-500/50 text-emerald-300`}>
                    Save
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <form action={saveCategoryAction} className="mt-4 grid gap-2 sm:grid-cols-[4rem_1fr_6rem_auto]" aria-label="New category">
            <input type="hidden" name="m" value={month} />
            <label className="sr-only" htmlFor="new-cat-icon">
              Icon
            </label>
            <input id="new-cat-icon" name="icon" defaultValue="💷" maxLength={16} className={`${input} mt-0`} />
            <label className="sr-only" htmlFor="new-cat-name">
              New category name
            </label>
            <input id="new-cat-name" name="name" required maxLength={30} placeholder="New category" className={`${input} mt-0`} />
            <label className="sr-only" htmlFor="new-cat-limit">
              Monthly limit (£)
            </label>
            <input id="new-cat-limit" name="limit" inputMode="decimal" placeholder="£ limit" className={`${input} mt-0`} />
            <button type="submit" className={`${btn} bg-gold-500 text-obsidian-950 hover:bg-gold-400`}>
              Add
            </button>
          </form>
          {categories.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="min-h-11 cursor-pointer py-2 text-silver-300">Archive a category</summary>
              <ul className="grid gap-1">
                {categories.map((c) => (
                  <li key={c.id}>
                    <form action={archiveCategoryAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="archived" value="true" />
                      <input type="hidden" name="m" value={month} />
                      <button type="submit" className="min-h-11 text-silver-300 hover:text-ember-300">
                        Archive {c.icon} {c.name}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}

export default function MoneyPage({ searchParams }: PageProps<"/money">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-4">
      <nav aria-label="Breadcrumb" className="-mx-4 flex gap-x-5 overflow-x-auto whitespace-nowrap px-4 text-sm [scrollbar-width:none]">
        <Link href="/" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          ← LIFEQUEST
        </Link>
        <Link href="/dragons/finance" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          Finance dragon
        </Link>
      </nav>
      <h1 className="mb-4 font-display text-4xl font-bold tracking-wide text-gold-300">Money</h1>
      <Suspense fallback={<p className="text-silver-300">Counting the hoard…</p>}>
        <Money searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
