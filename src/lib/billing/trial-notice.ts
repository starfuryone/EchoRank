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
import { prisma } from "@/lib/prisma";
import { isEmailConfigured, missingEmailEnv, sendMail } from "@/lib/mailer";
import { resolveIntervalFromPriceId } from "@/lib/stripe/prices";
import { BILLING_URL, emailLocaleOf, renderTrialEndingEmail } from "./trial-ending-email";

const log = logger.child({ module: "trial-notice" });

const QUEUE = "trial-notice" as const;
const NOTICE_LEAD_MS = 24 * 60 * 60 * 1000;

/**
 * Deterministic job id, so scheduling twice for the same subscription replaces
 * rather than duplicates, and cancelling only needs the subscription id.
 *
 * NO COLON. BullMQ rejects a custom job id containing ":" unless it splits into
 * exactly three parts — the separator is reserved for its own Redis keys, and
 * the three-part shape is grandfathered in for legacy repeatable jobs
 * (node_modules/bullmq/dist/cjs/classes/job.js, validateOptions).
 *
 * The previous id was `trial-ending:${id}` — two parts — so every call threw
 * "Custom Id cannot contain :" inside Job.validateOptions, before Redis was
 * ever contacted. The webhook wraps this call in a try/catch that deliberately
 * never fails a delivery over a reminder, so the throw surfaced only as a
 * "Could not schedule trial-ending notice" warning on every single checkout.
 * The 24-hour notice has therefore never been scheduled, in any environment,
 * since it shipped. Found 2026-08-19 while diagnosing an unrelated event race.
 *
 * A hyphen carries the same meaning to a human reader and none to BullMQ.
 * Nothing is queued under the old id (nothing ever validated), so changing the
 * scheme orphans no jobs.
 */
export function trialNoticeJobId(stripeSubscriptionId: string): string {
  return `trial-ending-${stripeSubscriptionId}`;
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
 * ── WHY THIS THROWS, AND WHEN IT MUST NOT ───────────────────────────────────
 * A send failure THROWS, so BullMQ retries it: the trial-notice queue is
 * configured with attempts 3 and exponential backoff precisely because a
 * transient relay error here means a customer is charged with no warning.
 *
 * A MISSING ENV VAR IS NOT A TRANSIENT ERROR. Throwing on unconfigured SMTP
 * would burn all three attempts against a condition no retry can change, and
 * bury the actual cause under a stack of "job failed" lines. So that case logs
 * once, structured, names the variables, and returns — the job completes, the
 * queue stays clean, and the log says exactly which variable to set.
 *
 * ── IDEMPOTENT BY CONSTRUCTION ──────────────────────────────────────────────
 * Nothing here writes to the database. A retry, or a duplicate delivery from a
 * queue replay, re-reads the same rows and sends the same message; the worst
 * outcome is a customer warned twice about a charge, which is the right way to
 * fail. (An EmailLog row is not written because that table is customer-bound —
 * `EmailLog.customerId` — and the recipient here is an account owner, not a
 * Customer record. The same reason src/lib/visibility-alerts.ts bypasses it.)
 *
 * The "still trialing?" guard lives in the worker
 * (src/infrastructure/queue/workers/trial-notice.worker.ts), which re-reads the
 * subscription before calling this. It is re-checked HERE as well, on the row
 * this function loads anyway: the worker's read and this one are separate
 * queries, and this is the one that decides what the email says.
 */
export async function sendTrialEndingEmail(input: {
  tenantId: string;
  stripeSubscriptionId: string;
  trialEnd: number;
}): Promise<void> {
  const { tenantId, stripeSubscriptionId } = input;
  const trialEndsAt = new Date(input.trialEnd * 1000);

  if (!isEmailConfigured()) {
    log.warn(
      {
        tenantId,
        stripeSubscriptionId,
        trialEnd: trialEndsAt.toISOString(),
        missingEnv: missingEmailEnv(),
        queue: "trial-notice",
      },
      "Trial-ending email NOT SENT — SMTP is not configured; the card will still be charged",
    );
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      defaultLanguage: true,
      timezone: true,
      members: {
        where: { role: "OWNER" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { user: { select: { email: true } } },
      },
      subscription: {
        select: { status: true, planType: true, stripePriceId: true },
      },
    },
  });

  if (!tenant) {
    log.info({ tenantId, stripeSubscriptionId }, "Trial-ending email: tenant gone — skipping");
    return;
  }

  const subscription = tenant.subscription;
  if (!subscription || subscription.status !== "TRIALING") {
    // Re-checked at the last possible moment. Between the worker's guard and
    // this read a customer may have cancelled or converted, and a warning about
    // a charge that is not coming is its own support ticket.
    log.info(
      { tenantId, stripeSubscriptionId, status: subscription?.status ?? null },
      "Trial-ending email: no longer trialing — skipping",
    );
    return;
  }

  const to = tenant.members[0]?.user.email;
  if (!to) {
    log.warn(
      { tenantId, stripeSubscriptionId },
      "Trial-ending email: tenant has no OWNER email — nobody to warn",
    );
    return;
  }

  const interval = await resolveIntervalFromPriceId(subscription.stripePriceId);
  const locale = emailLocaleOf(tenant.defaultLanguage);
  const { subject, html, text } = renderTrialEndingEmail({
    planType: subscription.planType,
    interval,
    trialEndsAt,
    timezone: tenant.timezone,
    billingUrl: BILLING_URL,
    locale,
  });

  // Throws on a relay error — that is what makes the queue retry. A false
  // return means the message was held (SMTP_HOST unset, or the dev guard), and
  // sendMail has already logged which.
  const sent = await sendMail({ to: [to], subject, html, text });
  if (!sent) {
    log.warn(
      { tenantId, stripeSubscriptionId, locale, queue: "trial-notice" },
      "Trial-ending email was not delivered — the mailer held it",
    );
    return;
  }

  log.info(
    {
      tenantId,
      stripeSubscriptionId,
      locale,
      planType: subscription.planType,
      interval,
      trialEnd: trialEndsAt.toISOString(),
    },
    "Trial-ending email sent",
  );
}
