/**
 * GET /api/seo/v1/crawl/[id]/rules — the Issues tab: one row per rule that
 * fired, with its kind, priority, the number of URLs it fired on and the share
 * of the crawl that is. Old crawls are tallied from crawl_issues
 * (rule-summary.ts); a rule that never fired is absent, not a zero row.
 *
 * `?format=csv` streams the same rows (csv-columns.ts RULE_LIST_COLUMNS).
 *
 * Phase 4b: ?segment=N counts only that segment's pages (share is of the
 * segment's pages). Without it, a crawl that ran with segments also gets
 * `bySegment` per rule — findings in each segment — as columns in the CSV.",
 *
 * Tenant-scoped on the parent crawl (id + tenantId).
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { KIND_ORDER, PRIORITY_ORDER, RULE_BY_ID } from "@/lib/crawl-rules";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { computeRuleTallies, ruleTalliesFor } from "@/lib/site-crawler/rule-summary";
import { issueInSegment, pageInSegment, ruleCountsBySegment, segmentScope } from "@/lib/site-crawler/segment-filter";
import { csvFilename } from "@/lib/csv-export";
import { csvStreamResponse, wantsCsv } from "@/lib/csv-stream";
import { ruleListColumns, type RuleListRow } from "@/lib/site-crawler/csv-columns";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;
    const crawl = await prisma.crawlJob.findFirst({
      where: { id, tenantId: tenant.tenantId },
      select: { id: true, pagesCrawled: true, summary: true, config: true },
    });
    if (!crawl) {
      return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const segment = segmentScope(new URL(request.url), crawl.config);
    const filtered = segment.index !== null;
    const [{ issues, issuesByKind }, pagesInScope, bySegment] = await Promise.all([
      filtered ? computeRuleTallies(crawl.id, issueInSegment(segment)) : ruleTalliesFor(crawl.id, crawl.summary),
      filtered ? prisma.crawlPage.count({ where: { crawlJobId: crawl.id, ...pageInSegment(segment) } }) : crawl.pagesCrawled,
      filtered ? ({} as Record<string, number[]>) : ruleCountsBySegment(crawl.id, segment.defs),
    ]);
    const rules = Object.entries(issues)
      .map(([ruleId, t]) => ({
        ruleId,
        family: RULE_BY_ID.get(ruleId)?.family ?? null,
        kind: t.kind,
        priority: t.priority,
        urls: t.count,
        share: pagesInScope > 0 ? Math.round((t.count / pagesInScope) * 1000) / 10 : 0,
        ...(segment.defs.length && !filtered ? { bySegment: bySegment[ruleId] ?? segment.defs.map(() => 0) } : {}),
      }))
      .sort(
        (a, b) =>
          KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
          PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) ||
          b.urls - a.urls ||
          a.ruleId.localeCompare(b.ruleId),
      );

    if (wantsCsv(new URL(request.url))) {
      // At most one row per registry rule: one page, then done.
      return csvStreamResponse<RuleListRow>({
        columns: ruleListColumns(filtered ? [] : segment.defs),
        filename: csvFilename("site-crawler-issues-by-rule"),
        cursorOf: (r) => r.ruleId,
        fetchPage: async (cursor) => (cursor === null ? rules : []),
      });
    }

    return NextResponse.json({
      pagesCrawled: pagesInScope,
      issuesByKind,
      rules,
      segments: filtered ? [] : segment.defs.map((d) => d.name),
    });
  } catch (err) {
    return crawlRouteError(err);
  }
}
