import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { KIND_LABELS, MAX_QUERY, MIN_QUERY, normaliseQuery, search, SEARCH_KINDS, type SearchKind } from "@/features/search/server/service";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "Search · LIFEQUEST" };

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const label = (d: string) => dayFmt.format(new Date(`${d}T12:00:00Z`));

type SP = Promise<Record<string, string | string[] | undefined>>;

async function readParams(searchParams: SP) {
  const sp = await searchParams;
  const q = normaliseQuery(sp.q);
  const kind = SEARCH_KINDS.includes(sp.type as SearchKind) ? (sp.type as SearchKind) : null;
  return { q, kind };
}

async function SearchForm({ searchParams }: { searchParams: SP }) {
  const { q, kind } = await readParams(searchParams);
  return (
    <form role="search" action="/search" className="flex gap-2">
      <label htmlFor="search-q" className="sr-only">
        Search everything
      </label>
      <input
        id="search-q"
        name="q"
        type="search"
        defaultValue={q}
        minLength={MIN_QUERY}
        maxLength={MAX_QUERY}
        placeholder="Actions, notes, spending, books, cards, journal…"
        className="block min-h-11 w-full rounded-lg border border-obsidian-600 bg-obsidian-950 px-3 text-silver-100 placeholder:text-silver-500 focus-visible:outline-2 focus-visible:outline-emerald-400"
      />
      {kind && <input type="hidden" name="type" value={kind} />}
      <button type="submit" className="min-h-11 rounded-lg bg-gold-500 px-4 text-sm font-semibold text-obsidian-950 hover:bg-gold-400">
        Search
      </button>
    </form>
  );
}

async function Results({ searchParams }: { searchParams: SP }) {
  await connection();
  const { q, kind } = await readParams(searchParams);
  if (q.length < MIN_QUERY) return <p className="mt-6 text-silver-300">Type at least {MIN_QUERY} letters.</p>;
  const all = await search(prisma, q);
  const counts = new Map<SearchKind, number>();
  for (const h of all) counts.set(h.kind, (counts.get(h.kind) ?? 0) + 1);
  const hits = kind ? all.filter((h) => h.kind === kind) : all;
  const chip = (active: boolean) =>
    `inline-flex min-h-11 items-center rounded-full border px-3 text-sm ${active ? "border-gold-400 text-gold-300" : "border-obsidian-600 text-silver-300 hover:text-gold-300"}`;

  return (
    <>
      <nav aria-label="Filter results" className="mt-4 flex flex-wrap gap-2">
        <Link href={`/search?q=${encodeURIComponent(q)}`} aria-current={!kind ? "page" : undefined} className={chip(!kind)}>
          All · {all.length}
        </Link>
        {SEARCH_KINDS.filter((k) => counts.get(k)).map((k) => (
          <Link
            key={k}
            href={`/search?q=${encodeURIComponent(q)}&type=${k}`}
            aria-current={kind === k ? "page" : undefined}
            className={chip(kind === k)}
          >
            {KIND_LABELS[k]} · {counts.get(k)}
          </Link>
        ))}
      </nav>
      {hits.length === 0 ? (
        <p className="mt-6 text-silver-300" data-testid="no-results">
          Nothing found for “{q}”.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-obsidian-700 rounded-2xl border border-obsidian-600 bg-obsidian-900/80" data-testid="search-results">
          {hits.map((h) => (
            <li key={`${h.kind}:${h.id}`}>
              <Link href={h.href} className="flex flex-wrap items-baseline gap-x-3 px-4 py-3 hover:bg-obsidian-800">
                <span className="text-xs uppercase tracking-wider text-gold-300">{KIND_LABELS[h.kind]}</span>
                <span className="min-w-0 flex-1 text-silver-100">{h.title}</span>
                {h.day && <span className="text-xs text-silver-300">{label(h.day)}</span>}
                <span className="basis-full text-sm text-silver-300">{h.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-4">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          ← LIFEQUEST
        </Link>
      </nav>
      <h1 className="mb-4 font-display text-4xl font-bold tracking-wide text-gold-300">Search</h1>
      <Suspense fallback={null}>
        <SearchForm searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<p className="mt-6 text-silver-300">Searching the archives…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
