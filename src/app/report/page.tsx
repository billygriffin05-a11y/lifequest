import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { weekStart } from "@/features/honour/progress";
import { londonDateKey } from "@/features/honour/rules";
import { getPlayerProgress, listActions } from "@/features/honour/server/service";
import { getWeeklyReport } from "@/features/report/server/service";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "Weekly report · LIFEQUEST" };

const card = "rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-5";
const h2 = "font-display text-xl text-gold-300";
const longFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const dayName = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });
const d = (k: string) => new Date(`${k}T12:00:00Z`);
const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-silver-300">{label}</dt>
      <dd className="font-display text-2xl text-silver-100" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

async function Report({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const sp = await searchParams;
  const today = londonDateKey(new Date());
  const thisWeek = weekStart(today);
  const asked = typeof sp.w === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.w) ? weekStart(sp.w) : thisWeek;
  const week = asked > thisWeek ? thisWeek : asked;
  const shift = (n: number) => {
    const x = d(week);
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
  };
  const prev = shift(-7);
  const next = shift(7);
  const isCurrent = week === thisWeek;

  const [r, progress, actions] = await Promise.all([getWeeklyReport(prisma, week), getPlayerProgress(prisma), listActions(prisma)]);
  const h = r.honour;
  const streaks = actions
    .filter((a) => a.kind === "good" && (progress.streaks[a.id] ?? 0) > 0)
    .map((a) => ({ name: a.name, icon: a.icon, days: progress.streaks[a.id] }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 5);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/report?w=${prev}`} className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          ← Previous week
        </Link>
        <h2 className="font-display text-2xl text-gold-300" data-testid="week-range">
          {longFmt.format(d(r.weekStart))} – {longFmt.format(d(r.weekEnd))}
          {isCurrent && <span className="ml-2 text-sm text-silver-300">(this week so far)</span>}
        </h2>
        {isCurrent ? (
          <span className="w-28" />
        ) : (
          <Link href={`/report?w=${next}`} className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
            Next week →
          </Link>
        )}
      </div>

      <section aria-labelledby="honour-heading" className={card}>
        <h2 id="honour-heading" className={h2}>
          Honour
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Good deeds" value={`${h.goodDeeds} · +${h.good}`} testId="good-total" />
          <Stat label="Bad habits" value={`${h.badDeeds} · −${h.bad}`} testId="bad-total" />
          <Stat label="Active days" value={`${h.daysActive} / 7`} />
          <Stat label="Best day" value={h.bestDay ? dayName.format(d(h.bestDay.day)) : "—"} />
        </dl>
        <p className="mt-4 text-sm text-silver-300" data-testid="boss-result">
          {h.boss.emoji} {h.boss.name}:{" "}
          {h.boss.defeated ? (
            <strong className="text-emerald-300">defeated!</strong>
          ) : (
            <>
              {h.boss.hpLeft} of {h.boss.hp} HP left{isCurrent ? " — keep going" : ""}.
            </>
          )}
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="wins-heading" className={card}>
          <h2 id="wins-heading" className={h2}>
            Wins
          </h2>
          {h.wins.length === 0 ? (
            <p className="mt-2 text-sm text-silver-300">No good deeds logged this week.</p>
          ) : (
            <ul className="mt-2 grid gap-1 text-sm" data-testid="wins">
              {h.wins.map((w) => (
                <li key={`${w.icon}${w.name}`} className="flex justify-between gap-3">
                  <span className="text-silver-100">
                    {w.icon} {w.name}
                  </span>
                  <span className="text-emerald-300">
                    ×{w.count} · +{w.honour}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="misses-heading" className={card}>
          <h2 id="misses-heading" className={h2}>
            Misses
          </h2>
          {h.misses.length === 0 ? (
            <p className="mt-2 text-sm text-emerald-300">No bad habits logged — clean week. ✨</p>
          ) : (
            <ul className="mt-2 grid gap-1 text-sm" data-testid="misses">
              {h.misses.map((m) => (
                <li key={`${m.icon}${m.name}`} className="flex justify-between gap-3">
                  <span className="text-silver-100">
                    {m.icon} {m.name}
                  </span>
                  <span className="text-ember-300">
                    ×{m.count} · −{m.honour}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="streaks-heading" className={card}>
          <h2 id="streaks-heading" className={h2}>
            Streaks right now
          </h2>
          {streaks.length === 0 ? (
            <p className="mt-2 text-sm text-silver-300">No active streaks. Log a good deed today to start one.</p>
          ) : (
            <ul className="mt-2 grid gap-1 text-sm">
              {streaks.map((s) => (
                <li key={s.name} className="flex justify-between gap-3">
                  <span className="text-silver-100">
                    {s.icon} {s.name}
                  </span>
                  <span className="text-gold-300">🔥 {s.days} days</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="dragons-heading" className={card}>
          <h2 id="dragons-heading" className={h2}>
            Dragons fed
          </h2>
          {h.dragons.length === 0 ? (
            <p className="mt-2 text-sm text-silver-300">No dragon XP from deeds this week.</p>
          ) : (
            <ul className="mt-2 grid gap-1 text-sm">
              {h.dragons.map((dr) => (
                <li key={dr.areaId} className="flex justify-between gap-3">
                  <Link href={`/dragons/${dr.areaId}`} className="text-silver-100 underline-offset-4 hover:underline">
                    🐉 {dr.name}
                  </Link>
                  <span className="text-gold-300">+{dr.xp} XP</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="life-heading" className={card}>
        <h2 id="life-heading" className={h2}>
          Life this week
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Spent" value={gbp.format(r.money.spentPence / 100)} />
          <Stat label="Workout days" value={String(r.body.workoutDays)} />
          <Stat label="Runs" value={r.body.runs ? `${r.body.runs} · ${(r.body.runMetres / 1000).toFixed(1)} km` : "0"} />
          <Stat label="Water goal days" value={`${r.body.waterGoalDays} / 7`} />
          <Stat label="Avg sleep" value={r.body.sleepAvgMinutes === null ? "—" : hm(r.body.sleepAvgMinutes)} />
          <Stat label="Focus" value={hm(r.mind.focusMinutes)} />
          <Stat label="Cards reviewed" value={r.mind.reviews ? `${r.mind.reviews} (${r.mind.reviewsRight} ✓)` : "0"} />
          <Stat label="Pages read" value={String(r.mind.pages)} />
          <Stat label="Avg mood" value={r.mind.moodAvg === null ? "—" : `${r.mind.moodAvg} / 5`} />
          <Stat label="Journal days" value={`${r.mind.journalDays} / 7`} />
        </dl>
      </section>
    </div>
  );
}

export default function ReportPage({ searchParams }: PageProps<"/report">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-4">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          ← LIFEQUEST
        </Link>
      </nav>
      <h1 className="mb-4 font-display text-4xl font-bold tracking-wide text-gold-300">Weekly report</h1>
      <Suspense fallback={<p className="text-silver-300">Tallying the week…</p>}>
        <Report searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
