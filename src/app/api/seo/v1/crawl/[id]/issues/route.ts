/**
 * GET /api/seo/v1/crawl/[id]/issues — paginated issues, joined with page URL.
 *
 * Filterable by `severity` and `type`. Both are validated against the closed
 * sets in checks.ts rather than passed through: an unrecognized filter is a
 * 400, not a silent empty page that reads like "no issues found".
 *
 * Tenant scoping is on the PARENT: the crawl is looked up by id + tenantId
 * first, and issues are read only once that succeeds.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { ISSUE_TYPES, type IssueType, type Severity } from "@/lib/site-crawler/checks";
import { crawlRouteError } from "@/lib/site-crawler/http";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const SEVERITIES: Severity[] = ["ERROR", "WARNING", "NOTICE"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;

    const crawl = await prisma.crawlJob.findFirst({
      where: { id, tenantId: tenant.tenantId },
      select: { id: true },
    });
    if (!crawl) {
      return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const url = new URL(request.url);
    const severity = url.searchParams.get("severity");
    const type = url.searchParams.get("type");

    if (severity && !SEVERITIES.includes(severity as Severity)) {
      return NextResponse.json(
        { error: "Unknown severity", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }
    if (type && !(ISSUE_TYPES as readonly string[]).includes(type)) {
      return NextResponse.json(
        { error: "Unknown issue type", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE),
    );

    const where = {
      crawlPage: { crawlJobId: crawl.id },
      ...(severity ? { severity } : {}),
      ...(type ? { type: type as IssueType } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.crawlIssue.count({ where }),
      prisma.crawlIssue.findMany({
        where,
        // Severity is a string column, so this orders alphabetically:
        // ERROR, NOTICE, WARNING. Deliberately left as a stable, cheap sort —
        // the UI filters by severity rather than relying on rank order.
        orderBy: [{ severity: "asc" }, { type: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          type: true,
          severity: true,
          detail: true,
          crawlPage: { select: { url: true, statusCode: true } },
        },
      }),
    ]);

    return NextResponse.json({
      issues: rows.map((r) => ({
        id: r.id,
        type: r.type,
        severity: r.severity,
        detail: r.detail,
        url: r.crawlPage.url,
        statusCode: r.crawlPage.statusCode,
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
