/**
 * POST /api/ai/visibility/marketing/generate — produce one marketing deliverable.
 * Body: { categoryId, values, locale? }.
 *
 * Guard chain: requirePaidPlan (session + tenant + billing) → zod → known
 * category → rate limit → plan gate → validation → heuristics → result cache →
 * token budget → one Haiku call → meter.
 *
 * THE BODY CARRIES VALUES, NOT A PROMPT. categoryId selects a template from
 * MARKETING_CATEGORIES; the prompt text, the model and the token ceiling all
 * come from that config. There is no request field that can change any of them,
 * so a caller cannot turn this route into a general-purpose model proxy on the
 * tenant's budget.
 *
 * AUTHENTICATED — do not add /api/ai/visibility/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { findMarketingCategory } from "@/lib/marketing-templates";
import { generate } from "@/lib/marketing/service";
import { marketingRouteError } from "@/lib/marketing/http";

/** Generations per tenant per minute. A floor under the monthly token budget,
 *  which a scripted loop could otherwise drain in well under a minute. */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

const BodySchema = z.object({
  categoryId: z.string().trim().min(1).max(64),
  // Values are validated against the category's declared variables in
  // collectValues — this only bounds the raw shape so a 10 MB object cannot
  // reach the analyser.
  values: z.record(z.string(), z.string().max(200_000)).default({}),
  locale: z.string().trim().max(16).optional(),
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

    // Rate limit before the plan gate so a locked plan cannot be used as a free
    // probe of which categories exist.
    const limited = await rateLimit(
      `marketing:${tenant.tenantId}`,
      RATE_LIMIT,
      RATE_WINDOW_MS,
    );
    if (!limited.success) {
      return NextResponse.json(
        { error: "Too many generations at once — try again in a minute", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    // Tenant-scoped read; the guide is prepended to the system prompt.
    const row = await prisma.tenant.findFirst({
      where: { id: tenant.tenantId },
      select: { brandVoiceGuide: true },
    });

    const result = await generate({
      tenantId: tenant.tenantId,
      plan: tenant.tenant.planType,
      category,
      raw: parsed.data.values,
      locale: dashboardLocale(parsed.data.locale),
      voiceGuide: row?.brandVoiceGuide ?? null,
    });

    return NextResponse.json(result);
  } catch (err) {
    return marketingRouteError(err);
  }
}
