// CSRF-safe OAuth state: HMAC-SHA256-signed payload bound to the initiating
// tenant with a 15-minute expiry and a random nonce. The callback verifies
// the signature AND that the embedded tenantId equals the session tenant, so
// a state minted for one tenant/session cannot complete another's flow.
// Pure sign/verify with injectable secret for tests.
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const STATE_TTL_MS = 15 * 60_000;

function envSecret(): string {
  const s = process.env.GSC_TOKEN_ENCRYPTION_KEY;
  if (!s) throw new Error("GSC_TOKEN_ENCRYPTION_KEY is not set");
  return s;
}

function hmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * Which flow minted the state: Search Console (default), the crawler's Sheets
 * connect (4c), Google Analytics (4d), or Search Console from Settings →
 * Integrations (the crawler-only plan, which has no GSC tool page to return
 * to, 2026-11-10).
 */
export type StatePurpose = "gsc" | "sheets" | "ga4" | "gsc_settings";
const PURPOSES: readonly string[] = ["sheets", "ga4", "gsc_settings"];

export function signState(tenantId: string, secret = envSecret(), now = Date.now(), purpose: StatePurpose = "gsc"): string {
  const nonce = randomBytes(8).toString("base64url");
  const payload = purpose === "gsc" ? `${tenantId}.${now + STATE_TTL_MS}.${nonce}` : `${tenantId}.${now + STATE_TTL_MS}.${nonce}.${purpose}`;
  return `${Buffer.from(payload).toString("base64url")}.${hmac(payload, secret)}`;
}

/** Returns the embedded tenantId when valid and unexpired, else null. */
export function verifyState(
  state: string,
  secret = envSecret(),
  now = Date.now(),
): string | null {
  return verifyStatePurpose(state, secret, now)?.tenantId ?? null;
}

/** The tenant AND the flow the state was signed for. The purpose is inside the HMAC. */
export function verifyStatePurpose(
  state: string,
  secret = envSecret(),
  now = Date.now(),
): { tenantId: string; purpose: StatePurpose } | null {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = hmac(payload, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [tenantId, expiresStr, , purposeStr] = payload.split(".");
  if (!tenantId || !expiresStr) return null;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || now > expires) return null;
  if (purposeStr !== undefined && !PURPOSES.includes(purposeStr)) return null;
  return { tenantId, purpose: (purposeStr as StatePurpose | undefined) ?? "gsc" };
}
