// The onboarding drip schedule, and the one function that queues it.
//
// EXTRACTED SO THE SCHEDULE HAS ONE DEFINITION. It previously lived inline in
// /api/auth/register, which made it look like a property of the registration
// route rather than of onboarding — so any second place that creates a tenant
// had to either import from a route handler or retype the four delays. A
// retyped schedule is one that drifts silently: nothing fails when d5 goes out
// on day six.
//
// ── THE JOB IDS ARE THE DEDUPE, AND THEY ARE FIXED ON PURPOSE ───────────────
//
// `onboarding-<tenantId>-<stage>` is deterministic, so enqueuing the same stage
// for the same tenant twice REPLACES rather than duplicates. That is what makes
// this function safe to call from more than one place, and safe to retry: a
// tenant that somehow passes through two provisioning paths still receives one
// d0, not two.
//
// No colon in the id, deliberately — see trialNoticeJobId in
// src/lib/billing/trial-notice.ts for the BullMQ rule that makes a colon a
// throw rather than a style preference.

import { addJob } from "@/infrastructure/queue/registry";
import type { OnboardingEmailStage } from "@/infrastructure/queue/jobs/schemas";

/**
 * Stage → delay from account creation.
 *
 * ── "d10" FIRES ON DAY SIX, AND THE NAME IS KEPT ON PURPOSE ────────────────
 *
 * The key is a WIRE IDENTIFIER, not a description of timing. It is half of the
 * dedupe id (`onboarding-<tenantId>-d10`), and jobs already sitting in Redis
 * with a ten-day delay carry it in their payload. Renaming it to `d6` would
 * mean:
 *
 *   • every in-flight job fails schema validation when it fires, because
 *     OnboardingEmailStage would no longer contain "d10"; and
 *   • a tenant re-enqueued after the rename gets BOTH `…-d10` (old, still
 *     queued) and `…-d6` (new) — two ids, so no dedupe, so two emails.
 *
 * Keeping the id is what makes this deploy safe for tenants already inside the
 * drip window: their queued job keeps its own baked-in ten-day delay and fires
 * once, and any re-enqueue collapses onto the same id. Only accounts created
 * after this deploy get the six-day delay.
 *
 * The stage's PURPOSE moved with its timing: it is now a pre-conversion value
 * recap, not a "your trial ends on <date>" notice. See the d10 block in
 * src/lib/onboarding-email.ts.
 */
export const ONBOARDING_DRIP_DELAYS: Record<OnboardingEmailStage, number> = {
  // D0 waits a few hours so the first audit exists when the recap renders.
  d0: 3 * 60 * 60 * 1000,
  d2: 2 * 24 * 60 * 60 * 1000,
  d5: 5 * 24 * 60 * 60 * 1000,
  // Day SIX. TRIAL_DAYS is 7, so this lands while the tenant is still TRIALING
  // and before Stripe converts them — which is what the stage's own status gate
  // has always assumed and, at ten days, never got.
  d10: 6 * 24 * 60 * 60 * 1000,
};

export const ONBOARDING_DRIP_STAGES = Object.keys(
  ONBOARDING_DRIP_DELAYS,
) as OnboardingEmailStage[];

/** The deterministic id for one tenant's stage. Exported so callers and tests
 *  agree on the dedupe key without restating its shape. */
export function onboardingJobId(tenantId: string, stage: OnboardingEmailStage): string {
  return `onboarding-${tenantId}-${stage}`;
}

/**
 * Queue the whole drip for a newly created tenant.
 *
 * NEVER THROWS. A queue that is down must not fail the account creation that
 * called it — the tenant exists and the customer is mid-flow, and losing a
 * marketing email is not a reason to hand them an error. The failure is logged
 * by the caller, which knows what it was doing at the time.
 *
 * The delayed jobs re-check tenant state at send time (consent, progress,
 * billing status) rather than trusting anything decided here, so enqueuing for
 * a tenant that later unsubscribes or lapses is harmless.
 */
export async function enqueueOnboardingDrip(tenantId: string): Promise<void> {
  await Promise.all(
    ONBOARDING_DRIP_STAGES.map((stage) =>
      addJob(
        "onboarding-email",
        "drip",
        { tenantId, correlationId: tenantId, stage },
        {
          jobId: onboardingJobId(tenantId, stage),
          delay: ONBOARDING_DRIP_DELAYS[stage],
        },
      ),
    ),
  );
}
