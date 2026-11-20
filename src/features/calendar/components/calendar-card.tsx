import { connection } from "next/server";
import { prisma } from "@/server/db/client";
import { getDataPaths } from "@/server/config/paths";
import { loadGoogleConfig } from "../google/client-file";
import {
  disconnectCalendarAction,
  importClientFromDownloadsAction,
  importClientUploadAction,
  saveReminderAction,
  syncCalendarNowAction,
} from "../server/actions";
import { getDailyReminder, getStatus } from "../server/service";

const MESSAGES: Record<string, { text: string; ok: boolean }> = {
  connected: { text: "Google Calendar linked. New deeds will appear in your LIFEQUEST calendar.", ok: true },
  denied: { text: "Google access was not granted. Nothing was linked.", ok: false },
  "invalid-state": { text: "That sign-in link expired or was tampered with. Please try again.", ok: false },
  error: { text: "Linking failed. Check your Google OAuth client settings and try again.", ok: false },
  "not-configured": { text: "Import your Google OAuth client file first (below).", ok: false },
  "client-imported": { text: "Google client imported. Now click “Link Google Calendar”.", ok: true },
  "client-not-found": { text: "No client_secret_….json file found in your Downloads folder.", ok: false },
  "client-invalid": { text: "That file isn't a Google “Web application” OAuth client JSON.", ok: false },
  "client-too-large": { text: "That file is too large to be a Google client JSON.", ok: false },
  "reminder-on": { text: "Daily reminder saved. It will appear in your LIFEQUEST calendar shortly.", ok: true },
  "reminder-off": { text: "Daily reminder turned off.", ok: true },
  "reminder-invalid": { text: "Please enter a valid time.", ok: false },
};

const btn =
  "inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";

