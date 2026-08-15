// src/lib/funnel/keys.ts
//
// Embed keys for the white-label audit funnel: `ef_<32 hex>`.
//
// ── Stored in plaintext, and that is deliberate ─────────────────────────────
// src/lib/attribution/keys.ts hashes its publishable key at rest and confirms
// it in constant time. This one does not, and the difference is honest rather
// than lazy: er_pub_ carries a `.<secret>` segment because it was modelled on
// the bearer key next to it, whereas this key has no secret segment at all. It
// is an OPAQUE IDENTIFIER that appears in a <script src> and in an iframe URL
// on a public page. Hashing an identifier that ships in page source protects
// nothing; it would only cost us the ability to show the agency its own embed
// snippet a second time, which is the exact usability failure the comment at
// the top of attribution/keys.ts records having to live with.
//
// Authorization is NOT this key. It is FunnelConfig.allowedOrigins, checked on
// every audit — see src/lib/funnel/origins.ts. Someone who copies a key out of
// a customer's page source can point it at their own site and get nothing: the
// Origin they send is not on the list.
//
// ── The shape check is the XSS control ──────────────────────────────────────
// The key is interpolated into the JavaScript that /api/public/funnel.js
// returns and into the iframe src it builds. `FUNNEL_KEY_PATTERN` is what makes
// that safe, and it is applied at the edge of every route that reads a key,
// before any database call. 32 hex characters cannot close a string literal,
// open a tag, or be anything but 32 hex characters.

import { randomBytes } from "crypto";

const KEY_PREFIX = "ef_";
const KEY_BYTES = 16;

/** Exact wire format. Junk is rejected before it reaches Postgres. */
export const FUNNEL_KEY_PATTERN = /^ef_[0-9a-f]{32}$/;

/** A fresh embed key. Unique by construction; the column is unique anyway. */
export function generateFunnelKey(): string {
  return `${KEY_PREFIX}${randomBytes(KEY_BYTES).toString("hex")}`;
}

/**
 * Structural check. Does NOT prove the funnel exists.
 *
 * Typed as a predicate so a caller that guards on it hands a `string` to the
 * query below it rather than an `unknown` it has to re-narrow.
 */
export function isFunnelKey(value: unknown): value is string {
  return typeof value === "string" && FUNNEL_KEY_PATTERN.test(value);
}
