import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline · LIFEQUEST" };

/** Static page the service worker shows when the PC can't be reached. No personal data. */
export default function OfflinePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <section className="w-full max-w-md rounded-2xl border border-gold-500/30 bg-obsidian-900/80 p-8 text-center">
        <p aria-hidden="true" className="text-5xl">
          🏰
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold text-gold-300">The castle is out of reach</h1>
        <p className="mt-4 text-silver-300">
          LIFEQUEST lives on your PC, and this device can&apos;t reach it right now. Your data is safe there.
        </p>
        <ul className="mt-4 grid gap-1 text-left text-sm text-silver-300">
          <li>• Is the PC switched on and awake?</li>
          <li>• Is the LIFEQUEST app running on it?</li>
          <li>• On your iPhone, is Tailscale connected?</li>
        </ul>
        {/* A plain link forces a full page load through the network (a client-side Link can't while offline). */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-gold-500 px-6 font-semibold text-obsidian-950 hover:bg-gold-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300"
        >
          Try again
        </a>
      </section>
    </main>
  );
}
