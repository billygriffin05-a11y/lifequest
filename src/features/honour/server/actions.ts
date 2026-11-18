"use server";
/**
 * Server Actions for the Honour page. These are reachable by direct POST, so
 * every one validates its own input. The server only listens on 127.0.0.1
 * (plus allow-listed Tailscale hosts) and Next.js checks the Origin of every
 * Server Action. Device authentication will be added in the pairing/sync phase.
 */
import "server-only";
import { refresh } from "next/cache";
import { z } from "zod";
import { onDeedLogged, onDeedUndone } from "@/features/calendar/server/runtime";
import { prisma } from "@/server/db/client";
import { actionInputSchema, idSchema, logInputSchema, undoInputSchema } from "../schemas";
import * as service from "./service";

type Field = "name" | "kind" | "points" | "icon" | "category";

export type FormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<Record<Field, string>>;
  /** Echo of submitted values on validation failure, so the form isn't wiped. */
  values?: Partial<Record<Field, string>>;
};

function echoValues(formData: FormData): FormState["values"] {
  const out: FormState["values"] = {};
  for (const key of ["name", "kind", "points", "icon", "category"] as const) {
    const v = formData.get(key);
    if (typeof v === "string") out[key] = v.slice(0, 100);
  }
  return out;
}

function readActionForm(formData: FormData) {
  return actionInputSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    points: formData.get("points"),
    icon: formData.get("icon"),
    category: formData.get("category"),
  });
}

function toFieldErrors(error: z.ZodError): FormState["fieldErrors"] {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  const out: FormState["fieldErrors"] = {};
  for (const key of ["name", "kind", "points", "icon", "category"] as const) {
    if (flat[key]?.[0]) out[key] = flat[key][0];
  }
  return out;
}

function failure(err: unknown): FormState {
  if (err instanceof service.HonourError) return { ok: false, message: err.message };
  // Never echo internal errors (could include paths or data) to the client.
  console.error(`[honour] action failed: ${err instanceof Error ? err.name : "unknown"}`);
  return { ok: false, message: "Something went wrong. Please try again." };
}

export async function createActionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = readActionForm(formData);
  if (!parsed.success) {
    return { ok: false, fieldErrors: toFieldErrors(parsed.error), values: echoValues(formData) };
  }
  try {
    await service.createAction(prisma, parsed.data);
  } catch (err) {
    return failure(err);
  }
  refresh();
  return { ok: true, message: `Added “${parsed.data.name}”.` };
}

export async function updateActionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = idSchema.safeParse(formData.get("id"));
  const parsed = readActionForm(formData);
  if (!id.success) return { ok: false, message: "Unknown action." };
  if (!parsed.success) {
    return { ok: false, fieldErrors: toFieldErrors(parsed.error), values: echoValues(formData) };
  }
  try {
    await service.updateAction(prisma, id.data, parsed.data);
  } catch (err) {
    return failure(err);
  }
  refresh();
  return { ok: true, message: "Saved." };
}

export async function setArchivedAction(formData: FormData): Promise<void> {
  const id = idSchema.safeParse(formData.get("id"));
  const archived = formData.get("archived") === "true";
  if (!id.success) return;
  try {
    await service.setArchived(prisma, id.data, archived);
  } catch (err) {
    failure(err);
    return;
  }
  refresh();
}

export async function addStarterActionsAction(): Promise<void> {
  await service.addStarterActions(prisma);
  refresh();
}

export async function logActionAction(input: { actionId: string; idempotencyKey: string }): Promise<FormState> {
  const parsed = logInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  let entry;
  try {
    entry = await service.logAction(prisma, parsed.data);
  } catch (err) {
    return failure(err);
  }
  await onDeedLogged(entry); // Google Calendar (if linked); never throws
  refresh();
  return { ok: true };
}

export async function undoEntryAction(input: { entryId: string; idempotencyKey: string }): Promise<FormState> {
  const parsed = undoInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  let reversal;
  try {
    reversal = await service.undoEntry(prisma, parsed.data);
  } catch (err) {
    return failure(err);
  }
  if (reversal.reversesEntryId) await onDeedUndone(reversal.reversesEntryId); // never throws
  refresh();
  return { ok: true };
}
