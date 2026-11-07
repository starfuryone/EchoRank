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
import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { SITE_URL } from "@/lib/seo/constants";

const PURPOSE = "marketing-unsubscribe";

function secret(): string | null {
  return process.env.AUTH_SECRET || null;
}

function mac(tenantId: string, key: string): string {
  return createHmac("sha256", key).update(`${PURPOSE}:${tenantId}`).digest("base64url");
}

/** `<tenantId b64url>.<hmac>`, or null when AUTH_SECRET is unset. */
export function unsubscribeToken(tenantId: string, key = secret()): string | null {
  if (!key) return null;
  return `${Buffer.from(tenantId).toString("base64url")}.${mac(tenantId, key)}`;
}

/** The tenant id when the token is genuine, else null. */
export function verifyUnsubscribeToken(token: string | null | undefined, key = secret()): string | null {
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
  const b = Buffer.from(mac(tenantId, key));
  return a.length === b.length && timingSafeEqual(a, b) ? tenantId : null;
}

export function unsubscribeUrl(tenantId: string, key = secret()): string | null {
  const t = unsubscribeToken(tenantId, key);
  return t ? `${SITE_URL}/api/email/unsubscribe?t=${encodeURIComponent(t)}` : null;
}

/** The RFC 8058 headers, or {} when no link can be minted. */
export function oneClickUnsubscribeHeaders(tenantId: string, key = secret()): Record<string, string> {
  const url = unsubscribeUrl(tenantId, key);
  if (!url) return {};
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
