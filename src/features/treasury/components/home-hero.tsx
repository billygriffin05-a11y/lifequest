import Link from "next/link";
import { connection } from "next/server";
import { DragonSprite } from "@/features/dragons/components/dragon-sprite";
import { MOOD_TEXT } from "@/features/dragons/rules";
import { getDragons } from "@/features/dragons/server/service";
import { prisma } from "@/server/db/client";
import { getFavouriteDragon, getTreasury } from "../server/service";

const num = new Intl.NumberFormat("en-GB");

/** Home page hero: your favourite dragon (or the most grown one) and your gold. */
export async function HomeHero() {
  await connection();
  const [dragons, favourite, treasury] = await Promise.all([getDragons(prisma), getFavouriteDragon(prisma), getTreasury(prisma)]);
  const dragon =
    dragons.find((d) => d.area.id === favourite) ?? [...dragons].sort((a, b) => b.growth.xp - a.growth.xp)[0];

  return (
    <div className="mt-6 text-left" data-testid="home-hero">
      <Link
        href={`/dragons/${dragon.area.id}`}
        className="block rounded-2xl border border-obsidian-600 p-2 focus-visible:outline-2 focus-visible:outline-emerald-400"
        style={{ background: `radial-gradient(ellipse at 45% 65%, ${dragon.area.palette.breathOuter}40, transparent 70%), var(--color-obsidian-950)` }}
      >
        <DragonSprite
          stage={dragon.growth.stage}
          mood={dragon.mood}
          element={dragon.area.element}
          palette={dragon.area.palette}
          accessory={dragon.accessory}
          path={dragon.path}
          label={`${dragon.displayName}: ${dragon.growth.stageName}, ${MOOD_TEXT[dragon.mood].toLowerCase()}`}
          className="aspect-[7/5] w-full"
        />
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-silver-100">
          <span className="font-display text-lg text-gold-300">{dragon.displayName}</span>{" "}
          <span className="text-sm text-silver-300">
            · {dragon.growth.stageName}
            {favourite === dragon.area.id ? " · ★ favourite" : ""}
          </span>
        </p>
        <Link href="/shop" className="inline-flex min-h-11 items-center text-sm text-gold-300 underline underline-offset-4" data-testid="home-gold">
          🪙 {num.format(treasury.balance)} gold · Shop
        </Link>
      </div>
    </div>
  );
}
