// src/lib/public-url.ts
//
// SSRF guard for any URL a caller hands us that the av-visibility sidecar will
// then fetch (/api/av/audit, /api/partner/v1/*). Two layers:
//
//   1. guardCheckUrl (bot-analytics/url-guard.ts) — the URL as written: http(s)
//      only, no credentials, ports 80/443 only (so never 4400, 4500 or any other
//      service on this box), no IP literals, no localhost/.internal/.local/…,
//      no single-label hosts.
//   2. DNS — every address the host resolves to must be public. Catches
//      `localhost.`, `127.0.0.1.nip.io`, and a domain someone points at 10.x.
//
// What it cannot stop: a host that resolves public here and private when the
// sidecar resolves it a moment later (DNS rebinding), or a public page that
// redirects to a private one. Both need resolve-then-pin at the socket, in the
// sidecar that owns the connection (av-service, separate repo).
import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { guardCheckUrl, isPrivateIpv4, type UrlRejection } from "@/lib/bot-analytics/url-guard";

export type PublicUrlRejection = UrlRejection | "unresolvable" | "resolves_private";

export type PublicUrlResult = { ok: true; url: string } | { ok: false; reason: PublicUrlRejection };

export type Resolver = (host: string) => Promise<string[]>;

const defaultResolver: Resolver = async (host) => (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);

/** IPv4 ranges isPrivateIpv4 leaves public that are still never a customer's site. */
function isReservedIpv4(ip: string): boolean {
  const [a, b, c] = ip.split(".").map(Number);
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // IETF protocol assignments, TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  return false;
}

/** True for any address that is not a public unicast address. */
export function isNonPublicAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateIpv4(ip) || isReservedIpv4(ip);
  if (v !== 6) return true; // not an address at all — refuse
  const h = ip.toLowerCase().split("%")[0];
  // IPv4-mapped / -compatible / NAT64: judge the embedded IPv4.
  const embedded = /^(?:::ffff:|::|64:ff9b::)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(h);
  if (embedded) return isNonPublicAddress(embedded[1]);
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isNonPublicAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  if (h === "::" || h === "::1") return true;
  const first = parseInt(h.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (h.startsWith("2001:db8:") || h === "2001:db8::") return true; // documentation
  return false;
}

/**
 * The URL, normalized, when it is safe for the sidecar to fetch; otherwise why not.
 * `resolve` is injectable for tests.
 */
export async function guardPublicUrl(raw: unknown, resolve: Resolver = defaultResolver): Promise<PublicUrlResult> {
  if (typeof raw !== "string" || raw.length > 300) return { ok: false, reason: "not_a_url" };
  const g = guardCheckUrl(raw);
  if (!g.ok || !g.url) return { ok: false, reason: g.reason ?? "not_a_url" };
  const host = new URL(g.url).hostname;
  let addresses: string[];
  try {
    addresses = await resolve(host);
  } catch {
    return { ok: false, reason: "unresolvable" };
  }
  if (addresses.length === 0) return { ok: false, reason: "unresolvable" };
  if (addresses.some(isNonPublicAddress)) return { ok: false, reason: "resolves_private" };
  return { ok: true, url: g.url };
}
