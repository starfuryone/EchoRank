// src/lib/ai-monitor/runner/plan.ts
//
// What one checkup is going to ask, worked out before anything is spent.
//
// PURE. The plan is (prompts × engines × repetitions) expanded into a flat list
// of slots, and every input arrives as an argument. Deciding the shape of a
// checkup without a database is what lets the tier arithmetic be tested
// directly, and it is also what lets the runner write the plan onto the Checkup
// row BEFORE the first call — so a checkup that dies halfway still says what it
// was going to do.
//
// REPETITIONS ARE A TIER PROPERTY, NOT AN ENGINE ONE. They come straight from
// plan-config's tier shape and apply identically to every engine in the plan.
// Read from plan-config rather than through ../limits.ts, which wraps the same
// value but imports Prisma at module scope for its quota queries — pulling that
// in would put a database requirement behind a pure planning function.
//
// There is deliberately no repeatsFor(engine): the repetition count is what the
// customer bought, and letting it vary per engine would make the repeatability
// score incomparable between two engines in the same checkup — the one number
// that exists to compare them.
//
// THE KEY IS THE PLAN'S IDENTITY, NOT A COUNTER. Every slot carries
// (checkupId, promptId, engine, repetition), which is the unique index on
// prompt_runs. Re-running a checkup regenerates exactly the same slots, so the
// second attempt collides with the first instead of doubling it.

import type { PlanType } from "@/generated/prisma";
import type { EngineSpec } from "../engines";
import { planConfig } from "@/lib/plan-config";

/** One provider call the checkup intends to make. */
export interface RunSlot {
  checkupId: string;
  promptId: string;
  promptText: string;
  /** The engine's provider id — what lands in PromptRun.engine. */
  engine: string;
  model: string;
  /** 1-based. The `run_number` half of the idempotency key. */
  repetition: number;
  /**
   * The prompt's category, carried onto the slot so the analysis step has it
   * without a second query. The entity classifier reads it: a tool named in a
   * "how do I fix this" answer is an instruction, the same tool named in a
   * "which should I buy" answer is an option.
   */
  promptCategory: string | null;
}

export interface PlannedPrompt {
  id: string;
  text: string;
  /** The wizard's stored category. A signal for the entity classifier. */
  category?: string | null;
}

/**
 * Expand a tier's shape into the slots a checkup will run.
 *
 * ORDERED PROMPT-MAJOR, THEN ENGINE, THEN REPETITION. The order is the order
 * the runner spends in, so it decides what survives a cap: prompt-major means a
 * tenant that runs out of money has complete data for its first prompts and
 * none for its last, which is a readable partial result. Engine-major would
 * spend the whole budget asking one engine everything, and repetition-major
 * would buy three identical answers to question one before asking question two.
 */
export function buildRunPlan(
  checkupId: string,
  prompts: readonly PlannedPrompt[],
  engines: readonly EngineSpec[],
  repetitions: number,
): RunSlot[] {
  const reps = Math.max(1, Math.floor(repetitions));
  const slots: RunSlot[] = [];

  for (const prompt of prompts) {
    for (const engine of engines) {
      for (let repetition = 1; repetition <= reps; repetition++) {
        slots.push({
          checkupId,
          promptId: prompt.id,
          promptText: prompt.text,
          promptCategory: prompt.category ?? null,
          engine: engine.provider,
          model: engine.modelName,
          repetition,
        });
      }
    }
  }

  return slots;
}

/** The plan a tier implies, for a checkup that has not been built yet. */
export function planForTier(
  checkupId: string,
  plan: PlanType,
  prompts: readonly PlannedPrompt[],
  engines: readonly EngineSpec[],
): RunSlot[] {
  return buildRunPlan(checkupId, prompts, engines, planConfig(plan).aiCheckup.repetitions);
}

/** The slot's identity, for logs and for de-duplicating in memory. */
export function slotKey(slot: RunSlot): string {
  return `${slot.checkupId}:${slot.promptId}:${slot.engine}:${slot.repetition}`;
}

/**
 * The shape snapshot written onto the Checkup row.
 *
 * COPIED ONTO THE ROW AT CREATION, as the Checkup model's own comment requires:
 * a checkup keeps reporting the shape it actually ran under after an upgrade,
 * a downgrade or a config edit.
 */
export interface CheckupShapeSnapshot {
  providers: string[];
  promptCount: number;
  repetitions: number;
}

export function snapshotShape(
  prompts: readonly PlannedPrompt[],
  engines: readonly EngineSpec[],
  repetitions: number,
): CheckupShapeSnapshot {
  return {
    providers: engines.map((engine) => engine.provider),
    promptCount: prompts.length,
    repetitions: Math.max(1, Math.floor(repetitions)),
  };
}
