/**
 * GET /api/seo/v1/site-audit/history — this tenant's audits, including any
 * still crawling, plus the monthly quota line the page header shows.
 *
 * In-flight rows are included on purpose: a crawl takes minutes, so the
 * history list is where a user who navigated away finds their running audit.
 *
 * Rows carry no section payloads — the list shows score, pages and status, and
 * 50 audits × a 100-row page table is a needlessly large body. Clicking a row
 * fetches the full audit from [id].
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { siteAuditRouteError } from "@/lib/site-audit/http";
import { buildUsage } from "@/lib/site-audit/usage";
import type {
  SiteAuditHistoryRow,
  SiteAuditStatus,
  SummarySection,
} from "@/lib/site-audit/types";

const HISTORY_LIMIT = 50;

export async function GET() {
  try {
    const tenant = await requirePaidPlan();

    const [rows, usage] = await Promise.all([
      prisma.siteAudit.findMany({
        where: { tenantId: tenant.tenantId },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
        select: {
          id: true,
          domain: true,
          status: true,
          summary: true,
          pagesCrawled: true,
          maxPages: true,
          costUsd: true,
          createdAt: true,
        },
      }),
      buildUsage(tenant.tenantId, tenant.tenant.planType),
    ]);

    const audits: SiteAuditHistoryRow[] = rows.map((row) => ({
      id: row.id,
      domain: row.domain,
      status: row.status as SiteAuditStatus,
      onPageScore: (row.summary as SummarySection | null)?.onPageScore ?? null,
      pagesCrawled: row.pagesCrawled,
      maxPages: row.maxPages,
      costUsd: Number(row.costUsd),
      createdAt: row.createdAt.toISOString(),
    }));

    return NextResponse.json({ audits, usage });
  } catch (err) {
    return siteAuditRouteError(err);
  }
}
