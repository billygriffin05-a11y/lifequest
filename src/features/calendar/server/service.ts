/**
 * Google Calendar connection + outbox. Dependencies are passed in so tests can
 * use a temp database and a fake `fetch`.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import type { DataPaths } from "@/server/config/paths";
import { decryptSecret, encryptSecret, getOrCreateKey } from "@/server/secrets/crypto";
import { eventBodyFor, eventDescriptionFor, eventIdFor, type DeedForCalendar } from "../events";
import {
  createLifequestCalendar,
  deleteEvent,
  GoogleApiError,
  insertEvent,
  patchEvent,
  upsertEvent,
  refreshAccessToken,
  revokeToken,
  type Fetch,
  type TokenSet,
} from "../google/api";
import type { GoogleConfig } from "../google/config";
import {
  DEFAULT_REMINDER,
  REMINDER_EVENT_ID,
  REMINDER_SETTING_KEY,
  reminderEventBody,
  reminderSchema,
  type ReminderSettings,
} from "../reminder";

export interface CalendarDeps {
  db: PrismaClient;
  paths: DataPaths;
  cfg: GoogleConfig | null;
  fetchImpl: Fetch;
}

const ROW_ID = "google";
export const MAX_ATTEMPTS = 8;

export interface CalendarStatus {
  configured: boolean;
  connected: boolean;
  calendarReady: boolean;
  connectedAt: Date | null;
  pending: number;
  failing: number;
  lastError: string | null;
}

export async function getStatus(db: PrismaClient, cfg: GoogleConfig | null): Promise<CalendarStatus> {
  const [row, pending, failing, lastFailed] = await Promise.all([
    db.googleConnection.findUnique({ where: { id: ROW_ID } }),
    db.calendarOutbox.count({ where: { doneAt: null, attempts: { lt: MAX_ATTEMPTS } } }),
    db.calendarOutbox.count({ where: { doneAt: null, attempts: { gte: MAX_ATTEMPTS } } }),
    db.calendarOutbox.findFirst({ where: { doneAt: null, lastError: { not: null } }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    configured: cfg !== null,
    connected: row !== null,
    calendarReady: Boolean(row?.calendarId),
    connectedAt: row?.connectedAt ?? null,
    pending,
    failing,
    lastError: lastFailed?.lastError ?? null,
  };
}

/** Store tokens from a fresh OAuth consent (encrypted) and make sure the LIFEQUEST calendar exists. */
export async function saveConnection(deps: CalendarDeps, tokens: TokenSet): Promise<void> {
  if (!tokens.refreshToken) throw new Error("Google did not return a refresh token — please connect again.");
  const key = getOrCreateKey(deps.paths);
  const data = {
    refreshTokenEncrypted: encryptSecret(tokens.refreshToken, key),
    accessTokenEncrypted: encryptSecret(tokens.accessToken, key),
    accessTokenExpiresAt: tokens.expiresAt,
  };
  await deps.db.googleConnection.upsert({ where: { id: ROW_ID }, create: { id: ROW_ID, ...data }, update: data });
  await ensureCalendar(deps);
  await deps.db.auditEvent.create({ data: { actor: "owner", action: "calendar.connect", entityType: "GoogleConnection" } });
}

/** A valid access token, refreshing (and storing) it when expired. */
export async function getAccessToken(deps: CalendarDeps): Promise<string> {
  if (!deps.cfg) throw new Error("Google Calendar is not configured.");
  const row = await deps.db.googleConnection.findUnique({ where: { id: ROW_ID } });
  if (!row) throw new Error("Google Calendar is not connected.");
  const key = getOrCreateKey(deps.paths);
  if (row.accessTokenEncrypted && row.accessTokenExpiresAt && row.accessTokenExpiresAt > new Date()) {
    return decryptSecret(row.accessTokenEncrypted, key);
  }
  const fresh = await refreshAccessToken(deps.fetchImpl, deps.cfg, decryptSecret(row.refreshTokenEncrypted, key));
  await deps.db.googleConnection.update({
    where: { id: ROW_ID },
    data: {
      accessTokenEncrypted: encryptSecret(fresh.accessToken, key),
      accessTokenExpiresAt: fresh.expiresAt,
      ...(fresh.refreshToken ? { refreshTokenEncrypted: encryptSecret(fresh.refreshToken, key) } : {}),
    },
  });
  return fresh.accessToken;
}

async function ensureCalendar(deps: CalendarDeps): Promise<string> {
  const row = await deps.db.googleConnection.findUniqueOrThrow({ where: { id: ROW_ID } });
  if (row.calendarId) return row.calendarId;
  const calendarId = await createLifequestCalendar(deps.fetchImpl, await getAccessToken(deps));
  await deps.db.googleConnection.update({ where: { id: ROW_ID }, data: { calendarId } });
  return calendarId;
}

/** Revoke access at Google (best effort) and forget the tokens locally. Calendar events stay in Google. */
export async function disconnect(deps: CalendarDeps): Promise<void> {
  const row = await deps.db.googleConnection.findUnique({ where: { id: ROW_ID } });
  if (!row) return;
  try {
    await revokeToken(deps.fetchImpl, decryptSecret(row.refreshTokenEncrypted, getOrCreateKey(deps.paths)));
  } catch {
    /* already revoked or offline — still forget locally */
  }
  await deps.db.$transaction([
    deps.db.googleConnection.delete({ where: { id: ROW_ID } }),
    deps.db.calendarOutbox.deleteMany({ where: { doneAt: null } }),
    deps.db.auditEvent.create({ data: { actor: "owner", action: "calendar.disconnect", entityType: "GoogleConnection" } }),
  ]);
}

