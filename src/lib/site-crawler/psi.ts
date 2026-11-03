// src/lib/site-crawler/psi.ts
//
// Lighthouse runs for crawled pages (Phase 3c performance rules). The crawl
// does NOT call PageSpeed Insights: it attaches runs the tenant already made
// with the Lighthouse tool, which is where PSI quota is metered. A crawled URL
// without a recent run simply gets no performance findings.
//
// Matching is by URL as each tool stores it, with and without a trailing
// slash; mobile is preferred over desktop (Google indexes mobile-first), then
// the newest run.

import "server-only";
import type { PsiAudit, PsiFacts } from "@/lib/crawl-rules";
import { prisma } from "@/lib/prisma";

/** A run older than this says little about the page as crawled today. */
export const PSI_MAX_AGE_DAYS = 30;

/** Lab metric key (LabMetric.key) → the Lighthouse audit id it came from. */
const METRIC_AUDIT: Record<string, string> = {
  FCP: "first-contentful-paint",
  LCP: "largest-contentful-paint",
  TBT: "total-blocking-time",
  CLS: "cumulative-layout-shift",
  SI: "speed-index",
};

export interface LighthouseRow {
  url: string;
  strategy: string;
  lighthouseVersion: string | null;
  fetchedAt: Date;
  metrics: unknown;
  crux: unknown;
  audits: unknown;
}

function variants(url: string): string[] {
  return url.endsWith("/") ? [url, url.replace(/\/+$/, "")] : [url, `${url}/`];
}

/**
 * One stored run → PsiFacts. Runs from before 3c have no `audits`: their five
 * lab metrics are still real measurements and are used; their opportunity
 * list is not, since it keeps only the top items with savings and no scores.
 */
export function toPsiFacts(row: LighthouseRow): PsiFacts {
  const audits: Record<string, PsiAudit> = {};
  if (row.audits && typeof row.audits === "object") {
    Object.assign(audits, row.audits as Record<string, PsiAudit>);
  } else if (Array.isArray(row.metrics)) {
    for (const m of row.metrics as { key?: string; value?: number | null; score?: number | null; display?: string }[]) {
      const id = m.key ? METRIC_AUDIT[m.key] : undefined;
      if (!id) continue;
      audits[id] = {
        score: typeof m.score === "number" ? m.score / 100 : null,
        value: typeof m.value === "number" ? m.value : null,
        display: m.display || null,
      };
    }
  }
  const crux = row.crux as { originFallback?: boolean; metrics?: { key: string; p75: number }[] } | null;
  // Field INP for THIS page only; origin-level data describes the whole site.
  const inp = crux && !crux.originFallback ? crux.metrics?.find((m) => m.key === "INP") : undefined;
  return {
    strategy: row.strategy === "desktop" ? "desktop" : "mobile",
    lighthouseVersion: row.lighthouseVersion,
    fetchedAt: row.fetchedAt.toISOString(),
    audits,
    inpP75: inp && typeof inp.p75 === "number" ? inp.p75 : null,
  };
}

/** Pick per crawl URL: mobile first, then newest. Pure, for tests. */
export function pickRuns(urls: string[], rows: LighthouseRow[]): Map<string, PsiFacts> {
  const out = new Map<string, PsiFacts>();
  for (const url of urls) {
    const keys = new Set(variants(url));
    const mine = rows
      .filter((r) => keys.has(r.url))
      .sort((a, b) => (a.strategy === b.strategy ? b.fetchedAt.getTime() - a.fetchedAt.getTime() : a.strategy === "mobile" ? -1 : 1));
    if (mine[0]) out.set(url, toPsiFacts(mine[0]));
  }
  return out;
}

/** The tenant's recent Lighthouse runs for a batch of crawled URLs. */
export async function psiFactsForUrls(tenantId: string, urls: string[], now = new Date()): Promise<Map<string, PsiFacts>> {
  if (urls.length === 0) return new Map();
  const rows = await prisma.lighthouseAudit.findMany({
    where: {
      tenantId,
      url: { in: urls.flatMap(variants) },
      fetchedAt: { gte: new Date(now.getTime() - PSI_MAX_AGE_DAYS * 86_400_000) },
    },
    select: { url: true, strategy: true, lighthouseVersion: true, fetchedAt: true, metrics: true, crux: true, audits: true },
  });
  return pickRuns(urls, rows);
}
