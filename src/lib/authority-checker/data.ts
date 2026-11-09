// src/lib/authority-checker/data.ts — the Link Authority Checker's three
// DataForSEO purchases, each cached per domain for CACHE_DAYS.
//
//   bulk_ranks   Echorank Authority (rank_scale one_hundred) for every domain
//                of a check in ONE call — only the domains not in cache.
//   summary      referring domains, backlinks, dofollow share (one per domain).
//   referring_domains  the top 10, strongest first.
//
// CACHE, TWO LAYERS, SHARED ACROSS TENANTS: a hit costs nobody anything. Redis
// (src/lib/free-tools/cache.ts) answers first; the shared cross-feature Spaces
// store (src/lib/spaces-cache.ts) second; then DataForSEO. Both writes are
// fail-open. Values are wrapped ({ v }) so "the index has no rank for this
// domain" is cached too, not bought again. The keys are the free tool's, so
// what it cached before 2026-11-09 is still served.
//
// METERED TO THE TENANT, like every other DataForSEO tool: one SeoApiCall row
// per call, with the response's real cost, under the feature "link_authority"
// (LINK_AUTHORITY_FEATURE). That feature is outside the pooled search quota
// and outside the shared SEO USD budget (OWN_CAP_FEATURES): a check draws on
// its own monthly allowance (quota.ts), the Keyword Opportunity Finder's
// pattern (keyword-opportunity/metering.ts).

import "server-only";

import { logger } from "@/infrastructure/observability/logger";
import { BACKLINKS } from "@/lib/dataforseo/endpoints";
import { DataforseoError, archivedResult, postTask, type ApiResult } from "@/lib/dataforseo/client";
import { recordCall } from "@/lib/dataforseo/metering";
import { runWithPurchaseContext } from "@/lib/purchase-archive/context";
import {
  backlinksSummaryTask,
  parseBacklinksSummary,
  type BacklinksSummaryItem,
} from "@/lib/dataforseo/backlinks-summary";
import { parseReferringDomains } from "@/lib/backlinks/parse";
import { cacheKey as redisKey, readCache as redisRead, writeCache as redisWrite } from "@/lib/free-tools/cache";
import { cacheKey as spacesKey, dateBucket, readCache as spacesRead, writeCache as spacesWrite } from "@/lib/spaces-cache";
import { CACHE_DAYS, TOP_REFERRING_DOMAINS } from "./config";
import type { LinkMetrics, ReferringDomainRow } from "./types";

/** The feature every SeoApiCall row of this tool carries. */
export const LINK_AUTHORITY_FEATURE = "link_authority" as const;

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

// ─── The metered call ────────────────────────────────────────────────────────

/**
 * One DataForSEO call billed to the tenant: the purchase archive first (cost
 * 0, as every metered tool does), then the live call. Charged-but-failed
 * calls are recorded with their cost; an uncharged failure with 0.
 */
export async function laMeteredCall<T>(tenantId: string, path: string, task: Record<string, unknown>): Promise<ApiResult<T>> {
  const ctx = { tenantId, purpose: LINK_AUTHORITY_FEATURE };
  const archived = await archivedResult<T>(path, task, ctx);
  if (archived) {
    await recordCall({ tenantId, feature: LINK_AUTHORITY_FEATURE, path, costUsd: 0, ok: true });
    return archived;
  }
  try {
    const result = await runWithPurchaseContext(ctx, () => postTask<T>(path, task));
    await recordCall({ tenantId, feature: LINK_AUTHORITY_FEATURE, path, costUsd: result.billing.costUsd, ok: true });
    return result;
  } catch (err) {
    const billed = err instanceof DataforseoError && err.billing ? err.billing.costUsd : 0;
    await recordCall({ tenantId, feature: LINK_AUTHORITY_FEATURE, path, costUsd: billed, ok: false }).catch(() => {});
    logger.warn({ tenantId, path, err: err instanceof Error ? err.message : String(err) }, "link authority: DataForSEO call failed");
    throw err;
  }
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

// ─── Reads (free) and purchases (metered to the tenant) ──────────────────────

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
export async function buyRanks(tenantId: string, domains: string[], now = new Date()): Promise<Record<string, number | null>> {
  if (domains.length === 0) return {};
  const res = await laMeteredCall<{ items?: { target?: string; rank?: number | null }[] }[]>(tenantId, BACKLINKS.bulkRanks, {
    targets: domains,
    rank_scale: RANK_SCALE,
  });
  const ranks = parseBulkRanks(res.data, domains);
  for (const d of domains) await writeCached("rank", d, ranks[d], now);
  return ranks;
}

export async function cachedLinks(domain: string, now = new Date()): Promise<LinkMetrics | null> {
  return (await readCached<LinkMetrics>("links", domain, now))?.v ?? null;
}

export async function buyLinks(tenantId: string, domain: string, now = new Date()): Promise<LinkMetrics> {
  const res = await laMeteredCall<BacklinksSummaryItem[]>(tenantId, BACKLINKS.summary, {
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

export async function buyRefDomains(tenantId: string, domain: string, now = new Date()): Promise<ReferringDomainRow[]> {
  const res = await laMeteredCall<{ items?: unknown[]; total_count?: number }[]>(tenantId, BACKLINKS.referringDomains, {
    target: domain,
    // Rows are billed: buy exactly the ten the report shows, strongest first.
    limit: TOP_REFERRING_DOMAINS,
    include_subdomains: true,
    backlinks_status_type: "live",
    order_by: ["rank,desc"],
    rank_scale: RANK_SCALE,
  });
  const rows = refDomainsFromResult(res.data);
  await writeCached("refdomains", domain, rows, now);
  return rows;
}
