// src/lib/ai-visibility-landing/facts.ts — every number, engine name and
// feature /[locale]/ai-visibility shows, read from config (ECHORANK-AI-
// VISIBILITY-PAGES.md Phase 1). Nothing here is typed copy: prices and
// allowances from PLAN_CONFIGS, engines from the live-engine registry
// (ai-monitor/engines.ts, filtered by the keys this process has), features
// from feature-flags / plan-access.
//
// ENGINES ARE THE LIVE ONES. enginesForCheckup() takes the head of the
// catalogue that this box can actually call, which is exactly what a checkup
// on that plan queries. A missing key drops the engine from the page instead of
// promising it. (The AIEngine table's operator switch is a DB read and is not
// applied here; it is used for outages, not for what a plan includes.)

import type { PlanType } from "@/generated/prisma";
import { enginesForCheckup } from "@/lib/ai-monitor/engines";
import { SCORE_WEIGHTS_V1 } from "@/lib/ai-monitor/metrics";
import { hasFeature, type Feature } from "@/lib/feature-flags";
import { planAllowsArea, type AccessArea } from "@/lib/plan-access";
import { PLAN_CONFIGS, type AiCheckupShape, type SellablePlanType } from "@/lib/plan-config";

export const AV_PLAN = "AI_VISIBILITY" as const satisfies SellablePlanType;

/** The four self-serve plans, cheapest first: the pricing cards and the allowance table. */
export const AV_LADDER = ["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY"] as const satisfies readonly SellablePlanType[];

/** ?src= on this page's links (attribution on /pricing and the sales form). */
export const AV_SRC = {
  hero: "ai-visibility-hero",
  pricing: "ai-visibility-pricing",
} as const;

/** The AI Visibility plan's monthly price, USD. */
export function avMonthlyPrice(): number {
  return PLAN_CONFIGS[AV_PLAN].monthlyPrice;
}

/** The checkout pattern every plan CTA on the site follows: /pricing with the plan and the source. */
export function avPlanHref(locale: string, src: string): string {
  return `/${locale}/pricing?plan=ai_visibility&src=${encodeURIComponent(src)}`;
}

/** The engines a checkup on this plan queries, by name, in catalogue order. */
export function planEngineNames(plan: SellablePlanType, env: NodeJS.ProcessEnv = process.env): string[] {
  return enginesForCheckup(PLAN_CONFIGS[plan].aiCheckup.providers, env).map((e) => e.displayName);
}

export interface AllowanceRow {
  plan: SellablePlanType;
  name: string;
  prompts: number;
  engines: string[];
  frequency: AiCheckupShape["frequency"];
  repetitions: number;
  projects: number | null;
}

/** One row per plan of the AI allowance table, from config and the registry. */
export function allowanceRows(env: NodeJS.ProcessEnv = process.env): AllowanceRow[] {
  return AV_LADDER.map((plan) => {
    const c = PLAN_CONFIGS[plan];
    return {
      plan,
      name: c.name,
      prompts: c.aiCheckup.prompts,
      engines: planEngineNames(plan, env),
      frequency: c.aiCheckup.frequency,
      repetitions: c.aiCheckup.repetitions,
      projects: c.aiProjects,
    };
  });
}

/** Every engine any self-serve plan queries (the union, catalogue order): the FAQ's "which engines". */
export function allLiveEngineNames(env: NodeJS.ProcessEnv = process.env): string[] {
  const seen: string[] = [];
  for (const row of allowanceRows(env)) for (const e of row.engines) if (!seen.includes(e)) seen.push(e);
  return seen;
}

/**
 * What the AI Visibility plan includes, each item tied to the feature key its
 * pages gate on. An item whose key the plan lacks is not shown.
 */
export const AV_FEATURES = [
  { id: "answers", feature: "answer_tracking" },
  { id: "trend", feature: "ai_visibility" },
  { id: "competitors", feature: "ai_visibility" },
  { id: "sources", feature: "citation_tracking" },
  { id: "alerts", feature: "ai_visibility" },
  { id: "history", feature: "ai_visibility" },
] as const satisfies readonly { id: string; feature: Feature }[];
export type AvFeatureId = (typeof AV_FEATURES)[number]["id"];

export function avShippedFeatures(plan: PlanType = AV_PLAN): AvFeatureId[] {
  return AV_FEATURES.filter((f) => hasFeature(plan, f.feature)).map((f) => f.id);
}

/**
 * What Starter adds beyond AI tracking: the areas the AI-only plan excludes
 * (plan-access) that Starter really has. plan-access opens every area to every
 * other plan and leaves the finer gates to features, so the areas whose
 * Starter access is not real (white-label/client workspaces, the public API,
 * the Pro assistant: higher-plan features) are not in this list.
 */
export const STARTER_ADD_AREAS = ["reputation", "seo_tools", "crawler", "marketing_studio"] as const satisfies readonly AccessArea[];

export function starterAdds(): (typeof STARTER_ADD_AREAS)[number][] {
  return STARTER_ADD_AREAS.filter((a) => planAllowsArea("STARTER", a) && !planAllowsArea(AV_PLAN, a));
}

/** The cheapest plan with review management (plan-access area "reputation"). */
export function reviewsFromPlan(): SellablePlanType | null {
  return AV_LADDER.find((p) => planAllowsArea(p, "reputation")) ?? null;
}

/** The AI Search Score's weights, as whole percentages (ai-monitor/metrics.ts, v1). */
export function searchScoreWeights(): { mention: number; position: number; citation: number; sentiment: number } {
  const pct = (n: number) => Math.round(n * 100);
  return {
    mention: pct(SCORE_WEIGHTS_V1.mention),
    position: pct(SCORE_WEIGHTS_V1.position),
    citation: pct(SCORE_WEIGHTS_V1.citation),
    sentiment: pct(SCORE_WEIGHTS_V1.sentiment),
  };
}
