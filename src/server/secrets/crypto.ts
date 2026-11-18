/**
 * At-rest encryption for secrets stored in the local database (OAuth tokens).
 *
 * AES-256-GCM with a random 32-byte key kept in `<data dir>/secrets/token.key`,
 * i.e. OUTSIDE the database file and outside the repository. Database backups
 * and exports therefore never contain a usable token on their own.
 * (Future hardening: wrap the key with Windows DPAPI / Credential Manager.)
 *
 * No Next.js imports — usable from scripts and tests.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DataPaths } from "../config/paths";

const VERSION = "v1";

export function keyFile(paths: DataPaths): string {
  return path.join(paths.root, "secrets", "token.key");
}

/** Load the key, creating it on first use. */
export function getOrCreateKey(paths: DataPaths): Buffer {
  const file = keyFile(paths);
  if (fs.existsSync(file)) {
    const key = Buffer.from(fs.readFileSync(file, "utf8").trim(), "base64");
    if (key.length !== 32) throw new Error("Token encryption key is corrupt.");
    return key;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const key = crypto.randomBytes(32);
  // "wx" fails if another process created it first; then read theirs.
  try {
    fs.writeFileSync(file, key.toString("base64"), { flag: "wx", mode: 0o600 });
  } catch {
    return getOrCreateKey(paths);
  }
  return key;
}

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(".");
}

export function decryptSecret(sealed: string, key: Buffer): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Unrecognised secret format.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
