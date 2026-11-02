// src/lib/snapshot/job.ts
//
// The two `visibility-monitoring` job types the free check adds:
//   snapshot        { snapshotId }  — ask, score, build the report;
//   snapshot-email  { leadId }      — PDF + report email + Brevo list.
// Both throw on a final failure, so the support@ queue alert covers them.
import "server-only";

import { UnrecoverableError } from "bullmq";
import { logger } from "@/infrastructure/observability/logger";
import { addJob } from "@/infrastructure/queue/registry";
import { queueJobId } from "@/infrastructure/queue/job-id";
import { askEngine, askJson, configuredEngines, costOf, estimateCall } from "./engines";
import { runCapUsd, runSnapshot } from "./run";
import * as store from "./store";
import { sendReport, subscribeToList } from "./deliver";

export const SNAPSHOT_JOB = "snapshot";
export const SNAPSHOT_EMAIL_JOB = "snapshot-email";
const ATTEMPTS = 2;

export async function enqueueSnapshot(snapshotId: string): Promise<void> {
  await addJob(
    "visibility-monitoring",
    SNAPSHOT_JOB,
    { snapshotId },
    {
      jobId: queueJobId("snapshot", snapshotId),
      attempts: ATTEMPTS,
      backoff: { type: "fixed", delay: 15_000 },
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 7 * 86_400 },
    },
  );
}

export async function enqueueSnapshotEmail(leadId: string): Promise<void> {
  await addJob(
    "visibility-monitoring",
    SNAPSHOT_EMAIL_JOB,
    { snapshotLeadId: leadId },
    {
      jobId: queueJobId("snapshot-email", leadId),
      attempts: 4,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 7 * 86_400 },
    },
  );
}

export async function processSnapshot(snapshotId: string, attemptsMade: number, attempts = ATTEMPTS): Promise<void> {
  const run = await store.getSnapshot(snapshotId);
  if (!run) throw new UnrecoverableError(`snapshot ${snapshotId} not found`);
  if (run.status === "done" || run.status === "failed") return;
  const finalAttempt = attemptsMade + 1 >= attempts;

  // The engines the run was created with; a key removed since is simply absent.
  const engines = configuredEngines().filter((e) => run.engines.includes(e.engine));
  if (!engines.length) {
    await store.failSnapshot(snapshotId, "no engine configured");
    throw new UnrecoverableError("snapshot: no engine configured (OPENAI_/GEMINI_ key + *_SNAPSHOT_MODEL)");
  }

  await store.markRunning(snapshotId);
  const result = await runSnapshot(run, {
    engines,
    capUsd: runCapUsd(),
    ask: askEngine,
    askJson,
    cost: costOf,
    estimate: estimateCall,
    loadAnswers: store.loadAnswers,
    saveAnswer: store.saveAnswer,
    saveCompetitors: store.saveCompetitors,
  });

  const log = { snapshotId, domain: run.domain, costUsd: result.costUsd.toFixed(4), calls: result.calls, capped: result.report.capped };
  if (result.allErrored) {
    const first = (await store.loadAnswers(snapshotId)).find((a) => a.error)?.error ?? "unknown";
    if (finalAttempt) await store.failSnapshot(snapshotId, `every answer errored; first: ${first}`, result.costUsd, result.calls);
    logger.error({ ...log, firstError: first }, "Snapshot: every answer errored");
    // Retry only re-asks the errored calls; past the last attempt this is final.
    throw new Error(`snapshot: every answer errored; first: ${first}`);
  }
  await store.finishSnapshot(snapshotId, result.report, result.costUsd, result.calls);
  logger.info(log, "Snapshot complete");
}

export async function processSnapshotEmail(leadId: string): Promise<void> {
  const lead = await store.getLead(leadId);
  if (!lead) throw new UnrecoverableError(`snapshot lead ${leadId} not found`);
  const run = lead.snapshot;
  if (run.status !== "done" || !run.report || !run.shareToken) throw new UnrecoverableError("snapshot lead: run has no report");
  // Report first: it is what the visitor asked for. A retry after a Brevo
  // failure does not send it twice.
  let sent = !!lead.emailedAt;
  if (!sent) {
    sent = await sendReport({
      email: lead.email,
      locale: lead.locale,
      report: run.report as unknown as Parameters<typeof sendReport>[0]["report"],
      token: run.shareToken,
    });
    if (sent) await store.markLeadEmailed(leadId);
  }
  if (lead.marketingConsent) await subscribeToList(lead.email, lead.locale, run.domain);
  logger.info({ leadId, snapshotId: run.id, sent }, sent ? "Snapshot report emailed" : "Snapshot report email not sent (mail off / dry run)");
}
