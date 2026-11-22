import { connection } from "next/server";
import { getDataPaths } from "@/server/config/paths";
import { prisma } from "@/server/db/client";
import { savePushPrefsAction } from "../server/actions";
import { countSubscriptions, getOrCreateVapidKeys, getPrefs } from "../server/service";
import { PushToggle } from "./push-toggle";

const input =
  "block min-h-11 rounded-lg border border-obsidian-600 bg-obsidian-950 px-3 text-silver-100 focus-visible:outline-2 focus-visible:outline-emerald-400";

/** Settings: push reminders on/off per device, and which reminders to send. */
export async function NotificationsCard({ saved }: { saved: boolean }) {
  await connection();
  const [prefs, devices] = await Promise.all([getPrefs(prisma), countSubscriptions(prisma)]);
  const { publicKey } = getOrCreateVapidKeys(getDataPaths());

  const check = (name: "streak" | "cards" | "budget" | "plans" | "review", label: string, hint: string, time?: { name: string; value: string }) => (
    <li className="flex flex-wrap items-center gap-3 py-2">
      <label className="flex min-h-11 flex-1 items-center gap-3">
        <input type="checkbox" name={name} defaultChecked={prefs[name]} className="h-5 w-5 accent-emerald-400" />
        <span>
          <span className="block text-silver-100">{label}</span>
          <span className="block text-xs text-silver-300">{hint}</span>
        </span>
      </label>
      {time && (
        <label className="flex items-center gap-2 text-sm text-silver-300">
          at
          <input type="time" name={time.name} defaultValue={time.value} className={input} aria-label={`${label} time`} />
        </label>
      )}
    </li>
  );

  return (
    <section id="notifications" aria-labelledby="push-heading" className="mt-6 rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-5">
      <h2 id="push-heading" className="font-display text-xl text-gold-300">
        Reminders on your phone
      </h2>
      <p className="mt-1 text-sm text-silver-300">
        Notifications are sent from your PC through your device&apos;s push service. They never include amounts or health details.
        {devices > 0 && ` On for ${devices} device${devices === 1 ? "" : "s"}.`}
      </p>
      <div className="mt-3">
        <PushToggle publicKey={publicKey} />
      </div>
      <form action={savePushPrefsAction} aria-label="Reminder settings" className="mt-2">
        <ul className="divide-y divide-obsidian-700">
          {check("streak", "Streak at risk", "If a streak will end at midnight.", { name: "streakTime", value: prefs.streakTime })}
          {check("cards", "Cards due", "Security+ cards ready to review.", { name: "cardsTime", value: prefs.cardsTime })}
          {check("plans", "If-then plans", "At the time you set on each action's plan.")}
          {check("budget", "Budgets", "When a budget passes 80% (once per month).")}
          {check("review", "Weekly review", "Sunday at 18:00, if you haven't done it yet.")}
        </ul>
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" className="min-h-11 rounded-lg bg-gold-500 px-4 text-sm font-semibold text-obsidian-950 hover:bg-gold-400">
            Save reminders
          </button>
          {saved && (
            <p role="status" className="text-sm text-emerald-300">
              Saved.
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
