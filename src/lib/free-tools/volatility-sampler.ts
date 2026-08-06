// src/lib/free-tools/volatility-sampler.ts
//
// The daily basket sample that makes the volatility tool free for everyone.
//
// COST DISCIPLINE. 30 standard-queue task_posts at depth 10, once a day —
// roughly $0.018. It is charged to the sentinel free-tools tenant like every
// other free-tools call, so it shows up in the same ledger and under the same
// daily cap. If the cap is already spent, the sample is SKIPPED rather than
// queued: a day with no sample is a gap in a chart, while a blown budget takes
// every other free tool down with it.
//
// IDEMPOTENT PER DAY. The unique index on (sampledOn, keyword, locationCode)
// means a retried tick upserts rather than duplicates, so a worker restart in
// the middle of a run cannot double-count a day.

import { prisma } from "@/lib/prisma";
import { seoMeteredCallResult } from "@/lib/dataforseo/metering";
import { SERP } from "@/lib/dataforseo/endpoints";
import { logger } from "@/infrastructure/observability/logger";
import { FREE_TOOLS_TENANT_ID, checkDailyCap } from "./spend";
import { VOLATILITY_LOCATION_CODE, basketEntries, domainOf } from "./volatility";

/** Depth 10: the tool compares top-10s, so anything deeper is money burnt. */
const SAMPLE_DEPTH = 10;

export interface SampleStats {
  posted: number;
  skipped: number;
  reason?: string;
}

/** UTC midnight for the given day — the value stored in sampledOn. */
export function utcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Post today's basket.
 *
 * Posts only: the existing serp sweep collects the results, exactly as it does
 * for the free SERP Location tool and for paid tenants. collectSamples() then
 * turns completed rows into samples on a later tick.
 */
export async function postDailyBasket(now: Date = new Date()): Promise<SampleStats> {
  const day = utcDay(now);

  const alreadyToday = await prisma.serpVolatilitySample.count({
    where: { sampledOn: day, locationCode: VOLATILITY_LOCATION_CODE },
  });
  if (alreadyToday > 0) {
    return { posted: 0, skipped: 0, reason: "already_sampled" };
  }

  const cap = await checkDailyCap(now);
  if (cap.capped) {
    logger.warn({ spent: cap.spent, cap: cap.cap }, "volatility basket skipped: daily cap reached");
    return { posted: 0, skipped: basketEntries().length, reason: "daily_cap" };
  }

  let posted = 0;
  let skipped = 0;

  for (const entry of basketEntries()) {
    try {
      const result = await seoMeteredCallResult<unknown[]>(
        FREE_TOOLS_TENANT_ID,
        SERP.organicTaskPost,
        {
          keyword: entry.keyword,
          location_code: VOLATILITY_LOCATION_CODE,
          language_code: "en",
          device: "desktop",
          os: "windows",
          priority: 1,
          depth: SAMPLE_DEPTH,
        },
      );

      await prisma.serpCheck.create({
        data: {
          tenantId: FREE_TOOLS_TENANT_ID,
          keyword: entry.keyword,
          locationCode: VOLATILITY_LOCATION_CODE,
          languageCode: "en",
          device: "desktop",
          dataforseoTaskId: result.taskId ?? null,
          status: "queued",
          costUsd: result.billing.costUsd,
        },
      });
      posted += 1;
    } catch (err) {
      // One keyword failing must not abandon the other 29.
      skipped += 1;
      logger.error({ err, keyword: entry.keyword }, "volatility basket post failed");
    }
  }

  return { posted, skipped };
}

/**
 * Turn completed basket checks into today's samples.
 *
 * Reads the SerpCheck rows the sweep has completed and writes one sample per
 * keyword. Runs on every tick because the standard queue resolves minutes after
 * the post, so posting and collecting cannot be the same pass.
 */
export async function collectSamples(now: Date = new Date()): Promise<number> {
  const day = utcDay(now);
  const keywords = new Set(basketEntries().map((e) => e.keyword));
  const categoryOf = new Map(basketEntries().map((e) => [e.keyword, e.category]));

  const checks = await prisma.serpCheck.findMany({
    where: {
      tenantId: FREE_TOOLS_TENANT_ID,
      locationCode: VOLATILITY_LOCATION_CODE,
      status: "completed",
      createdAt: { gte: day },
    },
    orderBy: { createdAt: "desc" },
    select: { keyword: true, results: true },
  });

  let written = 0;
  const seen = new Set<string>();

  for (const check of checks) {
    if (!keywords.has(check.keyword) || seen.has(check.keyword)) continue;
    seen.add(check.keyword);

    const items = (check.results as { items?: { url?: unknown }[] } | null)?.items;
    if (!Array.isArray(items)) continue;

    // Domains, not URLs: a site reorganising its own paths is not volatility.
    const topDomains = items
      .slice(0, 10)
      .map((i) => domainOf(String(i.url ?? "")))
      .filter(Boolean);
    if (topDomains.length === 0) continue;

    await prisma.serpVolatilitySample.upsert({
      where: {
        sampledOn_keyword_locationCode: {
          sampledOn: day,
          keyword: check.keyword,
          locationCode: VOLATILITY_LOCATION_CODE,
        },
      },
      create: {
        sampledOn: day,
        category: categoryOf.get(check.keyword) ?? "tech",
        keyword: check.keyword,
        locationCode: VOLATILITY_LOCATION_CODE,
        topDomains,
      },
      // Re-collecting the same day refreshes rather than duplicates.
      update: { topDomains },
    });
    written += 1;
  }

  return written;
}
