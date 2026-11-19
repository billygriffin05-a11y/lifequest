import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { londonDateKey } from "@/features/honour/rules";
import { BOX_INTERVALS, STUDY_DAY_MIN_REVIEWS, STUDY_DAY_XP } from "@/features/mind/rules";
import { addCardAction, archiveCardAction, reviewCardAction, seedDeckAction } from "@/features/mind/server/actions";
import { getCardStats, listCards } from "@/features/mind/server/service";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "Security+ cards · LIFEQUEST" };

const card = "rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-5";
const input =
  "mt-1 block min-h-11 w-full rounded-lg border border-obsidian-600 bg-obsidian-950 px-3 text-silver-100 placeholder:text-silver-500 focus-visible:outline-2 focus-visible:outline-emerald-400";
const btn =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";
const primary = `${btn} bg-gold-500 text-obsidian-950 hover:bg-gold-400`;
const h2 = "font-display text-xl text-gold-300";

async function Cards({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const sp = await searchParams;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const err = typeof sp.err === "string" ? sp.err : null;
  const today = londonDateKey(new Date());
  const [stats, all] = await Promise.all([getCardStats(prisma, today), listCards(prisma)]);
  const next = stats.due[0];

  return (
    <div className="grid gap-6">
      {(ok || err) && (
        <p data-testid="banner" className={`rounded-lg border px-3 py-2 text-sm ${ok ? "border-emerald-500/40 text-emerald-300" : "border-ember-500/40 text-ember-300"}`}>
          {ok ?? err}
        </p>
      )}

      <section id="review" aria-labelledby="review-heading" className={card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="review-heading" className={h2}>
            Review
          </h2>
          <p className="text-sm text-silver-300" data-testid="review-progress">
            {stats.due.length} due · {stats.reviewedToday} reviewed today ({stats.correctToday} right)
          </p>
        </div>

        {stats.total === 0 ? (
          <form action={seedDeckAction} className="mt-3">
            <p className="text-silver-300">No cards yet. Start with a Security+ (SY0-701) starter deck across all five domains, or write your own below.</p>
            <button type="submit" className={`${primary} mt-3`}>
              Add Security+ starter deck
            </button>
          </form>
        ) : !next ? (
          <p className="mt-4 text-lg text-emerald-300" data-testid="all-done">
            🎉 All caught up. Come back tomorrow.
          </p>
        ) : (
          <article className="mt-4 rounded-xl border border-gold-500/30 bg-obsidian-950 p-5" data-testid="card-under-review">
            <p className="text-xs uppercase tracking-wider text-silver-300">
              {next.topic || next.deck} · box {next.box}
            </p>
            <p className="mt-2 font-display text-xl text-silver-100">{next.front}</p>
            <details className="mt-4">
              <summary className={`${btn} cursor-pointer list-none border border-emerald-500/50 text-emerald-300`}>Show answer</summary>
              <p className="mt-3 text-silver-100" data-testid="card-answer">
                {next.back}
              </p>
              <p className="mt-3 text-sm text-silver-300">Did you get it?</p>
              <form action={reviewCardAction} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="id" value={next.id} />
                <button type="submit" name="result" value="right" className={primary}>
                  ✓ Got it
                </button>
                <button type="submit" name="result" value="wrong" className={`${btn} border border-ember-500/50 text-ember-300`}>
                  ✗ Missed it
                </button>
              </form>
            </details>
          </article>
        )}

        <p className="mt-4 text-xs text-silver-300">
          Right answers move a card up a box and it comes back later ({BOX_INTERVALS.join(", ")} days); misses go back to box 1 for tomorrow.{" "}
          {STUDY_DAY_MIN_REVIEWS}+ reviews in a day gives Study +{STUDY_DAY_XP} XP.
        </p>
        {stats.total > 0 && (
          <ol className="mt-3 grid grid-cols-5 gap-2 text-center text-xs" aria-label="Cards per box">
            {stats.byBox.map((n, i) => (
              <li key={i} className="rounded-md bg-obsidian-800 py-2">
                <span className="block text-silver-300">Box {i + 1}</span>
                <span className="font-display text-lg text-silver-100">{n}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section id="add-card" aria-labelledby="add-card-heading" className={card}>
        <h2 id="add-card-heading" className={h2}>
          Add a card
        </h2>
        <form action={addCardAction} className="mt-3 grid gap-3" aria-label="New flashcard">
          <div>
            <label htmlFor="card-front" className="text-sm text-silver-300">
              Question
            </label>
            <input id="card-front" name="front" required maxLength={300} className={input} />
          </div>
          <div>
            <label htmlFor="card-back" className="text-sm text-silver-300">
              Answer
            </label>
            <textarea id="card-back" name="back" required maxLength={600} rows={3} className={`${input} py-2`} />
          </div>
          <div>
            <label htmlFor="card-topic" className="text-sm text-silver-300">
              Topic (optional)
            </label>
            <input id="card-topic" name="topic" maxLength={60} placeholder="e.g. 4 · Security operations" className={input} />
          </div>
          <button type="submit" className={primary}>
            Add card
          </button>
        </form>
      </section>

      {all.length > 0 && (
        <section id="all-cards" aria-labelledby="all-cards-heading" className={card}>
          <details>
            <summary className="min-h-11 cursor-pointer py-2">
              <h2 id="all-cards-heading" className={`${h2} inline`}>
                All cards · {all.length}
              </h2>
            </summary>
            <ul className="mt-2 divide-y divide-obsidian-700 text-sm">
              {all.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 text-silver-100">{c.front}</span>
                  <span className="text-xs text-silver-300">box {c.box}</span>
                  <form action={archiveCardAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" aria-label={`Archive card: ${c.front}`} className="min-h-11 px-2 text-silver-300 hover:text-ember-300">
                      ✕
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </div>
  );
}

export default function CardsPage({ searchParams }: PageProps<"/mind/cards">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-[max(2rem,env(safe-area-inset-top))]">
      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-x-6 text-sm">
        <Link href="/mind" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          ← Mind
        </Link>
        <Link href="/dragons/study" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          Study dragon
        </Link>
      </nav>
      <h1 className="mb-4 font-display text-4xl font-bold tracking-wide text-gold-300">Security+ cards</h1>
      <Suspense fallback={<p className="text-silver-300">Shuffling the deck…</p>}>
        <Cards searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
