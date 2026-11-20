"use server";
/** Notification settings actions. Subscriptions are validated (push-service hosts only). */
import "server-only";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getDataPaths } from "@/server/config/paths";
import { prisma } from "@/server/db/client";
import { DEFAULT_PREFS, type PushPrefs } from "../rules";
import { getOrCreateVapidKeys, removeSubscription, saveSubscription, sendToAll, setPrefs, type SubscriptionInput } from "./service";

export async function savePushSubscriptionAction(input: SubscriptionInput): Promise<{ ok: boolean; message: string }> {
  try {
    await saveSubscription(prisma, input);
  } catch {
    return { ok: false, message: "This device's push service isn't supported." };
  }
  refresh();
  return { ok: true, message: "Notifications are on for this device." };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<void> {
  await removeSubscription(prisma, String(endpoint).slice(0, 1000));
  refresh();
}

export async function sendTestPushAction(): Promise<{ ok: boolean; message: string }> {
  const r = await sendToAll(prisma, getOrCreateVapidKeys(getDataPaths()), {
    title: "🐉 LIFEQUEST",
    body: "Notifications are working.",
    url: "/settings",
  });
  return r.sent ? { ok: true, message: `Sent to ${r.sent} device${r.sent === 1 ? "" : "s"}.` } : { ok: false, message: "No device received it." };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function savePushPrefsAction(formData: FormData) {
  const time = (k: string, fallback: string) => {
    const v = String(formData.get(k) ?? "");
    return TIME.test(v) ? v : fallback;
  };
  const prefs: PushPrefs = {
    streak: formData.get("streak") === "on",
    streakTime: time("streakTime", DEFAULT_PREFS.streakTime),
    cards: formData.get("cards") === "on",
    cardsTime: time("cardsTime", DEFAULT_PREFS.cardsTime),
    budget: formData.get("budget") === "on",
    plans: formData.get("plans") === "on",
  };
  await setPrefs(prisma, prefs);
  redirect("/settings?push=saved#notifications");
}
