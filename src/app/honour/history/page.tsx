import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { heatmapWeeks } from "@/features/honour/progress";
import { londonDateKey } from "@/features/honour/rules";
import { listActions, listLedger } from "@/features/honour/server/service";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "Habit heatmap · LIFEQUEST" };

const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fmt = (k: string) => dayFmt.format(new Date(`${k}T12:00:00Z`));

async function Heatmap() {
  await connection();
  const today = londonDateKey(new Date());
  const weeks = heatmapWeeks(today, 12);
  const [actions, ledger] = await Promise.all([listActions(prisma, { includeArchived: true }), listLedger(prisma)]);
  const doneDays = new Map<string, Set<string>>();
  for (const e of ledger) {
    if (e.isReversal || e.undone) continue;
    const key = actions.find((a) => a.name === e.actionName && a.icon === e.actionIcon)?.id ?? `name:${e.actionName}`;
    const set = doneDays.get(key) ?? new Set<string>();
    set.add(e.occurredOn);
    doneDays.set(key, set);
  }

  if (actions.length === 0) {
    return <p className="text-silver-300">No actions yet — add some on the Honour page.</p>;
  }

  return (
    <ul className="grid gap-4" aria-label="Habit heatmaps">
      {actions.map((a) => {
        const days = doneDays.get(a.id) ?? new Set<string>();
        const good = a.kind === "good";
        const count = weeks.flat().filter((d) => days.has(d)).length;
        return (
          <li key={a.id} className="rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-4">
            <p className="flex items-center gap-2 text-silver-100">
              <span aria-hidden="true" className="text-xl">
                {a.icon}
              </span>
              <span className="font-medium">{a.name}</span>
              <span className="text-sm text-silver-300">
                · {count} of {weeks.flat().filter((d) => d <= today).length} days in the last 12 weeks
              </span>
            </p>
            {/* Columns = weeks, rows = Mon..Sun. Decorative grid; the count above carries the information. */}
            <div className="mt-3 flex gap-1 overflow-x-auto" aria-hidden="true" data-testid={`heatmap-${a.id}`}>
              {weeks.map((week) => (
                <div key={week[0]} className="grid grid-rows-7 gap-1">
                  {week.map((d) => (
                    <span
                      key={d}
                      title={`${fmt(d)}${days.has(d) ? " — done" : ""}`}
                      className={`h-3.5 w-3.5 rounded-sm ${
                        d > today
                          ? "bg-transparent"
                          : days.has(d)
                            ? good
                              ? "bg-emerald-400"
                              : "bg-ember-400"
                            : "bg-obsidian-700"
                      }`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function HistoryPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-4">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/honour" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          ← Honour ledger
        </Link>
      </nav>
      <h1 className="mb-1 font-display text-4xl font-bold tracking-wide text-gold-300">Habit heatmap</h1>
      <p className="mb-6 text-silver-300">Each square is a day (Monday at the top). Green = good deed done, red = bad habit.</p>
      <Suspense fallback={<p className="text-silver-300">Drawing the map…</p>}>
        <Heatmap />
      </Suspense>
    </main>
  );
}
