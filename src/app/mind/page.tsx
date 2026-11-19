import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { londonDateKey } from "@/features/honour/rules";
import { FocusTimer } from "@/features/mind/components/focus-timer";
import { BOOK_FINISHED_XP, FOCUS_XP_PER_25, JOURNAL_DAY_XP, MOODS, moodFor, READING_DAY_XP } from "@/features/mind/rules";
import { addBookAction, archiveBookAction, logPagesAction, reflectionAction } from "@/features/mind/server/actions";
import { getCardStats, getFocusStats, getReflections, listBooks, MAX_ENTRY } from "@/features/mind/server/service";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "Mind · LIFEQUEST" };

const card = "rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-5";
const input =
  "mt-1 block min-h-11 w-full rounded-lg border border-obsidian-600 bg-obsidian-950 px-3 text-silver-100 placeholder:text-silver-500 focus-visible:outline-2 focus-visible:outline-emerald-400";
const btn =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";
const primary = `${btn} bg-gold-500 text-obsidian-950 hover:bg-gold-400`;
const h2 = "font-display text-xl text-gold-300";
const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const label = (d: string) => dayFmt.format(new Date(`${d}T12:00:00Z`));
const hours = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

async function Mind({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const sp = await searchParams;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const err = typeof sp.err === "string" ? sp.err : null;
  const today = londonDateKey(new Date());
  const [books, reflections, focus, cards] = await Promise.all([
    listBooks(prisma),
    getReflections(prisma, today),
    getFocusStats(prisma, today),
    getCardStats(prisma, today),
  ]);
  const reading = books.filter((b) => !b.finishedOn);
  const finished = books.filter((b) => b.finishedOn);

  return (
    <div className="grid gap-6">
      {(ok || err) && (
        <p data-testid="banner" className={`rounded-lg border px-3 py-2 text-sm ${ok ? "border-emerald-500/40 text-emerald-300" : "border-ember-500/40 text-ember-300"}`}>
          {ok ?? err}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mood + journal */}
        <section id="reflect" aria-labelledby="reflect-heading" className={card}>
          <h2 id="reflect-heading" className={h2}>
            Today&apos;s check-in
          </h2>
          <form action={reflectionAction} className="mt-3 grid gap-3" aria-label="Mood and journal">
            <fieldset>
              <legend className="text-sm text-silver-300">How are you feeling?</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {MOODS.map((m) => (
                  <label key={m.value} className="cursor-pointer">
                    <input type="radio" name="mood" value={m.value} defaultChecked={reflections.today?.mood === m.value} className="peer sr-only" />
                    <span className="inline-flex min-h-11 min-w-11 flex-col items-center justify-center rounded-lg border border-obsidian-600 px-2 text-silver-300 peer-checked:border-gold-400 peer-checked:text-gold-300 peer-focus-visible:outline-2 peer-focus-visible:outline-emerald-400">
                      <span aria-hidden="true" className="text-2xl">
                        {m.emoji}
                      </span>
                      <span className="text-xs">{m.label}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="journal-entry" className="text-sm text-silver-300">
                Journal (private, stays on this PC)
              </label>
              <textarea
                id="journal-entry"
                name="entry"
                rows={4}
                maxLength={MAX_ENTRY}
                defaultValue={reflections.today?.entry ?? ""}
                placeholder="One good thing, one lesson, one plan for tomorrow…"
                className={`${input} py-2`}
              />
            </div>
            <button type="submit" className={primary}>
              Save today
            </button>
          </form>
          <p className="mt-2 text-xs text-silver-300">Writing an entry gives Habits +{JOURNAL_DAY_XP} XP. Mood is just for you — never scored.</p>

          <h3 className="mt-5 font-display text-lg text-gold-300">Last 14 days</h3>
          <ol className="mt-2 grid grid-cols-7 gap-1" aria-label="Mood over the last 14 days" data-testid="mood-strip">
            {reflections.series.map((s) => {
              const m = s.mood ? moodFor(s.mood) : null;
              return (
                <li
                  key={s.day}
                  title={`${label(s.day)}: ${m ? m.label : "not logged"}`}
                  className="flex aspect-square items-center justify-center rounded-md bg-obsidian-800 text-lg"
                >
                  <span aria-hidden="true">{m ? m.emoji : "·"}</span>
                  <span className="sr-only">
                    {label(s.day)}: {m ? m.label : "not logged"}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-sm text-silver-300">
            {reflections.average === null ? "No moods logged yet." : `Average: ${reflections.average} / 5`}
          </p>
          {reflections.entries.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="min-h-11 cursor-pointer py-2 text-silver-300">Recent journal entries</summary>
              <ul className="grid gap-3">
                {reflections.entries.map((e) => (
                  <li key={e.day}>
                    <p className="text-xs text-silver-300">{label(e.day)}</p>
                    <p className="whitespace-pre-wrap text-silver-100">{e.entry}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {/* Focus */}
        <section id="focus" aria-labelledby="focus-heading" className={card}>
          <h2 id="focus-heading" className={h2}>
            Focus timer
          </h2>
          <div className="mt-3">
            <FocusTimer />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-silver-300">Today</dt>
              <dd className="font-display text-lg text-silver-100" data-testid="focus-today">
                {hours(focus.todayMinutes)}
              </dd>
            </div>
            <div>
              <dt className="text-silver-300">Last 7 days</dt>
              <dd className="font-display text-lg text-silver-100">{hours(focus.weekMinutes)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-silver-300">Every 25 minutes of focus gives Study +{FOCUS_XP_PER_25} XP.</p>
          <Link href="/mind/cards" className={`${btn} mt-4 w-full border border-emerald-500/50 text-emerald-300 hover:bg-emerald-700/20`}>
            Security+ cards · {cards.due.length} due
          </Link>
        </section>
      </div>

      {/* Reading */}
      <section id="reading" aria-labelledby="reading-heading" className={card}>
        <h2 id="reading-heading" className={h2}>
          Reading
        </h2>
        <p className="mt-1 text-xs text-silver-300">
          Each day you read gives Reading +{READING_DAY_XP} XP; finishing a book gives +{BOOK_FINISHED_XP} XP.
        </p>
        {reading.length === 0 ? (
          <p className="mt-3 text-silver-300">No books on the go. Add one below.</p>
        ) : (
          <ul className="mt-3 grid gap-4" aria-label="Books in progress">
            {reading.map((b) => (
              <li key={b.id} data-testid={`book-${b.title}`}>
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-silver-100">
                    📖 <strong>{b.title}</strong>
                    {b.author && <span className="text-silver-300"> · {b.author}</span>}
                  </span>
                  <span className="text-silver-300">
                    {b.pagesRead} / {b.totalPages} pages
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${b.title} progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={b.percent}
                  className="mt-1 h-2 overflow-hidden rounded-full bg-obsidian-700"
                >
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${b.percent}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <form action={logPagesAction} className="flex items-center gap-2">
                    <input type="hidden" name="bookId" value={b.id} />
                    <label htmlFor={`pages-${b.id}`} className="sr-only">
                      Pages read in {b.title}
                    </label>
                    <input id={`pages-${b.id}`} name="pages" inputMode="numeric" required placeholder="pages" className={`${input} mt-0 w-24`} />
                    <button type="submit" className={`${btn} border border-emerald-500/50 text-emerald-300`}>
                      Log pages
                    </button>
                  </form>
                  <form action={archiveBookAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <button type="submit" aria-label={`Remove ${b.title}`} className="min-h-11 px-2 text-sm text-silver-300 hover:text-ember-300">
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form action={addBookAction} className="mt-5 grid gap-2 sm:grid-cols-[2fr_1fr_6rem_auto]" aria-label="Add a book">
          <label className="sr-only" htmlFor="book-title">
            Title
          </label>
          <input id="book-title" name="title" required maxLength={120} placeholder="Title" className={`${input} mt-0`} />
          <label className="sr-only" htmlFor="book-author">
            Author
          </label>
          <input id="book-author" name="author" maxLength={80} placeholder="Author" className={`${input} mt-0`} />
          <label className="sr-only" htmlFor="book-pages">
            Total pages
          </label>
          <input id="book-pages" name="pages" inputMode="numeric" required placeholder="Pages" className={`${input} mt-0`} />
          <button type="submit" className={primary}>
            Add book
          </button>
        </form>

        {finished.length > 0 && (
          <>
            <h3 className="mt-5 font-display text-lg text-gold-300">Finished · {finished.length}</h3>
            <ul className="mt-2 grid gap-1 text-sm" data-testid="finished-books">
              {finished.map((b) => (
                <li key={b.id} className="flex justify-between gap-3">
                  <span className="text-silver-100">
                    🏅 {b.title}
                    {b.author && <span className="text-silver-300"> · {b.author}</span>}
                  </span>
                  <span className="text-silver-300">{label(b.finishedOn!)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

export default function MindPage({ searchParams }: PageProps<"/mind">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-[max(2rem,env(safe-area-inset-top))]">
      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-x-6 text-sm">
        <Link href="/" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          ← LIFEQUEST
        </Link>
        <Link href="/mind/cards" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          Security+ cards
        </Link>
      </nav>
      <h1 className="mb-4 font-display text-4xl font-bold tracking-wide text-gold-300">Mind</h1>
      <Suspense fallback={<p className="text-silver-300">Gathering thoughts…</p>}>
        <Mind searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
