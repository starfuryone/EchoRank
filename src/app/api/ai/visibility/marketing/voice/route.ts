/**
 * GET  /api/ai/visibility/marketing/voice — the saved brand voice guide.
 * PUT  /api/ai/visibility/marketing/voice — save or clear it.
 *
 * The guide produced by category 08 is prepended to the system prompt of every
 * other category, so saving it is what makes the other eleven sound like the
 * tenant rather than like a model. Body: { guide } — a string, or "" to clear.
 *
 * The guide is stored as free text, not as the VoiceStats that produced it: a
 * tenant is expected to edit it by hand ("we never say 'solutions'"), and
 * round-tripping through the analyser would silently discard those edits.
 *
 * The WRITING SAMPLES are not stored anywhere. Only the derived guide is.
 *
 * AUTHENTICATED — do not add /api/ai/visibility/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { planCanUseMarketing, MarketingPlanLockedError } from "@/lib/marketing/quota";
import { marketingRouteError } from "@/lib/marketing/http";

/** Generous — a hand-edited guide grows — but bounded: this is prepended to
 *  every generation, so an unbounded guide is an unbounded input-token bill. */
const MAX_GUIDE_LENGTH = 8000;

const BodySchema = z.object({
  guide: z.string().max(MAX_GUIDE_LENGTH),
});

export async function GET() {
  try {
    const tenant = await requirePaidPlan();
    // findFirst on the scoped id, never findUnique by id alone.
    const row = await prisma.tenant.findFirst({
      where: { id: tenant.tenantId },
      select: { brandVoiceGuide: true },
    });
    return NextResponse.json({ guide: row?.brandVoiceGuide ?? null });
  } catch (err) {
    return marketingRouteError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const tenant = await requirePaidPlan();
    if (!planCanUseMarketing(tenant.tenant.planType)) {
      throw new MarketingPlanLockedError(tenant.tenant.planType);
    }

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: `The guide must be text of at most ${MAX_GUIDE_LENGTH} characters.`,
          code: "INVALID_REQUEST",
        },
        { status: 400 },
      );
    }

    const guide = parsed.data.guide.trim();
    // updateMany, not update: it takes a where clause that keeps the tenant
    // scope on the write, where update({ where: { id } }) would not.
    await prisma.tenant.updateMany({
      where: { id: tenant.tenantId },
      data: { brandVoiceGuide: guide || null },
    });

    return NextResponse.json({ guide: guide || null });
  } catch (err) {
    return marketingRouteError(err);
  }
}
