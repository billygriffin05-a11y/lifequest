"use server";
/** Server Actions for the Settings → Google Calendar card. */
import "server-only";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getDataPaths } from "@/server/config/paths";
import { importFromDownloads, saveClientJson, type ImportResult } from "../google/client-file";
import { londonDateKey } from "@/features/honour/rules";
import { prisma } from "@/server/db/client";
import { reminderSchema } from "../reminder";
import { calendarDeps, syncSoon } from "./runtime";
import { disconnect, processOutbox, setDailyReminder } from "./service";

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

function afterImport(result: ImportResult): never {
  redirect(`/settings?google=${result.ok ? "client-imported" : `client-${result.reason}`}`);
}

/** Pick up the client_secret_….json Google downloaded, store it privately, delete the download. */
export async function importClientFromDownloadsAction(): Promise<void> {
  afterImport(importFromDownloads(getDataPaths()));
}

/** Same, from a file chosen in the browser. */
export async function importClientUploadAction(formData: FormData): Promise<void> {
  const file = formData.get("client");
  if (!(file instanceof File) || file.size === 0) afterImport({ ok: false, reason: "invalid" });
  if (file.size > 20_000) afterImport({ ok: false, reason: "too-large" });
  afterImport(saveClientJson(getDataPaths(), await file.text()));
}

/** Turn the daily reminder on (at a time) or off. */
export async function saveReminderAction(formData: FormData): Promise<void> {
  const parsed = reminderSchema.safeParse({
    enabled: formData.get("enabled") === "true",
    time: String(formData.get("time") ?? "20:00"),
  });
  if (!parsed.success) redirect("/settings?google=reminder-invalid");
  await setDailyReminder(prisma, parsed.data, londonDateKey(new Date()));
  syncSoon();
  redirect(`/settings?google=${parsed.data.enabled ? "reminder-on" : "reminder-off"}`);
}
