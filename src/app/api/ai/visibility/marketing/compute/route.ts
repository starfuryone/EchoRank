/**
 * POST /api/ai/visibility/marketing/compute — the heuristic half, alone.
 * Body: { categoryId, values }.
 *
 * Runs the local analysis for a category and returns both what the user sees
 * and, for the hybrids, the exact payload the optional AI step would receive.
 * No model call, no token budget, no spend.
 *
 * WHY IT IS A SEPARATE ROUTE. Three reasons, in order of weight:
 *   1. Category 08 has no AI half at all — this is its only endpoint.
 *   2. The hybrids (05, 09, 12) show their computed result first and only call
 *      the model if the user presses the second button. Most never will.
 *   3. It makes "your pasted data never leaves this server" inspectable: the
 *      response carries the AI payload verbatim, so a tenant can read exactly
 *      what would be sent before deciding to send it.
 *
 * Deliberately NOT budget-gated: nothing here costs money, so a tenant who has
 * exhausted their monthly tokens keeps full use of the analysis tools.
 *
 * AUTHENTICATED — do not add /api/ai/visibility/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import { findMarketingCategory } from "@/lib/marketing-templates";
import { computeOnly } from "@/lib/marketing/service";
import { planCanUseMarketing, MarketingPlanLockedError } from "@/lib/marketing/quota";
import { marketingRouteError } from "@/lib/marketing/http";

/** Higher than /generate — this is CPU-only — but still bounded: the n-gram
 *  pass over a large corpus is the most expensive thing a request can do here. */
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

const BodySchema = z.object({
  categoryId: z.string().trim().min(1).max(64),
  values: z.record(z.string(), z.string().max(200_000)).default({}),
});

export async function POST(request: Request) {
  try {
    const tenant = await requirePaidPlan();

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", code: "INVALID_REQUEST", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const category = findMarketingCategory(parsed.data.categoryId);
    if (!category) {
      return NextResponse.json(
        { error: "Unknown brief type", code: "UNKNOWN_CATEGORY" },
        { status: 400 },
      );
    }

    const limited = await rateLimit(
      `marketing-compute:${tenant.tenantId}`,
      RATE_LIMIT,
      RATE_WINDOW_MS,
    );
    if (!limited.success) {
      return NextResponse.json(
        { error: "Too many requests — try again in a minute", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    if (!planCanUseMarketing(tenant.tenant.planType)) {
      throw new MarketingPlanLockedError(tenant.tenant.planType);
    }

    return NextResponse.json(computeOnly(category, parsed.data.values));
  } catch (err) {
    return marketingRouteError(err);
  }
}
