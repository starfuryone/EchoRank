// src/lib/ai-monitor/onboarding/create-project.ts
//
// Project creation, end to end: check the allowance, read the site, work out
// what the business is, find its competitors, write its first prompts, and put
// them on the schedule.
//
// THE PROJECT ROW IS WRITTEN FIRST, BEFORE ANY OF THE SLOW PARTS. A crawl plus
// three LLM calls is thirty to sixty seconds of things that can fail, and
// failing after all of it with nothing saved means the user re-types the form
// and we re-spend the money. So the row exists from the start with
// `trackingActive: false` and `onboardedAt: null`, every later step is an
// UPDATE, and an interrupted onboarding leaves a resumable project rather than
// a lost one.
//
// EVERY STEP DEGRADES INSTEAD OF THROWING. A site that blocks robots, a model
// that returns prose, a tenant already at its spend cap — none of these is a
// reason to refuse someone a project. Each failure adds a warning the UI shows
// next to the field it affected, and the user fills that field in by hand. The
// ONE hard failure is the plan limit, which is checked before anything is
// written because the answer is "no", not "partly".
//
// USER INPUT ALWAYS BEATS INFERENCE. If someone typed their industry, the
// model's guess does not overwrite it — not even when the model is right. A
// form that silently rewrites what you typed is a form nobody trusts twice.

import type { PlanType } from "@/generated/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { prisma } from "@/lib/prisma";
import { planConfig } from "@/lib/plan-config";
import { AiCapReachedError, meteredAiCall } from "../metering";
import { costUsdFor, roundUsd } from "../pricing";
import { JSON_CALL_MODEL } from "../json-call";
import { assertCanCreateProject, maxPrompts } from "../limits";
import { commercialValue } from "../prompts/categories";
import { generatePrompts, selectInitialPrompts } from "../prompts/generate";
import { promptFrequencyFor, staggeredStart } from "../schedule";
import { crawlSite, type SiteSnapshot } from "./crawl";
import {
  discoverCompetitors,
  inferBusinessContext,
  mergeCompetitors,
  type BusinessContext,
} from "./infer";

/**
 * Candidates asked for, against the number that will be kept.
 *
 * Over-generating is deliberate: selectInitialPrompts round-robins across
 * thirteen categories, and a pool the same size as the limit would leave most
 * categories with one candidate and no choice between them. 2.5x is roughly
 * two candidates per category at the STARTER limit of ten.
 */
export const CANDIDATE_MULTIPLIER = 2.5;

/** Both halves of the generated set are asked for in one call. */
export const MAX_CANDIDATES = 40;

export interface CreateProjectInput {
  name: string;
  website?: string | null;
  /** Skips inference of this field when supplied. */
  description?: string | null;
  industry?: string | null;
  /** ISO-3166-1 alpha-2. */
  country?: string | null;
  /** BCP-47. Defaults to the tenant's language. */
  language?: string | null;
  targetMarkets?: string[];
  trackedCompetitors?: string[];
  audiences?: string[];
  aliases?: string[];
}

export interface CreateProjectContext {
  tenantId: string;
  plan: PlanType;
}

export type OnboardingWarning =
  | "no_website"
  | "crawl_failed"
  | "robots_disallowed"
  | "inference_failed"
  | "competitors_failed"
  | "prompt_generation_failed"
  | "spend_cap_reached";

export interface CreateProjectResult {
  projectId: string;
  /** True when the pipeline reached the end and tracking was switched on. */
  onboarded: boolean;
  promptsCreated: number;
  competitors: string[];
  pagesRead: number;
  /** Non-fatal problems, each mapped to a field the UI asks the user to fill. */
  warnings: OnboardingWarning[];
  /** USD spent by this onboarding's LLM calls. */
  costUsd: number;
}

/**
 * The crawl step. Returns an empty snapshot rather than throwing.
 *
 * Split out so `createProject` reads as the sequence it is, and so the tests
 * can drive the whole pipeline with a stub here and never touch the network.
 */
async function readSite(
  website: string | null | undefined,
  warnings: OnboardingWarning[],
  crawl: typeof crawlSite,
): Promise<SiteSnapshot | null> {
  if (!website) {
    warnings.push("no_website");
    return null;
  }

  const snapshot = await crawl(website);
  if (snapshot.failure) {
    warnings.push(snapshot.robotsBlocked ? "robots_disallowed" : "crawl_failed");
    return null;
  }
  return snapshot;
}