// ── Outbox ───────────────────────────────────────────────────────────────────

async function isConnected(db: PrismaClient) {
  return (await db.googleConnection.count({ where: { id: ROW_ID } })) > 0;
}

/** Queue a calendar event for a newly logged deed (no-op when not connected). */
export async function enqueueCreate(db: PrismaClient, deed: DeedForCalendar): Promise<boolean> {
  if (!(await isConnected(db))) return false;
  const body = eventBodyFor(deed);
  await db.calendarOutbox.create({ data: { op: "create", eventId: body.id, payload: JSON.stringify(body) } });
  return true;
}

/** Queue a description update after the owner adds/edits a note (no-op when not connected). */
export async function enqueuePatch(db: PrismaClient, entryId: string, kind: string, note: string | null): Promise<boolean> {
  if (!(await isConnected(db))) return false;
  await db.calendarOutbox.create({
    data: { op: "patch", eventId: eventIdFor(entryId), payload: JSON.stringify({ description: eventDescriptionFor(kind, note) }) },
  });
  return true;
}

// ── Daily reminder ───────────────────────────────────────────────────────────

export async function getDailyReminder(db: PrismaClient): Promise<ReminderSettings> {
  const row = await db.appSetting.findUnique({ where: { key: REMINDER_SETTING_KEY } });
  if (!row) return DEFAULT_REMINDER;
  const parsed = reminderSchema.safeParse(JSON.parse(row.value));
  return parsed.success ? parsed.data : DEFAULT_REMINDER;
}

/** Save the reminder setting and queue the matching calendar change. Needs a linked calendar. */
export async function setDailyReminder(db: PrismaClient, settings: ReminderSettings, todayKey: string): Promise<void> {
  const value = JSON.stringify(reminderSchema.parse(settings));
  await db.appSetting.upsert({
    where: { key: REMINDER_SETTING_KEY },
    create: { key: REMINDER_SETTING_KEY, value },
    update: { value, version: { increment: 1 } },
  });
  await db.auditEvent.create({ data: { actor: "owner", action: settings.enabled ? "reminder.on" : "reminder.off", entityType: "AppSetting" } });
  if (!(await isConnected(db))) return;
  await db.calendarOutbox.create({
    data: settings.enabled
      ? { op: "upsert", eventId: REMINDER_EVENT_ID, payload: JSON.stringify(reminderEventBody(settings.time, todayKey)) }
      : { op: "delete", eventId: REMINDER_EVENT_ID },
  });
}

/** Queue removal of the event for an undone deed (no-op when not connected). */
export async function enqueueDelete(db: PrismaClient, entryId: string): Promise<boolean> {
  if (!(await isConnected(db))) return false;
  await db.calendarOutbox.create({ data: { op: "delete", eventId: eventIdFor(entryId) } });
  return true;
}

export interface SyncResult {
  sent: number;
  failed: number;
  skipped?: "not-configured" | "not-connected";
}

/** Push pending outbox items to Google, oldest first. Safe to run concurrently (writes are idempotent). */
export async function processOutbox(deps: CalendarDeps, limit = 25): Promise<SyncResult> {
  if (!deps.cfg) return { sent: 0, failed: 0, skipped: "not-configured" };
  if (!(await isConnected(deps.db))) return { sent: 0, failed: 0, skipped: "not-connected" };
  const items = await deps.db.calendarOutbox.findMany({
    where: { doneAt: null, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  if (items.length === 0) return { sent: 0, failed: 0 };

  let token: string;
  let calendarId: string;
  try {
    token = await getAccessToken(deps);
    calendarId = await ensureCalendar(deps);
  } catch (err) {
    const msg = err instanceof GoogleApiError ? err.message : "Could not reach Google";
    await deps.db.calendarOutbox.updateMany({
      where: { id: { in: items.map((i) => i.id) } },
      data: { attempts: { increment: 1 }, lastError: msg },
    });
    return { sent: 0, failed: items.length };
  }

  let sent = 0;
  let failed = 0;
  for (const item of items) {
    try {
      if (item.op === "create" && item.payload) await insertEvent(deps.fetchImpl, token, calendarId, JSON.parse(item.payload));
      else if (item.op === "upsert" && item.payload) await upsertEvent(deps.fetchImpl, token, calendarId, JSON.parse(item.payload));
      else if (item.op === "patch" && item.payload) await patchEvent(deps.fetchImpl, token, calendarId, item.eventId, JSON.parse(item.payload));
      else if (item.op === "delete") await deleteEvent(deps.fetchImpl, token, calendarId, item.eventId);
      await deps.db.calendarOutbox.update({ where: { id: item.id }, data: { doneAt: new Date(), lastError: null } });
      sent++;
    } catch (err) {
      failed++;
      await deps.db.calendarOutbox.update({
        where: { id: item.id },
        data: { attempts: { increment: 1 }, lastError: err instanceof GoogleApiError ? err.message : "Network error" },
      });
    }
  }
  return { sent, failed };
}
