import Link from "next/link";

/**
 * Environment-setup placeholder. Replaced by the real home screen in the
 * first application development phase.
 */
export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16 bg-[radial-gradient(ellipse_at_top,var(--color-obsidian-700),var(--color-obsidian-950)_70%)]">
      <section className="w-full max-w-xl rounded-2xl border border-gold-500/30 bg-obsidian-900/80 p-8 text-center shadow-[0_0_60px_-20px_var(--color-emerald-500)]">
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Development environment</p>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-wide text-gold-300 sm:text-5xl">LIFEQUEST</h1>
        <p className="mt-4 text-silver-300">
          The forge is ready. Your data stays on your own PC.
        </p>
        <Link
          href="/honour"
          className="mt-8 inline-flex min-h-11 items-center rounded-lg bg-gold-500 px-6 font-semibold text-obsidian-950 hover:bg-gold-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300"
        >
          Open your Honour ledger
        </Link>
        <p className="mt-8 text-sm text-silver-500">
          Server status: <a className="text-emerald-300 underline underline-offset-4 hover:text-emerald-400" href="/api/health">/api/health</a>
        </p>
      </section>
    </main>
  );
}
