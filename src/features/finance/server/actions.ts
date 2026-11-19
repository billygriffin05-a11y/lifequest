"use server";
/** Money page actions. Every input is validated server-side; amounts are parsed to pence here. */
import "server-only";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { londonDateKey } from "@/features/honour/rules";
import { prisma } from "@/server/db/client";
import { parsePounds } from "../money";
import * as svc from "./service";

const MAX_CSV_BYTES = 2_000_000;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function back(month: string, message: string, ok = true): never {
  const m = /^\d{4}-\d{2}$/.test(month) ? month : londonDateKey(new Date()).slice(0, 7);
  redirect(`/money?m=${m}&${ok ? "ok" : "err"}=${encodeURIComponent(message)}`);
}

function errorText(err: unknown): string {
  if (err instanceof svc.MoneyError) return err.message;
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: { message: string }[] }).issues;
    return issues[0]?.message ?? "Please check the form.";
  }
  console.error("[money] action failed");
  return "Something went wrong.";
}

export async function addStarterCategoriesAction(formData: FormData) {
  await svc.addStarterCategories(prisma);
  back(str(formData, "m"), "Starter categories added — set your limits below.");
}

export async function saveCategoryAction(formData: FormData) {
  const month = str(formData, "m");
  const limit = parsePounds(str(formData, "limit") || "0");
  if (limit === null || limit < 0) back(month, "Enter a monthly limit like 150 or 150.00.", false);
  try {
    await svc.saveCategory(
      prisma,
      { name: str(formData, "name"), icon: str(formData, "icon") || "💷", monthlyLimitPence: limit },
      str(formData, "id") || undefined,
    );
  } catch (err) {
    back(month, errorText(err), false);
  }
  back(month, "Category saved.");
}

export async function archiveCategoryAction(formData: FormData) {
  await svc.archiveCategory(prisma, str(formData, "id"), str(formData, "archived") === "true");
  back(str(formData, "m"), "Category updated.");
}

export async function addTransactionAction(formData: FormData) {
  const month = str(formData, "m");
  const pence = parsePounds(str(formData, "amount"));
  if (pence === null || pence <= 0) back(month, "Enter an amount like 12.50.", false);
  const signed = str(formData, "direction") === "in" ? -pence : pence;
  try {
    await svc.addTransaction(prisma, {
      occurredOn: str(formData, "date"),
      amountPence: signed,
      description: str(formData, "description"),
      categoryId: str(formData, "categoryId") || null,
    });
  } catch (err) {
    back(month, errorText(err), false);
  }
  back(str(formData, "date").slice(0, 7) || month, "Saved.");
}

export async function setTransactionCategoryAction(input: { id: string; categoryId: string | null }) {
  await svc.setTransactionCategory(prisma, String(input.id), input.categoryId ? String(input.categoryId) : null);
  refresh();
}

export async function deleteTransactionAction(formData: FormData) {
  await svc.deleteTransaction(prisma, str(formData, "id"));
  back(str(formData, "m"), "Entry removed.");
}

export async function importCsvAction(formData: FormData) {
  const month = str(formData, "m");
  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0) back(month, "Choose a CSV file from your bank.", false);
  if (file.size > MAX_CSV_BYTES) back(month, "That file is too large (2 MB max).", false);
  const r = await svc.importBankCsv(prisma, await file.text());
  if (r.error === "no-header" || r.error === "unrecognised-columns") {
    back(month, "Couldn't find Date / Description / Amount columns in that file.", false);
  }
  back(
    month,
    `Imported ${r.imported} (${r.categorised} auto-sorted). ${r.duplicates} already here, ${r.skipped} unreadable rows skipped.`,
  );
}

export async function createGoalAction(formData: FormData) {
  const month = str(formData, "m");
  const target = parsePounds(str(formData, "target"));
  if (target === null || target <= 0) back(month, "Enter a target like 500.", false);
  try {
    await svc.createGoal(prisma, { name: str(formData, "name"), icon: str(formData, "icon") || "🐷", targetPence: target });
  } catch (err) {
    back(month, errorText(err), false);
  }
  back(month, "Savings goal created.");
}

export async function depositAction(formData: FormData) {
  const month = str(formData, "m");
  const pence = parsePounds(str(formData, "amount"));
  if (pence === null || pence <= 0) back(month, "Enter an amount like 25.", false);
  try {
    await svc.addDeposit(prisma, str(formData, "goalId"), str(formData, "mode") === "withdraw" ? -pence : pence, londonDateKey(new Date()));
  } catch (err) {
    back(month, errorText(err), false);
  }
  back(month, "Savings updated.");
}
