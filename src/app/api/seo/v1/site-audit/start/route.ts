/**
 * POST /api/seo/v1/site-audit/start — start a technical-SEO crawl.
 * Body: { domain }.
 *
 * Returns 202 with a `queued` row: the OnPage crawl runs for MINUTES, so this
 * never waits for it. The site-audit worker polls it to completion and the UI
 * polls GET /[id] for progress. The page is safe to leave and come back to.
 *
 * Guard chain: requirePaidPlan (session + tenant + ACTIVE billing) → zod →
 * domain normalization → request rate limit → 24 h cache → monthly per-plan
 * quota (Redis) → monthly USD cap (inside seoMeteredCall) → task_post.
 *
 * The crawl SIZE comes from the plan, never the request — OnPage bills per
 * page crawled, so that number is the cost.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import { startAudit } from "@/lib/site-audit/service";
import { siteAuditRouteError } from "@/lib/site-audit/http";
import { buildUsage } from "@/lib/site-audit/usage";

/** Starts per tenant per minute — a floor under the monthly allowance, which
 * for STARTER is only 2 and could otherwise be burned in one double-click. */
const START_RATE_LIMIT = 3;
const START_RATE_WINDOW_MS = 60_000;

const BodySchema = z.object({
  domain: z.string().trim().min(1).max(253),
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

    const limited = await rateLimit(
      `site-audit:${tenant.tenantId}`,
      START_RATE_LIMIT,
      START_RATE_WINDOW_MS,
    );
    if (!limited.success) {
      return NextResponse.json(
        { error: "Too many audits in a row. Wait a minute.", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    const { audit, cached } = await startAudit(
      tenant.tenantId,
      tenant.tenant.planType,
      parsed.data.domain,
    );

    return NextResponse.json(
      { audit, cached, usage: await buildUsage(tenant.tenantId, tenant.tenant.planType) },
      { status: cached ? 200 : 202 },
    );
  } catch (err) {
    return siteAuditRouteError(err);
  }
}
