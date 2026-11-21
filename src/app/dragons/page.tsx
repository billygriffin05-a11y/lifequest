import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DragonLair } from "@/features/dragons/components/dragon-lair";
import { PartyStats } from "@/features/dragons/components/party-stats";

export const metadata: Metadata = { title: "Dragon Lair · LIFEQUEST" };

const link = "inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300";

export default function DragonsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <nav aria-label="Breadcrumb" className="-mx-4 flex gap-x-5 overflow-x-auto whitespace-nowrap px-4 text-sm [scrollbar-width:none]">
        <Link href="/" className={link}>
          ← LIFEQUEST
        </Link>
        <Link href="/honour" className={link}>
          Honour ledger
        </Link>
        <Link href="/dragons/gallery" className={link}>
          Art gallery
        </Link>
      </nav>
      <header className="mb-6">
        <h1 className="font-display text-4xl font-bold tracking-wide text-gold-300">Dragon Lair</h1>
        <p className="mt-2 max-w-2xl text-silver-300">
          Each life area raises its own dragon. Good deeds feed it XP so it grows through twenty stages; your Honour this
          week sets its mood.
        </p>
      </header>
      <Suspense fallback={<p className="text-silver-300">Waking the dragons…</p>}>
        <PartyStats />
        <DragonLair />
      </Suspense>
    </main>
  );
}
