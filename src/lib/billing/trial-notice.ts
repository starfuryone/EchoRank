// 24-hour trial-ending notice.
//
// WHY THIS IS OUR JOB AND NOT A WEBHOOK. Stripe's customer.subscription
// trial_will_end fires three days before the trial converts, not twenty-four
// hours, and the interval is not configurable. So the webhook logs that event
// for visibility and this delayed job does the actual notifying.
//
// The card is collected up front and Stripe charges it automatically when the
// trial ends, which is precisely why the warning matters: without it the first
// signal a customer gets is a charge.

import { getQueue } from "@/infrastructure/queue/registry";
import type { TrialNoticeJob } from "@/infrastructure/queue/jobs/schemas";
import { logger } from "@/infrastructure/observability/logger";

const log = logger.child({ module: "trial-notice" });

const QUEUE = "trial-notice" as const;
const NOTICE_LEAD_MS = 24 * 60 * 60 * 1000;

/**
 * Deterministic job id, so scheduling twice for the same subscription replaces
 * rather than duplicates, and cancelling only needs the subscription id.
 */
export function trialNoticeJobId(stripeSubscriptionId: string): string {
  return `trial-ending:${stripeSubscriptionId}`;
}

/**
 * Queue the notice for trial_end minus 24h.
 *
 * A trial ending within the next day (or already over) gets no job: firing
 * immediately would send a "you will be charged tomorrow" note after the
 * charge, which is worse than staying quiet.
 */
export async function scheduleTrialEndingNotice(input: {
  tenantId: string;
  stripeSubscriptionId: string;
  /** Unix seconds, as Stripe reports it. */
  trialEnd: number | null | undefined;
}): Promise<boolean> {
  const { tenantId, stripeSubscriptionId, trialEnd } = input;
  if (!trialEnd) return false;

  const fireAt = trialEnd * 1000 - NOTICE_LEAD_MS;
  const delay = fireAt - Date.now();
  if (delay <= 0) {
    log.info(
      { tenantId, stripeSubscriptionId, trialEnd },
      "Trial ends within 24h — no notice scheduled",
    );
    return false;
  }

  const payload: TrialNoticeJob = { tenantId, stripeSubscriptionId, trialEnd };
  await getQueue(QUEUE).add("trial-ending", payload, {
    delay,
    jobId: trialNoticeJobId(stripeSubscriptionId),
  });

  log.info(
    { tenantId, stripeSubscriptionId, delayMs: delay },
    "Trial-ending notice scheduled",
  );
  return true;
}

/**
 * Drop a pending notice — the subscription was cancelled, or the trial ended
 * early. Safe to call when nothing is queued.
 */
export async function cancelTrialEndingNotice(
  stripeSubscriptionId: string,
): Promise<void> {
  try {
    const job = await getQueue(QUEUE).getJob(trialNoticeJobId(stripeSubscriptionId));
    if (job) {
      await job.remove();
      log.info({ stripeSubscriptionId }, "Trial-ending notice cancelled");
    }
  } catch (err) {
    // Never let notice bookkeeping fail a webhook — Stripe would retry the
    // whole event over a job that no longer matters.
    log.warn({ err, stripeSubscriptionId }, "Could not cancel trial-ending notice");
  }
}

/**
 * The single send point.
 *
 * TODO(brevo): replace the log with a Brevo transactional send. Brevo is not
 * wired for this template yet, and shipping a half-real send — writing an
 * EmailLog row for a message nobody received — would be worse than logging.
 * Everything the template needs is already in the arguments.
 */
export async function sendTrialEndingEmail(input: {
  tenantId: string;
  stripeSubscriptionId: string;
  trialEnd: number;
}): Promise<void> {
  log.warn(
    {
      tenantId: input.tenantId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      trialEnd: new Date(input.trialEnd * 1000).toISOString(),
      stub: true,
    },
    "TRIAL ENDING IN 24H — email not sent (Brevo not wired; see TODO(brevo))",
  );
}
