/**
 * GET /api/seo/v1/crawl/[id]/summary — the site-wide aggregation output.
 *
 * 404 until the crawl has COMPLETED. A running crawl has no summary to give,
 * and returning a half-built one would make the Overview tab flicker between
 * wrong numbers.
 *
 * Per-rule tallies (`issues`, `issuesByKind`) come from the summary when
 * aggregation wrote them (3a+), and are computed from crawl_issues otherwise
 * (rule-summary.ts). A crawl from before Phase 2 has no summary column at all:
 * it answers `{ partial: true, issues, issuesByKind }`, the tallies alone.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { archivedGuard, crawlRouteError } from "@/lib/site-crawler/http";
import { DATA_STATE_SELECT, rowsReadable } from "@/lib/site-crawler/data-state";
import { getIssueTotals } from "@/lib/site-crawler/issue-totals";
import { metricCoverage } from "@/lib/site-crawler/metrics";
import { computeRuleTallies, ruleTalliesFor } from "@/lib/site-crawler/rule-summary";
import {
  issueInSegment,
  pageInSegment,
  segmentIssueTotals,
  segmentOverview,
  segmentScope,
} from "@/lib/site-crawler/segment-filter";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;

    const row = await prisma.crawlJob.findFirst({
      where: { id, tenantId: tenant.tenantId },
      select: { id: true, status: true, summary: true, config: true, pagesCrawled: true, ...DATA_STATE_SELECT },
    });

    if (!row || row.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "No summary for this crawl", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // Phase 4b: ?segment=N narrows the issue totals and per-rule tallies to
    // that segment's pages (`segment` says which, and how many pages). The
    // rest of the stored summary stays whole-crawl. Without it, a crawl that
    // ran with segments also gets `segments`: pages and totals per segment.
    const scope = segmentScope(new URL(request.url), row.config);
    // An archived crawl: the stored summary and its cached totals only — a
    // segment view, the per-segment overview and metric coverage all read rows.
    const hot = rowsReadable(row);
    if (scope.index !== null) {
      const archived = archivedGuard(row);
      if (archived) return archived;
      const [{ issues, issuesByKind }, totals, pages] = await Promise.all([
        computeRuleTallies(row.id, issueInSegment(scope)),
        segmentIssueTotals(row.id, scope),
        prisma.crawlPage.count({ where: { crawlJobId: row.id, ...pageInSegment(scope) } }),
      ]);
      const segment = { index: scope.index, name: scope.defs[scope.index]!.name, pages };
      if (row.summary === null) return NextResponse.json({ partial: true, issues, issuesByKind, totals, computed: true, segment });
      return NextResponse.json({ ...(row.summary as object), issues, issuesByKind, totals, computed: true, segment });
    }

    const [{ issues, issuesByKind, computed }, totals, segments] = await Promise.all([
      ruleTalliesFor(row.id, row.summary, row),
      getIssueTotals(row.id, row.summary, row),
      hot ? segmentOverview(row.id, scope.defs) : [],
    ]);
    const perSegment = segments.length ? { segments } : {};
    // Phase 4d: pages with data per joined source, for the Overview tiles.
    const metricOverview = {
      coverage: hot ? await metricCoverage(row.id) : {},
      total: row.pagesCrawled,
      status: ((row.summary as { metrics?: object } | null)?.metrics ?? {}) as object,
    };
    if (row.summary === null) return NextResponse.json({ partial: true, issues, issuesByKind, totals, computed, ...perSegment, metricOverview });
    return NextResponse.json({ ...(row.summary as object), issues, issuesByKind, totals, computed, ...perSegment, metricOverview });
  } catch (err) {
    return crawlRouteError(err);
  }
}
