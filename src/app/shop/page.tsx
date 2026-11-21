import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AREAS } from "@/features/dragons/areas";
import { DragonSprite } from "@/features/dragons/components/dragon-sprite";
import { londonDateKey } from "@/features/honour/rules";
import { CATALOG, REGULAR_ITEMS, type ShopItem } from "@/features/treasury/catalog";
import { SEASONS, seasonEnds, seasonFor } from "@/features/treasury/seasons";
import { buyItemAction, equipItemAction } from "@/features/treasury/server/actions";
import { getTreasury } from "@/features/treasury/server/service";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "Treasure Shop · LIFEQUEST" };

const num = new Intl.NumberFormat("en-GB");
const endFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const btn =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:opacity-50";

async function Shop({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const sp = await searchParams;
  const result = typeof sp.r === "string" ? sp.r : "";
  const t = await getTreasury(prisma);
  const preview = AREAS[0];

  const card = (item: ShopItem) => {
          const owned = t.owned.has(item.id);
          return (
            <li key={item.id} className="flex flex-col rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-4" data-testid={`item-${item.id}`}>
              <DragonSprite
                stage={12}
                mood="content"
                element={preview.element}
                palette={preview.palette}
                accessory={item.id}
                animate={false}
                label={`Preview: ${item.name} on a dragon`}
                className="aspect-[7/5] w-full rounded-lg bg-obsidian-950"
              />
              <p className="mt-2 font-display text-lg font-bold text-gold-300">
                <span aria-hidden="true">{item.icon}</span> {item.name}
              </p>
              <p className="flex-1 text-sm text-silver-300">{item.description}</p>
              {owned ? (
                <form action={equipItemAction} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="itemId" value={item.id} />
                  <label htmlFor={`equip-${item.id}`} className="sr-only">
                    Dragon to wear {item.name}
                  </label>
                  <select
                    id={`equip-${item.id}`}
                    name="areaId"
                    className="min-h-11 flex-1 rounded-lg border border-obsidian-600 bg-obsidian-950 px-2 text-sm text-silver-100"
                  >
                    {AREAS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} dragon{t.equipped[a.id] === item.id ? " (wearing)" : ""}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className={`${btn} border border-emerald-500/50 text-emerald-300`}>
                    Equip
                  </button>
                </form>
              ) : (
                <form action={buyItemAction} className="mt-3">
                  <input type="hidden" name="itemId" value={item.id} />
                  <button
                    type="submit"
                    disabled={t.balance < item.price}
                    aria-label={`Buy ${item.name} for ${item.price} gold`}
                    className={`${btn} w-full bg-gold-500 text-obsidian-950 hover:bg-gold-400`}
                  >
                    🪙 {num.format(item.price)}
                  </button>
                </form>
              )}
            </li>
          );
  };

  const today = londonDateKey(new Date());
  const season = seasonFor(today);
  const seasonal = CATALOG.filter((i) => i.season && (i.season === season || t.owned.has(i.id)));

  return (
    <>
      <p className="mb-4 text-lg text-silver-100" data-testid="gold">
        🪙 <strong className="text-gold-300">{num.format(t.balance)}</strong> gold
        <span className="ml-2 text-sm text-silver-300">
          (earned {num.format(t.earned)} · spent {num.format(t.spent)})
        </span>
      </p>
      {result && (
        <p role="status" className={`mb-4 rounded-lg border px-3 py-2 text-sm ${result === "bought" ? "border-emerald-500/40 text-emerald-300" : "border-ember-500/40 text-ember-300"}`}>
          {result === "bought" ? "Purchased! Equip it on any dragon below." : decodeURIComponent(result.replace(/^error:/, ""))}
        </p>
      )}
      <section aria-labelledby="season-heading" className="mb-6 rounded-2xl border border-gold-500/50 bg-obsidian-900/80 p-4" data-testid="season">
        <h2 id="season-heading" className="font-display text-xl text-gold-300">
          {SEASONS[season].icon} {SEASONS[season].festival}
        </h2>
        <p className="text-sm text-silver-300">Limited item — on sale until {endFmt.format(new Date(`${seasonEnds(today)}T12:00:00Z`))}. Seasonal items you own stay yours.</p>
        <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Seasonal items">
          {seasonal.map(card)}
        </ul>
      </section>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Shop items">
        {REGULAR_ITEMS.map(card)}
      </ul>
      <p className="mt-6 text-sm text-silver-300">
        Earn gold from good deeds (1 per Honour point), half of all bonus XP, and 50 for every weekly boss you defeat. To take
        an item off, use “Remove item” on a dragon&apos;s page.
      </p>
    </>
  );
}

export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <nav aria-label="Breadcrumb" className="-mx-4 flex gap-x-5 overflow-x-auto whitespace-nowrap px-4 text-sm [scrollbar-width:none]">
        <Link href="/" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          ← LIFEQUEST
        </Link>
        <Link href="/dragons" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          Dragon Lair
        </Link>
      </nav>
      <h1 className="mb-4 font-display text-4xl font-bold tracking-wide text-gold-300">Treasure Shop</h1>
      <Suspense fallback={<p className="text-silver-300">Opening the vault…</p>}>
        <Shop searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
