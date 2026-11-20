import { prisma } from "@/server/db/client";
import { getDayDetail } from "../server/agenda";

const card = "rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-4 sm:p-5";
const h2 = "font-display text-lg text-gold-300";
const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const MOOD = ["", "😞", "😕", "😐", "🙂", "😄"];

/** Everything logged in LIFEQUEST on one day. */
export async function LifequestDayDetail({ day }: { day: string }) {
  const x = await getDayDetail(prisma, day);
  const spent = x.money.filter((t) => t.amountPence > 0).reduce((n, t) => n + t.amountPence, 0);
  const empty =
    !x.deeds.length && !x.sets.length && !x.runs.length && !x.water && !x.sleep && !x.weight && !x.reading.length && !x.focus.length && !x.money.length && !x.reflection && !x.reviews;
  const row = "flex justify-between gap-3 py-1";

  return (
    <section aria-labelledby="lq-day-heading" className={card} data-testid="day-panel">
      <h3 id="lq-day-heading" className={h2}>
        Logged in LIFEQUEST
      </h3>
      {empty ? (
        <p className="mt-2 text-sm text-silver-300">Nothing logged in LIFEQUEST on this day.</p>
      ) : (
        <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
          {x.deeds.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-silver-300">Deeds</h3>
              <ul className="divide-y divide-obsidian-700">
                {x.deeds.map((e) => (
                  <li key={e.id} className={row}>
                    <span className="text-silver-100">
                      {e.actionIcon} {e.actionName}
                      {e.note && <span className="block text-xs text-silver-300">“{e.note}”</span>}
                    </span>
                    <span className={e.honourDelta >= 0 ? "text-emerald-300" : "text-ember-300"}>
                      {e.honourDelta >= 0 ? "+" : "−"}
                      {Math.abs(e.honourDelta)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(x.sets.length > 0 || x.runs.length > 0 || x.water > 0 || x.sleep || x.weight) && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-silver-300">Body</h3>
              <ul className="divide-y divide-obsidian-700 text-silver-100">
                {x.sets.map((s) => (
                  <li key={s.id} className={row}>
                    <span>🏋️ {s.exercise}</span>
                    <span className="text-silver-300">
                      {s.sets}×{s.reps}
                      {s.weightGrams ? ` @ ${s.weightGrams / 1000} kg` : ""}
                    </span>
                  </li>
                ))}
                {x.runs.map((r) => (
                  <li key={r.id} className={row}>
                    <span>🏃 Run</span>
                    <span className="text-silver-300">
                      {(r.distanceMetres / 1000).toFixed(2)} km in {Math.floor(r.durationSeconds / 60)}:{String(r.durationSeconds % 60).padStart(2, "0")}
                    </span>
                  </li>
                ))}
                {x.water > 0 && (
                  <li className={row}>
                    <span>💧 Water</span>
                    <span className="text-silver-300">{x.water} glasses</span>
                  </li>
                )}
                {x.sleep && (
                  <li className={row}>
                    <span>🌙 Sleep</span>
                    <span className="text-silver-300">
                      {x.sleep.bedTime}–{x.sleep.wakeTime} · {Math.floor(x.sleep.minutes / 60)}h {String(x.sleep.minutes % 60).padStart(2, "0")}m
                    </span>
                  </li>
                )}
                {x.weight && (
                  <li className={row}>
                    <span>⚖️ Weight</span>
                    <span className="text-silver-300">{x.weight.grams / 1000} kg</span>
                  </li>
                )}
              </ul>
            </div>
          )}
          {(x.reading.length > 0 || x.focus.length > 0 || x.reviews > 0 || x.reflection) && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-silver-300">Mind</h3>
              <ul className="divide-y divide-obsidian-700 text-silver-100">
                {x.reading.map((r) => (
                  <li key={r.id} className={row}>
                    <span>📖 {r.book.title}</span>
                    <span className="text-silver-300">{r.pages} pages</span>
                  </li>
                ))}
                {x.focus.length > 0 && (
                  <li className={row}>
                    <span>⏳ Focus</span>
                    <span className="text-silver-300">{x.focus.reduce((n, f) => n + f.minutes, 0)} min</span>
                  </li>
                )}
                {x.reviews > 0 && (
                  <li className={row}>
                    <span>🃏 Cards reviewed</span>
                    <span className="text-silver-300">{x.reviews}</span>
                  </li>
                )}
                {x.reflection?.mood && (
                  <li className={row}>
                    <span>Mood</span>
                    <span aria-label={`${x.reflection.mood} out of 5`}>{MOOD[x.reflection.mood]}</span>
                  </li>
                )}
                {x.reflection?.entry && (
                  <li className="py-1">
                    <span className="block">✍️ Journal</span>
                    <span className="whitespace-pre-wrap text-silver-300">{x.reflection.entry}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
          {x.money.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-silver-300">Money · spent {gbp.format(spent / 100)}</h3>
              <ul className="divide-y divide-obsidian-700 text-silver-100">
                {x.money.map((t) => (
                  <li key={t.id} className={row}>
                    <span className="min-w-0 truncate">{t.description}</span>
                    <span className={t.amountPence > 0 ? "text-silver-300" : "text-emerald-300"}>
                      {t.amountPence > 0 ? "−" : "+"}
                      {gbp.format(Math.abs(t.amountPence) / 100)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
