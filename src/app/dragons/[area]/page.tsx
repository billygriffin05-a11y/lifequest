import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { setDragonPathAction } from "@/features/dragons/server/actions";
import { PATH_STAGE, PATHS, PLANS } from "@/features/dragons/body-plans";
import { DragonSprite } from "@/features/dragons/components/dragon-sprite";
import { RenameForm } from "@/features/dragons/components/rename-form";
import { MOOD_HINT, MOOD_TEXT, STAGE_COUNT } from "@/features/dragons/rules";
import { getDragonDetail } from "@/features/dragons/server/service";
import { equipItemAction, setFavouriteAction } from "@/features/treasury/server/actions";
import { getFavouriteDragon } from "@/features/treasury/server/service";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "Dragon · LIFEQUEST" };

const num = new Intl.NumberFormat("en-GB");
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtDay = (key: string) => dateFmt.format(new Date(`${key}T12:00:00Z`));

async function DragonDetail({ params }: { params: Promise<{ area: string }> }) {
  await connection();
  const { area } = await params;
  const [detail, favourite] = await Promise.all([getDragonDetail(prisma, area), getFavouriteDragon(prisma)]);
  if (!detail) notFound();
  const { dragon, timeline, recent } = detail;
  const { growth, mood } = dragon;

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-4xl font-bold tracking-wide text-gold-300">{dragon.displayName}</h1>
        <p className="mt-1 text-silver-300">
          {dragon.area.elementName} dragon of {dragon.area.name}
          {dragon.customName && <span className="text-silver-500"> · born {dragon.area.dragonName}</span>}
        </p>
        <p className="mt-1 text-sm text-silver-300" data-testid="dragon-look">
          {PLANS[dragon.area.element].look}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section
          aria-label="Dragon"
          className="rounded-2xl border border-obsidian-600 p-3"
          style={{ background: `radial-gradient(ellipse at 45% 65%, ${dragon.area.palette.breathOuter}40, transparent 70%), var(--color-obsidian-950)` }}
        >
          <DragonSprite
            stage={growth.stage}
            mood={mood}
            element={dragon.area.element}
            palette={dragon.area.palette}
            accessory={dragon.accessory}
            path={dragon.path}
            label={`${dragon.displayName}: ${growth.stageName}, ${MOOD_TEXT[mood].toLowerCase()}`}
            className="aspect-[7/5] w-full"
          />
        </section>

        <section aria-labelledby="stats-heading" className="rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-5">
          <h2 id="stats-heading" className="font-display text-xl text-gold-300">
            Stage {growth.stage + 1} of {STAGE_COUNT} · {growth.stageName}
          </h2>
          <p className="mt-2 text-silver-300">
            {num.format(growth.xp)} XP{growth.nextAt !== null ? ` · next stage at ${num.format(growth.nextAt)}` : " · fully grown"}
          </p>
          <div
            role="progressbar"
            aria-label="Growth to next stage"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={growth.percent}
            className="mt-2 h-2 overflow-hidden rounded-full bg-obsidian-700"
          >
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${growth.percent}%` }} />
          </div>
          <p className="mt-4 text-silver-100">
            Mood: <strong>{MOOD_TEXT[mood]}</strong>
          </p>
          <p className="text-sm text-silver-300">{MOOD_HINT[mood]}</p>
          <section aria-labelledby="path-heading" className="mt-5 rounded-xl border border-obsidian-600 p-3" data-testid="evolution-path">
            <h3 id="path-heading" className="font-display text-lg text-gold-300">
              Evolution path
            </h3>
            {growth.stage < PATH_STAGE ? (
              <p className="text-sm text-silver-300">At stage {PATH_STAGE + 1} you&apos;ll choose how {dragon.displayName} evolves.</p>
            ) : (
              <form action={setDragonPathAction} className="mt-2 grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="areaId" value={dragon.area.id} />
                {(Object.keys(PATHS) as (keyof typeof PATHS)[]).map((p) => (
                  <button
                    key={p}
                    type="submit"
                    name="path"
                    value={p}
                    aria-pressed={dragon.path === p}
                    className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm ${
                      dragon.path === p ? "border-gold-400 bg-gold-500/15 text-gold-300" : "border-obsidian-600 text-silver-100 hover:border-emerald-400"
                    }`}
                  >
                    <span className="block font-semibold">
                      {PATHS[p].icon} {PATHS[p].name}
                    </span>
                    <span className="block text-xs text-silver-300">{PATHS[p].blurb}</span>
                  </button>
                ))}
              </form>
            )}
          </section>
          <div className="mt-5">
            <RenameForm areaId={dragon.area.id} current={dragon.customName} defaultName={dragon.area.dragonName} />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {favourite === dragon.area.id ? (
              <p className="inline-flex min-h-11 items-center text-sm text-gold-300">★ Your favourite dragon</p>
            ) : (
              <form action={setFavouriteAction}>
                <input type="hidden" name="areaId" value={dragon.area.id} />
                <button type="submit" className="min-h-11 rounded-lg border border-gold-500/50 px-4 text-sm text-gold-300 hover:bg-gold-500/10">
                  ☆ Make favourite
                </button>
              </form>
            )}
            {dragon.accessory ? (
              <form action={equipItemAction}>
                <input type="hidden" name="areaId" value={dragon.area.id} />
                <input type="hidden" name="itemId" value="" />
                <button type="submit" className="min-h-11 rounded-lg border border-silver-500/40 px-4 text-sm text-silver-300 hover:text-silver-100">
                  Remove item
                </button>
              </form>
            ) : (
              <Link href="/shop" className="inline-flex min-h-11 items-center text-sm text-emerald-300 underline underline-offset-4">
                Dress up in the Treasure Shop
              </Link>
            )}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="timeline-heading" className="rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-5">
          <h2 id="timeline-heading" className="font-display text-xl text-gold-300">
            Growth timeline
          </h2>
          <ol className="mt-3 grid gap-1 text-sm" data-testid="timeline">
            {timeline.map((s) => {
              const reached = s.stage <= growth.stage;
              return (
                <li key={s.stage} className={`flex justify-between gap-3 ${reached ? "text-silver-100" : "text-silver-500"}`}>
                  <span>
                    {reached ? "✓" : "·"} {s.stage + 1}. {s.name}
                  </span>
                  <span className="text-silver-300">
                    {reached ? (s.reachedOn ? fmtDay(s.reachedOn) : "reached") : `${num.format(s.minXp)} XP`}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="recent-heading" className="rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-5">
          <h2 id="recent-heading" className="font-display text-xl text-gold-300">
            Recent deeds
          </h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-silver-300">
              No deeds in {dragon.area.name} yet. Log one on the{" "}
              <Link href="/honour" className="text-emerald-300 underline underline-offset-4">
                Honour page
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-obsidian-700 text-sm">
              {recent.map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-2">
                  <span aria-hidden="true" className="text-lg">
                    {e.actionIcon}
                  </span>
                  <span className="flex-1 text-silver-100">
                    {e.actionName}
                    <span className="ml-2 text-xs text-silver-300">{fmtDay(e.occurredOn)}</span>
                    {e.note && <span className="block italic text-silver-300">“{e.note}”</span>}
                  </span>
                  <span className={e.kind === "good" ? "text-emerald-300" : "text-ember-300"}>
                    {e.honourDelta > 0 ? "+" : "−"}
                    {Math.abs(e.honourDelta)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export default function DragonPage({ params }: PageProps<"/dragons/[area]">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-4">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/dragons" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          ← Dragon Lair
        </Link>
      </nav>
      <Suspense fallback={<p className="text-silver-300">Approaching the lair…</p>}>
        <DragonDetail params={params} />
      </Suspense>
    </main>
  );
}
