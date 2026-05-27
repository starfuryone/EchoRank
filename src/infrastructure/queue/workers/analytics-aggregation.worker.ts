import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { AnalyticsAggregationJob } from "@/infrastructure/queue/jobs/schemas";
import { prisma } from "@/lib/prisma";

const QUEUE_NAME = "analytics-aggregation";
const LOG_PREFIX = `[Worker:${QUEUE_NAME}]`;

// ─── Processor ────────────────────────────────────────────────────────────────

async function processAnalyticsAggregation(
  job: Job<AnalyticsAggregationJob>,
): Promise<void> {
  const { tenantId, periodType, periodStart, periodEnd } = job.data;

  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  console.log(
    `${LOG_PREFIX} Processing job ${job.id} - ${periodType} aggregation for tenant ${tenantId} (${periodStart} to ${periodEnd})`,
  );

  try {
    // ── Aggregate Emails Sent ────────────────────────────────────────
    const emailsSent = await prisma.usageMeter.count({
      where: {
        tenantId,
        meterType: "EMAIL_SENT",
        recordedAt: { gte: start, lte: end },
      },
    });

    // ── Aggregate SMS Sent ───────────────────────────────────────────
    const smsSent = await prisma.usageMeter.count({
      where: {
        tenantId,
        meterType: "SMS_SENT",
        recordedAt: { gte: start, lte: end },
      },
    });

    // ── Aggregate Webhook Calls ──────────────────────────────────────
    const webhookCalls = await prisma.usageMeter.count({
      where: {
        tenantId,
        meterType: "WEBHOOK_CALL",
        recordedAt: { gte: start, lte: end },
      },
    });

    // ── Aggregate API Requests ───────────────────────────────────────
    const apiRequests = await prisma.usageMeter.count({
      where: {
        tenantId,
        meterType: "API_REQUEST",
        recordedAt: { gte: start, lte: end },
      },
    });

    // ── Aggregate AI Token Usage ─────────────────────────────────────
    const aiTokenResult = await prisma.usageMeter.aggregate({
      where: {
        tenantId,
        meterType: "AI_TOKEN_USAGE",
        recordedAt: { gte: start, lte: end },
      },
      _sum: { quantity: true },
    });
    const aiTokensUsed = aiTokenResult._sum.quantity ?? 0;

    // ── Aggregate AI Inferences ──────────────────────────────────────
    const aiInferences = await prisma.usageMeter.count({
      where: {
        tenantId,
        meterType: "AI_INFERENCE",
        recordedAt: { gte: start, lte: end },
      },
    });

    // ── Aggregate Feedback Requests ──────────────────────────────────
    const feedbackRequests = await prisma.usageMeter.count({
      where: {
        tenantId,
        meterType: "FEEDBACK_REQUEST",
        recordedAt: { gte: start, lte: end },
      },
    });

    // ── Aggregate Review Conversions ─────────────────────────────────
    const reviewConversions = await prisma.usageMeter.count({
      where: {
        tenantId,
        meterType: "REVIEW_CONVERSION",
        recordedAt: { gte: start, lte: end },
      },
    });

    // ── Aggregate Escalation Events ──────────────────────────────────
    const escalationEvents = await prisma.usageMeter.count({
      where: {
        tenantId,
        meterType: "ESCALATION_EVENT",
        recordedAt: { gte: start, lte: end },
      },
    });

    // ── Aggregate Monitoring Checks ──────────────────────────────────
    const monitoringChecks = await prisma.usageMeter.count({
      where: {
        tenantId,
        meterType: "MONITORING_CHECK",
        recordedAt: { gte: start, lte: end },
      },
    });

    // ── Calculate AI Cost ────────────────────────────────────────────
    // Rough cost estimate: $0.002 per 1K tokens
    const aiCost = Math.round((aiTokensUsed / 1000) * 0.002 * 100) / 100;

    // ── Calculate Total Cost ─────────────────────────────────────────
    const quotas = await prisma.tenantQuota.findUnique({
      where: { tenantId },
    });

    const overageRateEmail = quotas?.overageRateEmail ?? 0.01;
    const overageRateSms = quotas?.overageRateSms ?? 0.05;

    const totalCost =
      Math.round(
        (emailsSent * overageRateEmail +
          smsSent * overageRateSms +
          aiCost) *
          100,
      ) / 100;

    // ── Upsert UsageSnapshot ─────────────────────────────────────────
    await prisma.usageSnapshot.upsert({
      where: {
        tenantId_periodStart_periodEnd: {
          tenantId,
          periodStart: start,
          periodEnd: end,
        },
      },
      update: {
        emailsSent,
        smsSent,
        webhookCalls,
        apiRequests,
        aiTokensUsed,
        aiInferences,
        aiCost,
        feedbackRequests,
        reviewConversions,
        escalationEvents,
        monitoringChecks,
        totalCost,
      },
      create: {
        tenantId,
        periodStart: start,
        periodEnd: end,
        emailsSent,
        smsSent,
        webhookCalls,
        apiRequests,
        aiTokensUsed,
        aiInferences,
        aiCost,
        feedbackRequests,
        reviewConversions,
        escalationEvents,
        monitoringChecks,
        totalCost,
      },
    });

    console.log(
      `${LOG_PREFIX} Analytics aggregation complete for tenant ${tenantId}: ` +
        `emails=${emailsSent}, sms=${smsSent}, webhooks=${webhookCalls}, ` +
        `ai_tokens=${aiTokensUsed}, ai_inferences=${aiInferences}, ` +
        `escalations=${escalationEvents}, cost=$${totalCost}`,
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`${LOG_PREFIX} Analytics aggregation failed:`, errorMsg);
    throw err;
  }
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<AnalyticsAggregationJob> | null = null;

export function startAnalyticsAggregationWorker(): Worker<AnalyticsAggregationJob> {
  if (worker) return worker;

  worker = new Worker<AnalyticsAggregationJob>(QUEUE_NAME, processAnalyticsAggregation, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 2,
    limiter: {
      max: 10,
      duration: 60_000,
    },
  });

  worker.on("completed", (job) => {
    console.log(`${LOG_PREFIX} Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `${LOG_PREFIX} Job ${job?.id} failed (attempt ${job?.attemptsMade}):`,
      err.message,
    );
  });

  worker.on("error", (err) => {
    console.error(`${LOG_PREFIX} Worker error:`, err.message);
  });

  console.log(`${LOG_PREFIX} Worker started`);
  return worker;
}

export async function stopAnalyticsAggregationWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log(`${LOG_PREFIX} Worker stopped`);
  }
}

export { processAnalyticsAggregation };
