// src/lib/historical/page-data.ts
//
// Everything the Historical page needs for its first paint, read server-side.
//
// SERP history is a plain Prisma read over rows the tenant already paid for —
// no DataForSEO call happens anywhere in this file, which is the v1 promise.

import { prisma } from "@/lib/prisma";
import type { SerpResultItem } from "@/lib/serp/types";
import { listSnapshotUrls } from "./snapshots";
import { isSpacesConfigured } from "./spaces";
import { bestByDomain, trackedDomains, DEFAULT_DELTA_DEPTH } from "./serp-delta";

export interface HistoricalCheck {
  id: string;
  createdAt: string;
  itemCount: number;
  /** Top-10 only. The full 100 would be ~40 KB per check in the payload. */
  top: Array<{ domain: string; position: number; url: string; title: string }>;
}

export interface HistoricalKeyword {
  keyword: string;
  locationCode: number;
  languageCode: string;
  device: string;
  checkCount: number;
  latestAt: string;
}

export interface HistoricalPageData {
  keywords: HistoricalKeyword[];
  snapshotUrls: Array<{ url: string; count: number; latest: string }>;
  storageConfigured: boolean;
  /** DataForSEO Labs panel is hidden entirely when creds are absent. */
  keywordHistoryAvailable: boolean;
}

/** One entry per distinct query the tenant has ever checked. */
export async function listHistoricalKeywords(tenantId: string): Promise<HistoricalKeyword[]> {
  const rows = await prisma.serpCheck.findMany({
    where: { tenantId, status: "completed" },
    orderBy: { createdAt: "desc" },
    select: {
      keyword: true,
      locationCode: true,
      languageCode: true,
      device: true,
      createdAt: true,
    },
  });

  const byQuery = new Map<string, HistoricalKeyword>();
  for (const row of rows) {
    const key = `${row.keyword}|${row.locationCode}|${row.languageCode}|${row.device}`;
    const prior = byQuery.get(key);
    if (prior) {
      prior.checkCount++;
    } else {
      byQuery.set(key, {
        keyword: row.keyword,
        locationCode: row.locationCode,
        languageCode: row.languageCode,
        device: row.device,
        checkCount: 1,
        latestAt: row.createdAt.toISOString(),
      });
    }
  }

  return [...byQuery.values()].sort(
    (a, b) => b.checkCount - a.checkCount || b.latestAt.localeCompare(a.latestAt),
  );
}

/** Chronological checks for one exact query, with their top-10 extracted. */
export async function loadCheckTimeline(
  tenantId: string,
  query: { keyword: string; locationCode: number; languageCode: string; device: string },
): Promise<{ checks: HistoricalCheck[]; domains: string[] }> {
  const rows = await prisma.serpCheck.findMany({
    where: {
      tenantId,
      keyword: query.keyword,
      locationCode: query.locationCode,
      languageCode: query.languageCode,
      device: query.device,
      status: "completed",
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true, itemCount: true, results: true },
  });

  const withItems = rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    itemCount: row.itemCount ?? 0,
    items: (((row.results as { items?: SerpResultItem[] } | null)?.items ?? []) as SerpResultItem[]),
  }));

  const checks: HistoricalCheck[] = withItems.map((c) => ({
    id: c.id,
    createdAt: c.createdAt.toISOString(),
    itemCount: c.itemCount,
    top: [...bestByDomain(c.items, DEFAULT_DELTA_DEPTH).entries()]
      .map(([domain, best]) => ({ domain, position: best.position, url: best.url, title: best.title }))
      .sort((a, b) => a.position - b.position),
  }));

  return { checks, domains: trackedDomains(withItems, DEFAULT_DELTA_DEPTH) };
}

/** True only when both DataForSEO credentials are present. */
export function hasDataforseoCredentials(): boolean {
  return Boolean(process.env.DATAFORSEO_LOGIN?.trim() && process.env.DATAFORSEO_PASSWORD?.trim());
}

export async function loadHistoricalPageData(tenantId: string): Promise<HistoricalPageData> {
  const [keywords, snapshotUrls] = await Promise.all([
    listHistoricalKeywords(tenantId),
    // A Spaces outage must not blank the SERP half of the page.
    listSnapshotUrls(tenantId).catch(() => []),
  ]);

  return {
    keywords,
    snapshotUrls,
    storageConfigured: isSpacesConfigured(),
    keywordHistoryAvailable: hasDataforseoCredentials(),
  };
}
