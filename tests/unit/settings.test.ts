import { describe, expect, it } from "vitest";
import { allowedHosts, hostnameFromHostHeader, loadServerSettings } from "@/server/config/settings";

describe("server settings", () => {
  it("applies safe defaults", () => {
    const s = loadServerSettings({});
    expect(s.LIFEQUEST_BACKUP_INTERVAL_HOURS).toBe(24);
    expect(s.LIFEQUEST_BACKUP_RETAIN).toBe(14);
  });

  it("rejects invalid values without echoing them", () => {
    expect(() => loadServerSettings({ LIFEQUEST_BACKUP_RETAIN: "secret-ish-value" })).toThrow(
      /LIFEQUEST_BACKUP_RETAIN/,
    );
    try {
      loadServerSettings({ LIFEQUEST_BACKUP_RETAIN: "secret-ish-value" });
    } catch (e) {
      expect(String(e)).not.toContain("secret-ish-value");
    }
  });
});

describe("host allow-list (DNS-rebinding protection)", () => {
  it("allows localhost variants and configured private names only", () => {
    const hosts = allowedHosts("my-pc.tail1234.ts.net");
    expect(hosts.has("localhost")).toBe(true);
    expect(hosts.has("127.0.0.1")).toBe(true);
    expect(hosts.has("my-pc.tail1234.ts.net")).toBe(true);
    expect(hosts.has("evil.example.com")).toBe(false);
  });

  it("parses Host headers with ports and IPv6", () => {
    expect(hostnameFromHostHeader("localhost:3000")).toBe("localhost");
    expect(hostnameFromHostHeader("[::1]:3000")).toBe("[::1]");
    expect(hostnameFromHostHeader(null)).toBeNull();
  });
});
