/**
 * POST /api/seo/v1/content-explorer/search — find web pages mentioning a phrase.
 * Body: { query, angle }.
 *
 * Synchronous by design: both Content Analysis calls are LIVE mode (this family
 * has no standard queue), so the response carries the finished search rather
 * than a job id.
 *
 * Guard chain: requirePaidPlan (session + tenant + ACTIVE billing) → zod →
 * plan gate (every sellable tier has an allowance) → request rate limit → 24 h cache →
 * monthly per-plan quota (Redis) → monthly USD cap (inside seoMeteredCall) →
 * DataForSEO → meter.
 *
 * Every cost gate runs BEFORE the first live call, which matters more here than
 * for most tools: Content Analysis bills ~$0.024 per call whether it finds
 * anything or not, so there is no such thing as a cheap failed search.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import { runSearch } from "@/lib/content-explorer/service";
import { contentRouteError } from "@/lib/content-explorer/http";
import { buildUsage } from "@/lib/content-explorer/usage";
import { normalizeQuery } from "@/lib/content-explorer/parse";
import { SEARCH_ANGLES } from "@/lib/content-explorer/types";

/** Searches per tenant per minute — a floor under the monthly allowance, which
 *  for STARTER is only 10 and could otherwise be burned in one burst. */
const SUBMIT_RATE_LIMIT = 3;
const SUBMIT_RATE_WINDOW_MS = 60_000;

const BodySchema = z.object({
  query: z.string().trim().min(2).max(200),
  angle: z.enum(SEARCH_ANGLES).default("topic"),
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

    // Normalized here as well as in the service so the empty-after-normalize
    // case (whitespace, punctuation only) is a 400 rather than a paid call for
    // a phrase that is not a phrase.
    const query = normalizeQuery(parsed.data.query);
    if (query.length < 2) {
      return NextResponse.json(
        { error: "Enter a phrase to search for", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    const limited = await rateLimit(
      `content-explorer:${tenant.tenantId}`,
      SUBMIT_RATE_LIMIT,
      SUBMIT_RATE_WINDOW_MS,
    );
    if (!limited.success) {
      return NextResponse.json(
        { error: "Too many searches — try again in a minute", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    const { search, cached } = await runSearch(tenant.tenantId, tenant.tenant.planType, {
      query,
      angle: parsed.data.angle,
    });

    return NextResponse.json({
      search,
      cached,
      usage: await buildUsage(tenant.tenantId, tenant.tenant.planType),
    });
  } catch (err) {
    return contentRouteError(err);
  }
}