export async function CalendarCard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const sp = await searchParams;
  const flag = typeof sp.google === "string" ? MESSAGES[sp.google] : undefined;
  const cfg = loadGoogleConfig(getDataPaths());
  const [status, reminder] = await Promise.all([getStatus(prisma, cfg), getDailyReminder(prisma)]);

  return (
    <section aria-labelledby="gcal-heading" className="rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-5">
      <h2 id="gcal-heading" className="font-display text-xl text-gold-300">
        Google Calendar
      </h2>
      <p className="mt-1 text-sm text-silver-300">
        Every good deed and bad habit you log is added to a separate <strong className="text-silver-100">LIFEQUEST</strong>{" "}
        calendar in your Google account. Undo removes it again. LIFEQUEST can also <em>read</em> your other calendars so
        they show in the in-app Calendar — it never changes or stores those events.
      </p>

      {flag && (
        <p role="status" className={`mt-3 rounded-lg border px-3 py-2 text-sm ${flag.ok ? "border-emerald-500/40 text-emerald-300" : "border-ember-500/40 text-ember-300"}`}>
          {flag.text}
        </p>
      )}

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-silver-300">Status</dt>
        <dd data-testid="gcal-status" className="text-silver-100">
          {!status.configured ? "Not set up" : status.connected ? (status.calendarReady ? "Linked" : "Linked (creating calendar…)") : "Not linked"}
        </dd>
        {status.connected && (
          <>
            <dt className="text-silver-300">Waiting to sync</dt>
            <dd className="text-silver-100">{status.pending}</dd>
            {status.failing > 0 && (
              <>
                <dt className="text-silver-300">Gave up after retries</dt>
                <dd className="text-ember-300">{status.failing}</dd>
              </>
            )}
            {status.lastError && (
              <>
                <dt className="text-silver-300">Last problem</dt>
                <dd className="text-ember-300">{status.lastError}</dd>
              </>
            )}
          </>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap gap-3">
        {status.configured && !status.connected && (
          // Plain link: this route redirects to Google's consent screen.
          <a href="/api/integrations/google/start" className={`${btn} bg-gold-500 text-obsidian-950 hover:bg-gold-400`}>
            Link Google Calendar
          </a>
        )}
        {status.connected && (
          <>
            <form action={syncCalendarNowAction}>
              <button type="submit" className={`${btn} border border-emerald-500/50 text-emerald-300 hover:bg-emerald-700/20`}>
                Sync now
              </button>
            </form>
            {/* Re-linking asks Google for the current permissions (incl. read-only access to your own events). */}
            <a href="/api/integrations/google/start" className={`${btn} border border-gold-500/50 text-gold-300 hover:bg-gold-500/10`}>
              Re-link
            </a>
            <form action={disconnectCalendarAction}>
              <button type="submit" className={`${btn} border border-ember-500/50 text-ember-300 hover:bg-ember-700/20`}>
                Unlink
              </button>
            </form>
          </>
        )}
      </div>

      {status.connected && (
        <div className="mt-6 rounded-xl border border-obsidian-700 p-4" data-testid="reminder">
          <h3 className="font-display text-lg text-gold-300">Daily reminder</h3>
          <p className="mt-1 text-sm text-silver-300">
            A repeating event with a pop-up alert in your LIFEQUEST calendar, so Google Calendar nudges you on your
            phone and PC.{" "}
            <span className="text-silver-100" data-testid="reminder-status">
              {reminder.enabled ? `On — every day at ${reminder.time}.` : "Off."}
            </span>
          </p>
          <form action={saveReminderAction} className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="reminder-time" className="block text-sm text-silver-300">
                Time
              </label>
              <input
                id="reminder-time"
                name="time"
                type="time"
                defaultValue={reminder.time}
                required
                className="mt-1 min-h-11 rounded-lg border border-obsidian-600 bg-obsidian-950 px-3 text-silver-100 focus-visible:outline-2 focus-visible:outline-emerald-400"
              />
            </div>
            <button type="submit" name="enabled" value="true" className={`${btn} bg-gold-500 text-obsidian-950 hover:bg-gold-400`}>
              {reminder.enabled ? "Update reminder" : "Turn on reminder"}
            </button>
            {reminder.enabled && (
              <button type="submit" name="enabled" value="false" className={`${btn} border border-silver-500/40 text-silver-300 hover:text-silver-100`}>
                Turn off
              </button>
            )}
          </form>
        </div>
      )}

      {!status.configured && (
        <div className="mt-4 rounded-xl border border-gold-500/30 p-4 text-sm">
          <p className="text-silver-100">Import the Google client file (no copy-pasting secrets):</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <form action={importClientFromDownloadsAction}>
              <button type="submit" className={`${btn} bg-gold-500 text-obsidian-950 hover:bg-gold-400`}>
                Import from Downloads
              </button>
            </form>
            <form action={importClientUploadAction} className="flex flex-wrap items-center gap-2">
              <label htmlFor="gcal-client-file" className="text-silver-300">
                or choose the file
              </label>
              <input id="gcal-client-file" name="client" type="file" accept=".json,application/json" className="max-w-56 text-silver-300" />
              <button type="submit" className={`${btn} border border-gold-500/50 text-gold-300 hover:bg-gold-500/10`}>
                Upload
              </button>
            </form>
          </div>
          <p className="mt-2 text-xs text-silver-300">
            The secret is stored privately in your LIFEQUEST data folder and the download is deleted.
          </p>
        </div>
      )}

      {!status.configured && (
        <details className="mt-4 text-sm text-silver-300">
          <summary className="min-h-11 cursor-pointer py-2 text-emerald-300">One-time setup (about 5 minutes)</summary>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Open{" "}
              <a className="text-emerald-300 underline" href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">
                Google Cloud Console
              </a>{" "}
              and create a project called <code>LIFEQUEST</code>.
            </li>
            <li>
              Enable the{" "}
              <a className="text-emerald-300 underline" href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noreferrer">
                Google Calendar API
              </a>
              .
            </li>
            <li>
              Set up the{" "}
              <a className="text-emerald-300 underline" href="https://console.cloud.google.com/auth/overview" target="_blank" rel="noreferrer">
                OAuth consent screen
              </a>
              : External, app name LIFEQUEST, and add your own Google address as a test user.
            </li>
            <li>
              Create an{" "}
              <a className="text-emerald-300 underline" href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noreferrer">
                OAuth client
              </a>
              : type <em>Web application</em>, authorised redirect URI{" "}
              <code className="break-all text-silver-100">{cfg?.redirectUri ?? "http://localhost:3000/api/integrations/google/callback"}</code>.
            </li>
            <li>
              Click <em>Download JSON</em> on the new client, then <em>Import from Downloads</em> above. (Advanced: you can
              instead set <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code> in <code>.env.local</code>.)
            </li>
          </ol>
        </details>
      )}
    </section>
  );
}
