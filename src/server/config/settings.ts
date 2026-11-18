/**
 * Validated server configuration from environment variables.
 * Never import this from client components. Never log the returned object.
 */
import { z } from "zod";

const schema = z.object({
  LIFEQUEST_BACKUP_INTERVAL_HOURS: z.coerce.number().positive().max(24 * 30).default(24),
  LIFEQUEST_BACKUP_RETAIN: z.coerce.number().int().min(1).max(365).default(14),
  /** Extra Host header values allowed (comma-separated), e.g. a Tailscale MagicDNS name. */
  LIFEQUEST_ALLOWED_HOSTS: z.string().default(""),
});

export type ServerSettings = z.infer<typeof schema>;

export function loadServerSettings(env: Record<string, string | undefined> = process.env): ServerSettings {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    // Report which keys are invalid, never their values.
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid LIFEQUEST configuration for: ${keys}`);
  }
  return parsed.data;
}

const DEFAULT_HOSTS = ["localhost", "127.0.0.1", "[::1]", "::1"];

export function allowedHosts(extra: string): Set<string> {
  return new Set([
    ...DEFAULT_HOSTS,
    ...extra
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  ]);
}

/** Strip the port from a Host header value (handles IPv6 literals). */
export function hostnameFromHostHeader(host: string | null): string | null {
  if (!host) return null;
  const h = host.trim().toLowerCase();
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    return end === -1 ? null : h.slice(0, end + 1);
  }
  return h.split(":")[0] || null;
}
