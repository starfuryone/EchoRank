/**
 * POST /api/seo/v1/backlinks/analyze — analyze one target's link profile.
 * Body: { target, mode }.
 *
 * Synchronous by design: the five DataForSEO calls this runs are all LIVE mode
 * (the Backlinks family has no standard queue), so the response carries the
 * finished analysis rather than a job id.
 *
 * Guard chain: requirePaidPlan (session + tenant + ACTIVE billing) → zod →
 * target normalization → plan gate (STARTER is locked) →
 * request rate limit → 24 h cache → monthly per-plan quota (Redis) → monthly
 * USD cap (inside seoMeteredCall) → DataForSEO → meter.
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

/** Analyses per tenant per minute — a floor under the monthly allowance, which
 * for GROWTH is only 25 and could otherwise be burned in one burst. */
const SUBMIT_RATE_LIMIT = 5;
const SUBMIT_RATE_WINDOW_MS = 60_000;

const BodySchema = z.object({
  target: z.string().trim().min(1).max(2000),
  mode: z.enum(BACKLINKS_MODES).default("domain"),
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
      { target, mode: parsed.data.mode },
    );

    // Read AFTER the run so the page's quota line reflects this analysis.
    const usage = await buildUsage(tenant.tenantId, tenant.tenant.planType);

    return NextResponse.json({ analysis, cached, usage });
  } catch (err) {
    return backlinksRouteError(err);
  }
}
