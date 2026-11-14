// One-click unsubscribe for marketing email (RFC 8058).
//
// Every marketing email carries
//   List-Unsubscribe: <https://echorank360.com/api/email/unsubscribe?t=TOKEN>
//   List-Unsubscribe-Post: List-Unsubscribe=One-Click
// and the same URL as `unsubscribeUrl` for the template's footer link. A mail
// client's one-click button POSTs to it; a person clicking the link GETs a page
// whose button POSTs (a GET never unsubscribes, so link scanners cannot).
//
// The token is the tenant id plus an HMAC of it under AUTH_SECRET. It does not
// expire: an unsubscribe link has to keep working for as long as the email sits
// in someone's inbox. It can do exactly one thing, turn marketing off.
//
// Product and billing emails (trial notice, receipts, security, deletion
// notices) are not marketing and carry none of this.
//
// TWO LISTS (2026-11-14). "marketing" (newsletters, promotions) turns off
// Tenant.marketingConsent. "onboarding" is the getting-started drip, a service
// email sent without marketing consent, which keeps its own link: it sets
// Tenant.onboardingEmailsOptedOutAt and leaves marketing consent alone. The
// list is part of the signed purpose, so a token for one list never works for
// the other. Its URL carries `l=onboarding`; no `l` means marketing, so links
// already sent keep working.
import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { SITE_URL } from "@/lib/seo/constants";

export type UnsubscribeList = "marketing" | "onboarding";

const PURPOSE: Record<UnsubscribeList, string> = {
  marketing: "marketing-unsubscribe",
  onboarding: "onboarding-unsubscribe",
};

/** The `l` query value → the list. Anything but "onboarding" is marketing. */
export function unsubscribeListOf(value: string | null | undefined): UnsubscribeList {
  return value === "onboarding" ? "onboarding" : "marketing";
}

function secret(): string | null {
  return process.env.AUTH_SECRET || null;
}

function mac(tenantId: string, key: string, list: UnsubscribeList): string {
  return createHmac("sha256", key).update(`${PURPOSE[list]}:${tenantId}`).digest("base64url");
}

/** `<tenantId b64url>.<hmac>`, or null when AUTH_SECRET is unset. */
export function unsubscribeToken(
  tenantId: string,
  key = secret(),
  list: UnsubscribeList = "marketing",
): string | null {
  if (!key) return null;
  return `${Buffer.from(tenantId).toString("base64url")}.${mac(tenantId, key, list)}`;
}

/** The tenant id when the token is genuine for this list, else null. */
export function verifyUnsubscribeToken(
  token: string | null | undefined,
  key = secret(),
  list: UnsubscribeList = "marketing",
): string | null {
  if (!token || !key) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  let tenantId: string;
  try {
    tenantId = Buffer.from(token.slice(0, dot), "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!tenantId) return null;
  const a = Buffer.from(token.slice(dot + 1));
  const b = Buffer.from(mac(tenantId, key, list));
  return a.length === b.length && timingSafeEqual(a, b) ? tenantId : null;
}

export function unsubscribeUrl(
  tenantId: string,
  key = secret(),
  list: UnsubscribeList = "marketing",
): string | null {
  const t = unsubscribeToken(tenantId, key, list);
  if (!t) return null;
  const l = list === "onboarding" ? "&l=onboarding" : "";
  return `${SITE_URL}/api/email/unsubscribe?t=${encodeURIComponent(t)}${l}`;
}

/** The RFC 8058 headers, or {} when no link can be minted. */
export function oneClickUnsubscribeHeaders(
  tenantId: string,
  key = secret(),
  list: UnsubscribeList = "marketing",
): Record<string, string> {
  const url = unsubscribeUrl(tenantId, key, list);
  if (!url) return {};
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
