import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clientFile, importFromDownloads, loadGoogleConfig, saveClientJson } from "@/features/calendar/google/client-file";
import { getDataPaths, type DataPaths } from "@/server/config/paths";

const VALID = JSON.stringify({
  web: {
    client_id: "123-abc.apps.googleusercontent.com",
    project_id: "lifequest",
    client_secret: "GOCSPX-test-secret-value",
    redirect_uris: ["http://localhost:3000/api/integrations/google/callback"],
  },
});

let root: string;
let paths: DataPaths;
let downloads: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "lifequest-gclient-"));
  paths = getDataPaths({ LIFEQUEST_DATA_DIR: path.join(root, "data") });
  downloads = path.join(root, "Downloads");
  fs.mkdirSync(downloads);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("google client file import", () => {
  it("is not configured until a client is imported", () => {
    expect(loadGoogleConfig(paths, {})).toBeNull();
  });

  it("imports a valid Web client JSON, keeping only id + secret, outside the repo", () => {
    expect(saveClientJson(paths, VALID)).toEqual({ ok: true });
    const stored = JSON.parse(fs.readFileSync(clientFile(paths), "utf8"));
    expect(Object.keys(stored.web).sort()).toEqual(["client_id", "client_secret"]);
    expect(clientFile(paths).startsWith(paths.root)).toBe(true);
    expect(loadGoogleConfig(paths, {})).toMatchObject({ clientId: "123-abc.apps.googleusercontent.com" });
  });

  it("environment variables win over the imported file", () => {
    saveClientJson(paths, VALID);
    expect(loadGoogleConfig(paths, { GOOGLE_CLIENT_ID: "env-id", GOOGLE_CLIENT_SECRET: "env-secret" })?.clientId).toBe("env-id");
  });

  it("rejects non-JSON, desktop/installed clients and wrong ids", () => {
    expect(saveClientJson(paths, "not json")).toEqual({ ok: false, reason: "invalid" });
    expect(saveClientJson(paths, JSON.stringify({ installed: { client_id: "x.apps.googleusercontent.com", client_secret: "s".repeat(20) } }))).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(saveClientJson(paths, JSON.stringify({ web: { client_id: "evil.example.com", client_secret: "s".repeat(20) } }))).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(saveClientJson(paths, "x".repeat(30_000))).toEqual({ ok: false, reason: "too-large" });
  });

  it("imports the newest client_secret_*.json from Downloads and deletes the download", () => {
    expect(importFromDownloads(paths, downloads)).toEqual({ ok: false, reason: "not-found" });
    const file = path.join(downloads, "client_secret_123-abc.apps.googleusercontent.com.json");
    fs.writeFileSync(file, VALID);
    fs.writeFileSync(path.join(downloads, "other.json"), "{}");
    expect(importFromDownloads(paths, downloads)).toEqual({ ok: true });
    expect(fs.existsSync(file)).toBe(false);
    expect(fs.existsSync(path.join(downloads, "other.json"))).toBe(true);
    expect(loadGoogleConfig(paths, {})).not.toBeNull();
  });

  it("leaves an invalid download in place", () => {
    const file = path.join(downloads, "client_secret_bad.json");
    fs.writeFileSync(file, "{}");
    expect(importFromDownloads(paths, downloads)).toEqual({ ok: false, reason: "invalid" });
    expect(fs.existsSync(file)).toBe(true);
  });
});
