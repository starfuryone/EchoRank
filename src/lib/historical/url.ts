// src/lib/historical/url.ts
//
// URL acceptance for snapshots. ANY public page, yours or anyone else's.
//
// NO OWNERSHIP CHECK, DELIBERATELY. Historical exists to compare your pages
// against the competition, so restricting captures to the tenant's own domain
// would remove the reason to use it. Nothing here consults tenant domains; the
// only question asked is "is this a public http(s) address".
//
// WHY NOT guardCheckUrl DIRECTLY. bot-analytics/url-guard.ts has exactly the
// SSRF logic we want and one behaviour we do not: it clears the query string,
// because a crawler-access probe only ever fetches a homepage and a query would
// just fragment its cache. A snapshot of /search?q=plumbers is a DIFFERENT PAGE
// from /search, and silently capturing the latter would file the wrong content
// under the URL the user typed. So the guard verdict is reused verbatim and the
// query is restored afterwards — the SSRF rules stay in one place.
//
// THE REDIRECT CASE is not decidable here and is not attempted. A URL that
// passes this check can still redirect to 127.0.0.1. That is caught in the
// sidecar (ai_lens.assert_fetchable re-resolves every hop and refuses any that
// leaves the requested registrable domain), which is the only layer holding the
// socket. This function guards what is expressible in the URL as written.

import { guardCheckUrl, type UrlRejection } from "@/lib/bot-analytics/url-guard";

export interface NormalizedUrl {
  ok: boolean;
  /** Absolute, scheme-normalized, query preserved. Only when ok. */
  url?: string;
  reason?: UrlRejection;
}

const MAX_URL_LENGTH = 2000;

/**
 * Accept a URL for capture.
 *
 * Scheme-less input is normalized to https:// before validation — "cnn.com" is
 * what people paste, and rejecting it would be pedantry. A scheme that IS
 * present is never rewritten: "http://x" stays http, and "ftp://x" is rejected
 * rather than quietly upgraded into something that passes.
 */
export function normalizeSnapshotUrl(raw: string): NormalizedUrl {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: false, reason: "not_a_url" };
  if (trimmed.length > MAX_URL_LENGTH) return { ok: false, reason: "not_a_url" };

  // One source of truth for the SSRF verdict.
  const guarded = guardCheckUrl(trimmed);
  if (!guarded.ok || !guarded.url) return { ok: false, reason: guarded.reason };

  // Restore the query the guard cleared. Re-parsed from the SAME normalized
  // candidate the guard accepted, so this cannot reintroduce a host it rejected.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, reason: "not_a_url" };
  }

  const accepted = new URL(guarded.url);
  accepted.search = parsed.search;
  // The fragment is client-side only and never reaches a server, so keeping it
  // would split the snapshot history of one page across several URLs.
  accepted.hash = "";

  return { ok: true, url: accepted.toString() };
}

/** Message key for a rejection. The catalogs hold the wording. */
export function rejectionCopyKey(reason: UrlRejection | undefined): string {
  switch (reason) {
    case "bad_scheme":
      return "errUrlScheme";
    case "has_credentials":
      return "errUrlCredentials";
    case "bad_port":
      return "errUrlPort";
    case "ip_literal":
    case "private_host":
      return "errUrlPrivate";
    default:
      return "errInvalidUrl";
  }
}
