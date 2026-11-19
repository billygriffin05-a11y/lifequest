/**
 * Daily reminder = one recurring event (with a pop-up alert) in the owner's
 * LIFEQUEST Google calendar. Google Calendar then notifies on iPhone and PC.
 * Pure helpers — tests: tests/unit/reminder.test.ts.
 */
import { z } from "zod";

/** Fixed Google event id (base32hex: 0-9, a-v) so turning it on/off is idempotent. */
export const REMINDER_EVENT_ID = "lqremind0001";
export const REMINDER_SETTING_KEY = "reminder.daily";
const MINUTES = 10;

export const reminderSchema = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 20:00"),
});
export type ReminderSettings = z.infer<typeof reminderSchema>;
export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, time: "20:00" };

/** Local wall-clock datetime `minutes` after `dateKey` + `time` (handles midnight). */
function plusMinutes(dateKey: string, time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const base = Date.UTC(+dateKey.slice(0, 4), +dateKey.slice(5, 7) - 1, +dateKey.slice(8, 10), h, m) + minutes * 60_000;
  return new Date(base).toISOString().slice(0, 19);
}

export function reminderEventBody(time: string, startDateKey: string) {
  return {
    id: REMINDER_EVENT_ID,
    status: "confirmed",
    summary: "⚔️ LIFEQUEST — log today's deeds",
    description: "Your daily LIFEQUEST reminder: log your good deeds and bad habits to keep your streaks and dragons growing.",
    // Wall-clock times + time zone: stays at the same local time across GMT/BST.
    start: { dateTime: plusMinutes(startDateKey, time, 0), timeZone: "Europe/London" },
    end: { dateTime: plusMinutes(startDateKey, time, MINUTES), timeZone: "Europe/London" },
    recurrence: ["RRULE:FREQ=DAILY"],
    transparency: "transparent",
    colorId: "5", // banana (gold)
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 0 }] },
    extendedProperties: { private: { lifequestReminder: "daily" } },
  };
}
