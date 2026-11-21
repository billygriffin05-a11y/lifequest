import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { MockExam } from "@/features/mind/components/mock-exam";
import { PASS_SCALED, scaledScore } from "@/features/mind/exam";
import { examPaper, listExams } from "@/features/mind/server/service";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "Security+ mock exam · LIFEQUEST" };

const card = "rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-5";
const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const pct = (c: number, t: number) => (t ? Math.round((c / t) * 100) : 0);

async function Exam({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const sp = await searchParams;
  // A fresh shuffle per visit (seeded from a random number, not from render output).
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const [paper, exams] = await Promise.all([examPaper(prisma, seed), listExams(prisma)]);
  const latest = typeof sp.done === "string" ? exams.find((e) => e.id === sp.done) : undefined;

  return (
    <div className="grid gap-6">
      {latest && (
        <section id="results" aria-labelledby="result-heading" className={`${card} border-gold-500/50`} data-testid="exam-result">
          <h2 id="result-heading" className="font-display text-xl text-gold-300">
            Your result
          </h2>
          <p className="mt-2 text-silver-100">
            <strong className="font-display text-3xl text-gold-300">{scaledScore(latest.correct, latest.total)}</strong>
            <span className="ml-2 text-silver-300">
              / 900 · {latest.correct} of {latest.total} ({pct(latest.correct, latest.total)}%) ·{" "}
              {scaledScore(latest.correct, latest.total) >= PASS_SCALED ? "above" : "below"} the {PASS_SCALED} pass mark
            </span>
          </p>
          <p className="mt-1 text-xs text-silver-300">A rough guide only — CompTIA doesn&apos;t publish how it scales scores.</p>
          <ul className="mt-3 grid gap-2" aria-label="Score by domain">
            {latest.byTopic.map((t) => (
              <li key={t.topic}>
                <p className="flex justify-between text-sm">
                  <span className="text-silver-100">{t.topic}</span>
                  <span className="text-silver-300">
                    {t.correct}/{t.total} · {pct(t.correct, t.total)}%
                  </span>
                </p>
                <div
                  role="progressbar"
                  aria-label={`${t.topic} score`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct(t.correct, t.total)}
                  className="mt-1 h-2 overflow-hidden rounded-full bg-obsidian-700"
                >
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct(t.correct, t.total)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="exam-heading" className={card}>
        <h2 id="exam-heading" className="font-display text-xl text-gold-300">
          {latest ? "Try again" : "Sit a mock"}
        </h2>
        <div className="mt-3">
          <MockExam paper={paper} />
        </div>
      </section>

      {exams.length > 0 && (
        <section aria-labelledby="history-heading" className={card}>
          <h2 id="history-heading" className="font-display text-xl text-gold-300">
            Past attempts
          </h2>
          <ul className="mt-2 divide-y divide-obsidian-700 text-sm">
            {exams.map((e) => (
              <li key={e.id} className="flex justify-between py-2">
                <span className="text-silver-300">{dayFmt.format(new Date(`${e.takenOn}T12:00:00Z`))}</span>
                <span className="text-silver-100">
                  {scaledScore(e.correct, e.total)} · {e.correct}/{e.total}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function ExamPage({ searchParams }: PageProps<"/mind/exam">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-4">
      <nav aria-label="Breadcrumb" className="-mx-4 flex gap-x-5 overflow-x-auto whitespace-nowrap px-4 text-sm [scrollbar-width:none]">
        <Link href="/mind/cards" className="inline-flex min-h-11 items-center text-silver-300 hover:text-gold-300">
          ← Security+ cards
        </Link>
      </nav>
      <h1 className="mb-4 font-display text-4xl font-bold tracking-wide text-gold-300">Mock exam</h1>
      <Suspense fallback={<p className="text-silver-300">Printing the paper…</p>}>
        <Exam searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
