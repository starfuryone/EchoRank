/**
 * POST /api/seo/v1/keywords/overview
 * Body: { keywords: string[], locationCode: number, languageCode: string }
 *
 * Phase 0 smoke route. Guard chain: requireTenant → requirePaidPlan →
 * monthly cap (inside seoMeteredCall) → 7 d cache → DataForSEO → meter.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 *
 * ASSUMPTIONS to verify on repo:
 *  - tenant resolution helper name/shape (`requireTenant` from "@/lib/tenant")
 *  - `requirePaidPlan` signature in "@/lib/paid-plan"
 * Adjust the two imports below to the repo's actual helpers.
 */

import { NextResponse } from "next/server";
import { requireSeoQuota, SeoQuotaExceededError } from "@/lib/seo-quota";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { LABS } from "@/lib/dataforseo/endpoints";
import { seoMeteredCall, seoErrorResponse } from "@/lib/dataforseo/metering";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // keyword overview: 7 d

const BodySchema = z.object({
  keywords: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
  locationCode: z.number().int().positive().default(2124), // Canada
  languageCode: z.string().min(2).max(5).default("en"),
});

export async function POST(request: Request) {
  // Throws PaidPlanRequiredError when not ACTIVE; returns the membership.
  const tenant = await requirePaidPlan();

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", code: "INVALID_REQUEST", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { keywords, locationCode, languageCode } = parsed.data;

  // Cache lookup — one row per keyword; only fetch the misses.
  const now = Date.now();
  const cached = await prisma.seoKeywordOverviewCache.findMany({
    where: { tenantId: tenant.tenantId, keyword: { in: keywords }, locationCode, languageCode },
  });
  const fresh = cached.filter(
    (row) => now - new Date(row.fetchedAt).getTime() < CACHE_TTL_MS,
  );
  const freshKeywords = new Set(fresh.map((row) => row.keyword));
  const misses = keywords.filter((k) => !freshKeywords.has(k));

  let fetched: unknown[] = [];
  if (misses.length > 0) {
    try {
      // Pooled monthly search quota. Checked only when there are cache misses:
      // a fully-cached request spends nothing upstream, so an exhausted tenant
      // still gets the keywords they already paid for.
      await requireSeoQuota(tenant.tenantId, tenant.tenant.planType, "keyword_research");

      const result = await seoMeteredCall<{ items?: unknown[] }[]>(
        tenant.tenantId,
        LABS.keywordOverview,
        {
          keywords: misses,
          location_code: locationCode,
          language_code: languageCode,
          include_serp_info: false,
        },
      );
      fetched = result[0]?.items ?? [];

      // Upsert cache rows keyed by keyword.
      await Promise.all(
        fetched.map((item) => {
          const keyword = (item as { keyword?: string }).keyword;
          if (!keyword) return Promise.resolve();
          return prisma.seoKeywordOverviewCache.upsert({
            where: {
              tenantId_keyword_locationCode_languageCode: {
                tenantId: tenant.tenantId,
                keyword,
                locationCode,
                languageCode,
              },
            },
            create: {
              tenantId: tenant.tenantId,
              keyword,
              locationCode,
              languageCode,
              payload: item as object,
            },
            update: { payload: item as object, fetchedAt: new Date() },
          });
        }),
      );
    } catch (err) {
      if (err instanceof SeoQuotaExceededError) {
        return NextResponse.json(err.toBody(), { status: err.statusCode });
      }
      const { status, body } = seoErrorResponse(err);
      // Partial success: return whatever the cache had alongside the error.
      return NextResponse.json(
        { ...body, items: fresh.map((row) => row.payload), partial: fresh.length > 0 },
        { status },
      );
    }
  }

  return NextResponse.json({
    items: [...fresh.map((row) => row.payload), ...fetched],
    cacheHits: fresh.length,
    fetched: misses.length,
  });
}
