import { describe, expect, it } from "vitest";
import { REMINDER_EVENT_ID, reminderEventBody, reminderSchema } from "@/features/calendar/reminder";

describe("daily reminder", () => {
  it("uses a valid fixed Google event id", () => {
    expect(REMINDER_EVENT_ID).toMatch(/^[0-9a-v]{5,1024}$/);
  });

  it("is a daily recurring 10-minute event with a pop-up, in local London time", () => {
    const e = reminderEventBody("20:00", "2026-11-19");
    expect(e.recurrence).toEqual(["RRULE:FREQ=DAILY"]);
    expect(e.start).toEqual({ dateTime: "2026-11-19T20:00:00", timeZone: "Europe/London" });
    expect(e.end).toEqual({ dateTime: "2026-11-19T20:10:00", timeZone: "Europe/London" });
    expect(e.reminders.overrides).toEqual([{ method: "popup", minutes: 0 }]);
    expect(e.status).toBe("confirmed");
  });

  it("handles a reminder just before midnight", () => {
    expect(reminderEventBody("23:55", "2026-11-19").end.dateTime).toBe("2026-11-20T00:05:00");
  });

  it("validates the time", () => {
    expect(reminderSchema.safeParse({ enabled: true, time: "07:30" }).success).toBe(true);
    expect(reminderSchema.safeParse({ enabled: true, time: "24:00" }).success).toBe(false);
    expect(reminderSchema.safeParse({ enabled: true, time: "7pm" }).success).toBe(false);
  });
});
