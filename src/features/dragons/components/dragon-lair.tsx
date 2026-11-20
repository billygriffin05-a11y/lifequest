import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/server/db/client";
import { MOOD_HINT, MOOD_TEXT, STAGE_COUNT } from "../rules";
import { getDragons } from "../server/service";
import { DragonSprite } from "./dragon-sprite";

const num = new Intl.NumberFormat("en-GB");

const moodStyle = {
  joyful: { chip: "border-gold-500/50 text-gold-300", sprite: "" },
  content: { chip: "border-emerald-500/50 text-emerald-300", sprite: "" },
  restless: { chip: "border-silver-500/50 text-silver-300", sprite: "opacity-80" },
  grumpy: { chip: "border-ember-500/50 text-ember-300", sprite: "saturate-50 brightness-90" },
} as const;

export async function DragonLair() {
  await connection(); // personal data: read at request time
  const dragons = await getDragons(prisma);

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Your dragons">
      {dragons.map(({ area, displayName, accessory, growth, mood, recentHonour }) => {
        const style = moodStyle[mood];
        const headingId = `dragon-${area.id}`;
        return (
          <li key={area.id}>
            <article
              aria-labelledby={headingId}
              data-testid={`dragon-${area.id}`}
              className="flex h-full flex-col rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-4"
            >
              <div
                className="aspect-[7/5] w-full overflow-hidden rounded-xl border border-obsidian-700 p-1"
                style={{
                  // Elemental glow behind each dragon (art data, from its palette).
                  background: `radial-gradient(ellipse at 45% 65%, ${area.palette.breathOuter}40, transparent 70%), var(--color-obsidian-950)`,
                }}
              >
                <DragonSprite
                  stage={growth.stage}
                  mood={mood}
                  element={area.element}
                  palette={area.palette}
                  accessory={accessory}
                  label={`${displayName}, the ${area.elementName} dragon of ${area.name}: ${growth.stageName}, ${MOOD_TEXT[mood].toLowerCase()}`}
                  className={`h-full w-full ${style.sprite}`}
                />
              </div>
              <h2 id={headingId} className="mt-3 font-display text-lg font-bold text-gold-300">
                <Link href={`/dragons/${area.id}`} className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-400">
                  {displayName}
                </Link>
              </h2>
              <p className="text-sm text-silver-300">
                {area.elementName} dragon of {area.name}
              </p>
              <p className="text-sm text-silver-300">
                Stage {growth.stage + 1} of {STAGE_COUNT} · <span className="text-silver-100">{growth.stageName}</span>
              </p>

              <div className="mt-3">
                <div className="flex justify-between text-xs text-silver-300">
                  <span>{num.format(growth.xp)} XP</span>
                  <span>{growth.nextAt === null ? "Fully grown" : `Next at ${num.format(growth.nextAt)}`}</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${area.name} dragon growth to next stage`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={growth.percent}
                  className="mt-1 h-2 overflow-hidden rounded-full bg-obsidian-700"
                >
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${growth.percent}%` }} />
                </div>
              </div>

              <p className="mt-3 text-sm">
                <span className={`inline-block rounded-full border px-2 py-0.5 ${style.chip}`}>{MOOD_TEXT[mood]}</span>
                <span className="ml-2 text-silver-300">
                  Honour this week: {recentHonour > 0 ? "+" : recentHonour < 0 ? "−" : ""}
                  {num.format(Math.abs(recentHonour))}
                </span>
              </p>
              <p className="mt-1 text-xs text-silver-300">{MOOD_HINT[mood]}</p>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
