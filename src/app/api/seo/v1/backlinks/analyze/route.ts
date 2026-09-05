/**
 * POST /api/seo/v1/backlinks/analyze — analyze one target's link profile.
 * Body: { target, mode }.
 *
 * Synchronous by design: the five DataForSEO calls this runs are all LIVE mode
 * (the Backlinks family has no standard queue), so the response carries the
 * finished analysis rather than a job id.
 *
 * Guard chain: requirePaidPlan (session + tenant + ACTIVE billing) → zod →
 * target normalization → plan gate → TIER CAPABILITY (scope and filters) →
 * request rate limit → stored row → shared Spaces cache → monthly per-plan
 * quota (Redis) → monthly USD cap (inside seoMeteredCall) → DataForSEO → meter.
 *
 * THE CAPABILITY CHECK LIVES IN THE SERVICE, not here, and this route does not
 * duplicate it. Three callers reach runAnalysis — this route, the e2e script
 * and the tests — and a gate that exists at one of them is a gate that will be
 * missed at the next. What this route does is shape the request; the service
 * decides whether the tier may have it.
 *
 * Every cost gate runs BEFORE the first live call.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeTarget, BACKLINKS_MODES } from "@/lib/backlinks/target";
import { runAnalysis } from "@/lib/backlinks/service";
import { backlinksRouteError } from "@/lib/backlinks/http";
import { buildUsage } from "@/lib/backlinks/usage";
import { backlinksCapability } from "@/lib/backlinks/options";
import { readBacklinkHistory } from "@/lib/backlinks/snapshots";

/** Analyses per tenant per minute — a floor under the monthly allowance, which
 * for GROWTH is only 25 and could otherwise be burned in one burst. */
const SUBMIT_RATE_LIMIT = 5;
const SUBMIT_RATE_WINDOW_MS = 60_000;

/** Full tier only. A Basic request carrying these is refused, not ignored. */
const ListFiltersSchema = z.object({
  include: z.string().trim().max(200).optional(),
  exclude: z.string().trim().max(200).optional(),
  linkType: z.enum(["dofollow", "nofollow"]).optional(),
  minDomainRank: z.coerce.number().int().min(0).max(1000).optional(),
  maxDomainRank: z.coerce.number().int().min(0).max(1000).optional(),
  tld: z.string().trim().max(30).optional(),
  hideLost: z.boolean().optional(),
  hideBroken: z.boolean().optional(),
});

const BodySchema = z.object({
  target: z.string().trim().min(1).max(2000),
  mode: z.enum(BACKLINKS_MODES).default("domain"),
  listFilters: ListFiltersSchema.optional(),
});

export async function POST(request: Request) {
  try {
    // Throws PaidPlanRequiredError when not ACTIVE; returns the membership.
    const tenant = await requirePaidPlan();

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", code: "INVALID_REQUEST", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    // Throws InvalidTargetError (-> 400) before anything can cost money.
    const target = normalizeTarget(parsed.data.target, parsed.data.mode);

    const limited = await rateLimit(
      `backlinks:${tenant.tenantId}`,
      SUBMIT_RATE_LIMIT,
      SUBMIT_RATE_WINDOW_MS,
    );
    if (!limited.success) {
      return NextResponse.json(
        { error: "Too many analyses in a row. Wait a minute.", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    const { analysis, cached } = await runAnalysis(
      tenant.tenantId,
      tenant.tenant.planType,
      {
        target,
        mode: parsed.data.mode,
        // Undefined rather than an empty object when nothing was filtered:
        // the service treats "filters present" as a Full-tier request, and an
        // empty object would refuse a Basic tenant who filtered nothing.
        listFilters:
          parsed.data.listFilters && Object.keys(parsed.data.listFilters).length > 0
            ? parsed.data.listFilters
            : undefined,
      },
    );

    // Read AFTER the run so the page's quota line reflects this analysis, and
    // so the sparkline includes the point this run just recorded.
    const capability = backlinksCapability(tenant.tenant.planType);
    const [usage, snapshots] = await Promise.all([
      buildUsage(tenant.tenantId, tenant.tenant.planType),
      // GATED HERE AS WELL AS IN THE COMPONENT. The write happens on every
      // tier — the data is already paid for — but a Basic response must not
      // carry a series the tier has not bought the right to see.
      capability.history
        ? readBacklinkHistory(tenant.tenantId, target, parsed.data.mode)
        : Promise.resolve([]),
    ]);

    return NextResponse.json({ analysis: { ...analysis, snapshots }, cached, usage });
  } catch (err) {
    return backlinksRouteError(err);
  }
}
