// src/lib/authority-checker/store.ts — a check's result link, its email unlock
// and its leads.
//
// THE RESULT LIVES IN REDIS under an unguessable token for RESULT_TTL_DAYS: it
// is a few hundred bytes of public-web facts, and a database table for a
// 7-day link would be a migration with nothing to keep. If Redis cannot store
// it, the check is refused (503) before anything is bought.
//
// THE UNLOCK is the free crawler's pattern (src/lib/site-crawler/free-result.ts):
// a cookie `erac_<token>` whose value is an HMAC of the token, checked on every
// read. LEADS go to the same table as the crawler's (free_crawl_leads), with
// source "authority-checker"; no migration. The blocked-country rule (no lead
// stored from the EU/EEA/UK) is applied by the unlock route.

import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { logger } from "@/infrastructure/observability/logger";
import { requestDoubleOptIn } from "@/lib/site-crawler/free-result";
import { AUTHORITY_SLUG, AUTHORITY_SRC, RESULT_TTL_DAYS } from "./config";
import type { CheckView, StoredCheck } from "./types";

const TTL_SECONDS = RESULT_TTL_DAYS * 86_400;
const TOKEN = /^[A-Za-z0-9_-]{22}$/;
const key = (token: string) => `free:authority:check:${token}`;

export function newToken(): string {
  return randomBytes(16).toString("base64url");
}

export function isToken(value: string): boolean {
  return TOKEN.test(value);
}

/** False when Redis would not take it. */
export async function saveCheck(check: StoredCheck): Promise<boolean> {
  const ttl = Math.max(60, Math.floor((Date.parse(check.createdAt) + TTL_SECONDS * 1000 - Date.now()) / 1000));
  try {
    await getRedisConnection().set(key(check.token), JSON.stringify(check), "EX", ttl);
    return true;
  } catch (err) {
    logger.warn({ err }, "authority checker: result not stored");
    return false;
  }
}

export async function loadCheck(token: string): Promise<StoredCheck | null> {
  if (!isToken(token)) return null;
  try {
    const raw = await getRedisConnection().get(key(token));
    return raw ? (JSON.parse(raw) as StoredCheck) : null;
  } catch {
    return null;
  }
}

// ─── The unlock cookie ───────────────────────────────────────────────────────

export const unlockCookieName = (token: string) => `erac_${token}`;

function unlockSecret(): string | null {
  return process.env.AUTH_SECRET || process.env.GSC_TOKEN_ENCRYPTION_KEY || null;
}

export function unlockValue(token: string, secret: string | null = unlockSecret()): string | null {
  if (!secret) return null;
  return createHmac("sha256", secret).update(`authority-unlock:${token}`).digest("base64url");
}

export function isUnlocked(token: string, cookieValue: string | null | undefined, secret: string | null = unlockSecret()): boolean {
  const want = unlockValue(token, secret);
  if (!want || !cookieValue) return false;
  const a = Buffer.from(want);
  const b = Buffer.from(cookieValue);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Set-Cookie for this browser, until the result expires. Null without a signing secret. */
export function unlockCookie(check: Pick<StoredCheck, "token" | "createdAt">, now: Date = new Date()): string | null {
  const value = unlockValue(check.token);
  if (!value) return null;
  const maxAge = Math.max(60, Math.floor((Date.parse(check.createdAt) + TTL_SECONDS * 1000 - now.getTime()) / 1000));
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${unlockCookieName(check.token)}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

export function cookieFrom(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function requestUnlocked(request: Request, token: string): boolean {
  return isUnlocked(token, cookieFrom(request, unlockCookieName(token)));
}

// ─── Views ───────────────────────────────────────────────────────────────────

/** What the browser may see: the free part always, the full part only once unlocked. */
export function toView(check: StoredCheck, unlocked: boolean): CheckView {
  return {
    token: check.token,
    createdAt: check.createdAt,
    domain: check.domain,
    competitors: check.competitors,
    authority: check.authority[check.domain] ?? null,
    links: check.links,
    unlocked,
    full: unlocked ? check.full : null,
    fullPending: unlocked && check.full === null,
  };
}

// ─── Leads ───────────────────────────────────────────────────────────────────

export const LEAD_SOURCE = AUTHORITY_SRC;

/** Store the lead once per result and email; with consent, Brevo's double opt-in. */
export async function recordAuthorityLead(input: { check: StoredCheck; email: string; locale: string; consent: boolean }) {
  const email = input.email.trim().toLowerCase();
  const lead = await prisma.freeCrawlLead.upsert({
    where: { token_email: { token: input.check.token, email } },
    create: { token: input.check.token, email, domain: input.check.domain, locale: input.locale, marketingConsent: input.consent, source: LEAD_SOURCE },
    update: input.consent ? { marketingConsent: true } : {},
    select: { id: true, doiRequestedAt: true },
  });
  if (input.consent && !lead.doiRequestedAt) {
    const sent = await requestDoubleOptIn(email, input.locale, input.check.domain, fetch, {
      source: LEAD_SOURCE,
      redirectPath: `/free-tools/${AUTHORITY_SLUG}`,
    }).catch((err: Error) => {
      logger.warn({ err: err.message }, "authority checker: Brevo double opt-in failed");
      return "skipped" as const;
    });
    if (sent === "sent") await prisma.freeCrawlLead.update({ where: { id: lead.id }, data: { doiRequestedAt: new Date() } });
  }
  return lead;
}
