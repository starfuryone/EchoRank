// src/lib/authority-checker/data.ts — the Website Authority Checker's three
// DataForSEO purchases, each cached per domain for CACHE_DAYS, and the tool's
// daily budget.
//
//   bulk_ranks   Echorank Authority (rank_scale one_hundred) for every domain
//                of a check in ONE call — only the domains not in cache.
//   summary      referring domains, backlinks, dofollow share (one per domain).
//   referring_domains  the top 10, strongest first (bought at email unlock).
//
// CACHE, TWO LAYERS, SAME RULE AS EVERY FREE TOOL: a hit costs nobody
// anything. Redis (src/lib/free-tools/cache.ts, always on) answers first; the
// shared cross-feature Spaces store (src/lib/spaces-cache.ts) second, so a
// domain bought here is a fact any later reader of that store can reuse; then
// DataForSEO. Both writes are fail-open. Values are wrapped ({ v }) so "the
// index has no rank for this domain" is cached too, not bought again.
//
// METERED LIKE EVERY OTHER DATAFORSEO CALL: seoMeteredCallResult writes the
// SeoApiCall row, under the sentinel AUTHORITY_TENANT_ID (config.ts). The
// daily budget sums those rows; the metering's own monthly cap
// (SEO_MONTHLY_CAP_USD_DEFAULT) also applies to that id and surfaces as the
// same "back tomorrow" answer.

import "server-only";

import { prisma } from "@/lib/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { logger } from "@/infrastructure/observability/logger";
import { BACKLINKS } from "@/lib/dataforseo/endpoints";
import { seoMeteredCallResult } from "@/lib/dataforseo/metering";
import {
  backlinksSummaryTask,
  parseBacklinksSummary,
  type BacklinksSummaryItem,
} from "@/lib/dataforseo/backlinks-summary";
import { parseReferringDomains } from "@/lib/backlinks/parse";
import { cacheKey as redisKey, readCache as redisRead, writeCache as redisWrite } from "@/lib/free-tools/cache";
import { utcDayStamp } from "@/lib/free-tools/limits";
import { cacheKey as spacesKey, dateBucket, readCache as spacesRead, writeCache as spacesWrite } from "@/lib/spaces-cache";
import { postMatrixAlert } from "@/lib/matrix/alert";
import {
  AUTHORITY_TENANT_ID,
  BUDGET_ALERT_SHARE,
  CACHE_DAYS,
  TOP_REFERRING_DOMAINS,
  dailyBudgetUsd,
} from "./config";
import type { LinkMetrics, ReferringDomainRow } from "./types";

type Kind = "rank" | "links" | "refdomains";
type Wrapped<T> = { v: T };

const RANK_SCALE = "one_hundred";

function keys(kind: Kind, domain: string, now: Date) {
  return {
    redis: redisKey("authority", kind, domain),
    spaces: spacesKey({ feature: `authority-${kind}`, version: "v1", scope: RANK_SCALE, target: domain, dateBucket: dateBucket(CACHE_DAYS, now) }),
  };
}

async function readCached<T>(kind: Kind, domain: string, now: Date): Promise<Wrapped<T> | null> {
  const k = keys(kind, domain, now);
  const fromRedis = await redisRead<Wrapped<T>>(k.redis);
  if (fromRedis && "v" in fromRedis) return fromRedis;
  const fromSpaces = await spacesRead<Wrapped<T>>(k.spaces);
  if (fromSpaces && "v" in fromSpaces) {
    await redisWrite(k.redis, fromSpaces, CACHE_DAYS * 86_400);
    return fromSpaces;
  }
  return null;
}

async function writeCached<T>(kind: Kind, domain: string, value: T, now: Date): Promise<void> {
  const k = keys(kind, domain, now);
  const wrapped: Wrapped<T> = { v: value };
  await Promise.all([redisWrite(k.redis, wrapped, CACHE_DAYS * 86_400), spacesWrite(k.spaces, wrapped)]);
}

// ─── Parsers (pure; exported for the tests) ──────────────────────────────────

