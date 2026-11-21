import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { WeightChart } from "@/features/body/components/weight-chart";
import {
  ACTIVE_DAY_XP,
  formatDuration,
  formatHours,
  formatKg,
  formatKm,
  formatPace,
  paceSecondsPerKm,
  REP_RANGE,
  SLEEP_GOAL_MINUTES,
  SLEEP_NIGHT_XP,
  WATER_DAY_XP,
  WATER_GOAL,
} from "@/features/body/rules";
import {
  addRunAction,
  addWorkoutAction,
  deleteRunAction,
  deleteWorkoutAction,
  sleepAction,
  waterAction,
  weightAction,
} from "@/features/body/server/actions";
import { getBodyOverview } from "@/features/body/server/service";
import { londonDateKey } from "@/features/honour/rules";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "Body · LIFEQUEST" };

const card = "rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-5";
const input =
  "mt-1 block min-h-11 w-full rounded-lg border border-obsidian-600 bg-obsidian-950 px-3 text-silver-100 placeholder:text-silver-500 focus-visible:outline-2 focus-visible:outline-emerald-400";
const btn =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";
const primary = `${btn} bg-gold-500 text-obsidian-950 hover:bg-gold-400`;
const h2 = "font-display text-xl text-gold-300";
const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const label = (d: string) => dayFmt.format(new Date(`${d}T12:00:00Z`));

function DateField({ id, today }: { id: string; today: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm text-silver-300">
        Date
      </label>
      <input id={id} name="date" type="date" required max={today} defaultValue={today} className={input} />
    </div>
  );
}

function RemoveButton({ action, id, what }: { action: (fd: FormData) => Promise<void>; id: string; what: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" aria-label={`Remove ${what}`} className="min-h-11 px-2 text-silver-300 hover:text-ember-300">
        ✕
      </button>
    </form>
  );
}

