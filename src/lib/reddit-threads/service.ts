// src/lib/reddit-threads/service.ts — the free Reddit Threads Finder's one
// purchase, its cache and its daily budget.
//
// THE SEARCH: DataForSEO Google organic, LIVE (synchronous), depth 10 — one
// SERP page, `site:reddit.com <keyword>` in one country, with Google's time
// filter when asked. No AI Overview, no feature parsing (REDDIT_SEARCH_ROUTE):
// a call the search router may later move to Serper. Its real cost is the
// `cost` field DataForSEO returns, written to SeoApiCall by the metering under
// REDDIT_TENANT_ID; the daily budget sums those rows.
//
// CACHE, TWO LAYERS, SAME RULE AS EVERY FREE TOOL: a hit costs nobody
// anything and uses no allowance. Redis first, then the shared cross-feature
// Spaces store, for CACHE_DAYS per keyword + country + time filter.

import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { SERP } from "@/lib/dataforseo/endpoints";
import { seoMeteredCallResult } from "@/lib/dataforseo/metering";
import { cacheKey as redisKey, readCache as redisRead, writeCache as redisWrite } from "@/lib/free-tools/cache";
import { cacheKey as spacesKey, dateBucket, readCache as spacesRead, writeCache as spacesWrite } from "@/lib/spaces-cache";
import { requestDoubleOptIn } from "@/lib/site-crawler/free-result";
import {
  CACHE_DAYS,
  MAX_THREADS,
  REDDIT_SEARCH_ROUTE,
  REDDIT_SLUG,
  REDDIT_SRC,
  REDDIT_TENANT_ID,
  TIME_PARAM,
  dailyBudgetUsd,
  type TimeFilter,
} from "./config";
import { parseRedditSerp, type RedditThread } from "./parse";

export interface RedditSearchInput {
  keyword: string;
  country: { code: number; language: string };
  time: TimeFilter;
}

export interface RedditSearchResult {
  keyword: string;
  countryCode: number;
  time: TimeFilter;
  threads: RedditThread[];
  /** Google showed a Discussions and forums block in this response. */
  forumsBlock: boolean;
  fetchedAt: string;
}

/** The search's identity: lowercased keyword, country, time filter. Also the lead's token. */
export function searchHash(input: RedditSearchInput): string {
  const canonical = `${input.keyword.toLowerCase()}|${input.country.code}|${input.time}`;
  return createHash("sha256").update(canonical).digest("hex");
}

function keys(input: RedditSearchInput, now: Date) {
  return {
    redis: redisKey("reddit", input.keyword, input.country.code, input.time),
    spaces: spacesKey({
      feature: "reddit-threads",
      version: "v1",
      scope: `${input.country.code}-${input.time}`,
      target: input.keyword,
      dateBucket: dateBucket(CACHE_DAYS, now),
    }),
  };
}

/** A cached search, or null. Never buys. */
export async function cachedSearch(input: RedditSearchInput, now = new Date()): Promise<RedditSearchResult | null> {
  const k = keys(input, now);
  const fromRedis = await redisRead<RedditSearchResult>(k.redis);
  if (fromRedis && Array.isArray(fromRedis.threads)) return fromRedis;
  const fromSpaces = await spacesRead<RedditSearchResult>(k.spaces);
  if (fromSpaces && Array.isArray(fromSpaces.threads)) {
    await redisWrite(k.redis, fromSpaces, CACHE_DAYS * 86_400);
    return fromSpaces;
  }
  return null;
}

/** The DataForSEO task: one live SERP page, top-10 organic, no AI Overview. Pure; exported for the tests. */
export function redditTask(input: RedditSearchInput): Record<string, unknown> {
  const task: Record<string, unknown> = {
    keyword: `site:reddit.com ${input.keyword}`,
    location_code: input.country.code,
    language_code: input.country.language,
    device: "desktop",
    os: "windows",
    depth: MAX_THREADS,
  };
  const param = TIME_PARAM[input.time];
  if (param) task.search_param = param;
  return task;
}

/** Buy the search, cache it, return it. Throws DataforseoError on a provider failure. */
export async function buySearch(input: RedditSearchInput, now = new Date()): Promise<RedditSearchResult> {
  const res = await seoMeteredCallResult<Parameters<typeof parseRedditSerp>[0]>(REDDIT_TENANT_ID, SERP.organicLive, redditTask(input));
  const parsed = parseRedditSerp(res.data);
  const result: RedditSearchResult = {
    keyword: input.keyword,
    countryCode: input.country.code,
    time: input.time,
    threads: parsed.threads,
    forumsBlock: parsed.forumsBlock,
    fetchedAt: now.toISOString(),
  };
  logger.info(
    { route: REDDIT_SEARCH_ROUTE, costUsd: res.billing?.costUsd ?? null, threads: result.threads.length, forums: result.forumsBlock },
    "reddit threads: search bought",
  );
  const k = keys(input, now);
  await Promise.all([redisWrite(k.redis, result, CACHE_DAYS * 86_400), spacesWrite(k.spaces, result)]);
  return result;
}

// ─── The daily budget ────────────────────────────────────────────────────────

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** USD this tool was billed since UTC midnight: the real `cost` of each call (its SeoApiCall rows). */
export async function spentTodayUsd(now = new Date()): Promise<number> {
  const agg = await prisma.seoApiCall.aggregate({
    _sum: { costUsd: true },
    where: { tenantId: REDDIT_TENANT_ID, createdAt: { gte: startOfUtcDay(now) } },
  });
  return Number(agg._sum.costUsd ?? 0);
}

/** Checked before every purchase; a purchase that starts under the budget may end a fraction of a cent over it. */
export async function budgetState(now = new Date()): Promise<{ spent: number; budget: number; exhausted: boolean }> {
  const budget = dailyBudgetUsd();
  const spent = await spentTodayUsd(now);
  return { spent, budget, exhausted: budget <= 0 || spent >= budget };
}

// ─── Leads (the CSV's email gate) ────────────────────────────────────────────

/**
 * Store the lead once per search and email (free_crawl_leads, source
 * "reddit-threads"; `domain` holds the keyword searched); with consent,
 * Brevo's double opt-in. The EU/EEA/UK rule is applied by the route.
 */
export async function recordRedditLead(input: { token: string; keyword: string; email: string; locale: string; consent: boolean }) {
  const email = input.email.trim().toLowerCase();
  const lead = await prisma.freeCrawlLead.upsert({
    where: { token_email: { token: input.token, email } },
    create: { token: input.token, email, domain: input.keyword.slice(0, 200), locale: input.locale, marketingConsent: input.consent, source: REDDIT_SRC },
    update: input.consent ? { marketingConsent: true } : {},
    select: { id: true, doiRequestedAt: true },
  });
  if (input.consent && !lead.doiRequestedAt) {
    const sent = await requestDoubleOptIn(email, input.locale, input.keyword, fetch, {
      source: REDDIT_SRC,
      redirectPath: `/free-tools/${REDDIT_SLUG}`,
    }).catch((err: Error) => {
      logger.warn({ err: err.message }, "reddit threads: Brevo double opt-in failed");
      return "skipped" as const;
    });
    if (sent === "sent") await prisma.freeCrawlLead.update({ where: { id: lead.id }, data: { doiRequestedAt: new Date() } });
  }
  return lead;
}
