// src/lib/funnel/origins.ts
//
// The allowlist that REPLACES the CSRF host check for POST /api/public/funnel/audit.
//
// ── Why the app-wide check cannot apply here ────────────────────────────────
// csrfProtection() in src/proxy.ts asks "is the Origin one of OUR hosts". Every
// legitimate call to the funnel audit endpoint fails that by construction — it
// is sent by a widget running on the AGENCY's domain — so the check would
// reject 100% of real traffic and 0% of attacks. src/proxy.ts exempts the path
// for that reason, exactly as it already does for /api/collect.
//
// What replaces it is strictly NARROWER, not weaker. The app-wide rule is "same
// origin as us"; this one is "one of the exact https origins this specific
// funnel's owner typed into their settings". A forged request from anywhere
// else carries an Origin that is not on the list and is refused, and because
// the endpoint reads no cookie and holds no session there is no ambient
// authority for a forgery to borrow in the first place — the same reasoning
// src/proxy.ts records for the beacon.
//
// ── v1 rules, and why each one ──────────────────────────────────────────────
//   https only     — the widget captures an email address. An http origin means
//                    that address crossed the network in clear text, and we
//                    would be the ones who made that possible.
//   no wildcards   — "*.acme.com" is one typo away from "*.com", and subdomain
//                    takeover on a forgotten host is a real and common way to
//                    inherit a wildcard. v1 makes the agency list what it runs.
//   no path        — Origin never carries one. An entry with a path could never
//                    match, so accepting it would be storing a rule that
//                    silently does nothing.
//   no credentials — likewise never present in an Origin header.
//
// An EMPTY list matches nothing, and that is the correct reading of "I have not
// said where this runs yet" — a freshly created funnel is inert until it is
// configured, rather than open until it is locked down.

/** Why one entry was refused. Rendered to the agency, so each is actionable. */
export type OriginRejection =
  | "unparseable"
  | "not_https"
  | "wildcard"
  | "has_path"
  | "has_credentials"
  | "duplicate";

export interface RejectedOrigin {
  raw: string;
  reason: OriginRejection;
}

export interface OriginListResult {
  origins: string[];
  rejected: RejectedOrigin[];
}

/** Hard ceiling per funnel. A list this long is a wildcard by other means. */
export const MAX_ORIGINS = 20;

/**
 * Normalise one entry to the exact form a browser sends in `Origin`.
 *
 * That form is scheme + host + non-default port and nothing else — no trailing
 * slash, no path, host lowercased. Normalising to it here rather than comparing
 * loosely at request time is what lets the match below be `===`: a loose
 * comparison is where allowlists grow the bug that "acme.com.evil.test" ends
 * with "acme.com".
 */
export function normalizeOrigin(raw: string): { ok: true; origin: string } | { ok: false; reason: OriginRejection } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "unparseable" };

  // Checked before URL parsing: `new URL("https://*.acme.com")` succeeds and
  // yields the literal hostname "*.acme.com", which would then normalise into
  // an entry that can never match and looks accepted in the UI.
  if (trimmed.includes("*")) return { ok: false, reason: "wildcard" };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "unparseable" };
  }

  if (url.protocol !== "https:") return { ok: false, reason: "not_https" };
  if (url.username || url.password) return { ok: false, reason: "has_credentials" };
  if (!url.hostname) return { ok: false, reason: "unparseable" };
  // "https://acme.com" parses with pathname "/" — that is the bare origin and is
  // fine. Anything longer was a URL, not an origin.
  if ((url.pathname !== "" && url.pathname !== "/") || url.search || url.hash) {
    return { ok: false, reason: "has_path" };
  }

  // url.port is "" when the port is the scheme default, so :443 collapses into
  // the same string a browser would send. url.origin already does all of this,
  // and is used rather than reassembled so the two can never drift.
  return { ok: true, origin: url.origin };
}

/**
 * Validate a whole list, keeping every rejection.
 *
 * Rejections are RETURNED, never dropped. An agency that pastes eight origins
 * and gets six saved must be told which two did not stick and why — a silent
 * drop shows up later as "the widget doesn't work on our staging site" with no
 * trail back to here.
 */
export function validateOriginList(raw: readonly string[]): OriginListResult {
  const origins: string[] = [];
  const rejected: RejectedOrigin[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (origins.length >= MAX_ORIGINS) {
      rejected.push({ raw: entry, reason: "duplicate" });
      continue;
    }
    const result = normalizeOrigin(entry);
    if (!result.ok) {
      rejected.push({ raw: entry, reason: result.reason });
      continue;
    }
    if (seen.has(result.origin)) {
      rejected.push({ raw: entry, reason: "duplicate" });
      continue;
    }
    seen.add(result.origin);
    origins.push(result.origin);
  }

  return { origins, rejected };
}

/**
 * Is this request's Origin header allowed for this funnel?
 *
 * A MISSING Origin is refused. Browsers send it on every cross-origin POST, so
 * its absence means the caller is not the widget — and "absent" must never be
 * the case that skips the check, which is the classic way an origin allowlist
 * turns into a no-op for exactly the clients that are not browsers.
 *
 * The stored list is already normalised, so the incoming header is normalised
 * the same way and compared exactly. `null` (the literal string browsers send
 * for an opaque origin, e.g. a sandboxed iframe or a data: document) fails
 * normalisation and is therefore refused.
 */
export function originAllowed(
  originHeader: string | null | undefined,
  allowedOrigins: readonly string[],
): boolean {
  if (!originHeader) return false;
  if (allowedOrigins.length === 0) return false;

  const normalized = normalizeOrigin(originHeader);
  if (!normalized.ok) return false;

  return allowedOrigins.includes(normalized.origin);
}
