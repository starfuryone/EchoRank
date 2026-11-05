// src/lib/site-crawler/report.ts
//
// The PDF crawl report's payload (Phase 4c, crawl.reports): everything the
// sidecar's POST /crawl-report renders, assembled here for ONE crawl of the
// signed-in tenant. Counts and capped samples only — the 20 busiest rules,
// one example finding each, the segment table, the latest comparison.

import "server-only";
import { prisma } from "@/lib/prisma";
import { RULE_BY_ID } from "@/lib/crawl-rules";
import { RULE_COPY } from "@/lib/crawl-rules-meta";
import { FAMILY_LABELS } from "@/app/[locale]/seo-spider/issues/library-html";
import { readStoredConfig } from "./crawl-config";
import { getIssueTotals } from "./issue-totals";
import { ruleIssueWhere, ruleTalliesFor } from "./rule-summary";
import { segmentOverview } from "./segment-filter";
import { evidenceCell } from "./csv-columns";
import type { ComparisonResult } from "./compare";
import { healthOf } from "./site-health";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://echorank360.com";

export const REPORT_TOP_ISSUES = 20;
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const KIND_RANK: Record<string, number> = { issue: 0, warning: 1, opportunity: 2 };

export interface CrawlReportPayload {
  host: string;
  rootUrl: string;
  crawledAt: string;
  pagesCrawled: number;
  urlCap: number;
  stoppedReason: string | null;
  renderMode: string;
  /** Site health 0–100 (site-health.ts); null on crawls from before it. */
  health: number | null;
  /** The crawl's Results view in the app (sign-in required); the PDF links to it. */
  resultsUrl: string;
  totals: { ERROR: number; WARNING: number; NOTICE: number };
  byKind: Record<string, number>;
  families: { family: string; label: string; issue: number; warning: number; opportunity: number; total: number }[];
  topIssues: { ruleId: string; name: string; kind: string; priority: string; pages: number; example: { url: string; evidence: string | null } | null }[];
  segments: { name: string; pages: number; ERROR: number; WARNING: number; NOTICE: number }[];
  compare: {
    baselineDate: string;
    counts: ComparisonResult["counts"];
    summary: ComparisonResult["summary"];
    rules: { ruleId: string; name: string; new: number; resolved: number }[];
  } | null;
}

type ReportCrawl = {
  id: string;
  rootUrl: string;
  createdAt: Date;
  pagesCrawled: number;
  urlCap: number;
  stoppedReason: string | null;
  renderMode: string;
  summary: unknown;
  config: unknown;
  storageState?: string | null;
  dataPurgedAt?: Date | null;
};

/** Rank rules: kind (issue first), then priority, then findings. */
export function topRules(issues: Record<string, { count: number; kind: string; priority: string }>, n = REPORT_TOP_ISSUES) {
  return Object.entries(issues)
    .filter(([, t]) => t.count > 0)
    .sort(([a, x], [b, y]) => (KIND_RANK[x.kind] ?? 9) - (KIND_RANK[y.kind] ?? 9) || (PRIORITY_RANK[x.priority] ?? 9) - (PRIORITY_RANK[y.priority] ?? 9) || y.count - x.count || a.localeCompare(b))
    .slice(0, n);
}

export async function crawlReportPayload(crawl: ReportCrawl): Promise<CrawlReportPayload> {
  const tallies = await ruleTalliesFor(crawl.id, crawl.summary, crawl);
  const families = new Map<string, CrawlReportPayload["families"][number]>();
  for (const [id, t] of Object.entries(tallies.issues)) {
    const family = RULE_BY_ID.get(id)?.family ?? "other";
    const row = families.get(family) ?? { family, label: FAMILY_LABELS[family as keyof typeof FAMILY_LABELS] ?? family, issue: 0, warning: 0, opportunity: 0, total: 0 };
    row[t.kind] += t.count;
    row.total += t.count;
    families.set(family, row);
  }

  const top = await Promise.all(
    topRules(tallies.issues).map(async ([ruleId, t]) => {
      const ex = await prisma.crawlIssue.findFirst({
        where: ruleIssueWhere(crawl.id, ruleId),
        orderBy: { id: "asc" },
        select: { evidence: true, detail: true, crawlPage: { select: { url: true } } },
      });
      const evidence = ex ? evidenceCell(ex) : null;
      return {
        ruleId,
        name: RULE_COPY[ruleId]?.name ?? ruleId,
        kind: t.kind,
        priority: t.priority,
        pages: t.count,
        example: ex ? { url: ex.crawlPage.url, evidence: evidence ? evidence.slice(0, 200) : null } : null,
      };
    }),
  );

  const defs = readStoredConfig(crawl.config)?.segments ?? [];
  const segments = (await segmentOverview(crawl.id, defs)).map((s) => ({ name: s.name, pages: s.pages, ...s.totals }));

  const cmp = await prisma.crawlComparison.findFirst({
    where: { jobAId: crawl.id, segmentId: null },
    orderBy: { createdAt: "desc" },
    select: { result: true, jobB: { select: { createdAt: true } } },
  });
  const result = cmp?.result as unknown as ComparisonResult | undefined;

  return {
    host: new URL(crawl.rootUrl).hostname,
    rootUrl: crawl.rootUrl,
    crawledAt: crawl.createdAt.toISOString(),
    pagesCrawled: crawl.pagesCrawled,
    urlCap: crawl.urlCap,
    stoppedReason: crawl.stoppedReason,
    renderMode: crawl.renderMode,
    health: healthOf(crawl.summary),
    resultsUrl: `${SITE}/crawler/${encodeURIComponent(crawl.id)}`,
    totals: await getIssueTotals(crawl.id, crawl.summary, crawl),
    byKind: tallies.issuesByKind,
    families: [...families.values()].sort((a, b) => b.total - a.total),
    topIssues: top,
    segments,
    compare:
      cmp && result
        ? {
            baselineDate: cmp.jobB.createdAt.toISOString(),
            counts: result.counts,
            summary: result.summary,
            rules: result.rules.slice(0, 15).map((r) => ({ ...r, name: RULE_COPY[r.ruleId]?.name ?? r.ruleId })),
          }
        : null,
  };
}