export interface CreateProjectDeps {
  crawl?: typeof crawlSite;
  inferContext?: typeof inferBusinessContext;
  findCompetitors?: typeof discoverCompetitors;
  writePrompts?: typeof generatePrompts;
  now?: () => Date;
}

/**
 * Create a tracked brand and everything it needs to start producing data.
 *
 * Throws only PlanLimitError. Everything else is a warning on the result.
 */
export async function createProject(
  ctx: CreateProjectContext,
  input: CreateProjectInput,
  deps: CreateProjectDeps = {},
): Promise<CreateProjectResult> {
  const crawl = deps.crawl ?? crawlSite;
  const inferContext = deps.inferContext ?? inferBusinessContext;
  const findCompetitors = deps.findCompetitors ?? discoverCompetitors;
  const writePrompts = deps.writePrompts ?? generatePrompts;
  const now = deps.now ?? (() => new Date());

  await assertCanCreateProject(ctx.tenantId, ctx.plan);

  const warnings: OnboardingWarning[] = [];
  let costUsd = 0;

  /**
   * Every model call in onboarding goes through here so the cap is checked
   * before it and the tokens are recorded after it. A cap reached mid-pipeline
   * stops the REMAINING calls and leaves what has been written in place — the
   * project keeps its description even if it never got its prompts.
   *
   * The running cost is computed with costUsdFor — THE SAME function the
   * metering layer used to price the row it just wrote. Not a second estimate:
   * two figures derived two ways disagree eventually, and the one on screen is
   * the one the customer disputes.
   */
  const capped = { hit: false };
  async function metered<T>(
    purpose: "inference",
    run: () => Promise<{ value: T; inputTokens: number; outputTokens: number; model: string }>,
  ): Promise<T | null> {
    if (capped.hit) return null;
    try {
      return await meteredAiCall(
        { tenantId: ctx.tenantId, plan: ctx.plan },
        { provider: "CLAUDE", model: JSON_CALL_MODEL, purpose },
        async () => {
          const result = await run();
          const usage = {
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            cachedInputTokens: 0,
          };
          costUsd = roundUsd(
            costUsd + costUsdFor("CLAUDE", result.model, usage).costUsd,
          );
          return { value: result.value, model: result.model, usage };
        },
      );
    } catch (err) {
      if (err instanceof AiCapReachedError) {
        capped.hit = true;
        warnings.push("spend_cap_reached");
        return null;
      }
      throw err;
    }
  }

  const language = input.language?.trim() || "en";

  // ── 1. The row, before anything that can be slow ──
  const project = await prisma.brandProfile.create({
    data: {
      tenantId: ctx.tenantId,
      name: input.name.trim(),
      website: input.website?.trim() || null,
      description: input.description?.trim() || null,
      industry: input.industry?.trim() || null,
      country: input.country?.trim()?.toUpperCase() || null,
      language,
      aliases: input.aliases ?? [],
      competitors: input.trackedCompetitors ?? [],
      markets: input.targetMarkets ?? [],
      audiences: input.audiences ?? [],
      trackingActive: false,
    },
  });

  // ── 2. Read the site ──
  const snapshot = await readSite(input.website, warnings, crawl);

  // ── 3. What is this business? ──
  let context: BusinessContext | null = null;
  if (snapshot) {
    const result = await metered("inference", async () => {
      const inferred = await inferContext({
        brandName: project.name,
        website: project.website,
        snapshot,
      });
      return {
        value: inferred,
        inputTokens: inferred.inputTokens,
        outputTokens: inferred.outputTokens,
        model: inferred.model,
      };
    });

    if (result?.value) {
      context = result.value;
    } else if (result) {
      warnings.push("inference_failed");
      logger.warn(
        { projectId: project.id, error: result.error },
        "onboarding could not infer business context",
      );
    }
  }

  // User input wins; inference fills the gaps only.
  const description = project.description ?? context?.description ?? null;
  const industry = project.industry ?? context?.industry ?? null;
  const country = project.country ?? context?.country ?? null;
  const aliases = project.aliases.length > 0 ? project.aliases : (context?.aliases ?? []);
  const audiences = project.audiences.length > 0 ? project.audiences : (context?.audiences ?? []);
  const topics = context?.topics ?? [];

  // ── 4. Who does it compete with? ──
  let competitors = project.competitors;
  if (competitors.length === 0 && description && industry) {
    const result = await metered("inference", async () => {
      const found = await findCompetitors({
        brandName: project.name,
        description,
        industry,
        country,
        namedOnSite: context?.competitorsNamedOnSite ?? [],
      });
      return {
        value: found,
        inputTokens: found.inputTokens,
        outputTokens: found.outputTokens,
        model: found.model,
      };
    });

    if (result?.value) {
      competitors = mergeCompetitors(
        project.name,
        context?.competitorsNamedOnSite ?? [],
        result.value.competitors,
      );
    } else if (result) {
      warnings.push("competitors_failed");
      // Not fatal: prompts can be generated without competitor names, they are
      // simply less pointed. The user adds them in the review step.
      competitors = mergeCompetitors(project.name, context?.competitorsNamedOnSite ?? [], []);
    }
  }

  await prisma.brandProfile.update({
    where: { id: project.id },
    data: {
      description,
      industry,
      country,
      aliases,
      audiences,
      topics,
      competitors,
      onboardingEvidence: snapshot
        ? {
            pages: snapshot.pages.map((page) => ({
              url: page.url,
              title: page.title,
              chars: page.text.length,
            })),
            fetched: snapshot.fetched,
            durationMs: snapshot.durationMs,
            detectedIndustry: context?.industry ?? null,
            confidence: context?.confidence ?? null,
            competitorsNamedOnSite: context?.competitorsNamedOnSite ?? [],
          }
        : { pages: [], robotsBlocked: warnings.includes("robots_disallowed") },
    },
  });

  // ── 5. First prompts ──
  // The legacy background onboarding path, which predates the standalone
  // watcher and only ever runs for a tenant on a tier. resolveWatcherShape is
  // the choke point for anything a watcher holder can reach; this is not one.
  const limit = maxPrompts(planConfig(ctx.plan).aiCheckup);
  let promptsCreated = 0;

  if (limit > 0 && description && industry) {
    const result = await metered("inference", async () => {
      const generated = await writePrompts({
        brandName: project.name,
        description,
        industry,
        competitors,
        audiences,
        markets: project.markets,
        language,
        count: Math.min(MAX_CANDIDATES, Math.ceil(limit * CANDIDATE_MULTIPLIER)),
      });
      return {
        value: generated,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        model: generated.model,
      };
    });

    if (result?.value) {
      const selected = selectInitialPrompts(result.value.prompts, { limit });
      const frequency = promptFrequencyFor(planConfig(ctx.plan).aiCheckup.frequency);
      const startedAt = now();

      // createMany with skipDuplicates: TrackedPrompt is unique on
      // (tenantId, text), and a tenant onboarding a second brand in the same
      // market will legitimately generate a question it already tracks. That
      // is a collision to skip, not an error to fail creation over.
      const created = await prisma.trackedPrompt.createMany({
        data: selected.map((prompt, index) => ({
          tenantId: ctx.tenantId,
          brandProfileId: project.id,
          text: prompt.text,
          category: prompt.category,
          intent: prompt.intent,
          audience: prompt.audience,
          language,
          country,
          market: project.markets[0] ?? null,
          source: "SUGGESTED" as const,
          commercialValue: commercialValue({
            category: prompt.category,
            intent: prompt.intent,
          }),
          trackingFrequency: frequency,
          selected: true,
          active: true,
          nextRunAt: staggeredStart(index, selected.length, startedAt),
        })),
        skipDuplicates: true,
      });
      promptsCreated = created.count;
    } else if (result) {
      warnings.push("prompt_generation_failed");
    }
  }

  // ── 6. Switch tracking on, but only if there is something to track ──
  const onboarded = promptsCreated > 0;
  if (onboarded) {
    await prisma.brandProfile.update({
      where: { id: project.id },
      data: { trackingActive: true, onboardedAt: now() },
    });
  }

  logger.info(
    {
      projectId: project.id,
      tenantId: ctx.tenantId,
      promptsCreated,
      competitors: competitors.length,
      pagesRead: snapshot?.pages.length ?? 0,
      warnings,
    },
    "project onboarding finished",
  );

  return {
    projectId: project.id,
    onboarded,
    promptsCreated,
    competitors,
    pagesRead: snapshot?.pages.length ?? 0,
    warnings,
    costUsd,
  };
}
