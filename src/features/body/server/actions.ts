"use server";
/** Body page actions. Input parsed and validated here; no health values are logged. */
import "server-only";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { londonDateKey } from "@/features/honour/rules";
import { prisma } from "@/server/db/client";
import { parseDuration, parseKg, parseKm } from "../rules";
import * as svc from "./service";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const int = (fd: FormData, k: string) => (/^\d{1,6}$/.test(str(fd, k)) ? Number(str(fd, k)) : NaN);

function back(message: string, ok = true, hash = ""): never {
  redirect(`/body?${ok ? "ok" : "err"}=${encodeURIComponent(message)}${hash}`);
}

/** A logged day must be a real date, not in the future. */
function dayFrom(fd: FormData): string {
  const today = londonDateKey(new Date());
  const d = str(fd, "date") || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > today) back("Pick today or an earlier date.", false);
  return d;
}

function errorText(err: unknown): string {
  if (err instanceof svc.BodyError) return err.message;
  if (err && typeof err === "object" && "issues" in err) {
    return (err as { issues: { message: string }[] }).issues[0]?.message ?? "Please check the form.";
  }
  console.error("[body] action failed");
  return "Something went wrong.";
}

export async function addWorkoutAction(formData: FormData) {
  const occurredOn = dayFrom(formData);
  const weightGrams = str(formData, "weight") ? parseKg(str(formData, "weight")) : 0;
  if (weightGrams === null) back("Enter weight in kg, like 60 or 62.5 (blank for bodyweight).", false);
  try {
    await svc.addWorkoutSet(prisma, {
      occurredOn,
      exercise: str(formData, "exercise"),
      sets: int(formData, "sets"),
      reps: int(formData, "reps"),
      weightGrams,
    });
  } catch (err) {
    back(errorText(err), false);
  }
  back("Workout logged. 💪", true, "#workouts");
}

export async function deleteWorkoutAction(formData: FormData) {
  await svc.deleteWorkoutSet(prisma, str(formData, "id"));
  back("Entry removed.", true, "#workouts");
}

export async function addRunAction(formData: FormData) {
  const occurredOn = dayFrom(formData);
  const distanceMetres = parseKm(str(formData, "distance"));
  const durationSeconds = parseDuration(str(formData, "time"));
  if (distanceMetres === null) back("Enter distance in km, like 5 or 5.25.", false);
  if (durationSeconds === null) back("Enter time like 28:15 or 1:05:30.", false);
  try {
    await svc.addRun(prisma, { occurredOn, distanceMetres, durationSeconds });
  } catch (err) {
    back(errorText(err), false);
  }
  back("Run logged. 🏃", true, "#runs");
}

export async function deleteRunAction(formData: FormData) {
  await svc.deleteRun(prisma, str(formData, "id"));
  back("Run removed.", true, "#runs");
}

export async function waterAction(formData: FormData) {
  const delta = str(formData, "delta") === "-1" ? -1 : 1;
  await svc.changeWater(prisma, londonDateKey(new Date()), delta);
  refresh();
}

export async function sleepAction(formData: FormData) {
  const d = dayFrom(formData);
  try {
    await svc.saveSleep(prisma, d, str(formData, "bed"), str(formData, "wake"));
  } catch (err) {
    back(errorText(err), false);
  }
  back("Sleep saved. 🌙", true, "#sleep");
}

export async function weightAction(formData: FormData) {
  const d = dayFrom(formData);
  const grams = parseKg(str(formData, "weight"));
  if (grams === null) back("Enter weight in kg, like 80.4.", false);
  try {
    await svc.saveWeight(prisma, d, grams);
  } catch (err) {
    back(errorText(err), false);
  }
  back("Weight saved.", true, "#weight");
}
