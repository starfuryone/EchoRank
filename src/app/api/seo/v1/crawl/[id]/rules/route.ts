/**
 * GET /api/seo/v1/crawl/[id]/rules — the Issues tab: one row per rule that
 * fired, with its kind, priority, the number of URLs it fired on and the share
 * of the crawl that is. Old crawls are tallied from crawl_issues
 * (rule-summary.ts); a rule that never fired is absent, not a zero row.
 *
 * Tenant-scoped on the parent crawl (id + tenantId).
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { KIND_ORDER, PRIORITY_ORDER, RULE_BY_ID } from "@/lib/crawl-rules";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { ruleTalliesFor } from "@/lib/site-crawler/rule-summary";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;
    const crawl = await prisma.crawlJob.findFirst({
      where: { id, tenantId: tenant.tenantId },
      select: { id: true, pagesCrawled: true, summary: true },
    });
    if (!crawl) {
      return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const { issues, issuesByKind } = await ruleTalliesFor(crawl.id, crawl.summary);
    const rules = Object.entries(issues)
      .map(([ruleId, t]) => ({
        ruleId,
        family: RULE_BY_ID.get(ruleId)?.family ?? null,
        kind: t.kind,
        priority: t.priority,
        urls: t.count,
        share: crawl.pagesCrawled > 0 ? Math.round((t.count / crawl.pagesCrawled) * 1000) / 10 : 0,
      }))
      .sort(
        (a, b) =>
          KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
          PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) ||
          b.urls - a.urls ||
          a.ruleId.localeCompare(b.ruleId),
      );

    return NextResponse.json({ pagesCrawled: crawl.pagesCrawled, issuesByKind, rules });
  } catch (err) {
    return crawlRouteError(err);
  }
}
