/**
 * Google OAuth client from the JSON file Google Cloud lets you download
 * ("client_secret_….json"), so the owner never has to copy/paste secrets.
 *
 * The file is validated and stored in `<data dir>/secrets/google-oauth-client.json`
 * (outside the repo, never served, never logged). Environment variables in
 * .env.local still take priority when set.
 *
 * No Next.js imports — usable from startup, scripts and tests.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type { DataPaths } from "@/server/config/paths";
import { googleConfig, type GoogleConfig } from "./config";

const MAX_BYTES = 20_000;

const clientSchema = z.object({
  web: z.object({
    client_id: z.string().regex(/^[\w-]+\.apps\.googleusercontent\.com$/, "Not a Google OAuth client id"),
    client_secret: z.string().min(10).max(200),
  }),
});

export function clientFile(paths: DataPaths): string {
  return path.join(paths.root, "secrets", "google-oauth-client.json");
}

export type ImportResult = { ok: true } | { ok: false; reason: "invalid" | "not-found" | "too-large" };

/** Validate the downloaded JSON (must be a "Web application" client) and store it privately. */
export function saveClientJson(paths: DataPaths, text: string): ImportResult {
  if (Buffer.byteLength(text) > MAX_BYTES) return { ok: false, reason: "too-large" };
  let parsed;
  try {
    parsed = clientSchema.safeParse(JSON.parse(text));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const file = clientFile(paths);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Only the two fields we need are kept.
  fs.writeFileSync(file, JSON.stringify({ web: { client_id: parsed.data.web.client_id, client_secret: parsed.data.web.client_secret } }), {
    mode: 0o600,
  });
  return { ok: true };
}

/** Env vars first (.env.local), then the imported client file. */
export function loadGoogleConfig(paths: DataPaths, env: Record<string, string | undefined> = process.env): GoogleConfig | null {
  const fromEnv = googleConfig(env);
  if (fromEnv) return fromEnv;
  let text: string;
  try {
    text = fs.readFileSync(clientFile(paths), "utf8");
  } catch {
    return null;
  }
  const parsed = clientSchema.safeParse(JSON.parse(text));
  if (!parsed.success) return null;
  return googleConfig({
    ...env,
    GOOGLE_CLIENT_ID: parsed.data.web.client_id,
    GOOGLE_CLIENT_SECRET: parsed.data.web.client_secret,
  });
}

export function removeClientFile(paths: DataPaths): void {
  fs.rmSync(clientFile(paths), { force: true });
}

/**
 * Import the newest `client_secret_*.json` from the owner's Downloads folder,
 * then delete that copy so the secret isn't left lying around.
 */
export function importFromDownloads(paths: DataPaths, downloadsDir = path.join(os.homedir(), "Downloads")): ImportResult {
  let names: string[];
  try {
    names = fs.readdirSync(downloadsDir).filter((n) => /^client_secret_[\w.-]+\.json$/.test(n));
  } catch {
    return { ok: false, reason: "not-found" };
  }
  const newest = names
    .map((n) => ({ n, t: fs.statSync(path.join(downloadsDir, n)).mtimeMs }))
    .sort((a, b) => b.t - a.t)[0];
  if (!newest) return { ok: false, reason: "not-found" };
  const full = path.join(downloadsDir, newest.n);
  const result = saveClientJson(paths, fs.readFileSync(full, "utf8"));
  if (result.ok) fs.rmSync(full, { force: true });
  return result;
}
