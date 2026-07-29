// src/lib/ai-lens/options.ts
//
// Every AI Lens number a user can see, in one place. Nothing here is written
// into copy — the UI reads these so a plan change never leaves a stale figure on
// screen.

import type { PlanType } from "@/generated/prisma";

/**
 * Analyses per tenant per month.
 *
 * Each one costs a chromium render, which is the most expensive thing the
 * sidecar does (~16 s wall on a real marketing page, one browser process).
 * These caps are about render load on a single box, not upstream billing —
 * there is no per-call vendor cost here.
 *
 * AI_VISIBILITY sits at the STARTER allowance: it is a $29 plan whose whole
 * pitch is AI answer-engine visibility, so the tool belongs on it, but it does
 * not buy Agency's render budget.
 */
export const AI_LENS_ANALYSES_PER_MONTH: Record<PlanType, number> = {
  AI_VISIBILITY: 10,
  STARTER: 10,
  GROWTH: 50,
  AGENCY: 200,
  ENTERPRISE: 200,
};

/**
 * Plans allowed to point the lens at a domain the tenant has not audited.
 *
 * The competitor lens is the Agency teaser. Enforced SERVER-SIDE in
 * assertUrlAllowed — hiding the input for other plans is presentation, not a
 * control, and the route is what stops a hand-rolled POST.
 */
export const CROSS_DOMAIN_PLANS: readonly PlanType[] = ["AGENCY", "ENTERPRISE"];

/**
 * 24 h per (tenant, url). A page's render output does not move minute to
 * minute, and a re-check inside the window returns the stored row rather than
 * spending an analysis — deliberately generous, because the common reflex after
 * reading a bad gap is to hit the button again.
 */
export const AI_LENS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Submissions per tenant per minute — a floor under the monthly allowance. */
export const AI_LENS_SUBMIT_RATE_LIMIT = 3;
export const AI_LENS_SUBMIT_RATE_WINDOW_MS = 60_000;

/**
 * Verdict bands on the gap percentage. Boundaries are inclusive at the bottom:
 * exactly 5.0% is "partial", exactly 25.0% is "substantial".
 *
 * These thresholds are the product's opinion, so they live here rather than
 * being re-derived in the client and the help copy independently.
 */
export type AiLensVerdict = "readable" | "partial" | "substantial";

export const AI_LENS_PARTIAL_THRESHOLD = 5;
export const AI_LENS_SUBSTANTIAL_THRESHOLD = 25;

export function aiLensVerdict(gapPercent: number): AiLensVerdict {
  if (gapPercent >= AI_LENS_SUBSTANTIAL_THRESHOLD) return "substantial";
  if (gapPercent >= AI_LENS_PARTIAL_THRESHOLD) return "partial";
  return "readable";
}

/** Rows on the history list. */
export const AI_LENS_HISTORY_LIMIT = 25;
