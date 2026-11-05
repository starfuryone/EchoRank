/**
 * GET /api/seo/v1/crawl/[id]/pages/[pageId] — one crawled page for the Pages
 * view's detail panel: its fields, page score, the findings on it (rule,
 * kind, priority, evidence; legacy rows mapped to their rule), its joined
 * metrics and its extraction values. Inlinks have their own keyset-paged
 * route (./inlinks).
 *
 * Tenant-scoped through the parent crawl (id + tenantId); a page of another
 * crawl or workspace is a 404.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { RULE_BY_ID } from "@/lib/crawl-rules";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { archivedGuard, crawlRouteError } from "@/lib/site-crawler/http";
import { DATA_STATE_SELECT } from "@/lib/site-crawler/data-state";
import { ruleIdOf } from "@/lib/site-crawler/legacy-map";

/** Findings listed per page; the rule's own list has the rest. */
const ISSUES_MAX = 200;
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; pageId: string }> }) {
  try {
    const tenant = await requirePaidPlan();
    const { id, pageId } = await params;
    // The crawl first: an archived crawl's pages are not in Postgres (409 ARCHIVED, not 404).
    const crawl = await prisma.crawlJob.findFirst({ where: { id, tenantId: tenant.tenantId }, select: DATA_STATE_SELECT });
    if (crawl) {
      const archived = archivedGuard(crawl);
      if (archived) return archived;
    }
    const page = await prisma.crawlPage.findFirst({
      where: { id: pageId, crawlJobId: id, crawlJob: { tenantId: tenant.tenantId } },
      select: {
        id: true,
        url: true,
        statusCode: true,
        title: true,
        metaDescription: true,
        h1First: true,
        wordCount: true,
        depth: true,
        canonical: true,
        noindex: true,
        redirectTarget: true,
        contentType: true,
        fetchMs: true,
        inlinkCount: true,
        internalLinks: true,
        inSitemap: true,
        foundOn: true,
        linkScore: true,
        pageScore: true,
        issueTotal: true,
        issueHigh: true,
        issues: { select: { id: true, ruleId: true, type: true, kind: true, priority: true, evidence: true, detail: true }, take: ISSUES_MAX },
        metrics: { select: { source: true, data: true } },
        extractions: { select: { kind: true, extractorIndex: true, values: true }, orderBy: [{ kind: "asc" }, { extractorIndex: "asc" }] },
      },
    });
    if (!page) {
      return NextResponse.json({ error: "Page not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const issues = page.issues
      .map((i) => {
        const ruleId = ruleIdOf(i);
        const rule = ruleId ? RULE_BY_ID.get(ruleId) : undefined;
        return {
          id: i.id,
          ruleId: ruleId ?? i.type,
          kind: i.kind ?? rule?.kind ?? "issue",
          priority: i.priority ?? rule?.priority ?? "low",
          evidence: (i.evidence as Record<string, unknown> | null) ?? (i.detail ? { detail: i.detail } : {}),
        };
      })
      .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3) || a.ruleId.localeCompare(b.ruleId));

    const { issues: _raw, metrics, extractions, ...fields } = page;
    void _raw;
    return NextResponse.json({
      page: fields,
      issues,
      issuesTruncated: page.issues.length >= ISSUES_MAX,
      metrics: Object.fromEntries(metrics.map((m) => [m.source, m.data])),
      extractions: extractions.map((e) => ({ kind: e.kind, index: e.extractorIndex, values: e.values })),
    });
  } catch (err) {
    return crawlRouteError(err);
  }
}
