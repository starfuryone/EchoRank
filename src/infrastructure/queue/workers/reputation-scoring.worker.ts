import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { ReputationScoringJob } from "@/infrastructure/queue/jobs/schemas";
import { eventBus } from "@/infrastructure/events/bus";
import { EVENT_TYPES } from "@/infrastructure/events/types";
import { prisma } from "@/lib/prisma";

const QUEUE_NAME = "reputation-scoring";
const LOG_PREFIX = `[Worker:${QUEUE_NAME}]`;

/** Scoring period: last 30 days */
const SCORING_PERIOD_DAYS = 30;
/** Significant score change threshold (triggers alert) */
const SIGNIFICANT_CHANGE_THRESHOLD = 10;

// ─── Processor ────────────────────────────────────────────────────────────────

async function processReputationScoring(job: Job<ReputationScoringJob>): Promise<void> {
  const { tenantId, location, triggerEvent, correlationId } = job.data;

  console.log(
    `${LOG_PREFIX} Processing job ${job.id} - scoring for tenant ${tenantId}${location ? ` (location: ${location})` : ""} triggered by ${triggerEvent}`,
  );

  const now = new Date();
  const periodStart = new Date(now.getTime() - SCORING_PERIOD_DAYS * 86_400_000);
  const periodEnd = now;

  try {
    // ── Gather feedback data ──────────────────────────────────────────
    const feedbackWhere = {
      tenantId,
      status: "SUBMITTED" as const,
      submittedAt: { gte: periodStart, lte: periodEnd },
      ...(location ? { customer: { location } } : {}),
    };

    const feedbackData = await prisma.feedback.findMany({
      where: feedbackWhere,
      select: {
        id: true,
        rating: true,
        comment: true,
        submittedAt: true,
      },
    });

    // ── Gather ticket data (response rate & recovery rate) ───────────
    const tickets = await prisma.recoveryTicket.findMany({
      where: {
        tenantId,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      select: {
        id: true,
        status: true,
        resolvedAt: true,
        createdAt: true,
      },
    });

    // ── Gather AI analysis data for sentiment ────────────────────────
    const analyses = await prisma.aiAnalysis.findMany({
      where: {
        tenantId,
        createdAt: { gte: periodStart, lte: periodEnd },
        sentimentScore: { not: null },
      },
      select: {
        sentimentScore: true,
        sentimentLabel: true,
      },
    });

    // ── Gather external review data ──────────────────────────────────
    const externalReviews = await prisma.externalReview.findMany({
      where: {
        tenantId,
        publishedAt: { gte: periodStart, lte: periodEnd },
      },
      select: {
        rating: true,
        sentimentScore: true,
        publishedAt: true,
      },
    });

    // ── Calculate Scores ─────────────────────────────────────────────

    const sampleSize =
      feedbackData.length + externalReviews.length;

    // 1. Sentiment Score (0-100)
    let sentimentScore = 50;
    if (analyses.length > 0) {
      const avgSentiment =
        analyses.reduce((sum, a) => sum + (a.sentimentScore ?? 0), 0) / analyses.length;
      sentimentScore = Math.round(avgSentiment * 100);
    }

    // 2. Response Rate Score (0-100)
    const totalFeedbackNeedingResponse = feedbackData.filter(
      (f) => f.rating !== null && f.rating <= 3,
    ).length;
    const respondedTickets = tickets.filter(
      (t) => t.status === "RESOLVED" || t.status === "CLOSED",
    ).length;
    let responseRateScore = 100;
    if (totalFeedbackNeedingResponse > 0) {
      responseRateScore = Math.round(
        (Math.min(respondedTickets, totalFeedbackNeedingResponse) /
          totalFeedbackNeedingResponse) *
          100,
      );
    }

    // 3. Recovery Score (0-100): How well negative experiences are recovered
    const resolvedTickets = tickets.filter((t) => t.status === "RESOLVED");
    let recoveryScore = 50;
    if (tickets.length > 0) {
      recoveryScore = Math.round((resolvedTickets.length / tickets.length) * 100);
    }

    // 4. Review Velocity Score (0-100): Rate of new reviews over time
    const reviewsPerWeek = externalReviews.length / (SCORING_PERIOD_DAYS / 7);
    // Normalize: 10 reviews/week = 100 score
    const reviewVelocityScore = Math.min(Math.round((reviewsPerWeek / 10) * 100), 100);

    // 5. Overall Score (weighted average)
    const overallScore = Math.round(
      sentimentScore * 0.35 +
        responseRateScore * 0.25 +
        recoveryScore * 0.2 +
        reviewVelocityScore * 0.2,
    );

    // 6. Volatility Index: Standard deviation of recent ratings
    const allRatings = [
      ...feedbackData
        .filter((f) => f.rating !== null)
        .map((f) => f.rating!),
      ...externalReviews
        .filter((r) => r.rating !== null)
        .map((r) => r.rating!),
    ];

    let volatilityIndex = 0;
    if (allRatings.length > 1) {
      const mean = allRatings.reduce((s, r) => s + r, 0) / allRatings.length;
      const variance =
        allRatings.reduce((s, r) => s + (r - mean) ** 2, 0) / allRatings.length;
      volatilityIndex = Math.round(Math.sqrt(variance) * 100) / 100;
    }

    // 7. Risk Level
    let riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "LOW";
    if (overallScore < 30) riskLevel = "CRITICAL";
    else if (overallScore < 50) riskLevel = "HIGH";
    else if (overallScore < 70) riskLevel = "MODERATE";

    // 8. Trend Direction
    const previousScore = await prisma.reputationScore.findFirst({
      where: {
        tenantId,
        location: location ?? null,
      },
      orderBy: { createdAt: "desc" },
    });

    let trendDirection = "stable";
    if (previousScore) {
      const diff = overallScore - previousScore.overallScore;
      if (diff > 5) trendDirection = "improving";
      else if (diff < -5) trendDirection = "declining";
    }

    // 9. Confidence (based on sample size)
    const confidence = Math.min(sampleSize / 50, 1);

    // ── Store Score ──────────────────────────────────────────────────
    const score = await prisma.reputationScore.create({
      data: {
        tenantId,
        location: location ?? null,
        overallScore,
        sentimentScore,
        responseRateScore,
        recoveryScore,
        reviewVelocityScore,
        volatilityIndex,
        riskLevel,
        trendDirection,
        periodStart,
        periodEnd,
        sampleSize,
        confidence,
      },
    });

    console.log(
      `${LOG_PREFIX} Score calculated: overall=${overallScore}, risk=${riskLevel}, trend=${trendDirection} (sample=${sampleSize})`,
    );

    // ── Detect Significant Changes ───────────────────────────────────
    if (
      previousScore &&
      Math.abs(overallScore - previousScore.overallScore) >= SIGNIFICANT_CHANGE_THRESHOLD
    ) {
      const direction =
        overallScore > previousScore.overallScore ? "improved" : "declined";

      await eventBus.emit({
        tenantId,
        eventType: EVENT_TYPES.SENTIMENT_CHANGED,
        eventVersion: 1,
        aggregateType: "ReputationScore",
        aggregateId: score.id,
        payload: {
          tenantId,
          correlationId,
          timestamp: new Date().toISOString(),
          version: 1,
          entityType: "ReputationScore",
          entityId: score.id,
          previousSentiment: `${previousScore.overallScore}`,
          newSentiment: `${overallScore}`,
        },
        correlationId,
      });

      console.log(
        `${LOG_PREFIX} Significant score change detected: ${previousScore.overallScore} -> ${overallScore} (${direction})`,
      );
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`${LOG_PREFIX} Reputation scoring failed:`, errorMsg);
    throw err;
  }
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<ReputationScoringJob> | null = null;

export function startReputationScoringWorker(): Worker<ReputationScoringJob> {
  if (worker) return worker;

  worker = new Worker<ReputationScoringJob>(QUEUE_NAME, processReputationScoring, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 2,
    limiter: {
      max: 20,
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

export async function stopReputationScoringWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log(`${LOG_PREFIX} Worker stopped`);
  }
}

export { processReputationScoring };
