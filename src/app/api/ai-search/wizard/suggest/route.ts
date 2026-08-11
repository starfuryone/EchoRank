import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { aiSearchEnabledFor } from "@/lib/ai-monitor/rollout";
import { wizardEngineOptions } from "@/lib/ai-monitor/wizard/engines";
import { normalizeDomain, isValidBrand, normalizeBrand } from "@/lib/ai-monitor/wizard/validation";
import { suggestPrompts } from "@/lib/ai-monitor/wizard/suggest";
import { resolveShapeForTenant } from "@/lib/ai-monitor/limits";

/**
 * The wizard's analyse-and-suggest step.
 *
 * ONE FETCH AND ONE MODEL CALL, both budgeted — see wizard/suggest.ts. The
 * suggestion call spends the tenant's AI budget exactly like a checkup does, so
 * a tenant at its ceiling gets an empty list and a flag rather than a free one,
 * and the wizard carries on letting them write prompts by hand.
 *
 * THE STARTER GATE IS requireFeature("ai_visibility"), unchanged. STARTER does
 * not carry that feature and is refused here, which is why nothing downstream
 * re-checks the tier: one gate, at the boundary.
 *
 * The engine list is returned alongside the suggestions so the form renders
 * from one round trip, and so the selectable set is computed by the same
 * predicate the runner uses rather than by the browser.
 */
export async function POST(request: Request) {
  try {
    const membership = await requireTenant();
    await requireFeature("ai_visibility");

    if (!aiSearchEnabledFor(membership.tenantId)) {
      return NextResponse.json({ error: "not_available" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const brand = normalizeBrand(String(body.brand ?? ""));
    const domain = normalizeDomain(String(body.website ?? ""));

    if (!isValidBrand(brand) || domain === null) {
      // The form validates this too; reaching here is a stale tab or a
      // hand-made request, and either way it must not reach a paid call.
      return NextResponse.json(
        { error: "invalid_input", fields: { brand: !isValidBrand(brand), website: domain === null } },
        { status: 400 },
      );
    }

    const result = await suggestPrompts(
      {
        brand,
        domain,
        description: typeof body.description === "string" ? body.description : undefined,
        industry: typeof body.industry === "string" ? body.industry : undefined,
        country: typeof body.country === "string" ? body.country : null,
        language: typeof body.language === "string" ? body.language : "en",
        competitors: Array.isArray(body.competitors)
          ? body.competitors.filter((c): c is string => typeof c === "string")
          : [],
      },
      {
        tenantId: membership.tenantId,
        plan: membership.tenant.planType,
        // Resolved once, here: a standalone watcher holder has a shape their
        // tier does not describe.
        shape: await resolveShapeForTenant(membership.tenantId, membership.tenant.planType),
      },
    );

    return NextResponse.json({
      site: result.site,
      suggestions: result.suggestions,
      limit: result.limit,
      capped: result.capped,
      error: result.error,
      engines: wizardEngineOptions(),
    });
  } catch (error) {
    const enforcement = enforcementErrorResponse(error);
    if (enforcement) return enforcement;
    throw error;
  }
}
