import { prisma } from "@/server/db/client";
import { saveReviewAction } from "../server/actions";
import { getReview, MAX_REVIEW_TEXT, resurfacedEntry, REVIEW_XP } from "../server/review";

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const area =
  "mt-1 block w-full rounded-lg border border-obsidian-600 bg-obsidian-950 px-3 py-2 text-silver-100 placeholder:text-silver-500 focus-visible:outline-2 focus-visible:outline-emerald-400";

const QUESTIONS = [
  { name: "win", label: "What was your best win this week?", placeholder: "Something you're proud of, big or small" },
  { name: "obstacle", label: "What got in the way?", placeholder: "Be honest — no judgement" },
  { name: "change", label: "One thing to change next week", placeholder: "Small and specific beats big and vague" },
] as const;

/** Sunday ritual: three reflections for the week, plus a look back at an older journal entry. */
export async function WeeklyReview({ week, status }: { week: string; status: string | null }) {
  const [review, past] = await Promise.all([getReview(prisma, week), resurfacedEntry(prisma, week)]);
  return (
    <section id="review" aria-labelledby="review-heading" className="rounded-2xl border border-gold-500/40 bg-obsidian-900/80 p-5">
      <h2 id="review-heading" className="font-display text-xl text-gold-300">
        Weekly review
      </h2>
      <p className="mt-1 text-sm text-silver-300">Five minutes to close out the week. Completing it gives your Habits dragon +{REVIEW_XP} XP.</p>
      {past && (
        <figure className="mt-3 rounded-lg border border-obsidian-600 bg-obsidian-950/60 p-3" data-testid="resurfaced">
          <figcaption className="text-xs uppercase tracking-wider text-silver-300">From your journal · {dayFmt.format(new Date(`${past.day}T12:00:00Z`))}</figcaption>
          <blockquote className="mt-1 whitespace-pre-wrap text-sm text-silver-100">“{past.entry}”</blockquote>
        </figure>
      )}
      <form action={saveReviewAction} className="mt-3 grid gap-3" aria-label="Weekly review">
        <input type="hidden" name="week" value={week} />
        {QUESTIONS.map((q) => (
          <div key={q.name}>
            <label htmlFor={`review-${q.name}`} className="text-sm text-silver-100">
              {q.label}
            </label>
            <textarea
              id={`review-${q.name}`}
              name={q.name}
              rows={2}
              maxLength={MAX_REVIEW_TEXT}
              defaultValue={review?.[q.name] ?? ""}
              placeholder={q.placeholder}
              className={area}
            />
          </div>
        ))}
        <div className="flex items-center gap-3">
          <button type="submit" className="min-h-11 rounded-lg bg-gold-500 px-5 text-sm font-semibold text-obsidian-950 hover:bg-gold-400">
            Save review
          </button>
          {status === "saved" && (
            <p role="status" className="text-sm text-emerald-300">
              Saved. Well done for reflecting.
            </p>
          )}
          {status === "error" && (
            <p role="status" className="text-sm text-ember-300">
              Couldn&apos;t save — keep each answer under {MAX_REVIEW_TEXT} characters.
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
