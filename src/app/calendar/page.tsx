import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DAY_RE, describeDay, MONTH_RE, monthGrid, shiftMonth } from "@/features/calendar/month";
import { getActivityByDay, getDayDetail } from "@/features/calendar/server/agenda";
import { getDailyReminder, getStatus } from "@/features/calendar/server/service";
import { londonDateKey } from "@/features/honour/rules";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "Calendar · LIFEQUEST" };

const card = "rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-4 sm:p-5";
const h2 = "font-display text-xl text-gold-300";
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const d = (k: string) => new Date(`${k}T12:00:00Z`);
const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const MOOD = ["", "😞", "😕", "😐", "🙂", "😄"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

async function DayPanel({ day }: { day: string }) {
  const x = await getDayDetail(prisma, day);
  const spent = x.money.filter((t) => t.amountPence > 0).reduce((n, t) => n + t.amountPence, 0);
  const empty =
    !x.deeds.length && !x.sets.length && !x.runs.length && !x.water && !x.sleep && !x.weight && !x.reading.length && !x.focus.length && !x.money.length && !x.reflection && !x.reviews;
  const row = "flex justify-between gap-3 py-1";

  return (
    <section aria-labelledby="day-heading" className={card} data-testid="day-panel">
      <h2 id="day-heading" className={h2}>
        {longDay.format(d(day))}
      </h2>
      {empty ? (
        <p className="mt-2 text-sm text-silver-300">Nothing logged on this day.</p>
      ) : (
        <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
          {x.deeds.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-silver-300">Deeds</h3>
              <ul className="divide-y divide-obsidian-700">
                {x.deeds.map((e) => (
                  <li key={e.id} className={row}>
                    <span className="text-silver-100">
                      {e.actionIcon} {e.actionName}
                      {e.note && <span className="block text-xs text-silver-300">“{e.note}”</span>}
                    </span>
                    <span className={e.honourDelta >= 0 ? "text-emerald-300" : "text-ember-300"}>
                      {e.honourDelta >= 0 ? "+" : "−"}
                      {Math.abs(e.honourDelta)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(x.sets.length > 0 || x.runs.length > 0 || x.water > 0 || x.sleep || x.weight) && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-silver-300">Body</h3>
              <ul className="divide-y divide-obsidian-700 text-silver-100">
                {x.sets.map((s) => (
                  <li key={s.id} className={row}>
                    <span>🏋️ {s.exercise}</span>
                    <span className="text-silver-300">
                      {s.sets}×{s.reps}
                      {s.weightGrams ? ` @ ${s.weightGrams / 1000} kg` : ""}
                    </span>
                  </li>
                ))}
                {x.runs.map((r) => (
                  <li key={r.id} className={row}>
                    <span>🏃 Run</span>
                    <span className="text-silver-300">
                      {(r.distanceMetres / 1000).toFixed(2)} km in {Math.floor(r.durationSeconds / 60)}:{String(r.durationSeconds % 60).padStart(2, "0")}
                    </span>
                  </li>
                ))}
                {x.water > 0 && (
                  <li className={row}>
                    <span>💧 Water</span>
                    <span className="text-silver-300">{x.water} glasses</span>
                  </li>
                )}
                {x.sleep && (
                  <li className={row}>
                    <span>🌙 Sleep</span>
                    <span className="text-silver-300">
                      {x.sleep.bedTime}–{x.sleep.wakeTime} · {Math.floor(x.sleep.minutes / 60)}h {String(x.sleep.minutes % 60).padStart(2, "0")}m
                    </span>
                  </li>
                )}
                {x.weight && (
                  <li className={row}>
                    <span>⚖️ Weight</span>
                    <span className="text-silver-300">{x.weight.grams / 1000} kg</span>
                  </li>
                )}
              </ul>
            </div>
          )}
          {(x.reading.length > 0 || x.focus.length > 0 || x.reviews > 0 || x.reflection) && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-silver-300">Mind</h3>
              <ul className="divide-y divide-obsidian-700 text-silver-100">
                {x.reading.map((r) => (
                  <li key={r.id} className={row}>
                    <span>📖 {r.book.title}</span>
                    <span className="text-silver-300">{r.pages} pages</span>
                  </li>
                ))}
                {x.focus.length > 0 && (
                  <li className={row}>
                    <span>⏳ Focus</span>
                    <span className="text-silver-300">{x.focus.reduce((n, f) => n + f.minutes, 0)} min</span>
                  </li>
                )}
                {x.reviews > 0 && (
                  <li className={row}>
                    <span>🃏 Cards reviewed</span>
                    <span className="text-silver-300">{x.reviews}</span>
                  </li>
                )}
                {x.reflection?.mood && (
                  <li className={row}>
                    <span>Mood</span>
                    <span aria-label={`${x.reflection.mood} out of 5`}>{MOOD[x.reflection.mood]}</span>
                  </li>
                )}
                {x.reflection?.entry && (
                  <li className="py-1">
                    <span className="block">✍️ Journal</span>
                    <span className="whitespace-pre-wrap text-silver-300">{x.reflection.entry}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
          {x.money.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-silver-300">Money · spent {gbp.format(spent / 100)}</h3>
              <ul className="divide-y divide-obsidian-700 text-silver-100">
                {x.money.map((t) => (
                  <li key={t.id} className={row}>
                    <span className="min-w-0 truncate">{t.description}</span>
                    <span className={t.amountPence > 0 ? "text-silver-300" : "text-emerald-300"}>
                      {t.amountPence > 0 ? "−" : "+"}
                      {gbp.format(Math.abs(t.amountPence) / 100)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

async function CalendarView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const sp = await searchParams;
  const today = londonDateKey(new Date());
  const selected = typeof sp.d === "string" && DAY_RE.test(sp.d) ? sp.d : today;
  const month = typeof sp.m === "string" && MONTH_RE.test(sp.m) ? sp.m : selected.slice(0, 7);
  const weeks = monthGrid(month);
  const [activity, reminder, google] = await Promise.all([
    getActivityByDay(prisma, weeks[0][0], weeks[weeks.length - 1][6]),
    getDailyReminder(prisma),
    getStatus(prisma, null),
  ]);

  return (
    <div className="grid gap-4">
      <section aria-labelledby="month-heading" className={card}>
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/calendar?m=${shiftMonth(month, -1)}`}
            aria-label="Previous month"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-silver-300 hover:text-gold-300"
          >
            ←
          </Link>
          <h2 id="month-heading" className="font-display text-2xl text-gold-300">
            {monthFmt.format(d(`${month}-15`))}
          </h2>
          <Link
            href={`/calendar?m=${shiftMonth(month, 1)}`}
            aria-label="Next month"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-silver-300 hover:text-gold-300"
          >
            →
          </Link>
        </div>
        {month !== today.slice(0, 7) && (
          <p className="text-center">
            <Link href="/calendar" className="inline-flex min-h-11 items-center text-sm text-emerald-300 underline underline-offset-4">
              Back to today
            </Link>
          </p>
        )}

        <table className="mt-2 w-full table-fixed border-separate border-spacing-1" data-testid="month-grid">
          <caption className="sr-only">Activity for {monthFmt.format(d(`${month}-15`))}. Pick a day to see details.</caption>
          <thead>
            <tr>
              {WEEKDAYS.map((w) => (
                <th key={w} scope="col" className="text-xs font-normal text-silver-300">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]}>
                {week.map((day) => {
                  const a = activity.get(day);
                  const inMonth = day.startsWith(month);
                  const isToday = day === today;
                  const isSel = day === selected;
                  const future = day > today;
                  return (
                    <td key={day} className="p-0 align-top">
                      <Link
                        href={`/calendar?m=${month}&d=${day}#day-heading`}
                        aria-current={isSel ? "date" : undefined}
                        aria-label={`${longDay.format(d(day))}: ${a ? describeDay(a) : "nothing logged"}`}
                        className={`flex aspect-square min-h-11 flex-col items-center justify-start rounded-lg border p-1 text-xs sm:aspect-auto sm:h-20 ${
                          isSel ? "border-gold-400 bg-gold-500/10" : isToday ? "border-emerald-500/60" : "border-obsidian-700"
                        } ${inMonth ? "" : "border-dashed bg-transparent"} ${future || !inMonth ? "text-silver-300" : "text-silver-100"} hover:border-gold-400 focus-visible:outline-2 focus-visible:outline-emerald-400`}
                      >
                        <span className={isToday ? "font-bold text-emerald-300" : ""}>{Number(day.slice(8))}</span>
                        {a && (
                          <span aria-hidden="true" className="mt-0.5 flex flex-wrap justify-center gap-0.5 leading-none">
                            {a.good > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                            {a.bad > 0 && <span className="h-1.5 w-1.5 rounded-full bg-ember-500" />}
                            {a.active && <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />}
                            {(a.reading || a.focusMinutes > 0) && <span className="h-1.5 w-1.5 rounded-full bg-silver-300" />}
                          </span>
                        )}
                        {a?.mood && (
                          <span aria-hidden="true" className="mt-0.5 hidden text-sm sm:block">
                            {MOOD[a.mood]}
                          </span>
                        )}
                        {a && a.net !== 0 && (
                          <span aria-hidden="true" className={`hidden sm:block ${a.net > 0 ? "text-emerald-300" : "text-ember-300"}`}>
                            {a.net > 0 ? "+" : "−"}
                            {Math.abs(a.net)}
                          </span>
                        )}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-silver-300" aria-hidden="true">
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />
            good deed
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-ember-500" />
            bad habit
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-gold-400" />
            workout / run
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-silver-300" />
            reading / focus
          </span>
        </p>
      </section>

      <Suspense fallback={<p className="text-silver-300">Opening the day…</p>}>
        <DayPanel day={selected} />
      </Suspense>

      <p className="text-sm text-silver-300">
        {google.connected ? (
          <>
            Deeds also go to your <strong className="text-silver-100">LIFEQUEST</strong> Google Calendar.{" "}
            <a href="https://calendar.google.com/calendar/r" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline underline-offset-4">
              Open Google Calendar
            </a>
          </>
        ) : (
          <>
            Google Calendar isn&apos;t linked.{" "}
            <Link href="/settings" className="text-emerald-300 underline underline-offset-4">
              Link it in Settings
            </Link>
          </>
        )}
        {" · "}
        {reminder.enabled ? `Daily reminder at ${reminder.time}` : "Daily reminder off"}
      </p>
    </div>
  );
}

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <nav aria-label="Breadcrumb" className="-mx-4 flex gap-x-5 overflow-x-auto whitespace-nowrap px-4 text-sm [scrollbar-width:none]">
        <Link href="/" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          ← LIFEQUEST
        </Link>
        <Link href="/honour" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          Honour
        </Link>
        <Link href="/report" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          Weekly report
        </Link>
        <Link href="/settings" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          Google Calendar settings
        </Link>
      </nav>
      <h1 className="mb-3 font-display text-4xl font-bold tracking-wide text-gold-300">Calendar</h1>
      <Suspense fallback={<p className="text-silver-300">Unrolling the calendar…</p>}>
        <CalendarView searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
