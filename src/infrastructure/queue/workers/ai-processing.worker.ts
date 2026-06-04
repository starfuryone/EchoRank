import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { AiProcessingJob } from "@/infrastructure/queue/jobs/schemas";
import { eventBus } from "@/infrastructure/events/bus";
import { EVENT_TYPES } from "@/infrastructure/events/types";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { withSpan } from "@/infrastructure/observability/telemetry";

const QUEUE_NAME = "ai-processing";

// ─── Mock AI Service ──────────────────────────────────────────────────────────

interface MockAiResult {
  sentimentLabel: string;
  sentimentScore: number;
  escalationProbability: number;
  publicPostProbability: number;
  churnProbability: number;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  intent: string;
  entities: Record<string, string[]>;
  emotions: Record<string, number>;
  topics: string[];
  suggestedAction: string;
  confidence: number;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

function generateMockAnalysis(content: string, _analysisType: string, rating?: number): MockAiResult {
  // Simulate realistic analysis based on content characteristics
  const contentLength = content.length;
  const hasNegativeWords =
    /angry|terrible|worst|horrible|disgusting|unacceptable|never again|lawsuit|refund/i.test(
      content,
    );
  const hasPositiveWords = /great|excellent|amazing|wonderful|love|perfect|outstanding/i.test(
    content,
  );
  const hasUrgencyWords = /urgent|immediately|asap|right now|emergency|critical/i.test(content);

  // Determine sentiment — rating is the primary signal, keywords fallback
  let sentimentScore = 0.5;
  let sentimentLabel = "neutral";
  if (rating != null) {
    if (rating >= 4) {
      sentimentScore = rating >= 5 ? 0.9 : 0.7;
      sentimentLabel = "positive";
    } else if (rating <= 2) {
      sentimentScore = rating <= 1 ? 0.1 : 0.3;
      sentimentLabel = "negative";
    } else {
      sentimentScore = 0.5;
      sentimentLabel = "neutral";
    }
  } else if (hasNegativeWords) {
    sentimentScore = 0.2;
    sentimentLabel = "negative";
  } else if (hasPositiveWords) {
    sentimentScore = 0.8;
    sentimentLabel = "positive";
  }

  // Escalation probability
  let escalationProbability = 0.1;
  if (hasNegativeWords) escalationProbability += 0.4;
  if (rating != null && rating <= 2) escalationProbability += 0.35;
  if (hasUrgencyWords) escalationProbability += 0.3;
  if (contentLength > 500) escalationProbability += 0.1;
  escalationProbability = Math.min(escalationProbability, 0.99);

  // Risk level
  let riskLevel: MockAiResult["riskLevel"] = "LOW";
  if (escalationProbability > 0.8) riskLevel = "CRITICAL";
  else if (escalationProbability > 0.6) riskLevel = "HIGH";
  else if (escalationProbability > 0.3) riskLevel = "MODERATE";

  // Other probabilities
  const publicPostProbability = hasNegativeWords ? 0.5 + Math.random() * 0.4 : Math.random() * 0.3;
  const churnProbability = hasNegativeWords ? 0.4 + Math.random() * 0.4 : Math.random() * 0.2;

  // Intent classification
  const intents = hasNegativeWords
    ? ["complaint", "refund_request", "escalation"]
    : hasPositiveWords
      ? ["praise", "recommendation", "loyalty"]
      : ["inquiry", "feedback", "suggestion"];
  const intent = intents[Math.floor(Math.random() * intents.length)];

  // Suggested action
  const actions: Record<string, string> = {
    complaint: "Assign to customer recovery team for immediate follow-up",
    refund_request: "Route to billing team with priority handling",
    escalation: "Alert manager and initiate recovery protocol",
    praise: "Send thank-you and request public review",
    recommendation: "Add to testimonial pipeline",
    loyalty: "Offer loyalty reward or referral program invite",
    inquiry: "Route to appropriate department for response",
    feedback: "Log and include in monthly analysis report",
    suggestion: "Forward to product team for consideration",
  };

  // Simulate processing time
  const latencyMs = 200 + Math.floor(Math.random() * 800);
  const promptTokens = Math.floor(content.length / 4) + 50;
  const completionTokens = 150 + Math.floor(Math.random() * 350);

  return {
    sentimentLabel,
    sentimentScore: Math.round(sentimentScore * 1000) / 1000,
    escalationProbability: Math.round(escalationProbability * 1000) / 1000,
    publicPostProbability: Math.round(publicPostProbability * 1000) / 1000,
    churnProbability: Math.round(churnProbability * 1000) / 1000,
    riskLevel,
    intent,
    entities: {
      products: ["service", "product"],
      locations: [],
      people: [],
    },
    emotions: {
      anger: hasNegativeWords ? 0.7 : 0.1,
      joy: hasPositiveWords ? 0.8 : 0.1,
      frustration: hasNegativeWords ? 0.6 : 0.05,
      satisfaction: hasPositiveWords ? 0.7 : 0.2,
    },
    topics: ["customer_service", "product_quality"],
    suggestedAction: actions[intent] || "Review and categorize for analysis",
    confidence: 0.75 + Math.random() * 0.2,
    promptTokens,
    completionTokens,
    latencyMs,
  };
}

// ─── Processor ────────────────────────────────────────────────────────────────

async function processAiJob(job: Job<AiProcessingJob>): Promise<void> {
  await withSpan("ai-processing.process", async (span) => {
    const { tenantId, feedbackId, externalReviewId, analysisType, content, correlationId } =
      job.data;

    span.setAttributes({
      "job.id": job.id ?? "",
      "tenant.id": tenantId,
      "analysis.type": analysisType,
    });

    logger.info(
      { jobId: job.id, tenantId, analysisType, queue: QUEUE_NAME },
      "Processing job",
    );

    // ── Idempotency Check ──────────────────────────────────────────────────
    const existingAnalysis = await prisma.aiAnalysis.findFirst({
      where: {
        tenantId,
        feedbackId: feedbackId ?? undefined,
        externalReviewId: externalReviewId ?? undefined,
        analysisType,
      },
    });

    if (existingAnalysis) {
      logger.info(
        { jobId: job.id, tenantId, analysisId: existingAnalysis.id, queue: QUEUE_NAME },
        "Idempotency: analysis already exists, skipping",
      );
      return;
    }

    try {
      // ── Run AI Analysis (mock) ──────────────────────────────────────
      const result = generateMockAnalysis(content, analysisType, job.data.rating);

      // ── Store Result in AiAnalysis Table ─────────────────────────────
      const analysis = await prisma.aiAnalysis.create({
        data: {
          tenantId,
          feedbackId: feedbackId ?? null,
          externalReviewId: externalReviewId ?? null,
          analysisType,
          sentimentLabel: result.sentimentLabel,
          sentimentScore: result.sentimentScore,
          escalationProbability: result.escalationProbability,
          publicPostProbability: result.publicPostProbability,
          churnProbability: result.churnProbability,
          riskLevel: result.riskLevel,
          intent: result.intent,
          entities: result.entities,
          emotions: result.emotions,
          topics: result.topics,
          suggestedAction: result.suggestedAction,
          confidence: result.confidence,
          modelId: "mock-model-v1",
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          latencyMs: result.latencyMs,
        },
      });

      // ── Propagate result onto the parent ExternalReview ──────────────
      if (externalReviewId) {
        await prisma.externalReview.update({
          where: { id: externalReviewId },
          data: {
            sentimentLabel: result.sentimentLabel,
            sentimentScore: result.sentimentScore,
            riskLevel: result.riskLevel,
            isProcessed: true,
          },
        });
      }

      // ── Record Token Usage in UsageMeter ─────────────────────────────
      await prisma.usageMeter.create({
        data: {
          tenantId,
          meterType: "AI_TOKEN_USAGE",
          quantity: result.promptTokens + result.completionTokens,
          metadata: {
            analysisId: analysis.id,
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            correlationId,
            jobId: job.id,
          },
        },
      });

      await prisma.usageMeter.create({
        data: {
          tenantId,
          meterType: "AI_INFERENCE",
          quantity: 1,
          metadata: {
            analysisId: analysis.id,
            analysisType,
            latencyMs: result.latencyMs,
            correlationId,
          },
        },
      });

      // ── Emit Events Based on Risk Level ──────────────────────────────
      if (result.riskLevel === "HIGH" || result.riskLevel === "CRITICAL") {
        await eventBus.emit({
          tenantId,
          eventType: EVENT_TYPES.AI_RISK_DETECTED,
          eventVersion: 1,
          aggregateType: "AiAnalysis",
          aggregateId: analysis.id,
          payload: {
            tenantId,
            correlationId,
            timestamp: new Date().toISOString(),
            version: 1,
            analysisId: analysis.id,
            riskLevel: result.riskLevel,
            riskType: result.intent,
            confidence: result.confidence,
          },
          correlationId,
        });
      }

      logger.info(
        {
          jobId: job.id,
          tenantId,
          analysisId: analysis.id,
          riskLevel: result.riskLevel,
          sentimentLabel: result.sentimentLabel,
          queue: QUEUE_NAME,
        },
        "AI analysis completed",
      );
    } catch (err) {
      logger.error(
        { jobId: job.id, tenantId, err, queue: QUEUE_NAME },
        "AI processing failed",
      );
      throw err;
    }
  });
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<AiProcessingJob> | null = null;

export function startAiProcessingWorker(): Worker<AiProcessingJob> {
  if (worker) return worker;

  worker = new Worker<AiProcessingJob>(QUEUE_NAME, processAiJob, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 3,
    limiter: {
      max: 30,
      duration: 60_000,
    },
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

  logger.info({ queue: QUEUE_NAME }, "Worker started");
  return worker;
}

export async function stopAiProcessingWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info({ queue: QUEUE_NAME }, "Worker stopped");
  }
}

export { processAiJob };
