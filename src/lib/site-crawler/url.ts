// src/lib/site-crawler/url.ts
//
// URL normalization and the in-scope rule for the Site Crawler.
//
// Normalization is what makes the seen-set correct. Every URL that reaches the
// frontier goes through normalizeCrawlUrl() first, so the same page reached by
// three different links is fetched once. Getting this wrong does not produce a
// wrong answer — it produces an unbounded crawl of the same page, which on a
// shared box is the more expensive failure.
//
// The SSRF guard is NOT reimplemented here. src/lib/bot-analytics/url-guard.ts
// already owns "is this URL safe to fetch from a server", including IP
// literals, private ranges, credentials and odd ports; this module imports it
// rather than growing a second copy to keep correct.

import { guardCheckUrl, isPrivateIpv4 } from "@/lib/bot-analytics/url-guard";
import { registrableDomain } from "@/lib/registrable-domain";

export const MAX_URL_LENGTH = 2000;

/**
 * Query parameters dropped during normalization.
 *
 * These are click-attribution tags: they never change what the server returns,
 * and keeping them would enter the same page into the frontier once per
 * inbound campaign. `utm_*` is matched by prefix; the rest are exact.
 */
const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAMS = new Set([
  "gclid",
  "fbclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "_ga",
  "ref_src",
]);

export function isTrackingParam(name: string): boolean {
  const n = name.toLowerCase();
  return TRACKING_PARAM_PREFIXES.some((p) => n.startsWith(p)) || TRACKING_PARAMS.has(n);
}

/** Schemes that are never fetched, even when a page links to them. */
const NON_HTTP_SCHEME = /^(mailto|tel|javascript|data|ftp|sms|geo|blob|file):/i;

/**
 * File extensions that are not HTML and not worth a request.
 *
 * The crawler still refuses non-HTML by Content-Type after fetching, but that
 * costs a round trip and, for a PDF or a video, potentially megabytes before
 * the abort. Skipping the obvious ones by extension is the cheap half.
 */
const NON_HTML_EXTENSION =
  /\.(jpe?g|png|gif|webp|avif|svg|ico|bmp|tiff?|mp4|webm|mov|avi|mkv|mp3|wav|ogg|flac|pdf|zip|gz|tgz|rar|7z|tar|dmg|exe|msi|apk|css|js|mjs|json|xml|rss|atom|woff2?|ttf|eot|otf|csv|xlsx?|docx?|pptx?)$/i;

export function looksLikeNonHtml(pathname: string): boolean {
  return NON_HTML_EXTENSION.test(pathname);
}

/**
 * Canonical string form of a URL for the seen-set.
 *
 * Lowercases the host, drops the fragment, strips tracking params, and removes
 * a trailing slash on everything except the root path. The PATH KEEPS ITS CASE:
 * on most servers /About and /about are different resources, and folding them
 * would silently skip one.
 *
 * Returns null when the URL is not something this crawler will ever fetch —
 * a non-HTTP scheme, an unparseable string, or an over-long URL.
 */
export function normalizeCrawlUrl(input: string, base?: string): string | null {
  const raw = (input ?? "").trim();
  if (!raw || raw.length > MAX_URL_LENGTH) return null;
  if (NON_HTTP_SCHEME.test(raw)) return null;

  let parsed: URL;
  try {
    parsed = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  // Default ports are noise: http://x:80/ and http://x/ are the same request.
  if ((parsed.protocol === "http:" && parsed.port === "80") ||
      (parsed.protocol === "https:" && parsed.port === "443")) {
    parsed.port = "";
  }

  for (const name of [...parsed.searchParams.keys()]) {
    if (isTrackingParam(name)) parsed.searchParams.delete(name);
  }
  // Sorting makes ?b=2&a=1 and ?a=1&b=2 one entry. Server behaviour does not
  // depend on parameter order, so two orderings are always the same page.
  parsed.searchParams.sort();

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }
  if (parsed.pathname === "") parsed.pathname = "/";

  const normalized = parsed.toString();
  return normalized.length > MAX_URL_LENGTH ? null : normalized;
}

/**
 * Same registrable domain as the root — subdomains included, per the spec.
 *
 * blog.example.com is in scope for a crawl of example.com; example.org is not,
 * and neither is evil-example.com, which a naive endsWith() would have let in.
 */
export function isInScope(candidate: string, rootUrl: string): boolean {
  let candidateHost: string;
  let rootHost: string;
  try {
    candidateHost = new URL(candidate).hostname.toLowerCase();
    rootHost = new URL(rootUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (candidateHost === rootHost) return true;

  const candidateRoot = registrableDomain(candidateHost);
  const rootRoot = registrableDomain(rootHost);
  if (!candidateRoot || !rootRoot) return false;
  return candidateRoot === rootRoot;
}

export type RootUrlRejection =
  | "not_a_url"
  | "bad_scheme"
  | "has_credentials"
  | "bad_port"
  | "ip_literal"
  | "private_host"
  | "too_long";

export interface RootUrlResult {
  ok: boolean;
  url?: string;
  reason?: RootUrlRejection;
}

/**
 * Validate a tenant-supplied crawl root.
 *
 * Delegates the SSRF decision to the shared guard and then normalizes. No
 * tenantDomain is passed: a crawl is a tool a paying tenant points at a site,
 * and the product has no domain-verification step to check ownership against —
 * the same reasoning documented in ai-lens/url.ts for its cross-domain gate.
 */
export function validateRootUrl(input: string): RootUrlResult {
  const raw = (input ?? "").trim();
  if (raw.length > MAX_URL_LENGTH) return { ok: false, reason: "too_long" };

  const guarded = guardCheckUrl(raw);
  if (!guarded.ok || !guarded.url) {
    // domain_mismatch cannot occur — no tenantDomain was supplied.
    return { ok: false, reason: (guarded.reason ?? "not_a_url") as RootUrlRejection };
  }

  const normalized = normalizeCrawlUrl(guarded.url);
  if (!normalized) return { ok: false, reason: "not_a_url" };
  return { ok: true, url: normalized };
}

/**
 * Per-URL guard applied to every link before it is fetched, not just the root.
 *
 * Scope already restricts discovered URLs to the root's registrable domain, so
 * this is the second line: a site that links to http://192.168.1.1/ on its own
 * domain, or to an internal hostname, must not drag the crawler there.
 */
export function isFetchableUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") return false;

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host.includes(":")) return false; // IPv6 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false; // any IPv4 literal
  if (isPrivateIpv4(host)) return false;
  if (!host.includes(".")) return false;
  return true;
}
