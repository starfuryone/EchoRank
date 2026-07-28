/**
 * POST /api/seo/v1/site-explorer/analyze — analyze one domain.
 * Body: { domain }.
 *
 * Synchronous by design: the four DataForSEO calls this runs are all LIVE mode
 * (the Labs and Backlinks families have no standard queue), each sub-second, so
 * the response carries the finished analysis rather than a job id.
 *
 * Guard chain: requirePaidPlan (session + tenant + ACTIVE billing) → domain
 * validation → request rate limit → 24 h cache → monthly per-plan quota (Redis)
 * → monthly USD cap (inside seoMeteredCall) → DataForSEO → meter.
 *
 * Every cost gate runs BEFORE the first live call.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeDomain } from "@/lib/site-explorer/domain";
import { DEFAULT_LANGUAGE_CODE, DEFAULT_LOCATION_CODE, runAnalysis } from "@/lib/site-explorer/service";
import { siteExplorerAnalysesUsed, siteExplorerLimit } from "@/lib/site-explorer/quota";
import { siteExplorerRouteError } from "@/lib/site-explorer/http";

/** Analyses per tenant per minute — a floor under the monthly allowance, which
 * for STARTER is only 5 and could otherwise be burned in one burst. */
const SUBMIT_RATE_LIMIT = 5;
const SUBMIT_RATE_WINDOW_MS = 60_000;

const BodySchema = z.object({
  domain: z.string().trim().min(1).max(253),
  locationCode: z.number().int().positive().default(DEFAULT_LOCATION_CODE),
  languageCode: z.string().trim().min(2).max(5).default(DEFAULT_LANGUAGE_CODE),
});

export async function POST(request: Request) {
  try {
    // Throws PaidPlanRequiredError when not ACTIVE; returns the membership.
    const tenant = await requirePaidPlan();

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          code: "INVALID_REQUEST",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    // Throws InvalidDomainError (-> 400) before anything can cost money.
    const domain = normalizeDomain(parsed.data.domain);

    const limited = await rateLimit(
      `site-explorer:${tenant.tenantId}`,
      SUBMIT_RATE_LIMIT,
      SUBMIT_RATE_WINDOW_MS,
    );
    if (!limited.success) {
      return NextResponse.json(
        { error: "Too many analyses in a row. Wait a minute.", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    const { analysis, cached } = await runAnalysis(tenant.tenantId, tenant.tenant.planType, {
      domain,
      locationCode: parsed.data.locationCode,
      languageCode: parsed.data.languageCode,
    });

    // Read AFTER the run so the page's quota line reflects this analysis.
    const used = await siteExplorerAnalysesUsed(tenant.tenantId);

    return NextResponse.json({
      analysis,
      cached,
      usage: {
        used,
        limit: siteExplorerLimit(tenant.tenant.planType),
        plan: tenant.tenant.planType,
      },
    });
  } catch (err) {
    return siteExplorerRouteError(err);
  }
}
