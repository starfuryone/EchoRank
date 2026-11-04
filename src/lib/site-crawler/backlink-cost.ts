// src/lib/site-crawler/backlink-cost.ts — the backlink opt-in's estimate
// (Phase 4d): N pages × the last metered unit cost of backlinks/summary/live,
// against what is left of the tenant's monthly SEO data budget.

import "server-only";
import { prisma } from "@/lib/prisma";
import { BACKLINKS } from "@/lib/dataforseo/endpoints";
import { monthlyCapUsd, spentThisMonth } from "@/lib/dataforseo/metering";

/** Observed on backlinks/summary/live (fixtures/dataforseo/v3-backlinks-summary-live.json): the estimate before any call is metered. */
export const OBSERVED_BACKLINK_UNIT_USD = 0.024036;

/** The last metered unit cost of a backlinks summary (any tenant), else the observed one. */
export async function backlinkUnitCostUsd(): Promise<number> {
  const last = await prisma.seoApiCall.findFirst({
    where: { path: BACKLINKS.summary, ok: true, costUsd: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    select: { costUsd: true },
  });
  return last ? Number(last.costUsd) : OBSERVED_BACKLINK_UNIT_USD;
}

export async function seoBudgetLeftUsd(tenantId: string): Promise<number> {
  const [cap, spent] = await Promise.all([monthlyCapUsd(tenantId), spentThisMonth(tenantId)]);
  return Math.max(0, Math.round((cap - spent) * 100) / 100);
}
