/**
 * POST /api/seo/v1/ai-lens/analyze — analyze one URL. Body: { url }.
 *
 * Synchronous by design: the sidecar's raw fetch plus one chromium render lands
 * in ~15-20 s, so the response carries the finished analysis rather than a job
 * id. That is slow for an HTTP request and deliberate — the alternative is a
 * queue and a poll for a tool nobody runs in bulk.
 *
 * Guard chain: requirePaidPlan (session + tenant + ACTIVE billing) → URL
 * normalization → own-domain rule (cross-domain is AGENCY+) → per-minute rate
 * limit → 24 h cache → monthly quota (Redis) → sidecar render.
 *
 * Every gate that can reject runs BEFORE the render. A chromium process is the
 * most expensive thing on this box.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import {
  AI_LENS_SUBMIT_RATE_LIMIT,
  AI_LENS_SUBMIT_RATE_WINDOW_MS,
  CROSS_DOMAIN_PLANS,
} from "@/lib/ai-lens/options";
import { assertUrlAllowed, normalizeLensUrl } from "@/lib/ai-lens/url";
import { runLensAnalysis } from "@/lib/ai-lens/service";
import { aiLensRouteError } from "@/lib/ai-lens/http";

const BodySchema = z.object({
  url: z.string().trim().min(1).max(2000),
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

    // Throws InvalidUrlError (-> 400) before anything else runs.
    const url = normalizeLensUrl(parsed.data.url);

    // Throws ForeignDomainError (-> 403). Server-side; the client hiding the
    // affordance below Agency is presentation, this is the control.
    await assertUrlAllowed(tenant.tenantId, tenant.tenant.planType, url);

    const limited = await rateLimit(
      `ai-lens:${tenant.tenantId}`,
      AI_LENS_SUBMIT_RATE_LIMIT,
      AI_LENS_SUBMIT_RATE_WINDOW_MS,
    );
    if (!limited.success) {
      return NextResponse.json(
        { error: "Too many analyses in a row. Wait a minute.", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    const { analysis, cached, usage } = await runLensAnalysis(
      tenant.tenantId,
      tenant.tenant.planType,
      url,
    );

    return NextResponse.json({
      analysis,
      cached,
      usage: {
        ...usage,
        plan: tenant.tenant.planType,
        crossDomain: CROSS_DOMAIN_PLANS.includes(tenant.tenant.planType),
      },
    });
  } catch (err) {
    return aiLensRouteError(err);
  }
}
