import "server-only";
import { after } from "next/server";
import { getDataPaths } from "@/server/config/paths";
import { prisma } from "@/server/db/client";
import type { DeedForCalendar } from "../events";
import { loadGoogleConfig } from "../google/client-file";
import { enqueueCreate, enqueueDelete, enqueuePatch, processOutbox, type CalendarDeps } from "./service";

/** Production dependencies (real DB, real data dir, real fetch). */
export function calendarDeps(): CalendarDeps {
  return { db: prisma, paths: getDataPaths(), cfg: loadGoogleConfig(getDataPaths()), fetchImpl: fetch };
}

function syncInBackground() {
  after(async () => {
    try {
      await processOutbox(calendarDeps());
    } catch {
      console.error("[calendar] background sync failed");
    }
  });
}

/** Called after a deed is logged. Never throws — calendar problems must not block logging. */
export async function onDeedLogged(deed: DeedForCalendar): Promise<void> {
  try {
    if (await enqueueCreate(prisma, deed)) syncInBackground();
  } catch {
    console.error("[calendar] could not queue event");
  }
}

/** Called after the owner sets a note on a deed. Never throws. */
export async function onDeedNoteChanged(entryId: string, kind: string, note: string | null): Promise<void> {
  try {
    if (await enqueuePatch(prisma, entryId, kind, note)) syncInBackground();
  } catch {
    console.error("[calendar] could not queue event update");
  }
}

/** Called after a deed is undone. Never throws. */
export async function onDeedUndone(originalEntryId: string): Promise<void> {
  try {
    if (await enqueueDelete(prisma, originalEntryId)) syncInBackground();
  } catch {
    console.error("[calendar] could not queue event removal");
  }
}
