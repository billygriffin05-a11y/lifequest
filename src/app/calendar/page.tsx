import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EventList } from "@/features/calendar/components/event-list";
import { LifequestDayDetail } from "@/features/calendar/components/lifequest-day-detail";
import { groupByDay, type CalEvent } from "@/features/calendar/google/event-mapping";
import { DAY_RE, describeDay, monthGrid, shiftMonth, type DayActivity } from "@/features/calendar/month";
import { getActivityByDay } from "@/features/calendar/server/agenda";
import { getGoogleEvents, type GoogleEventsResult } from "@/features/calendar/server/google-events";
import { calendarDeps } from "@/features/calendar/server/runtime";
import { weekStart } from "@/features/honour/progress";
import { londonDateKey } from "@/features/honour/rules";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "Calendar · LIFEQUEST" };

type View = "month" | "week" | "day";
const VIEWS: { id: View; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
];

const card = "rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-4 sm:p-5";
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const d = (k: string) => new Date(`${k}T12:00:00Z`);
const MOOD = ["", "😞", "😕", "😐", "🙂", "😄"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function addDays(key: string, n: number) {
  const x = d(key);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

const href = (view: View, day: string) => `/calendar?view=${view}&d=${day}`;

function Dots({ a }: { a: DayActivity | undefined }) {
  if (!a) return null;
  return (
    <span aria-hidden="true" className="flex flex-wrap justify-center gap-0.5 leading-none">
      {a.good > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
      {a.bad > 0 && <span className="h-1.5 w-1.5 rounded-full bg-ember-500" />}
      {a.active && <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />}
      {(a.reading || a.focusMinutes > 0) && <span className="h-1.5 w-1.5 rounded-full bg-silver-300" />}
    </span>
  );
}

function GoogleNotice({ result }: { result: GoogleEventsResult }) {
  if (result.status === "ok") return null;
  const text: Record<Exclude<GoogleEventsResult["status"], "ok">, string> = {
    "not-configured": "Google Calendar isn't set up, so only LIFEQUEST activity is shown.",
    "not-linked": "Link Google Calendar to see your own events (like “Pay rent”) here.",
    "needs-relink": "To show your own Google events here, LIFEQUEST needs read-only access. Re-link Google Calendar once in Settings.",
    error: "Couldn't reach Google just now — showing LIFEQUEST activity only.",
  };
  return (
    <p className="rounded-lg border border-gold-500/40 px-3 py-2 text-sm text-gold-300" data-testid="google-notice">
      {text[result.status]}{" "}
      {result.status !== "error" && (
        <Link href="/settings" className="text-emerald-300 underline underline-offset-4">
          Open Settings
        </Link>
      )}
    </p>
  );
}

function MonthView({ day, today, activity, events }: { day: string; today: string; activity: Map<string, DayActivity>; events: Map<string, CalEvent[]> }) {
  const month = day.slice(0, 7);
  const weeks = monthGrid(month);
  return (
    <table className="w-full table-fixed border-separate border-spacing-1" data-testid="month-grid">
      <caption className="sr-only">{monthFmt.format(d(`${month}-15`))}. Pick a day to open it.</caption>
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
            {week.map((k) => {
              const a = activity.get(k);
              const ev = events.get(k) ?? [];
              const inMonth = k.startsWith(month);
              const label = `${longDay.format(d(k))}: ${ev.length ? `${ev.map((e) => e.title).join(", ")}; ` : ""}${a ? describeDay(a) : "nothing logged"}`;
              return (
                <td key={k} className="p-0 align-top">
                  <Link
                    href={href("day", k)}
                    aria-label={label}
                    aria-current={k === today ? "date" : undefined}
                    className={`flex min-h-14 flex-col gap-0.5 overflow-hidden rounded-lg border p-1 text-xs sm:h-24 ${
                      k === today ? "border-emerald-500/70 bg-emerald-500/5" : "border-obsidian-700"
                    } ${inMonth ? "text-silver-100" : "border-dashed text-silver-300"} hover:border-gold-400 focus-visible:outline-2 focus-visible:outline-emerald-400`}
                  >
                    <span className={`text-center ${k === today ? "font-bold text-emerald-300" : ""}`}>{Number(k.slice(8))}</span>
                    {/* Phone: a dot per Google event; wider: titles */}
                    {ev.length > 0 && (
                      <span aria-hidden="true" className="flex justify-center gap-0.5 sm:hidden">
                        {ev.slice(0, 3).map((e) => (
                          <span key={e.id} className="h-1.5 w-1.5 rounded-full bg-silver-100" style={e.colour ? { backgroundColor: e.colour } : undefined} />
                        ))}
                      </span>
                    )}
                    <span aria-hidden="true" className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                      {ev.slice(0, 2).map((e) => (
                        <span
                          key={e.id}
                          className="truncate border-l-2 border-silver-300 bg-obsidian-800 pl-1 text-[11px] leading-4 text-silver-100"
                          style={e.colour ? { borderLeftColor: e.colour } : undefined}
                        >
                          {e.title}
                        </span>
                      ))}
                      {ev.length > 2 && <span className="text-[11px] text-silver-300">+{ev.length - 2} more</span>}
                    </span>
                    <span className="mt-auto">
                      <Dots a={a} />
                    </span>
                  </Link>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function WeekView({ day, today, activity, events }: { day: string; today: string; activity: Map<string, DayActivity>; events: Map<string, CalEvent[]> }) {
  const start = weekStart(day);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <ol className="grid gap-2 md:grid-cols-7" data-testid="week-grid">
      {days.map((k) => {
        const a = activity.get(k);
        const ev = events.get(k) ?? [];
        return (
          <li key={k} className={`rounded-xl border p-2 ${k === today ? "border-emerald-500/70" : "border-obsidian-700"}`}>
            <Link href={href("day", k)} className="flex min-h-11 items-center justify-between gap-2 text-sm hover:text-gold-300">
              <span className={k === today ? "font-bold text-emerald-300" : "text-gold-300"}>{shortDay.format(d(k))}</span>
              <Dots a={a} />
            </Link>
            {ev.length ? <EventList events={ev} compact /> : <p className="text-xs text-silver-300">No events</p>}
            {a && (a.good || a.bad) ? (
              <p className="mt-1 text-xs text-silver-300">
                {a.good} good · {a.bad} bad
                {a.mood ? ` · ${MOOD[a.mood]}` : ""}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

async function CalendarView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const sp = await searchParams;
  const today = londonDateKey(new Date());
  const view: View = sp.view === "week" || sp.view === "day" ? sp.view : "month";
  let day = typeof sp.d === "string" && DAY_RE.test(sp.d) ? sp.d : today;
  // Old links used ?m=YYYY-MM.
  if (typeof sp.m === "string" && /^\d{4}-\d{2}$/.test(sp.m) && typeof sp.d !== "string") day = `${sp.m}-01`;

  let from: string;
  let to: string;
  let title: string;
  let prev: string;
  let next: string;
  if (view === "month") {
    const weeks = monthGrid(day.slice(0, 7));
    from = weeks[0][0];
    to = weeks[weeks.length - 1][6];
    title = monthFmt.format(d(`${day.slice(0, 7)}-15`));
    prev = `${shiftMonth(day.slice(0, 7), -1)}-01`;
    next = `${shiftMonth(day.slice(0, 7), 1)}-01`;
  } else if (view === "week") {
    from = weekStart(day);
    to = addDays(from, 6);
    title = `${shortDay.format(d(from))} – ${shortDay.format(d(to))}`;
    prev = addDays(from, -7);
    next = addDays(from, 7);
  } else {
    from = to = day;
    title = longDay.format(d(day));
    prev = addDays(day, -1);
    next = addDays(day, 1);
  }

  const [activity, google] = await Promise.all([getActivityByDay(prisma, from, to), getGoogleEvents(calendarDeps(), from, to)]);
  const events = groupByDay(google.events);
  const unit = view === "month" ? "month" : view === "week" ? "week" : "day";

  return (
    <div className="grid gap-4">
      <nav aria-label="Calendar view" className="flex gap-1 rounded-xl border border-obsidian-600 bg-obsidian-900/80 p-1">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={href(v.id, day)}
            aria-current={view === v.id ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold ${
              view === v.id ? "bg-gold-500 text-obsidian-950" : "text-silver-300 hover:text-gold-300"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <GoogleNotice result={google} />

      <section aria-labelledby="period-heading" className={card}>
        <div className="flex items-center justify-between gap-2">
          <Link href={href(view, prev)} aria-label={`Previous ${unit}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-silver-300 hover:text-gold-300">
            ←
          </Link>
          <h2 id="period-heading" className="text-center font-display text-xl text-gold-300 sm:text-2xl" data-testid="period-title">
            {title}
          </h2>
          <Link href={href(view, next)} aria-label={`Next ${unit}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-silver-300 hover:text-gold-300">
            →
          </Link>
        </div>
        {!(from <= today && today <= to) && (
          <p className="text-center">
            <Link href={href(view, today)} className="inline-flex min-h-11 items-center text-sm text-emerald-300 underline underline-offset-4">
              Back to today
            </Link>
          </p>
        )}

        <div className="mt-2">
          {view === "month" && <MonthView day={day} today={today} activity={activity} events={events} />}
          {view === "week" && <WeekView day={day} today={today} activity={activity} events={events} />}
          {view === "day" && (
            <div className="grid gap-3">
              <section aria-labelledby="google-day-heading">
                <h3 id="google-day-heading" className="font-display text-lg text-gold-300">
                  Your calendar
                </h3>
                {(events.get(day) ?? []).length ? (
                  <EventList events={events.get(day) ?? []} />
                ) : (
                  <p className="text-sm text-silver-300">{google.status === "ok" ? "No events." : "—"}</p>
                )}
              </section>
            </div>
          )}
        </div>
        {view !== "day" && (
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
        )}
      </section>

      {view === "day" && (
        <Suspense fallback={<p className="text-silver-300">Opening the day…</p>}>
          <LifequestDayDetail day={day} />
        </Suspense>
      )}
    </div>
  );
}

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-4">
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
