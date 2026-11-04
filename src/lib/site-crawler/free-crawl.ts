// src/lib/site-crawler/free-crawl.ts
//
// The free public site crawler's crawl: FREE_CRAWL_URL_CAP pages, spider mode,
// raw HTML, the default configuration (Echorank360Bot UA, robots.txt obeyed,
// 2 requests a second, no opt-ins), owned by the system tenant
// (free-tenant.ts) and queued behind every paid crawl. It bypasses startCrawl
// on purpose: no plan, no quota, no saved site defaults, no segments.

import "server-only";
import { randomBytes } from "node:crypto";
import { addJob } from "@/infrastructure/queue/registry";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { consumeDailyLimit, refundDailyLimit } from "@/lib/free-tools/limits";
import { prisma } from "@/lib/prisma";
import { registrableDomain } from "@/lib/registrable-domain";
import { hashIp } from "@/lib/snapshot/limits";
import { verifyTurnstile } from "@/lib/snapshot/turnstile";
import { FREE_CRAWL_PRIORITY, freeTenantId } from "./free-tenant";
import { validateRootUrl } from "./url";

export const FREE_CRAWL_URL_CAP = 100;
/** New free crawls per visitor IP per UTC day (Redis INCR + TTL, free-tools/limits.ts). */
export const FREE_CRAWL_IP_DAILY = 3;
/** One crawl per registrable domain in this window; a second request gets the first's result. */
export const FREE_CRAWL_DOMAIN_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Result links (and the crawl behind them) live this long. */
export const FREE_CRAWL_RETENTION_DAYS = 7;
const LIMIT_TOOL = "site-crawler";
const LOCK_S = 30;

/** Create and queue one free crawl of an already-validated root URL. */
export async function enqueueFreeCrawl(rootUrl: string): Promise<{ id: string; tenantId: string }> {
  const tenantId = await freeTenantId();
  const job = await prisma.crawlJob.create({
    data: {
      tenantId,
      rootUrl,
      mode: "spider",
      urlCap: FREE_CRAWL_URL_CAP,
      renderMode: "none",
      renderCap: 0,
      status: "QUEUED",
      // No config: the defaults, which are robots.txt obeyed at 2 req/s as
      // Echorank360Bot, with no opt-in of any kind.
    },
    select: { id: true, tenantId: true },
  });
  await addJob("site-crawl", "crawl", { crawlJobId: job.id, tenantId }, { priority: FREE_CRAWL_PRIORITY });
  return job;
}

// ─── Start: the abuse checks, in order ───────────────────────────────────────

export type FreeStartError =
  | "invalid_url" // not a public http(s) URL (url-guard)
  | "blocked" // the owner asked to be left out
  | "turnstile" // challenge failed
  | "unavailable" // Turnstile unconfigured, or Redis down (limits fail closed)
  | "rate_limited" // this IP's FREE_CRAWL_IP_DAILY starts are used
  | "busy"; // the same domain is being started right now

export type FreeStartResult = { ok: true; token: string; reused: boolean } | { ok: false; error: FreeStartError; reason?: string };

const lockKey = (domain: string) => `free:crawl:lock:${domain}`;

/** True when `host` or one of its parent domains is on the opt-out list. */
export async function isBlockedHost(host: string): Promise<boolean> {
  const h = host.toLowerCase().replace(/\.$/, "");
  const labels = h.split(".");
  const candidates = labels.map((_, i) => labels.slice(i).join(".")).filter((c) => c.includes("."));
  const hit = await prisma.freeCrawlBlockedHost.findFirst({ where: { host: { in: candidates } }, select: { id: true } });
  return hit !== null;
}

/** The newest free crawl of a registrable domain inside the 24-hour window. */
export async function recentFreeCrawl(domain: string, now: Date = new Date()): Promise<{ token: string } | null> {
  return prisma.freeCrawl.findFirst({
    where: { domain, createdAt: { gt: new Date(now.getTime() - FREE_CRAWL_DOMAIN_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });
}

/**
 * A visitor's free crawl: URL guard, opt-out list, Turnstile, the domain's
 * 24-hour reuse (answers before the IP allowance, so a repeat costs nothing),
 * the IP's daily starts, then a short per-domain lock so two visitors racing
 * on one domain share one crawl. `ip` is cf-connecting-ip (the route refuses a
 * request without one).
 */
export async function startFreeCrawl(input: { url: string; turnstileToken?: string; ip: string; locale: string }, now: Date = new Date()): Promise<FreeStartResult> {
  const v = validateRootUrl(input.url);
  if (!v.ok || !v.url) return { ok: false, error: "invalid_url", reason: v.reason };
  const rootUrl = v.url;
  const host = new URL(rootUrl).hostname.toLowerCase();
  const domain = registrableDomain(host);
  if (await isBlockedHost(host)) return { ok: false, error: "blocked" };

  const turnstile = await verifyTurnstile(input.turnstileToken, input.ip);
  if (turnstile === "unconfigured") return { ok: false, error: "unavailable" };
  if (turnstile !== "ok") return { ok: false, error: "turnstile" };

  const existing = await recentFreeCrawl(domain, now);
  if (existing) return { ok: true, token: existing.token, reused: true };

  const allowance = await consumeDailyLimit(LIMIT_TOOL, input.ip, FREE_CRAWL_IP_DAILY, now);
  if (!allowance.ok) return { ok: false, error: allowance.reason === "rate_limited" ? "rate_limited" : "unavailable" };

  const redis = getRedisConnection();
  const locked = await redis.set(lockKey(domain), "1", "EX", LOCK_S, "NX").catch(() => null);
  if (locked !== "OK") {
    await refundDailyLimit(LIMIT_TOOL, input.ip, now);
    const racing = await recentFreeCrawl(domain, now);
    return racing ? { ok: true, token: racing.token, reused: true } : { ok: false, error: "busy" };
  }
  try {
    const job = await enqueueFreeCrawl(rootUrl);
    const token = randomBytes(18).toString("base64url");
    await prisma.freeCrawl.create({
      data: { token, crawlJobId: job.id, domain, host, ipHash: hashIp(input.ip), locale: input.locale === "fr" ? "fr" : "en" },
    });
    return { ok: true, token, reused: false };
  } catch (err) {
    await refundDailyLimit(LIMIT_TOOL, input.ip, now);
    throw err;
  } finally {
    await redis.del(lockKey(domain)).catch(() => undefined);
  }
}

/** A blocklist entry from the admin form: a lowercase hostname, no scheme or path. */
export function normalizeBlockedHost(raw: string): string | null {
  let h = (raw ?? "").trim().toLowerCase();
  if (h.includes("://")) {
    try {
      h = new URL(h).hostname;
    } catch {
      return null;
    }
  }
  h = h.replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/\.$/, "").replace(/^www\./, "");
  return /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(h) ? h : null;
}

/** Free crawls started in the last `days` days (the admin page's count). */
export function freeCrawlsInLastDays(days: number, now: Date = new Date()): Promise<number> {
  return prisma.freeCrawl.count({ where: { createdAt: { gt: new Date(now.getTime() - days * 86_400_000) } } });
}
