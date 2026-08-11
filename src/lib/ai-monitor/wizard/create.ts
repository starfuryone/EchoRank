// src/lib/ai-monitor/wizard/create.ts
//
// What happens when someone presses Finish.
//
// THE BRAND IS WRITTEN BEFORE THE QUEUE IS TOUCHED. A setup that succeeded in
// Redis and failed in Postgres is a checkup for a brand that does not exist; a
// setup that succeeded in Postgres and failed in Redis is a brand that waits
// fifteen minutes for the sweep to notice it. Only one of those is recoverable
// without a human, so the durable write goes first and the enqueue is
// best-effort on top.
//
// NO PARALLEL RUN MECHANISM. The initial checkup is the SAME job on the SAME
// queue the scheduler uses — `run-checkup` on `ai-checkup`, with the same
// interval-bucketed job id, so a wizard finishing minutes before a sweep does
// not produce two checkups. Anything else would be a second way for a checkup
// to start, and the two would drift on cap handling, idempotency and status.
//
// THE ROLLOUT GATE IS RESPECTED HERE TOO. A tenant outside the flag gets a
// fully configured brand and no checkup: the surface is not ready for them, and
// spending their money to fill a dashboard they cannot open is the failure the
// flag exists to prevent. The brand is still created, so switching the flag on
// later starts them at the next sweep with nothing lost.

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { addJob } from "@/infrastructure/queue/registry";
import { planConfig } from "@/lib/plan-config";
import { aiSearchEnabledFor } from "../rollout";
import { assertCanCreateProject } from "../limits";
import { enqueueBucket } from "../runner/scheduler";
import { defaultIntentFor } from "../prompts/generate";
import { promptFrequencyFor } from "../schedule";
import { isPromptCategory, type PromptCategory } from "../prompts/categories";

/** One prompt as the wizard hands it over. */
export interface WizardPrompt {
  text: string;
  category?: string | null;
  intent?: string | null;
  audience?: string | null;
  /** 0-100 from wizard/scoring.ts. Absent for a prompt the user typed. */
  suggestionScore?: number | null;
  /** True when the user wrote or edited it rather than accepting a suggestion. */
  custom?: boolean;
}

export interface CompleteWizardInput {
  brand: string;
  domain: string;
  aliases: string[];
  engines: string[];
  prompts: WizardPrompt[];
  industry: string | null;
  country: string | null;
  language: string;
  competitors?: string[];
}

export interface CompleteWizardContext {
  tenantId: string;
  plan: PlanType;
}

export interface CompleteWizardResult {
  brandProfileId: string;
  promptCount: number;
  /** False when the rollout flag does not cover this tenant. */
  queued: boolean;
  /** Set when the brand was created but the enqueue failed. */
  queueError: string | null;
}

/**
 * Create the brand, its prompts, and the first checkup job.
 *
 * The engines the user picked are NOT stored on the brand. Which engines a
 * checkup queries is resolved at run time from the tier's allowance and what is
 * actually reachable and billable (runner/providers.ts), and a stored list
 * would go stale the moment an adapter shipped or a key was rotated — leaving a
 * brand pinned to a selection made when only one engine existed. The selection
 * is a validation gate in the wizard, not a configuration.
 */
export async function completeWizard(
  ctx: CompleteWizardContext,
  input: CompleteWizardInput,
): Promise<CompleteWizardResult> {
  await assertCanCreateProject(ctx.tenantId, ctx.plan);

  const config = planConfig(ctx.plan);
  const frequency = promptFrequencyFor(config.aiCheckup.frequency);
  const now = new Date();

  const brand = await prisma.brandProfile.create({
    data: {
      tenantId: ctx.tenantId,
      name: input.brand,
      website: input.domain,
      industry: input.industry,
      country: input.country,
      language: input.language,
      aliases: input.aliases,
      competitors: input.competitors ?? [],
      // The wizard finishing is what this flag means, and the scheduler reads
      // it before it will schedule anything.
      trackingActive: true,
      onboardedAt: now,
      prompts: {
        create: input.prompts.map((prompt) => {
          const category: PromptCategory | null =
            prompt.category && isPromptCategory(prompt.category) ? prompt.category : null;
          return {
            tenantId: ctx.tenantId,
            text: prompt.text,
            category,
            intent: prompt.intent ?? (category ? defaultIntentFor(category) : null),
            audience: prompt.audience ?? null,
            language: input.language,
            country: input.country,
            source: prompt.custom ? ("CUSTOM" as const) : ("SUGGESTED" as const),
            // Both true: the wizard's selection state AND the tracking switch.
            // They are separate columns because deselecting in the wizard and
            // pausing tracking are different actions later.
            selected: true,
            active: true,
            suggestionScore: prompt.suggestionScore ?? null,
            trackingFrequency: frequency,
          };
        }),
      },
    },
    select: { id: true, _count: { select: { prompts: true } } },
  });

  const result: CompleteWizardResult = {
    brandProfileId: brand.id,
    promptCount: brand._count.prompts,
    queued: false,
    queueError: null,
  };

  if (!aiSearchEnabledFor(ctx.tenantId)) {
    logger.info(
      { brandProfileId: brand.id, tenantId: ctx.tenantId },
      "wizard complete; first checkup not queued (tenant outside the rollout flag)",
    );
    return result;
  }

  try {
    // The same job, queue and id the sweep uses. The bucket means a wizard
    // finishing shortly before a sweep collapses into one checkup rather than
    // two.
    await addJob(
      "ai-checkup",
      "run-checkup",
      { brandProfileId: brand.id, tenantId: ctx.tenantId, manual: false },
      { jobId: `checkup:${brand.id}:${enqueueBucket(config.aiCheckup.frequency, now)}` },
    );
    result.queued = true;
  } catch (err) {
    // The brand exists and is trackingActive, so the sweep will pick it up
    // within the interval regardless. Reporting rather than throwing keeps a
    // Redis blip from losing a completed setup.
    result.queueError = err instanceof Error ? err.message : String(err);
    logger.error(
      { brandProfileId: brand.id, err },
      "wizard complete but first checkup could not be queued; the sweep will pick it up",
    );
  }

  return result;
}
