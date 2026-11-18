import type { Metadata } from "next";
import Link from "next/link";
import { AREAS } from "@/features/dragons/areas";
import { DragonSprite } from "@/features/dragons/components/dragon-sprite";
import { MOOD_TEXT, STAGES, type Mood } from "@/features/dragons/rules";

export const metadata: Metadata = { title: "Dragon Art Gallery · LIFEQUEST" };

const MOODS: Mood[] = ["joyful", "content", "restless", "grumpy"];

/** Static preview of every elemental dragon at every stage (no personal data). */
export default function DragonGalleryPage() {
  const fire = AREAS[0];
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-[max(2rem,env(safe-area-inset-top))]">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/dragons" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          ← Dragon Lair
        </Link>
      </nav>
      <h1 className="font-display text-4xl font-bold tracking-wide text-gold-300">Dragon Art Gallery</h1>
      <p className="mt-2 max-w-2xl text-silver-300">
        Eight elemental dragons across all {STAGES.length} stages — wings, breath, spines and crowns unlock as they grow.
      </p>

      {AREAS.map((area) => (
        <section key={area.id} aria-labelledby={`g-${area.id}`} className="mt-8">
          <h2 id={`g-${area.id}`} className="font-display text-xl text-gold-300">
            {area.dragonName}{" "}
            <span className="text-base text-silver-300">
              · {area.elementName} · {area.name}
            </span>
          </h2>
          <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-10">
            {STAGES.map((stage, i) => (
              <li key={stage.name} className="rounded-lg bg-obsidian-900 p-1 text-center">
                <DragonSprite
                  stage={i}
                  mood="content"
                  element={area.element}
                  palette={area.palette}
                  label={`${area.dragonName} stage ${i + 1}: ${stage.name}`}
                  className="aspect-[7/5] w-full"
                  animate={false}
                />
                <span className="block truncate text-[0.65rem] text-silver-300">
                  {i + 1}. {stage.name}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section aria-labelledby="g-moods" className="mt-10">
        <h2 id="g-moods" className="font-display text-xl text-gold-300">
          Moods
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MOODS.map((mood) => (
            <li key={mood} className="rounded-lg bg-obsidian-900 p-2 text-center">
              <DragonSprite
                stage={14}
                mood={mood}
                element={fire.element}
                palette={fire.palette}
                label={`${fire.dragonName}, ${MOOD_TEXT[mood]}`}
                className="aspect-[7/5] w-full"
              />
              <span className="text-sm text-silver-300">{MOOD_TEXT[mood]}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
