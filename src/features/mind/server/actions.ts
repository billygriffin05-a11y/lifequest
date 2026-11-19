"use server";
/** Mind actions. Inputs validated here and in the service; journal/mood never logged. */
import "server-only";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { londonDateKey } from "@/features/honour/rules";
import { prisma } from "@/server/db/client";
import * as svc from "./service";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const int = (fd: FormData, k: string) => (/^\d{1,6}$/.test(str(fd, k)) ? Number(str(fd, k)) : NaN);
const today = () => londonDateKey(new Date());

function back(path: string, message: string, ok = true, hash = ""): never {
  redirect(`${path}?${ok ? "ok" : "err"}=${encodeURIComponent(message)}${hash}`);
}

function errorText(err: unknown): string {
  if (err instanceof svc.MindError) return err.message;
  if (err && typeof err === "object" && "issues" in err) {
    return (err as { issues: { message: string }[] }).issues[0]?.message ?? "Please check the form.";
  }
  console.error("[mind] action failed");
  return "Something went wrong.";
}

// ── Books ────────────────────────────────────────────────────────────────────

export async function addBookAction(formData: FormData) {
  try {
    await svc.addBook(prisma, { title: str(formData, "title"), author: str(formData, "author"), totalPages: int(formData, "pages") });
  } catch (err) {
    back("/mind", errorText(err), false, "#reading");
  }
  back("/mind", "Book added. 📚", true, "#reading");
}

export async function logPagesAction(formData: FormData) {
  let finished = false;
  try {
    ({ finished } = await svc.logPages(prisma, str(formData, "bookId"), int(formData, "pages"), today()));
  } catch (err) {
    back("/mind", errorText(err), false, "#reading");
  }
  back("/mind", finished ? "Book finished! 🎉 +50 XP for your Reading dragon." : "Pages logged.", true, "#reading");
}

export async function archiveBookAction(formData: FormData) {
  await svc.archiveBook(prisma, str(formData, "id"));
  back("/mind", "Book removed from your shelf.", true, "#reading");
}

// ── Reflection ───────────────────────────────────────────────────────────────

export async function reflectionAction(formData: FormData) {
  const moodRaw = str(formData, "mood");
  const mood = moodRaw ? Number(moodRaw) : null;
  try {
    await svc.saveReflection(prisma, today(), mood, str(formData, "entry"));
  } catch (err) {
    back("/mind", errorText(err), false, "#reflect");
  }
  back("/mind", "Saved for today. ✍️", true, "#reflect");
}

// ── Focus ────────────────────────────────────────────────────────────────────

export async function logFocusAction(input: { minutes: number; label: string }): Promise<{ ok: boolean; message: string }> {
  try {
    await svc.logFocus(prisma, today(), Number(input.minutes), String(input.label ?? ""));
  } catch (err) {
    return { ok: false, message: errorText(err) };
  }
  refresh();
  return { ok: true, message: `${Number(input.minutes)} minutes of focus logged.` };
}

// ── Cards ────────────────────────────────────────────────────────────────────

export async function seedDeckAction() {
  const n = await svc.seedStarterDeck(prisma, today());
  back("/mind/cards", n ? `Added ${n} Security+ cards.` : "The starter deck is already in.");
}

export async function addCardAction(formData: FormData) {
  try {
    await svc.addCard(prisma, { front: str(formData, "front"), back: str(formData, "back"), topic: str(formData, "topic") }, today());
  } catch (err) {
    back("/mind/cards", errorText(err), false, "#add-card");
  }
  back("/mind/cards", "Card added.", true, "#add-card");
}

export async function reviewCardAction(formData: FormData) {
  try {
    await svc.reviewCard(prisma, str(formData, "id"), str(formData, "result") === "right", today());
  } catch (err) {
    back("/mind/cards", errorText(err), false);
  }
  redirect(`/mind/cards?r=${Date.now()}#review`);
}

export async function archiveCardAction(formData: FormData) {
  await svc.archiveCard(prisma, str(formData, "id"));
  back("/mind/cards", "Card archived.", true, "#all-cards");
}
