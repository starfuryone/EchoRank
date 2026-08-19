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

/** Stage → delay from account creation. */
export const ONBOARDING_DRIP_DELAYS: Record<OnboardingEmailStage, number> = {
  // D0 waits a few hours so the first audit exists when the recap renders.
  d0: 3 * 60 * 60 * 1000,
  d2: 2 * 24 * 60 * 60 * 1000,
  d5: 5 * 24 * 60 * 60 * 1000,
  d10: 10 * 24 * 60 * 60 * 1000,
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
