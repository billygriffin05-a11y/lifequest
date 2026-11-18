"use server";
/** Server Actions for the Settings → Google Calendar card. */
import "server-only";
import { refresh } from "next/cache";
import { calendarDeps } from "./runtime";
import { disconnect, processOutbox } from "./service";

export async function syncCalendarNowAction(): Promise<void> {
  try {
    await processOutbox(calendarDeps(), 100);
  } catch {
    console.error("[calendar] manual sync failed");
  }
  refresh();
}

export async function disconnectCalendarAction(): Promise<void> {
  await disconnect(calendarDeps());
  refresh();
}
