import { NextResponse, type NextRequest } from "next/server";
import { allowedHosts, hostnameFromHostHeader } from "@/server/config/settings";

/**
 * Host allow-list. LIFEQUEST runs on the user's PC and must only answer to
 * localhost and explicitly configured private names (e.g. a Tailscale
 * MagicDNS hostname). This blocks DNS-rebinding attacks where a malicious
 * website tries to talk to the local server through the browser.
 */
export function proxy(request: NextRequest) {
  const hosts = allowedHosts(process.env.LIFEQUEST_ALLOWED_HOSTS ?? "");
  const hostname = hostnameFromHostHeader(request.headers.get("host"));
  if (!hostname || !hosts.has(hostname)) {
    return new NextResponse("Misdirected request", { status: 421 });
  }
  return NextResponse.next();
}
