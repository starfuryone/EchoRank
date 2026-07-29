/**
 * POST /api/seo/v1/lighthouse/audit — run one Lighthouse audit.
 * Body: { url, strategy }.
 *
 * Synchronous and SLOW BY DESIGN: a PageSpeed Insights run takes 10-30 s and
 * the client shows a progress state for it. There is no queue because there is
 * nothing to poll — PSI returns the whole result or nothing, and the 60 s
 * timeout in the client bounds the wait.
 *
 * Guard chain: requirePaidPlan (session + tenant + ACTIVE billing) → zod →
 * URL validation (must be publicly reachable) → 6 h cache → hourly per-tenant
 * limiter (Redis) → PSI.
 *
 * There is no plan gate and no monthly cap: PSI is free. The limiter exists to
 * protect the SHARED Google quota, which every tenant on this server draws
 * from, not to meter revenue.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { normalizeAuditUrl } from "@/lib/lighthouse/url";
import { runAudit } from "@/lib/lighthouse/service";
import { lighthouseRouteError } from "@/lib/lighthouse/http";
import { buildUsage } from "@/lib/lighthouse/usage";
import { DEFAULT_STRATEGY, LIGHTHOUSE_STRATEGIES } from "@/lib/lighthouse/options";

/** A PSI run can take 30 s+; Next's default would cut it off. */
export const maxDuration = 90;

const BodySchema = z.object({
  url: z.string().trim().min(1).max(2000),
  strategy: z.enum(LIGHTHOUSE_STRATEGIES).default(DEFAULT_STRATEGY),
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

    // Throws InvalidAuditUrlError (-> 400) before PSI is ever contacted.
    const url = normalizeAuditUrl(parsed.data.url);

    const { audit, cached } = await runAudit(tenant.tenantId, {
      url,
      strategy: parsed.data.strategy,
    });

    return NextResponse.json({
      audit,
      cached,
      usage: await buildUsage(tenant.tenantId),
    });
  } catch (err) {
    return lighthouseRouteError(err);
  }
}
