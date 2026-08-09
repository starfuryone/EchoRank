// src/lib/ai-monitor/limits.ts
//
// What a tier may have: how many brands, how many prompts each, how many
// engines per checkup.
//
// THREE LIMITS, THREE DIFFERENT KINDS OF THING, and conflating them is how a
// limit ends up enforced in the wrong place:
//   - PROJECTS is a limit on current state. Delete a brand and the allowance
//     comes back. Enforced at creation, in a transaction, against a COUNT.
//   - PROMPTS is also current state, per project, and is the tier's
//     `aiCheckup.prompts` — the same number the checkup runner uses to decide
//     how many to ask. One source, so "you may select 15" and "we asked 15"
//     cannot disagree.
//   - ENGINES is neither: it is bounded by the tier AND by which API keys are
//     set, and the second half is a runtime fact. See engines.ts.
//
// NONE OF THESE IS THE SPEND GUARD. aiMonthlyCapUsd is, and it binds however
// the prompts are arranged. These exist so a tenant hits a clear "your plan
// allows 1 brand" at the moment they try, rather than a CAPPED checkup at 3am.

import type { PlanType } from "@/generated/prisma";
import { planConfig } from "@/lib/plan-config";
import { prisma } from "@/lib/prisma";
import { enginesForCheckup, type EngineSpec } from "./engines";

/** Thrown when an action would exceed a plan allowance. */
export class PlanLimitError extends Error {
  readonly limit: number;
  readonly current: number;
  readonly resource: "projects" | "prompts";

  constructor(resource: "projects" | "prompts", current: number, limit: number) {
    super(
      `Plan limit reached: ${current} of ${limit} ${resource}. Upgrade to track more.`,
    );
    this.name = "PlanLimitError";
    this.resource = resource;
    this.current = current;
    this.limit = limit;
  }
}

/** Brands one tenant may track. `null` = unlimited. */
export function maxProjects(plan: PlanType): number | null {
  return planConfig(plan).aiProjects;
}

/** Prompts one brand may have selected. Always a number; 0 locks the tool. */
export function maxPrompts(plan: PlanType): number {
  return planConfig(plan).aiCheckup.prompts;
}

/** Repetitions per prompt per engine, from the tier. */
export function repetitions(plan: PlanType): number {
  return planConfig(plan).aiCheckup.repetitions;
}

/**
 * The engines a checkup on this tier will query, right now.
 *
 * Both halves apply: the tier's allowance and what is actually reachable. A
 * tier promising six engines on a box with two keys set gets two, and the
 * dashboard says so rather than showing four silent zeros.
 */
export function enginesFor(
  plan: PlanType,
  env: NodeJS.ProcessEnv = process.env,
  disabled: ReadonlySet<string> = new Set(),
): EngineSpec[] {
  return enginesForCheckup(planConfig(plan).aiCheckup.providers, env, disabled);
}

export interface LimitState {
  current: number;
  /** `null` = unlimited. */
  limit: number | null;
  remaining: number;
  atLimit: boolean;
}

function state(current: number, limit: number | null): LimitState {
  if (limit === null) {
    return { current, limit: null, remaining: Number.POSITIVE_INFINITY, atLimit: false };
  }
  return {
    current,
    limit,
    remaining: Math.max(0, limit - current),
    atLimit: current >= limit,
  };
}

/** Where a tenant stands on its brand allowance. */
export async function projectLimitState(
  tenantId: string,
  plan: PlanType,
): Promise<LimitState> {
  const current = await prisma.brandProfile.count({ where: { tenantId } });
  return state(current, maxProjects(plan));
}

/**
 * Refuse a project that would exceed the tier's allowance.
 *
 * COUNTED INSIDE THE CALLER'S TRANSACTION when one is passed. Two tabs
 * submitting the onboarding form at the same moment both read "0 of 1" and both
 * insert otherwise. This is not hypothetical on a form with a slow crawl behind
 * it — the user clicks again because nothing appeared to happen.
 */
export async function assertCanCreateProject(
  tenantId: string,
  plan: PlanType,
  client: Pick<typeof prisma, "brandProfile"> = prisma,
): Promise<void> {
  const limit = maxProjects(plan);
  if (limit === null) return;

  const current = await client.brandProfile.count({ where: { tenantId } });
  if (current >= limit) throw new PlanLimitError("projects", current, limit);
}

/** Where a brand stands on its prompt allowance. */
export async function promptLimitState(
  brandProfileId: string,
  plan: PlanType,
): Promise<LimitState> {
  const current = await prisma.trackedPrompt.count({
    where: { brandProfileId, selected: true },
  });
  return state(current, maxPrompts(plan));
}

/**
 * How many more prompts this brand may select.
 *
 * Returns a number rather than throwing, because the caller is usually deciding
 * how many to GENERATE — asking a model for twenty and discarding twelve is
 * money spent on nothing.
 */
export async function promptHeadroom(
  brandProfileId: string,
  plan: PlanType,
): Promise<number> {
  const { remaining } = await promptLimitState(brandProfileId, plan);
  return Number.isFinite(remaining) ? remaining : maxPrompts(plan);
}
