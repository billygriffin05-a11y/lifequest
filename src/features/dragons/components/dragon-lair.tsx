import { connection } from "next/server";
import { prisma } from "@/server/db/client";
import { MOOD_HINT, MOOD_TEXT, STAGE_COUNT } from "../rules";
import { getDragons } from "../server/service";
import { DragonSprite } from "./dragon-sprite";

const num = new Intl.NumberFormat("en-GB");

const moodStyle = {
  joyful: { chip: "border-gold-500/50 text-gold-300", sprite: "lq-hop" },
  content: { chip: "border-emerald-500/50 text-emerald-300", sprite: "" },
  restless: { chip: "border-silver-500/50 text-silver-300", sprite: "opacity-80" },
  grumpy: { chip: "border-ember-500/50 text-ember-300", sprite: "saturate-50 brightness-90" },
} as const;

export async function DragonLair() {
  await connection(); // personal data: read at request time
  const dragons = await getDragons(prisma);

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Your dragons">
      {dragons.map(({ area, growth, mood, recentHonour }) => {
        const style = moodStyle[mood];
        const headingId = `dragon-${area.id}`;
        return (
          <li key={area.id}>
            <article
              aria-labelledby={headingId}
              data-testid={`dragon-${area.id}`}
              className="flex h-full flex-col rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-4"
            >
              <div className="mx-auto aspect-square w-40 rounded-xl bg-[radial-gradient(circle_at_50%_60%,var(--color-obsidian-700),var(--color-obsidian-950)_70%)] p-2">
                <DragonSprite
                  stage={growth.stage}
                  mood={mood}
                  palette={area.palette}
                  label={`${area.dragonName}, the ${area.name} dragon: ${growth.stageName}, ${MOOD_TEXT[mood].toLowerCase()}`}
                  className={`h-full w-full ${style.sprite}`}
                />
              </div>
              <h2 id={headingId} className="mt-3 font-display text-lg font-bold text-gold-300">
                {area.dragonName}
              </h2>
              <p className="text-sm text-silver-300">
                {area.name} · Stage {growth.stage + 1} of {STAGE_COUNT} · <span className="text-silver-100">{growth.stageName}</span>
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
