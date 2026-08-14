/**
 * Citation Opportunity Engine worker.
 *
 * Two jobs on one queue, the same sweep/score split its two siblings use. A
 * repeatable WEEKLY sweep finds the tenants with tracking on and enqueues one
 * scoring pass each; a pass turns that tenant's `sources` rows into a get-listed
 * worklist and alerts on the top quartile of what is new.
 *
 * ── This is the one aggregation job that SPENDS ─────────────────────────────
 * sov-aggregation and citation-aggregation are pure database work, retry freely
 * and cost a read. This one makes at most one DataForSEO referring-domains call
 * per tenant per week to answer "are we already listed there" — observed at
 * $0.0258 on the recorded envelope. Three consequences, all deliberate:
 *
 *   - SEPARATE QUEUE. Not because of throughput but because of the retry
 *     policy: `citation-opportunities` gets ONE attempt (see registry.ts),
 *     where its siblings get three. Sharing a queue would mean sharing that
 *     policy with jobs that want the opposite of it.
 *   - WEEKLY, NOT NIGHTLY. The spec says weekly and the economics agree: a
 *     tenant's referring domains do not change overnight, the cache TTL is
 *     seven days, and a nightly version would be seven times the spend for the
 *     same worklist.
 *   - THE COST IS LOGGED per tenant and per sweep, in dollars, because a
 *     line-item that quietly gets more expensive is otherwise invisible until
 *     the monthly cap trips.
 *
 * ── It reads `sources`, never `citations` ───────────────────────────────────
 * So Citation.sourceId — the nightly rollup's watermark — is untouched. See
 * src/lib/citation-opportunities/store.ts for the full argument. The 04:20
 * Monday tick is 45 minutes behind the nightly citation rollup at 03:35 purely
 * so the week's first worklist is built on a rollup that has just run; nothing
 * about correctness depends on the ordering, because the rollup is idempotent
 * and this job recomputes from scratch.
 *
 * ── A MISSED WEEK COSTS NOTHING ─────────────────────────────────────────────
 * There is no window and no watermark. Every sweep recomputes the whole
 * worklist from the current state of `sources`, so a skipped Monday leaves last
 * week's rows in place — including every status the customer has set — and the
 * next Monday produces exactly what the missed one would have.
 */

import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import { getQueue, addJob } from "@/infrastructure/queue/registry";
import { logger } from "@/infrastructure/observability/logger";
import type { CitationOpportunityJob } from "@/infrastructure/queue/jobs/schemas";
import { listOpportunityTenants, loadCandidates, sweepTenant } from "@/lib/citation-opportunities/store";
import { checkListed } from "@/lib/citation-opportunities/listed";
import { p75 } from "@/lib/citation-opportunities/score";
import { notifyCitationOpportunity } from "@/lib/notifications/adapters";

const QUEUE_NAME = "citation-opportunities" as const;
const SWEEP_JOB_NAME = "sweep";
const SCORE_JOB_NAME = "score";

/**
 * Mondays at 04:20 UTC.
 *
 * Monday because the output is a week's worth of work and Monday is when
 * somebody picks it up; 04:20 because it is behind every nightly job that feeds
 * it and well clear of business hours in every market this product sells into.
 */
const SWEEP_CRON = "20 4 * * 1";

/**
 * Tenants scored at once in this process.
 *
 * ONE, which is lower than either sibling and is about money, not memory. Each
 * pass can make a metered upstream call, and the monthly USD cap is read
 * (spentThisMonth) and then spent against; two passes running concurrently for
 * the same tenant would both read a spend figure that neither has updated yet.
 * The jobId below makes that impossible per tenant, and a concurrency of one
 * makes it impossible full stop — at the cost of a sweep that takes a few
 * seconds longer once a week, which is not a cost.
 */
const CONCURRENCY = 1;

/** Enqueue one scoring pass per tracked tenant. */
async function sweep(): Promise<number> {
  const tenants = await listOpportunityTenants();

  for (const tenant of tenants) {
    await addJob<CitationOpportunityJob>(
      QUEUE_NAME,
      SCORE_JOB_NAME,
      { tenantId: tenant.tenantId },
      // Keyed on the tenant alone, no date: two passes for one tenant must
      // never run concurrently, because both would read the same monthly spend
      // and both would decide they were under the cap. A jobId that already
      // exists is dropped by BullMQ, which is exactly the mutual exclusion this
      // needs — and a dropped job costs nothing, because next week's pass
      // recomputes the same worklist from scratch.
      { jobId: `citation-opps:${tenant.tenantId}` },
    );
  }

  logger.info({ queue: QUEUE_NAME, enqueued: tenants.length }, "citation opportunity sweep complete");
  return tenants.length;
}

