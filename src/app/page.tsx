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
        <p className="mt-8 text-sm text-silver-500">
          Server status: <a className="text-emerald-300 underline underline-offset-4 hover:text-emerald-400" href="/api/health">/api/health</a>
        </p>
      </section>
    </main>
  );
}
