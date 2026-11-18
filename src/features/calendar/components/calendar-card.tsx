import { connection } from "next/server";
import { prisma } from "@/server/db/client";
import { googleConfig } from "../google/config";
import { disconnectCalendarAction, syncCalendarNowAction } from "../server/actions";
import { getStatus } from "../server/service";

const MESSAGES: Record<string, { text: string; ok: boolean }> = {
  connected: { text: "Google Calendar linked. New deeds will appear in your LIFEQUEST calendar.", ok: true },
  denied: { text: "Google access was not granted. Nothing was linked.", ok: false },
  "invalid-state": { text: "That sign-in link expired or was tampered with. Please try again.", ok: false },
  error: { text: "Linking failed. Check your Google OAuth client settings and try again.", ok: false },
  "not-configured": { text: "Add your Google OAuth client to .env.local first (steps below).", ok: false },
};

const btn =
  "inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";

export async function CalendarCard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const sp = await searchParams;
  const flag = typeof sp.google === "string" ? MESSAGES[sp.google] : undefined;
  const cfg = googleConfig();
  const status = await getStatus(prisma, cfg);

  return (
    <section aria-labelledby="gcal-heading" className="rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-5">
      <h2 id="gcal-heading" className="font-display text-xl text-gold-300">
        Google Calendar
      </h2>
      <p className="mt-1 text-sm text-silver-300">
        Every good deed and bad habit you log is added to a separate <strong className="text-silver-100">LIFEQUEST</strong>{" "}
        calendar in your Google account. Undo removes it again. LIFEQUEST can only see that one calendar — not your
        other calendars or events.
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
            <form action={disconnectCalendarAction}>
              <button type="submit" className={`${btn} border border-ember-500/50 text-ember-300 hover:bg-ember-700/20`}>
                Unlink
              </button>
            </form>
          </>
        )}
      </div>

      {!status.configured && (
        <details className="mt-4 text-sm text-silver-300" open>
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
              Put the client ID and secret in <code>.env.local</code> in the project folder as <code>GOOGLE_CLIENT_ID=…</code> and{" "}
              <code>GOOGLE_CLIENT_SECRET=…</code>, then restart LIFEQUEST.
            </li>
          </ol>
        </details>
      )}
    </section>
  );
}
