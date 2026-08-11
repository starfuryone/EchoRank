import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { PlanLimitError } from "@/lib/ai-monitor/limits";
import { aiSearchEnabledFor } from "@/lib/ai-monitor/rollout";
import { keepSelectableEngines } from "@/lib/ai-monitor/wizard/engines";
import { validateSubmission } from "@/lib/ai-monitor/wizard/validation";
import { completeWizard, type WizardPrompt } from "@/lib/ai-monitor/wizard/create";

/**
 * Finish setup: create the brand and its prompts, then queue the first checkup.
 *
 * ENGINES ARE FILTERED, NOT REJECTED. An engine that is no longer selectable —
 * a stale tab, a rotated key — is dropped and the rest of the submission
 * proceeds. Rejecting outright would lose five minutes of a user's work over an
 * engine they could never have had. The filter runs BEFORE validation so that
 * dropping every engine surfaces as "pick an engine" rather than as a silent
 * setup with none.
 */
export async function POST(request: Request) {
  try {
    const membership = await requireTenant();
    await requireFeature("ai_visibility");

    if (!aiSearchEnabledFor(membership.tenantId)) {
      return NextResponse.json({ error: "not_available" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const rawPrompts: WizardPrompt[] = Array.isArray(body.prompts)
      ? (body.prompts as WizardPrompt[]).filter(
          (prompt) => prompt && typeof prompt.text === "string",
        )
      : [];

    const validation = validateSubmission({
      brand: String(body.brand ?? ""),
      website: String(body.website ?? ""),
      engines: keepSelectableEngines(
        Array.isArray(body.engines) ? (body.engines as string[]) : [],
      ),
      prompts: rawPrompts.map((prompt) => prompt.text),
      aliases: Array.isArray(body.aliases) ? (body.aliases as string[]) : [],
      industry: typeof body.industry === "string" ? body.industry : null,
      country: typeof body.country === "string" ? body.country : null,
      language: typeof body.language === "string" ? body.language : "en",
    });

    if (!validation.ok || !validation.normalized) {
      return NextResponse.json({ error: "invalid_input", fields: validation.errors }, { status: 400 });
    }

    const normalized = validation.normalized;
    // Re-attach the metadata the validator does not carry, matched on the
    // normalised text so an edited suggestion keeps its category and score.
    const byText = new Map(
      rawPrompts.map((prompt) => [prompt.text.trim().replace(/\s+/g, " ").toLowerCase(), prompt]),
    );

    const result = await completeWizard(
      { tenantId: membership.tenantId, plan: membership.tenant.planType },
      {
        brand: normalized.brand,
        domain: normalized.domain,
        aliases: normalized.aliases,
        engines: normalized.engines,
        industry: normalized.industry,
        country: normalized.country,
        language: normalized.language,
        competitors: Array.isArray(body.competitors)
          ? (body.competitors as string[]).filter((c) => typeof c === "string")
          : [],
        prompts: normalized.prompts.map((text) => {
          const source = byText.get(text.toLowerCase());
          return {
            text,
            category: source?.category ?? null,
            intent: source?.intent ?? null,
            audience: source?.audience ?? null,
            suggestionScore: source?.suggestionScore ?? null,
            custom: source?.custom ?? source === undefined,
          };
        }),
      },
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PlanLimitError) {
      return NextResponse.json({ error: "plan_limit", message: error.message }, { status: 402 });
    }
    const enforcement = enforcementErrorResponse(error);
    if (enforcement) return enforcement;
    throw error;
  }
}