async function Body({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const sp = await searchParams;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const err = typeof sp.err === "string" ? sp.err : null;
  const today = londonDateKey(new Date());
  const o = await getBodyOverview(prisma, today);
  const waterPct = Math.min(100, Math.round((o.waterToday / WATER_GOAL) * 100));

  return (
    <div className="grid gap-6">
      {(ok || err) && (
        <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${ok ? "border-emerald-500/40 text-emerald-300" : "border-ember-500/40 text-ember-300"}`}>
          {ok ?? err}
        </p>
      )}

      <p className="text-sm text-silver-300">
        Your body feeds three dragons: each active day (workout or run) gives Fitness <strong className="text-gold-300">+{ACTIVE_DAY_XP} XP</strong>,
        each day at {WATER_GOAL} glasses gives Nutrition <strong className="text-gold-300">+{WATER_DAY_XP} XP</strong>, and each night of 7h+
        gives Sleep <strong className="text-gold-300">+{SLEEP_NIGHT_XP} XP</strong>.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Water */}
        <section id="water" aria-labelledby="water-heading" className={card}>
          <h2 id="water-heading" className={h2}>
            Water today
          </h2>
          <p className="mt-2 font-display text-3xl text-silver-100" data-testid="water-count">
            {o.waterToday} / {WATER_GOAL} glasses
          </p>
          <div
            role="progressbar"
            aria-label="Water goal"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={waterPct}
            className="mt-2 h-2 overflow-hidden rounded-full bg-obsidian-700"
          >
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${waterPct}%` }} />
          </div>
          <div className="mt-3 flex gap-2">
            <form action={waterAction}>
              <input type="hidden" name="delta" value="1" />
              <button type="submit" className={primary}>
                + Glass 💧
              </button>
            </form>
            <form action={waterAction}>
              <input type="hidden" name="delta" value="-1" />
              <button type="submit" className={`${btn} border border-silver-500/40 text-silver-300`} aria-label="Remove a glass">
                − 1
              </button>
            </form>
          </div>
          <p className="mt-2 text-sm text-silver-300">Goal reached on {o.waterWeekDaysAtGoal} of the last 7 days.</p>
        </section>

        {/* Sleep */}
        <section id="sleep" aria-labelledby="sleep-heading" className={card}>
          <h2 id="sleep-heading" className={h2}>
            Sleep
          </h2>
          <form action={sleepAction} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Log sleep">
            <div>
              <label htmlFor="sleep-bed" className="text-sm text-silver-300">
                Bed time
              </label>
              <input id="sleep-bed" name="bed" type="time" required defaultValue="23:00" className={input} />
            </div>
            <div>
              <label htmlFor="sleep-wake" className="text-sm text-silver-300">
                Wake time
              </label>
              <input id="sleep-wake" name="wake" type="time" required defaultValue="07:00" className={input} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <DateField id="sleep-date" today={today} />
            </div>
            <button type="submit" className={`${primary} col-span-2 sm:col-span-3`}>
              Save night
            </button>
          </form>
          <p className="mt-3 text-sm text-silver-300" data-testid="sleep-avg">
            {o.sleepAvg === null ? "No nights logged this week." : `7-day average: ${formatHours(o.sleepAvg)}`}
          </p>
          {o.sleeps.length > 0 && (
            <ul className="mt-2 grid gap-1 text-sm">
              {o.sleeps.map((s) => (
                <li key={s.day} className="flex justify-between">
                  <span className="text-silver-300">{label(s.day)}</span>
                  <span className={s.minutes >= SLEEP_GOAL_MINUTES ? "text-emerald-300" : "text-silver-100"}>
                    {s.bedTime}–{s.wakeTime} · {formatHours(s.minutes)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Workouts */}
      <section id="workouts" aria-labelledby="workouts-heading" className={card}>
        <h2 id="workouts-heading" className={h2}>
          Workouts
        </h2>
        <form action={addWorkoutAction} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Log exercise">
          <div className="col-span-2">
            <label htmlFor="wo-exercise" className="text-sm text-silver-300">
              Exercise
            </label>
            <input id="wo-exercise" name="exercise" required maxLength={40} placeholder="e.g. Bench press" list="exercise-list" className={input} />
            <datalist id="exercise-list">
              {o.pbs.map((p) => (
                <option key={p.exercise} value={p.exercise} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="wo-sets" className="text-sm text-silver-300">
              Sets
            </label>
            <input id="wo-sets" name="sets" inputMode="numeric" required defaultValue="3" className={input} />
          </div>
          <div>
            <label htmlFor="wo-reps" className="text-sm text-silver-300">
              Reps
            </label>
            <input id="wo-reps" name="reps" inputMode="numeric" required defaultValue="10" className={input} />
          </div>
          <div>
            <label htmlFor="wo-weight" className="text-sm text-silver-300">
              Weight (kg)
            </label>
            <input id="wo-weight" name="weight" inputMode="decimal" placeholder="blank = bodyweight" className={input} />
          </div>
          <div className="col-span-2 sm:col-span-2">
            <DateField id="wo-date" today={today} />
          </div>
          <button type="submit" className={`${primary} col-span-2 self-end sm:col-span-3`}>
            Log exercise
          </button>
        </form>

        {o.suggestions.length > 0 && (
          <div className="mt-5 rounded-xl border border-emerald-500/30 p-3" data-testid="lift-suggestions">
            <h3 className="font-display text-lg text-gold-300">Next session</h3>
            <p className="text-xs text-silver-300">
              Add a rep each time up to {REP_RANGE.high}; when you hit {REP_RANGE.high}, add 2.5 kg and drop back to {REP_RANGE.low}.
            </p>
            <ul className="mt-2 grid gap-1 text-sm">
              {o.suggestions.map((s) => (
                <li key={s.exercise} className="flex flex-wrap justify-between gap-x-3">
                  <span className="text-silver-100">{s.exercise}</span>
                  <span className="text-emerald-300">
                    {s.next.sets}×{s.next.reps}
                    {s.next.weightGrams ? ` @ ${formatKg(s.next.weightGrams)}` : " (bodyweight)"}
                    {s.reason === "add-weight" ? " ⬆ weight" : " ⬆ 1 rep"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-lg text-gold-300">Personal bests</h3>
            {o.pbs.length === 0 ? (
              <p className="mt-2 text-sm text-silver-300">Your heaviest lift per exercise shows here.</p>
            ) : (
              <ul className="mt-2 grid gap-1 text-sm" data-testid="lift-pbs">
                {o.pbs.map((p) => (
                  <li key={p.exercise} className="flex justify-between gap-3">
                    <span className="text-silver-100">🏆 {p.exercise}</span>
                    <span className="text-silver-300">
                      {p.weightGrams ? formatKg(p.weightGrams) : "Bodyweight"} × {p.reps}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="font-display text-lg text-gold-300">Recent</h3>
            {o.recentSets.length === 0 ? (
              <p className="mt-2 text-sm text-silver-300">No exercises yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-obsidian-700 text-sm" data-testid="recent-sets">
                {o.recentSets.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-1">
                    <span className="w-24 text-silver-300">{label(s.occurredOn)}</span>
                    <span className="min-w-0 flex-1 truncate text-silver-100">{s.exercise}</span>
                    <span className="text-silver-300">
                      {s.sets}×{s.reps}
                      {s.weightGrams ? ` @ ${formatKg(s.weightGrams)}` : ""}
                    </span>
                    <RemoveButton action={deleteWorkoutAction} id={s.id} what={`${s.exercise} on ${label(s.occurredOn)}`} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Runs */}
      <section id="runs" aria-labelledby="runs-heading" className={card}>
        <h2 id="runs-heading" className={h2}>
          Runs
        </h2>
        <form action={addRunAction} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Log run">
          <div>
            <label htmlFor="run-distance" className="text-sm text-silver-300">
              Distance (km)
            </label>
            <input id="run-distance" name="distance" inputMode="decimal" required placeholder="5" className={input} />
          </div>
          <div>
            <label htmlFor="run-time" className="text-sm text-silver-300">
              Time (mm:ss)
            </label>
            <input id="run-time" name="time" required placeholder="28:15" className={input} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <DateField id="run-date" today={today} />
          </div>
          <button type="submit" className={`${primary} col-span-2 self-end sm:col-span-1`}>
            Log run
          </button>
        </form>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" data-testid="run-pbs">
          <div>
            <dt className="text-silver-300">Total distance</dt>
            <dd className="font-display text-lg text-silver-100">{formatKm(o.runTotalMetres)}</dd>
          </div>
          <div>
            <dt className="text-silver-300">Longest run</dt>
            <dd className="font-display text-lg text-silver-100">{o.runPbs.longest ? formatKm(o.runPbs.longest.distanceMetres) : "—"}</dd>
          </div>
          <div>
            <dt className="text-silver-300">Fastest pace (1 km+)</dt>
            <dd className="font-display text-lg text-silver-100">
              {o.runPbs.fastestPace ? formatPace(paceSecondsPerKm(o.runPbs.fastestPace.distanceMetres, o.runPbs.fastestPace.durationSeconds)) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-silver-300">Best 5 km+ pace</dt>
            <dd className="font-display text-lg text-silver-100">
              {o.runPbs.fastest5k ? formatPace(paceSecondsPerKm(o.runPbs.fastest5k.distanceMetres, o.runPbs.fastest5k.durationSeconds)) : "—"}
            </dd>
          </div>
        </dl>

        {o.recentRuns.length > 0 && (
          <ul className="mt-4 divide-y divide-obsidian-700 text-sm" data-testid="recent-runs">
            {o.recentRuns.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-1">
                <span className="w-24 text-silver-300">{label(r.occurredOn)}</span>
                <span className="flex-1 text-silver-100">
                  {formatKm(r.distanceMetres)} in {formatDuration(r.durationSeconds)}
                </span>
                <span className="text-silver-300">{formatPace(paceSecondsPerKm(r.distanceMetres, r.durationSeconds))}</span>
                <RemoveButton action={deleteRunAction} id={r.id} what={`run on ${label(r.occurredOn)}`} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Weight */}
      <section id="weight" aria-labelledby="weight-heading" className={card}>
        <h2 id="weight-heading" className={h2}>
          Body weight · last 90 days
        </h2>
        <form action={weightAction} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Log weight">
          <div>
            <label htmlFor="weight-kg" className="text-sm text-silver-300">
              Weight (kg)
            </label>
            <input id="weight-kg" name="weight" inputMode="decimal" required placeholder="80.4" className={input} />
          </div>
          <DateField id="weight-date" today={today} />
          <button type="submit" className={`${primary} col-span-2 self-end sm:col-span-1`}>
            Save weight
          </button>
        </form>
        <WeightChart points={o.weights} />
      </section>
    </div>
  );
}

export default function BodyPage({ searchParams }: PageProps<"/body">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-4">
      <nav aria-label="Breadcrumb" className="-mx-4 flex gap-x-5 overflow-x-auto whitespace-nowrap px-4 text-sm [scrollbar-width:none]">
        <Link href="/" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          ← LIFEQUEST
        </Link>
        <Link href="/dragons/fitness" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          Fitness dragon
        </Link>
      </nav>
      <h1 className="mb-4 font-display text-4xl font-bold tracking-wide text-gold-300">Body</h1>
      <Suspense fallback={<p className="text-silver-300">Warming up…</p>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
