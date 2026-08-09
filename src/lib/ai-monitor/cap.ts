// src/lib/ai-monitor/cap.ts
//
// The monthly-spend cap arithmetic, with no I/O.
//
// SEPARATE FROM metering.ts ON PURPOSE. metering.ts imports Prisma at module
// scope, and Prisma cannot be reached from a client component or from a test
// that has no DATABASE_URL. The decision "is this tenant capped, and by how
// much" is pure arithmetic, so it lives here where the dashboard badge and the
// unit tests can both have it. src/lib/free-tools/public-constants.ts exists
// for the same reason and was written after a production build failed on it.

import type { PlanType } from "@/generated/prisma";
import { planConfig } from "@/lib/plan-config";
import { roundUsd } from "./pricing";

/** First instant of the current billing month, UTC — matches SeoApiCall's. */
export function startOfAiBillingMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** The tier's monthly USD ceiling. `null` = uncapped. */
export function aiMonthlyCapUsd(plan: PlanType): number | null {
  return planConfig(plan).aiMonthlyCapUsd;
}

export interface CapState {
  capped: boolean;
  spent: number;
  /** `null` when the tier is uncapped. */
  cap: number | null;
  /** Headroom left. `Infinity` when uncapped. */
  remaining: number;
}

/**
 * Where a tenant stands against a cap.
 *
 * A cap of 0 caps immediately — that is how a tier with no monitor (STARTER)
 * refuses the first call rather than allowing one free checkup.
 */
export function capState(spent: number, cap: number | null): CapState {
  if (cap === null) {
    return { capped: false, spent, cap: null, remaining: Number.POSITIVE_INFINITY };
  }
  return {
    capped: spent >= cap,
    spent,
    cap,
    remaining: Math.max(0, roundUsd(cap - spent)),
  };
}

/**
 * Thrown when a call is refused because the tenant is at its monthly cap.
 *
 * Carries the numbers so the caller can write them onto the Checkup row and
 * the dashboard can say "$40 of $40" rather than just "capped".
 */
export class AiCapReachedError extends Error {
  readonly spent: number;
  readonly cap: number;

  constructor(spent: number, cap: number) {
    super(`AI spend cap reached: $${spent.toFixed(2)} of $${cap.toFixed(2)} this month`);
    this.name = "AiCapReachedError";
    this.spent = spent;
    this.cap = cap;
  }
}
