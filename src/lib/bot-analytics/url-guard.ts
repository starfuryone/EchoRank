// src/lib/bot-analytics/url-guard.ts
//
// SSRF guard for the active access check.
//
// The access check is a server-side fetch loop aimed at a URL, which is the
// classic SSRF shape. Today the URL is never user-supplied per request — the
// route resolves it from the tenant's own monitor / audit / auditDomain rows and
// accepts no URL parameter — so the guard is defence in depth rather than the
// only thing standing between us and the metadata service. It is here because
// "the caller currently happens to pass something safe" is a property that holds
// until someone adds a convenience parameter, and this file makes the loss loud.
//
// SCOPE, stated plainly: these are checks on the URL as written. They stop
// http://169.254.169.254/, file://, credentials-in-URL, odd ports, and a URL
// pointing at a host the tenant does not own. They do NOT stop a tenant
// registering a domain whose DNS resolves to a private address — that needs
// resolve-then-pin at the socket, which belongs in the sidecar that owns the
// actual connection, not in the app. The sidecar is the enforcement point for
// that class; this is the enforcement point for everything expressible in the
// URL itself.

export type UrlRejection =
  | "not_a_url"
  | "bad_scheme"
  | "has_credentials"
  | "bad_port"
  | "ip_literal"
  | "private_host"
  | "domain_mismatch";

export interface UrlGuardResult {
  ok: boolean;
  /** Normalized absolute URL, only when ok. */
  url?: string;
  reason?: UrlRejection;
}

/** http(s) only. No file:, gopher:, data:, ftp:, or anything else. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Default ports plus nothing. A crawler reaches a site on 80/443. */
const ALLOWED_PORTS = new Set(["", "80", "443"]);

/**
 * Hostname suffixes that never name a public site. `.local` is mDNS, `.internal`
 * is the common cloud-private convention, and the rest are reserved by RFC 6761
 * or RFC 2606.
 */
const PRIVATE_SUFFIXES = [
  ".local",
  ".localhost",
  ".internal",
  ".intranet",
  ".lan",
  ".home.arpa",
  ".test",
  ".invalid",
  ".example",
];

const PRIVATE_HOSTS = new Set(["localhost", "ip6-localhost", "ip6-loopback"]);

/** Bare IPv4. */
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * True for any IPv4 literal outside the public range: loopback, RFC1918,
 * link-local (including the 169.254.169.254 metadata endpoint), CGNAT,
 * broadcast, multicast, and 0.0.0.0/8.
 */
export function isPrivateIpv4(host: string): boolean {
  const m = IPV4_RE.exec(host);
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some((n) => n > 255)) return true; // malformed — refuse, do not pass on
  const [a, b] = o;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved + 255.255.255.255
  return false;
}

/** Registrable-domain comparison: exact match or a subdomain of it. */
export function hostMatchesDomain(host: string, domain: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  const d = domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
    .replace(/\.$/, "");
  if (!d) return false;
  // Strip a leading www. from the host too: a tenant registering example.com
  // and being checked at www.example.com is the same site, not a mismatch.
  const hBare = h.replace(/^www\./, "");
  return hBare === d || hBare.endsWith(`.${d}`);
}

/**
 * Validates a URL for the access check.
 *
 * @param raw          URL to fetch. A bare host is accepted and gets https://.
 * @param tenantDomain The domain the tenant has registered. When supplied, the
 *                     URL's host must be it or a subdomain of it — this is what
 *                     keeps the check from being pointed at someone else's site.
 */
export function guardCheckUrl(raw: string, tenantDomain?: string | null): UrlGuardResult {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: false, reason: "not_a_url" };

  // Accept "example.com" the way every other URL field in this app does, but
  // only when there is no scheme at all — never rewrite a scheme we rejected.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, reason: "not_a_url" };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { ok: false, reason: "bad_scheme" };
  }
  // Credentials in the URL are a redirect-laundering trick and never legitimate
  // for a public homepage fetch.
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "has_credentials" };
  }
  if (!ALLOWED_PORTS.has(parsed.port)) {
    return { ok: false, reason: "bad_port" };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // Any IPv6 literal, and any IPv4 literal at all. A public site is named by a
  // domain; an IP literal here is either a mistake or an attempt, and allowing
  // public IPv4 literals would mean maintaining a second private-range list for
  // every representation (decimal, octal, IPv4-mapped IPv6).
  if (host.includes(":") || IPV4_RE.test(host)) {
    return { ok: false, reason: isPrivateIpv4(host) ? "private_host" : "ip_literal" };
  }
  if (PRIVATE_HOSTS.has(host) || PRIVATE_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: "private_host" };
  }
  // A single-label host ("intranet", "router") is not a public site either.
  if (!host.includes(".")) {
    return { ok: false, reason: "private_host" };
  }

  if (tenantDomain && !hostMatchesDomain(host, tenantDomain)) {
    return { ok: false, reason: "domain_mismatch" };
  }

  // Normalize to origin + path; the probe fetches the homepage, and a query or
  // fragment on it would only vary the cache key for no gain.
  parsed.hash = "";
  parsed.search = "";
  return { ok: true, url: parsed.toString() };
}
