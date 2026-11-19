import Link from "next/link";
import { Suspense } from "react";
import { HomeRank } from "@/features/honour/components/home-rank";
import { HomeHero } from "@/features/treasury/components/home-hero";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16 bg-[radial-gradient(ellipse_at_top,var(--color-obsidian-700),var(--color-obsidian-950)_70%)]">
      <section className="w-full max-w-xl rounded-2xl border border-gold-500/30 bg-obsidian-900/80 p-8 text-center shadow-[0_0_60px_-20px_var(--color-emerald-500)]">
        <h1 className="font-display text-4xl font-bold tracking-wide text-gold-300 sm:text-5xl">LIFEQUEST</h1>
        <p className="mt-4 text-silver-300">Your life, forged into an epic quest.</p>
        <Suspense fallback={<p className="mt-6 text-silver-300">Reading your legend…</p>}>
          <HomeHero />
          <HomeRank />
        </Suspense>
        <Link
          href="/honour"
          className="mt-8 inline-flex min-h-11 items-center rounded-lg bg-gold-500 px-6 font-semibold text-obsidian-950 hover:bg-gold-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300"
        >
          Open your Honour ledger
        </Link>
        <Link
          href="/dragons"
          className="mt-3 ml-3 inline-flex min-h-11 items-center rounded-lg border border-emerald-500/50 px-6 font-semibold text-emerald-300 hover:bg-emerald-700/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          Visit the Dragon Lair
        </Link>
        <p className="mt-4">
          <Link href="/settings" className="inline-flex min-h-11 items-center text-sm text-silver-300 underline underline-offset-4 hover:text-gold-300">
            Settings &amp; Google Calendar
          </Link>
          <span className="mx-2 text-silver-500" aria-hidden="true">·</span>
          <Link href="/achievements" className="inline-flex min-h-11 items-center text-sm text-silver-300 underline underline-offset-4 hover:text-gold-300">
            Achievements
          </Link>
          <span className="mx-2 text-silver-500" aria-hidden="true">·</span>
          <Link href="/money" className="inline-flex min-h-11 items-center text-sm text-silver-300 underline underline-offset-4 hover:text-gold-300">
            Money
          </Link>
          <span className="mx-2 text-silver-500" aria-hidden="true">·</span>
          <Link href="/body" className="inline-flex min-h-11 items-center text-sm text-silver-300 underline underline-offset-4 hover:text-gold-300">
            Body
          </Link>
        </p>
        <p className="mt-8 text-sm text-silver-500">
          Server status: <a className="text-emerald-300 underline underline-offset-4 hover:text-emerald-400" href="/api/health">/api/health</a>
        </p>
      </section>
    </main>
  );
}
