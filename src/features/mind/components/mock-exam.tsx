"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { EXAM_SECONDS } from "../exam";
import { saveExamAction } from "../server/actions";

interface Q {
  id: string;
  topic: string;
  front: string;
  back: string;
}

const btn =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

/** Timed, self-marked mock: reveal each answer, mark it right or wrong. */
export function MockExam({ paper }: { paper: Q[] }) {
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const answers = useRef<{ cardId: string; correct: boolean }[]>([]);
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const router = useRouter();

  const left = started === null ? EXAM_SECONDS : EXAM_SECONDS - Math.floor((now - started) / 1000);

  const finish = () =>
    start(async () => {
      if (!answers.current.length) {
        setStarted(null);
        return;
      }
      const r = await saveExamAction(answers.current, started === null ? 0 : (Date.now() - started) / 1000);
      if (r.ok) router.push(`/mind/exam?done=${r.id}#results`);
      else setError(true);
    });

  useEffect(() => {
    if (started === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [started]);

  // Time's up: hand in automatically.
  useEffect(() => {
    if (started !== null && left <= 0 && !pending) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  if (!paper.length) return <p className="text-silver-300">Add some cards first — the mock is built from your deck.</p>;

  if (started === null) {
    return (
      <div className="grid gap-3">
        <p className="text-silver-100">
          {paper.length} questions · {EXAM_SECONDS / 60} minutes. For each one, think of your answer, reveal it, then mark yourself honestly.
        </p>
        <button
          type="button"
          className={`${btn} bg-gold-500 text-obsidian-950 hover:bg-gold-400`}
          onClick={() => {
            const t = Date.now();
            setStarted(t);
            setNow(t);
          }}
        >
          Start the mock exam
        </button>
      </div>
    );
  }

  const q = paper[i];
  const mark = (correct: boolean) => {
    answers.current.push({ cardId: q.id, correct });
    setShown(false);
    if (i + 1 >= paper.length) finish();
    else setI(i + 1);
  };

  return (
    <div className="grid gap-3" data-testid="exam-question">
      <div className="flex items-center justify-between text-sm text-silver-300">
        <span>
          Question {i + 1} of {paper.length}
        </span>
        <span role="timer" aria-label="Time left" className={left < 300 ? "font-semibold text-ember-300" : "text-silver-100"}>
          ⏳ {mmss(left)}
        </span>
      </div>
      <article className="rounded-xl border border-gold-500/30 bg-obsidian-950 p-5">
        <p className="text-xs uppercase tracking-wider text-silver-300">{q.topic}</p>
        <p className="mt-2 font-display text-xl text-silver-100">{q.front}</p>
        {shown ? (
          <>
            <p className="mt-3 text-silver-100" data-testid="exam-answer">
              {q.back}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={`${btn} bg-gold-500 text-obsidian-950`} onClick={() => mark(true)} disabled={pending}>
                ✓ I had it
              </button>
              <button type="button" className={`${btn} border border-ember-500/50 text-ember-300`} onClick={() => mark(false)} disabled={pending}>
                ✗ I didn&apos;t
              </button>
            </div>
          </>
        ) : (
          <button type="button" className={`${btn} mt-3 border border-emerald-500/50 text-emerald-300`} onClick={() => setShown(true)}>
            Reveal answer
          </button>
        )}
      </article>
      <button type="button" onClick={finish} disabled={pending} className={`${btn} border border-silver-500/40 text-silver-300`}>
        Hand in now
      </button>
      {error && (
        <p role="alert" className="text-sm text-ember-300">
          Couldn&apos;t save your result. Try handing in again.
        </p>
      )}
    </div>
  );
}
