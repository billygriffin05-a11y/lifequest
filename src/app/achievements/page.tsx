import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getAchievements } from "@/features/achievements/server/service";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "Achievements · LIFEQUEST" };

async function Badges() {
  await connection();
  const list = await getAchievements(prisma);
  const unlocked = list.filter((a) => a.unlocked).length;
  return (
    <>
      <p className="mb-4 text-silver-300" data-testid="achievement-count">
        {unlocked} of {list.length} unlocked
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <li
            key={a.id}
            data-testid={`badge-${a.id}`}
            data-unlocked={a.unlocked}
            className={`flex items-center gap-4 rounded-2xl border p-4 ${
              a.unlocked ? "border-gold-500/60 bg-gold-500/10" : "border-obsidian-600 bg-obsidian-900/80"
            }`}
          >
            <span aria-hidden="true" className={`text-4xl ${a.unlocked ? "" : "opacity-50 grayscale"}`}>
              {a.unlocked ? a.icon : "🔒"}
            </span>
            <div className="min-w-0">
              <p className={`font-display text-lg font-bold ${a.unlocked ? "text-gold-300" : "text-silver-100"}`}>{a.title}</p>
              <p className="text-sm text-silver-300">{a.description}</p>
              <p className="mt-1 text-xs text-silver-300">
                {a.unlocked ? (
                  <span className="text-emerald-300">Unlocked</span>
                ) : (
                  <>
                    <span className="sr-only">Locked. </span>
                    {a.current}/{a.goal}
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function AchievementsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-[max(2rem,env(safe-area-inset-top))]">
      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-x-6 text-sm">
        <Link href="/" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          ← LIFEQUEST
        </Link>
        <Link href="/honour" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          Honour ledger
        </Link>
      </nav>
      <h1 className="mb-2 font-display text-4xl font-bold tracking-wide text-gold-300">Achievements</h1>
      <Suspense fallback={<p className="text-silver-300">Polishing trophies…</p>}>
        <Badges />
      </Suspense>
    </main>
  );
}
