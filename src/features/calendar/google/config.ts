import { z } from "zod";

/**
 * Google OAuth client settings, from .env.local (never committed).
 * The redirect must exactly match one registered on the Google Cloud OAuth client.
 */
const schema = z.object({
  GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().trim().min(1).optional(),
  GOOGLE_REDIRECT_URI: z
    .url()
    .default("http://localhost:3000/api/integrations/google/callback"),
});

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Returns the config, or null when the owner hasn't set up a Google OAuth client yet. */
export function googleConfig(env: Record<string, string | undefined> = process.env): GoogleConfig | null {
  const parsed = schema.safeParse(env);
  if (!parsed.success || !parsed.data.GOOGLE_CLIENT_ID || !parsed.data.GOOGLE_CLIENT_SECRET) return null;
  return {
    clientId: parsed.data.GOOGLE_CLIENT_ID,
    clientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
    redirectUri: parsed.data.GOOGLE_REDIRECT_URI,
  };
}

/**
 * Least privilege:
 * - `calendar.app.created`: write only to the calendar LIFEQUEST creates itself.
 * - `calendar.calendarlist.readonly` + `calendar.events.readonly`: READ the
 *   owner's other calendars so the in-app calendar can show them (e.g. "Pay
 *   rent"). LIFEQUEST never creates, changes or deletes those events, and never
 *   stores them — they are fetched live and held in memory for a short time.
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
] as const;

export const CALENDAR_NAME = "LIFEQUEST";
