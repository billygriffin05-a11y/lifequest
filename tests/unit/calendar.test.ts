import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { eventBodyFor, eventIdFor } from "@/features/calendar/events";
import { buildAuthUrl, pkceChallenge } from "@/features/calendar/google/api";
import { googleConfig } from "@/features/calendar/google/config";
import { decryptSecret, encryptSecret } from "@/server/secrets/crypto";

describe("token encryption", () => {
  const key = crypto.randomBytes(32);

  it("round-trips and never stores the plaintext", () => {
    const sealed = encryptSecret("1//refresh-token-value", key);
    expect(sealed).not.toContain("refresh-token-value");
    expect(decryptSecret(sealed, key)).toBe("1//refresh-token-value");
  });

  it("uses a fresh IV each time", () => {
    expect(encryptSecret("same", key)).not.toBe(encryptSecret("same", key));
  });

  it("rejects tampering and the wrong key", () => {
    const sealed = encryptSecret("secret", key);
    const parts = sealed.split(".");
    parts[3] = Buffer.from("evil").toString("base64");
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
    expect(() => decryptSecret(sealed, crypto.randomBytes(32))).toThrow();
  });
});

describe("google config", () => {
  it("is null until both client id and secret are set", () => {
    expect(googleConfig({})).toBeNull();
    expect(googleConfig({ GOOGLE_CLIENT_ID: "id" })).toBeNull();
    expect(googleConfig({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" })).toMatchObject({
      redirectUri: "http://localhost:3000/api/integrations/google/callback",
    });
  });

  it("asks only for the app-created-calendars scope, offline, with PKCE + state", () => {
    const cfg = googleConfig({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" })!;
    const url = new URL(buildAuthUrl(cfg, "state123", "verifier456"));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/calendar.app.created");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("state")).toBe("state123");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(pkceChallenge("verifier456"));
    expect(url.searchParams.get("client_secret")).toBeNull();
  });
});

describe("calendar events", () => {
  it("event ids are deterministic and valid Google base32hex ids", () => {
    const id = eventIdFor("cmwmm8lpg000a2kuvl0vat60l");
    expect(id).toBe(eventIdFor("cmwmm8lpg000a2kuvl0vat60l"));
    expect(id).toMatch(/^[0-9a-v]{5,1024}$/);
  });

  it("maps good and bad deeds to a 15-minute, non-blocking event", () => {
    const at = new Date("2026-11-18T08:30:00Z");
    const good = eventBodyFor({ id: "e1", kind: "good", actionName: "Gym session", actionIcon: "🏋️", honourDelta: 20, occurredAt: at });
    expect(good.summary).toBe("✅ 🏋️ Gym session (+20 Honour)");
    expect(good.start.dateTime).toBe("2026-11-18T08:30:00.000Z");
    expect(good.end.dateTime).toBe("2026-11-18T08:45:00.000Z");
    expect(good.transparency).toBe("transparent");
    expect(good.extendedProperties.private.lifequestEntryId).toBe("e1");
    const bad = eventBodyFor({ id: "e2", kind: "bad", actionName: "Takeaway", actionIcon: "🍔", honourDelta: -15, occurredAt: at });
    expect(bad.summary).toBe("❌ 🍔 Takeaway (−15 Honour)");
  });
});