/**
 * Score one tenant.
 *
 * Re-reads the tenant rather than trusting the job payload for its website and
 * topics: the payload was written by a sweep that may be minutes or hours old,
 * and the website is the backlink target the whole listed-check hangs off.
 */
async function scoreOne(job: CitationOpportunityJob): Promise<void> {
  const { tenantId } = job;
  if (!tenantId) {
    throw new Error("scoring job needs a tenantId");
  }

  const tenants = await listOpportunityTenants(tenantId);
  const tenant = tenants.find((candidate) => candidate.tenantId === tenantId);
  if (!tenant) {
    logger.warn(
      { tenantId },
      "tenant stopped tracking before its citation opportunity pass ran",
    );
    return;
  }

  // The listed check needs the candidate domains, so candidates are loaded
  // first and then loaded again inside sweepTenant. Two reads of a small,
  // indexed table, and the alternative — threading the list through — would
  // make sweepTenant's contract depend on the caller having already done half
  // its work.
  const candidates = await loadCandidates(tenantId);

  const listed = await checkListed({
    tenantId,
    target: tenant.target,
    // Most-cited first, so if the per-call ceiling ever bites, what goes
    // unchecked is the tail rather than the domains most likely to matter.
    domains: candidates
      .slice()
      .sort((a, b) => b.seenCount - a.seenCount || a.domain.localeCompare(b.domain))
      .map((candidate) => candidate.domain),
  });

  const listedDomains = new Set(
    [...listed.verdicts.entries()]
      .filter(([, verdict]) => verdict === "listed")
      .map(([domain]) => domain),
  );

  const result = await sweepTenant({ tenant, listed: listedDomains });

  // ── The p75 alert pass ──────────────────────────────────────────────────
  // The cut is taken over THIS SWEEP'S WHOLE distribution, including rows that
  // already existed, but only NEW rows can fire. Taking it over the new rows
  // alone would make "top quartile" mean "top quartile of this week's
  // newcomers", which on a week with one newcomer is a guaranteed alert for
  // whatever turned up.
  const cut = p75(result.scored.map((row) => row.priority));
  const createdSet = new Set(result.created);
  const alerted = cut === null
    ? []
    : result.scored.filter((row) => createdSet.has(row.domain) && row.priority > cut);

  for (const row of alerted) {
    // Fire-and-forget by contract: recordNotification never throws, and a
    // notification that failed to write must not lose the worklist that is
    // already committed above.
    await notifyCitationOpportunity({
      tenantId,
      domain: row.domain,
      priority: row.priority,
    });
  }

  logger.info(
    {
      queue: QUEUE_NAME,
      tenantId,
      candidates: candidates.length,
      scored: result.scored.length,
      created: result.created.length,
      updated: result.updated.length,
      retired: result.retired,
      skippedListed: result.skippedListed,
      skippedManual: result.skippedManual,
      alerted: alerted.length,
      p75: cut,
      // Dollars, per tenant, every week. See this file's header.
      costUsd: Number(listed.costUsd.toFixed(6)),
      dataforseoCalled: listed.called,
      skipReason: listed.skipReason ?? null,
    },
    "citation opportunity pass complete",
  );
}

async function processCitationOpportunityJob(job: Job<CitationOpportunityJob>): Promise<void> {
  if (job.data.sweep) {
    await sweep();
    return;
  }
  await scoreOne(job.data);
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<CitationOpportunityJob> | null = null;

export function startCitationOpportunitiesWorker(): Worker<CitationOpportunityJob> {
  if (worker) return worker;

  worker = new Worker<CitationOpportunityJob>(QUEUE_NAME, processCitationOpportunityJob, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: CONCURRENCY,
  });

  // Repeatable weekly tick. BullMQ dedupes the repeat config across restarts.
  getQueue(QUEUE_NAME)
    .add(
      SWEEP_JOB_NAME,
      { sweep: true },
      {
        repeat: { pattern: SWEEP_CRON, tz: "UTC" },
        removeOnComplete: true,
        removeOnFail: { count: 50 },
      },
    )
    .catch((err) => {
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule citation opportunity sweep");
    });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, queue: QUEUE_NAME }, "Job completed");
  });
  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, attempt: job?.attemptsMade, err, queue: QUEUE_NAME },
      "Job failed",
    );
  });
  worker.on("error", (err) => {
    logger.error({ err, queue: QUEUE_NAME }, "Worker error");
  });

  return worker;
}

export async function stopCitationOpportunitiesWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

export { processCitationOpportunityJob, sweep, scoreOne, SWEEP_CRON };
