"use server";
/** Server Actions for the Settings → Google Calendar card. */
import "server-only";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getDataPaths } from "@/server/config/paths";
import { importFromDownloads, saveClientJson, type ImportResult } from "../google/client-file";
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
