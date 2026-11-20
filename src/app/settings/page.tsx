import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarCard } from "@/features/calendar/components/calendar-card";
import { GoogleCalendarsList } from "@/features/calendar/components/google-calendars-list";

export const metadata: Metadata = { title: "Settings · LIFEQUEST" };

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <nav aria-label="Breadcrumb" className="-mx-4 flex gap-x-5 overflow-x-auto whitespace-nowrap px-4 text-sm [scrollbar-width:none]">
        <Link href="/" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          ← LIFEQUEST
        </Link>
        <Link href="/honour" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          Honour ledger
        </Link>
      </nav>
      <h1 className="mb-6 font-display text-4xl font-bold tracking-wide text-gold-300">Settings</h1>
      <Suspense fallback={<p className="text-silver-300">Loading…</p>}>
        <CalendarCard searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <GoogleCalendarsList />
      </Suspense>
    </main>
  );
}
