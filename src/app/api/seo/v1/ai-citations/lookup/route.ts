// POST /api/seo/v1/ai-citations/lookup — run (or replay) an AI Citations lookup.
//
// THE ONLY ROUTE IN THIS FEATURE THAT CAN SPEND. Everything it needs to decide
// that lives in runAiCitationsLookup: the verification flag, the plan gate, the
// day-bucket cache, the pooled search allowance and the USD cap, in that order.
// This handler validates input and maps errors; it makes no gating decision of
// its own, because a second copy of a gate is a second thing to get wrong.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant";
import { requirePaidPlan } from "@/lib/paid-plan";
import { LLM_PLATFORMS } from "@/lib/dataforseo/endpoints";
import { CITATION_SCOPES, parseCitationTarget } from "@/lib/ai-citations/target";
import { MAX_COMPETITORS } from "@/lib/ai-citations/options";
import { runAiCitationsLookup } from "@/lib/ai-citations/service";
import { aiCitationsRouteError } from "@/lib/ai-citations/http";

const bodySchema = z.object({
  target: z.string().trim().min(1).max(2000),
  scope: z.enum(CITATION_SCOPES).optional(),
  // At least one platform, and the set is closed: an unknown platform would be
  // a billed call for a product that does not exist.
  platforms: z.array(z.enum(LLM_PLATFORMS)).min(1).max(LLM_PLATFORMS.length).optional(),
  competitors: z.array(z.string().trim().max(200)).max(MAX_COMPETITORS * 2).optional(),
});

export async function POST(req: NextRequest) {
  try {
    await requirePaidPlan();
    const { tenantId, tenant } = await requireTenant();

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a domain or URL to look up.", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    const target = parseCitationTarget(parsed.data.target, parsed.data.scope);

    const { analysis, cached } = await runAiCitationsLookup(tenantId, tenant.planType, {
      target,
      platforms: parsed.data.platforms ?? [...LLM_PLATFORMS],
      competitors: parsed.data.competitors ?? [],
    });

    return NextResponse.json({ analysis, cached });
  } catch (err) {
    return aiCitationsRouteError(err);
  }
}
