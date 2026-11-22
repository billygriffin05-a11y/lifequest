"use server";
import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db/client";
import { saveReview } from "./review";

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function saveReviewAction(formData: FormData) {
  const week = String(formData.get("week") ?? "");
  if (!WEEK_RE.test(week)) redirect("/report");
  const str = (k: string) => String(formData.get(k) ?? "");
  try {
    await saveReview(prisma, week, { win: str("win"), obstacle: str("obstacle"), change: str("change") });
  } catch {
    redirect(`/report?w=${week}&review=error#review`);
  }
  redirect(`/report?w=${week}&review=saved#review`);
}