const bare = (d: unknown) =>
  String(d ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

/** bulk_ranks items → rank per asked domain; a domain the index did not return is null. */
export function parseBulkRanks(
  result: { items?: { target?: string; rank?: number | null }[] }[] | undefined,
  asked: string[],
): Record<string, number | null> {
  const byTarget = new Map<string, number>();
  for (const item of result?.[0]?.items ?? []) {
    const rank = item.rank;
    if (typeof rank === "number" && Number.isFinite(rank)) byTarget.set(bare(item.target), Math.max(0, Math.min(100, Math.round(rank))));
  }
  return Object.fromEntries(asked.map((d) => [d, byTarget.get(d) ?? null]));
}

export function linksFromSummary(result: BacklinksSummaryItem[] | undefined): LinkMetrics {
  const s = parseBacklinksSummary(result);
  return { referringDomains: s.referringDomains, backlinks: s.backlinks, dofollowShare: s.dofollowRatio };
}

export function refDomainsFromResult(
  result: { items?: unknown[]; total_count?: number }[] | undefined,
): ReferringDomainRow[] {
  return parseReferringDomains(result as Parameters<typeof parseReferringDomains>[0])
    .items.slice(0, TOP_REFERRING_DOMAINS)
    .map((r) => ({ domain: r.domain, authority: Number.isFinite(r.rank) ? Math.round(r.rank) : null, backlinks: r.backlinks }));
}

// ─── Reads (free) and purchases (metered) ────────────────────────────────────

export async function cachedRanks(domains: string[], now = new Date()) {
  const known: Record<string, number | null> = {};
  const missing: string[] = [];
  for (const d of domains) {
    const hit = await readCached<number | null>("rank", d, now);
    if (hit) known[d] = hit.v;
    else missing.push(d);
  }
  return { known, missing };
}

/** One bulk_ranks call for every domain given. */
export async function buyRanks(domains: string[], now = new Date()): Promise<Record<string, number | null>> {
  if (domains.length === 0) return {};
  const res = await seoMeteredCallResult<{ items?: { target?: string; rank?: number | null }[] }[]>(
    AUTHORITY_TENANT_ID,
    BACKLINKS.bulkRanks,
    { targets: domains, rank_scale: RANK_SCALE },
  );
  const ranks = parseBulkRanks(res.data, domains);
  for (const d of domains) await writeCached("rank", d, ranks[d], now);
  return ranks;
}

export async function cachedLinks(domain: string, now = new Date()): Promise<LinkMetrics | null> {
  return (await readCached<LinkMetrics>("links", domain, now))?.v ?? null;
}

export async function buyLinks(domain: string, now = new Date()): Promise<LinkMetrics> {
  const res = await seoMeteredCallResult<BacklinksSummaryItem[]>(AUTHORITY_TENANT_ID, BACKLINKS.summary, {
    ...backlinksSummaryTask(domain, { includeSubdomains: true }),
    rank_scale: RANK_SCALE,
  });
  const links = linksFromSummary(res.data);
  await writeCached("links", domain, links, now);
  return links;
}

export async function cachedRefDomains(domain: string, now = new Date()): Promise<ReferringDomainRow[] | null> {
  return (await readCached<ReferringDomainRow[]>("refdomains", domain, now))?.v ?? null;
}

export async function buyRefDomains(domain: string, now = new Date()): Promise<ReferringDomainRow[]> {
  const res = await seoMeteredCallResult<{ items?: unknown[]; total_count?: number }[]>(
    AUTHORITY_TENANT_ID,
    BACKLINKS.referringDomains,
    {
      target: domain,
      // Rows are billed: buy exactly the ten the page shows, strongest first.
      limit: TOP_REFERRING_DOMAINS,
      include_subdomains: true,
      backlinks_status_type: "live",
      order_by: ["rank,desc"],
      rank_scale: RANK_SCALE,
    },
  );
  const rows = refDomainsFromResult(res.data);
  await writeCached("refdomains", domain, rows, now);
  return rows;
}

// ─── The daily budget ────────────────────────────────────────────────────────

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** USD this tool was billed since UTC midnight (its SeoApiCall rows). */
export async function spentTodayUsd(now = new Date()): Promise<number> {
  const agg = await prisma.seoApiCall.aggregate({
    _sum: { costUsd: true },
    where: { tenantId: AUTHORITY_TENANT_ID, createdAt: { gte: startOfUtcDay(now) } },
  });
  return Number(agg._sum.costUsd ?? 0);
}

export interface BudgetState {
  spent: number;
  budget: number;
  exhausted: boolean;
}

/**
 * Checked before every purchase. A purchase that starts under the budget may
 * finish a few cents over it (one check is at most ~$0.05, an unlock ~$0.1);
 * the next one is refused.
 */
export async function budgetState(now = new Date()): Promise<BudgetState> {
  const budget = dailyBudgetUsd();
  const spent = await spentTodayUsd(now);
  return { spent, budget, exhausted: budget <= 0 || spent >= budget };
}

/** The Matrix line, pure for the test. */
export function budgetAlertLine(spent: number, budget: number): string {
  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 100;
  return `Website Authority Checker: ${pct}% of today's DataForSEO budget used ($${spent.toFixed(2)} of $${budget.toFixed(2)}). New checks stop at 100% until midnight UTC.`;
}

/**
 * One Matrix alert per UTC day, once spend reaches BUDGET_ALERT_SHARE of the
 * budget. The once-a-day guard is a Redis SET NX; if Redis cannot answer, no
 * alert is sent rather than one per request. Never throws.
 */
export async function alertIfNearBudget(now = new Date()): Promise<boolean> {
  try {
    const { spent, budget } = await budgetState(now);
    // In micro-dollars: 0.8 × 3 is 2.4000000000000004 in floating point, which
    // would keep the alert silent at exactly 80%.
    if (budget <= 0 || Math.round(spent * 1e6) < Math.round(budget * BUDGET_ALERT_SHARE * 1e6)) return false;
    const first = await getRedisConnection().set(`free:authority:alert:${utcDayStamp(now)}`, "1", "EX", 2 * 86_400, "NX");
    if (first !== "OK") return false;
    return await postMatrixAlert(budgetAlertLine(spent, budget));
  } catch (err) {
    logger.debug({ err }, "authority checker: budget alert skipped");
    return false;
  }
}
