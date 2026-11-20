/**
 * Web Push: VAPID keys (kept in the data folder, never in the DB or repo),
 * subscriptions, preferences and sending. Only push-service hosts are
 * accepted as endpoints (no arbitrary outbound URLs). Logs carry counts only.
 */
import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { DataPaths } from "@/server/config/paths";
import { DEFAULT_PREFS, prefsSchema, type PushPrefs, type Reminder } from "../rules";

type Db = PrismaClient;
const PREFS_KEY = "push.prefs";
/** A contact is required by the Web Push standard; deliberately not the owner's address. */
const SUBJECT = "mailto:owner@lifequest.invalid";

/** Push services used by Safari/iOS, Chrome/Edge/Android and Firefox. */
const PUSH_HOSTS = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /\.notify\.windows\.com$/, /^updates\.push\.services\.mozilla\.com$/];

export const subscriptionSchema = z
  .object({
    endpoint: z
      .url()
      .max(1000)
      .refine((u) => {
        const url = new URL(u);
        return url.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(url.hostname));
      }, "Unsupported push service"),
    keys: z.object({ p256dh: z.string().min(16).max(200), auth: z.string().min(8).max(100) }).strict(),
  })
  .strict();
export type SubscriptionInput = z.input<typeof subscriptionSchema>;

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

function vapidFile(paths: DataPaths) {
  return path.join(paths.root, "secrets", "vapid.json");
}

/** Read the VAPID key pair, creating it (owner-only file) the first time. */
export function getOrCreateVapidKeys(paths: DataPaths): VapidKeys {
  const file = vapidFile(paths);
  try {
    const k = JSON.parse(fs.readFileSync(file, "utf8")) as VapidKeys;
    if (k.publicKey && k.privateKey) return k;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  const keys = webpush.generateVAPIDKeys();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    fs.writeFileSync(file, JSON.stringify(keys), { mode: 0o600, flag: "wx" });
    return keys;
  } catch (err) {
    // Another process created it first: use theirs.
    if ((err as NodeJS.ErrnoException).code === "EEXIST") return JSON.parse(fs.readFileSync(file, "utf8")) as VapidKeys;
    throw err;
  }
}

export async function saveSubscription(db: Db, input: SubscriptionInput) {
  const s = subscriptionSchema.parse(input);
  await db.pushSubscription.upsert({
    where: { endpoint: s.endpoint },
    create: { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth },
    update: { p256dh: s.keys.p256dh, auth: s.keys.auth, failures: 0 },
  });
  await db.auditEvent.create({ data: { actor: "owner", action: "push.subscribe", entityType: "PushSubscription" } });
}

export async function removeSubscription(db: Db, endpoint: string) {
  await db.pushSubscription.deleteMany({ where: { endpoint } });
}

export function countSubscriptions(db: Db) {
  return db.pushSubscription.count();
}

export async function getPrefs(db: Db): Promise<PushPrefs> {
  const row = await db.appSetting.findUnique({ where: { key: PREFS_KEY } });
  if (!row) return DEFAULT_PREFS;
  const parsed = prefsSchema.safeParse(JSON.parse(row.value));
  return parsed.success ? parsed.data : DEFAULT_PREFS;
}

export async function setPrefs(db: Db, prefs: PushPrefs) {
  const value = JSON.stringify(prefsSchema.parse(prefs));
  await db.appSetting.upsert({ where: { key: PREFS_KEY }, create: { key: PREFS_KEY, value }, update: { value } });
}

export type Sender = (sub: webpush.PushSubscription, payload: string, opts: webpush.RequestOptions) => Promise<unknown>;

/** Send one reminder to every device. Expired subscriptions (404/410) are removed. */
export async function sendToAll(db: Db, vapid: VapidKeys, r: Pick<Reminder, "title" | "body" | "url">, send: Sender = webpush.sendNotification) {
  const subs = await db.pushSubscription.findMany();
  const payload = JSON.stringify({ title: r.title, body: r.body, url: r.url });
  let sent = 0;
  for (const s of subs) {
    try {
      await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        vapidDetails: { subject: SUBJECT, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
        TTL: 60 * 60,
        urgency: "normal",
      });
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.pushSubscription.delete({ where: { id: s.id } });
      else await db.pushSubscription.update({ where: { id: s.id }, data: { failures: { increment: 1 } } });
    }
  }
  return { sent, devices: subs.length };
}

/** Claim a reminder key; false if it was already sent. */
export async function claim(db: Db, key: string): Promise<boolean> {
  try {
    await db.pushLog.create({ data: { key } });
    return true;
  } catch {
    return false;
  }
}
