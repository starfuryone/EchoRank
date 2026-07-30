// src/lib/content-explorer/service.ts
//
// One search = up to two DataForSEO Content Analysis live calls.
//
// GATE ORDER, cheapest first, every one of them before a cent is spent:
//   1. plan gate      — the tool is absent from AI_VISIBILITY entirely
//   2. 24 h cache     — free, and never touches the monthly allowance
//   3. monthly count  — Redis, per plan (10 / 50 / 200)
//   4. monthly USD    — inside seoMeteredCall
//
// THE SUMMARY SKIP. search/live is called first and summary/live only when the
// first reports total_count > 0. This is not a micro-optimization: both calls
// bill $0.024036 flat, so skipping one halves the price of a search. It is safe
// because a zero-result phrase makes summary/live return an all-zero sentiment
// distribution and an empty top_domains — verified live against "Echorank360" on
// 2026-07-30 — so the call buys literally nothing. Typos, brand names nobody has
// written about yet, and idle exploration are exactly the queries that hit this
// path, and they are the ones a tenant would most resent paying full price for.
//
// A zero-result search is still STORED and still counts against the allowance.
// It cost real money, and "nobody is writing about you" is a genuine answer that
// should not cost twice to see again.

import { prisma } from "@/lib/prisma";
import type { ContentSearch, PlanType } from "@/generated/prisma";
import { CONTENT_ANALYSIS } from "@/lib/dataforseo/endpoints";
import { seoMeteredCallResult } from "@/lib/dataforseo/metering";
import {
  CONTENT_CACHE_TTL_MS,
  MENTIONS_LIMIT,
  planCanSearchContent,
} from "./options";
import { normalizeQuery, parseSearchResult, parseSummaryResult } from "./parse";
import {
  ContentPlanLockedError,
  ContentQuotaExceededError,
  releaseContentSearch,
  reserveContentSearch,
} from "./quota";
import type {
  ContentSearchDto,
  ContentSearchListItem,
  ContentSummary,
  Mention,
  SearchAngle,
} from "./types";

export { CONTENT_CACHE_TTL_MS } from "./options";

/** Every section failed — nothing worth persisting. */
export class ContentSearchFailedError extends Error {
  readonly statusCode = 502;
  constructor() {
    super("Could not search web mentions right now");
    this.name = "ContentSearchFailedError";
  }
}

export interface ContentSearchParams {
  /** Already normalized by normalizeQuery(). */
  query: string;
  angle: SearchAngle;
}

interface StoredResults {
  totalCount: number;
  mentions: Mention[];
}

function toDto(
  row: ContentSearch,
  extra?: { cached?: boolean; now?: Date },
): ContentSearchDto {
  const results = (row.results ?? {}) as unknown as StoredResults;
  const dto: ContentSearchDto = {
    id: row.id,
    query: row.query,
    angle: row.angle as SearchAngle,
    totalCount: results.totalCount ?? 0,
    mentions: Array.isArray(results.mentions) ? results.mentions : [],
    summary: (row.summary as unknown as ContentSummary | null) ?? null,
    costUsd: Number(row.costUsd),
    createdAt: row.createdAt.toISOString(),
    cached: Boolean(extra?.cached),
  };

  if (extra?.cached) {
    const elapsed = (extra.now ?? new Date()).getTime() - row.createdAt.getTime();
    dto.reRunAvailableInMs = Math.max(CONTENT_CACHE_TTL_MS - elapsed, 0);
  }

  return dto;
}

export function toListItem(row: ContentSearch): ContentSearchListItem {
  const results = (row.results ?? {}) as unknown as StoredResults;
  return {
    id: row.id,
    query: row.query,
    angle: row.angle as SearchAngle,
    totalCount: results.totalCount ?? 0,
    mentionCount: Array.isArray(results.mentions) ? results.mentions.length : 0,
    costUsd: Number(row.costUsd),
    createdAt: row.createdAt.toISOString(),
  };
}

/** Newest search for this exact phrase inside the cache window. */
export async function findCachedSearch(
  tenantId: string,
  query: string,
  now = new Date(),
): Promise<ContentSearch | null> {
  return prisma.contentSearch.findFirst({
    where: {
      tenantId,
      query,
      createdAt: { gte: new Date(now.getTime() - CONTENT_CACHE_TTL_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** One stored search, tenant-scoped. Reopening is free — no quota, no spend. */
export async function getSearchById(
  tenantId: string,
  id: string,
): Promise<ContentSearchDto | null> {
  // findFirst with both keys, never findUnique by id alone.
  const row = await prisma.contentSearch.findFirst({ where: { id, tenantId } });
  return row ? toDto(row) : null;
}

export async function listSearches(
  tenantId: string,
  take = 20,
): Promise<ContentSearchListItem[]> {
  const rows = await prisma.contentSearch.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map(toListItem);
}

/**
 * Cache hit → the stored search. Otherwise reserve quota, run the live call(s),
 * persist, and return.
 */
export async function runSearch(
  tenantId: string,
  plan: PlanType,
  params: ContentSearchParams,
  now = new Date(),
): Promise<{ search: ContentSearchDto; cached: boolean }> {
  if (!planCanSearchContent(plan)) throw new ContentPlanLockedError(plan);

  const query = normalizeQuery(params.query);

  // 2. Cache before quota: a repeat inside 24 h must not consume an allowance.
  const cached = await findCachedSearch(tenantId, query, now);
  if (cached) {
    return { search: toDto(cached, { cached: true, now }), cached: true };
  }

  // 3. Monthly count.
  const quota = await reserveContentSearch(tenantId, plan, now);
  if (!quota.allowed) throw new ContentQuotaExceededError(quota.limit, plan);

  let reserved = true;
  try {
    const task = {
      keyword: query,
      limit: MENTIONS_LIMIT,
      offset: 0,
      search_mode: "as_is" as const,
    };

    // 4. USD cap is enforced inside this call, before the fetch.
    const searchCall = await seoMeteredCallResult<unknown>(
      tenantId,
      CONTENT_ANALYSIS.search,
      task,
    );
    const parsed = parseSearchResult(searchCall.data);
    let costUsd = searchCall.billing.costUsd;

    // THE SKIP: no matches means summary/live has nothing to summarize.
    let summary: ContentSummary | null = null;
    if (parsed.totalCount > 0) {
      try {
        const summaryCall = await seoMeteredCallResult<unknown>(
          tenantId,
          CONTENT_ANALYSIS.summary,
          { keyword: query },
        );
        summary = parseSummaryResult(summaryCall.data);
        costUsd += summaryCall.billing.costUsd;
      } catch {
        // The mentions table is the load-bearing half. Losing the summary band
        // degrades the page; failing the whole search would waste the money
        // already spent on the call that succeeded.
        summary = null;
      }
    }

    const row = await prisma.contentSearch.create({
      data: {
        tenantId,
        query,
        angle: params.angle,
        params: task,
        results: { totalCount: parsed.totalCount, mentions: parsed.mentions } as unknown as object,
        summary: (summary ?? undefined) as unknown as object | undefined,
        costUsd,
      },
    });
    reserved = false; // spent and stored — the reservation is earned

    return { search: toDto(row), cached: false };
  } finally {
    // Nothing was stored, so the tenant should not have paid an allowance for it.
    if (reserved) await releaseContentSearch(tenantId, now);
  }
}
