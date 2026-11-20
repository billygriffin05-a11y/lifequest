import { connection } from "next/server";
import { londonDateKey } from "@/features/honour/rules";
import { getCalendarOverview } from "../server/google-events";
import { calendarDeps } from "../server/runtime";

const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });

/** Settings: which Google calendars feed the in-app Calendar, with event counts. */
export async function GoogleCalendarsList() {
  await connection();
  const today = londonDateKey(new Date());
  const from = `${today.slice(0, 7)}-01`;
  const [y, m] = today.split("-").map(Number);
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const o = await getCalendarOverview(calendarDeps(), from, to);
  if (o.status === "not-configured" || o.status === "not-linked") return null;

  return (
    <section aria-labelledby="gcals-heading" className="mt-6 rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-5" data-testid="google-calendars">
      <h2 id="gcals-heading" className="font-display text-xl text-gold-300">
        Calendars LIFEQUEST can see
      </h2>
      {o.status === "needs-relink" && <p className="mt-2 text-sm text-gold-300">Re-link Google Calendar above to let LIFEQUEST read your calendars.</p>}
      {o.status === "error" && <p className="mt-2 text-sm text-ember-300">Couldn&apos;t reach Google just now. Try again in a minute.</p>}
      {o.status === "ok" && (
        <>
          <p className="mt-1 text-sm text-silver-300">
            Events in {monthFmt.format(new Date(`${from}T12:00:00Z`))}, per calendar. If something you expect is missing, check it&apos;s in one
            of these (and the same Google account).
          </p>
          <ul className="mt-3 divide-y divide-obsidian-700 text-sm">
            {o.calendars.map((c) => (
              <li key={c.name} className="flex items-center gap-3 py-2">
                <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm bg-silver-300" style={c.colour ? { backgroundColor: c.colour } : undefined} />
                <span className="min-w-0 flex-1 truncate text-silver-100">
                  {c.name}
                  {c.primary && <span className="ml-2 text-xs text-emerald-300">main</span>}
                </span>
                <span className={c.included ? "text-silver-300" : "text-silver-500"}>
                  {c.included ? `${c.events} event${c.events === 1 ? "" : "s"}` : c.reason === "lifequest" ? "LIFEQUEST's own (deeds)" : "hidden in Google"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
