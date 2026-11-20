import Link from "next/link";
import { Suspense } from "react";
import { TodayPanel } from "@/features/dashboard/components/today-panel";
import { PixelIcon, type IconName } from "@/components/ui/pixel-icon";
import { HomeRank } from "@/features/honour/components/home-rank";
import { HomeHero } from "@/features/treasury/components/home-hero";

const AREAS: { href: string; icon: IconName; label: string }[] = [
  { href: "/honour", icon: "honour", label: "Honour" },
  { href: "/dragons", icon: "dragons", label: "Dragons" },
  { href: "/money", icon: "money", label: "Money" },
  { href: "/body", icon: "body", label: "Body" },
  { href: "/mind", icon: "mind", label: "Mind" },
  { href: "/report", icon: "report", label: "Weekly report" },
  { href: "/shop", icon: "shop", label: "Shop" },
  { href: "/achievements", icon: "achievements", label: "Achievements" },
  { href: "/calendar", icon: "calendar", label: "Calendar" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

export default function Home() {
  return (
    <main className="flex flex-1 justify-center px-4 pb-16 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <section className="w-full max-w-2xl rounded-2xl border border-gold-500/30 bg-obsidian-900/80 p-6 text-center shadow-[0_0_60px_-20px_var(--color-emerald-500)] sm:p-8">
        <h1 className="font-display text-4xl font-bold tracking-wide text-gold-300 sm:text-5xl">LIFEQUEST</h1>
        <p className="mt-3 text-silver-300">Your life, forged into an epic quest.</p>

        <form role="search" action="/search" className="mt-5 flex gap-2">
          <label htmlFor="home-search" className="sr-only">
            Search everything
          </label>
          <input
            id="home-search"
            name="q"
            type="search"
            placeholder="Search actions, notes, spending, books…"
            className="block min-h-11 w-full rounded-lg border border-obsidian-600 bg-obsidian-950 px-3 text-silver-100 placeholder:text-silver-500 focus-visible:outline-2 focus-visible:outline-emerald-400"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-500/50 px-4 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10"
          >
            <PixelIcon name="search" className="h-4 w-4" />
            Search
          </button>
        </form>

        <Suspense fallback={<p className="mt-6 text-silver-300">Reading your legend…</p>}>
          <HomeHero />
          <HomeRank />
          <TodayPanel />
        </Suspense>

        <nav aria-label="Areas" className="mt-6">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {AREAS.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className="group flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-obsidian-600 bg-obsidian-950/60 px-2 py-2 text-sm text-silver-100 transition-transform hover:-translate-y-0.5 hover:border-emerald-400 hover:text-emerald-300 hover:shadow-[0_0_18px_-6px_var(--color-emerald-400)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                >
                  <PixelIcon name={a.icon} className="h-8 w-8" />
                  {a.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="mt-6 text-xs text-silver-500">
          Server status: <a className="text-emerald-300 underline underline-offset-4 hover:text-emerald-400" href="/api/health">/api/health</a>
        </p>
      </section>
    </main>
  );
}
