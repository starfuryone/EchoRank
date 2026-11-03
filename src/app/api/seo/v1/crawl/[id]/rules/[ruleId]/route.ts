/**
 * GET /api/seo/v1/crawl/[id]/rules/[ruleId] — the URLs one rule fired on,
 * with each finding's evidence. Paginated (`page`, `pageSize` ≤ 200).
 *
 * The rule id is validated against the registry: an unknown id is a 400, not
 * an empty page that reads like "no problems". Pre-3a rows match through
 * their legacy type (rule-summary.ts ruleIssueWhere).
 *
 * `?format=csv` streams every finding (keyset, capped like every export):
 * URL, status, rule, evidence (csv-columns.ts RULE_PAGE_COLUMNS).
 *
 * Tenant-scoped on the parent crawl (id + tenantId).
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { RULE_BY_ID } from "@/lib/crawl-rules";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { ruleIssueWhere } from "@/lib/site-crawler/rule-summary";
import { csvFilename } from "@/lib/csv-export";
import { csvStreamResponse, wantsCsv } from "@/lib/csv-stream";
import { RULE_PAGE_COLUMNS, withSegmentColumn, type RulePageRow } from "@/lib/site-crawler/csv-columns";
import { issueInSegment, segmentScope } from "@/lib/site-crawler/segment-filter";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id, ruleId } = await params;
    const crawl = await prisma.crawlJob.findFirst({
      where: { id, tenantId: tenant.tenantId },
      select: { id: true, config: true },
    });
    if (!crawl) {
      return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    }
    if (!RULE_BY_ID.has(ruleId)) {
      return NextResponse.json({ error: "Unknown rule", code: "INVALID_REQUEST" }, { status: 400 });
    }

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE),
    );
    const segment = segmentScope(url, crawl.config);
    const where = { ...ruleIssueWhere(crawl.id, ruleId), ...issueInSegment(segment) };

    // After validation and the tenant-scoped lookup, so CSV inherits both.
    if (wantsCsv(url)) {
      return csvStreamResponse<RulePageRow>({
        columns: withSegmentColumn(RULE_PAGE_COLUMNS, segment.defs, (r) => r.crawlPage.segmentIds),
        filename: csvFilename(`site-crawler-${ruleId.replace(/[^a-z0-9]+/g, "-")}`),
        cursorOf: (r) => r.id,
        fetchPage: (cursor, take) =>
          prisma.crawlIssue.findMany({
            where: { ...where, ...(cursor ? { id: { gt: cursor } } : {}) },
            orderBy: { id: "asc" },
            take,
            select: {
              id: true,
              ruleId: true,
              type: true,
              evidence: true,
              detail: true,
              crawlPage: { select: { url: true, statusCode: true, foundOn: true, segmentIds: true } },
            },
          }),
      });
    }
    const [total, rows] = await Promise.all([
      prisma.crawlIssue.count({ where }),
      prisma.crawlIssue.findMany({
        where,
        select: {
          id: true,
          evidence: true,
          detail: true,
          crawlPage: { select: { id: true, url: true, statusCode: true, foundOn: true } },
        },
        orderBy: { id: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      ruleId,
      rows: rows.map((r) => ({
        id: r.id,
        pageId: r.crawlPage.id,
        url: r.crawlPage.url,
        statusCode: r.crawlPage.statusCode,
        foundOn: r.crawlPage.foundOn,
        evidence: (r.evidence as Record<string, unknown> | null) ?? (r.detail ? { detail: r.detail } : {}),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    return crawlRouteError(err);
  }
}
