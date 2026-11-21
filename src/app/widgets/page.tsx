import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { CopyScript } from "@/features/widgets/components/copy-script";
import { scriptableScript } from "@/features/widgets/scriptable";

export const metadata: Metadata = { title: "Widgets · LIFEQUEST" };

const card = "rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-5";
const h2 = "font-display text-xl text-gold-300";

async function Setup() {
  const h = await headers();
  const host = h.get("host") ?? "127.0.0.1:3000";
  const local = /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  const base = `${proto}://${host}`;
  return (
    <>
      {local && (
        <p className="rounded-lg border border-gold-500/40 px-3 py-2 text-sm text-gold-300">
          Open this page on your iPhone (through your Tailscale address) so the script points at the right place.
        </p>
      )}
      <section aria-labelledby="steps-heading" className={card}>
        <h2 id="steps-heading" className={h2}>
          Set up (once)
        </h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-silver-100">
          <li>
            Install <strong>Scriptable</strong> from the App Store (free). iPhone widgets can only come from an installed app, and Scriptable runs
            this small script on your phone.
          </li>
          <li>Tap <strong>Copy widget script</strong> below.</li>
          <li>In Scriptable, tap <strong>+</strong>, paste, and name it <strong>LIFEQUEST</strong>. Tap ▶ once to check it shows your rank.</li>
        </ol>
        <div className="mt-4">
          <CopyScript script={scriptableScript(base)} />
        </div>
      </section>

      <section aria-labelledby="add-heading" className={card}>
        <h2 id="add-heading" className={h2}>
          Add widgets
        </h2>
        <h3 className="mt-2 font-display text-lg text-emerald-300">Home Screen</h3>
        <p className="text-sm text-silver-100">
          Touch and hold the Home Screen → <strong>Edit</strong> → <strong>Add Widget</strong> → Scriptable → pick a size → Add. Then tap the
          widget and set <strong>Script</strong> to LIFEQUEST.
        </p>
        <h3 className="mt-3 font-display text-lg text-emerald-300">Lock Screen</h3>
        <p className="text-sm text-silver-100">
          Touch and hold the Lock Screen → <strong>Customise</strong> → Lock Screen → tap the widget area → Scriptable → choose the rectangle,
          circle or the line above the clock. Tap it and set <strong>Script</strong> to LIFEQUEST.
        </p>
        <h3 className="mt-3 font-display text-lg text-emerald-300">What each widget shows</h3>
        <p className="text-sm text-silver-300">Set the widget&apos;s <strong>Parameter</strong> to choose:</p>
        <ul className="mt-1 grid gap-1 text-sm text-silver-100">
          <li>
            <strong>today</strong> (or blank): rank, quests, streak, cards and water; large adds the boss and what&apos;s coming up
          </li>
          <li>
            <strong>calendar</strong>: your next events and bills from your Google calendar (e.g. Pay rent)
          </li>
          <li>
            <strong>dragon</strong>: your favourite dragon&apos;s stage and mood, and the weekly boss
          </li>
        </ul>
        <p className="mt-3 text-xs text-silver-300">
          Widgets refresh about every 15 minutes (iOS decides exactly when). They need Tailscale on and your PC running; otherwise they show
          &ldquo;offline&rdquo;. Tapping a widget opens LIFEQUEST.
        </p>
      </section>
    </>
  );
}

export default function WidgetsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-4">
      <nav aria-label="Breadcrumb" className="-mx-4 flex gap-x-5 overflow-x-auto whitespace-nowrap px-4 text-sm [scrollbar-width:none]">
        <Link href="/settings" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          ← Settings
        </Link>
      </nav>
      <h1 className="mb-4 font-display text-4xl font-bold tracking-wide text-gold-300">Widgets</h1>
      <div className="grid gap-6">
        <Suspense fallback={<p className="text-silver-300">Loading…</p>}>
          <Setup />
        </Suspense>
      </div>
    </main>
  );
}
