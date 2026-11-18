import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HonourBoard } from "@/features/honour/components/honour-board";

export const metadata: Metadata = { title: "Honour · LIFEQUEST" };

export default function HonourPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-[max(2rem,env(safe-area-inset-top))]">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          ← LIFEQUEST
        </Link>
      </nav>
      <header className="mb-6">
        <h1 className="font-display text-4xl font-bold tracking-wide text-gold-300">Honour</h1>
        <p className="mt-2 max-w-2xl text-silver-300">
          Every deed shapes your legend. Good deeds earn Honour and XP; bad habits cost Honour.
        </p>
      </header>
      <Suspense fallback={<p className="text-silver-300">Opening your ledger…</p>}>
        <HonourBoard />
      </Suspense>
    </main>
  );
}
