import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { EscalationDetectionJob } from "@/infrastructure/queue/jobs/schemas";
import { eventBus } from "@/infrastructure/events/bus";
import { EVENT_TYPES } from "@/infrastructure/events/types";
import { prisma } from "@/lib/prisma";

const QUEUE_NAME = "escalation-detection";
const LOG_PREFIX = `[Worker:${QUEUE_NAME}]`;

/** Escalation probability threshold to trigger an alert */
const ESCALATION_THRESHOLD = 0.5;

/** Urgency words that increase escalation probability */
const URGENCY_WORDS = [
  "urgent",
  "immediately",
  "asap",
  "right now",
  "emergency",
  "critical",
  "lawsuit",
  "attorney",
  "lawyer",
  "legal",
  "bbb",
  "better business bureau",
  "news",
  "media",
  "social media",
  "viral",
  "never again",
  "disgusting",
  "unacceptable",
  "outrageous",
  "scam",
  "fraud",
];

// ─── Processor ────────────────────────────────────────────────────────────────

async function processEscalationDetection(
  job: Job<EscalationDetectionJob>,
): Promise<void> {
  const { tenantId, feedbackId, customerId, signals, correlationId } = job.data;

  console.log(
    `${LOG_PREFIX} Processing job ${job.id} - escalation detection for tenant ${tenantId}`,
  );

  try {
    // ── Calculate Escalation Probability ──────────────────────────────
    let probability = 0;
    let totalWeight = 0;
    const signalResults: { type: string; contribution: number }[] = [];

    for (const signal of signals) {
      totalWeight += signal.weight;

      let contribution = 0;

      switch (signal.type) {
        case "rating": {
          // Low ratings increase probability
          const rating = Number(signal.value);
          if (rating <= 1) contribution = 0.9 * signal.weight;
          else if (rating <= 2) contribution = 0.6 * signal.weight;
          else if (rating <= 3) contribution = 0.2 * signal.weight;
          break;
        }

        case "sentiment": {
          // Negative sentiment increases probability
          const sentiment = Number(signal.value);
          if (sentiment < 0.2) contribution = 0.8 * signal.weight;
          else if (sentiment < 0.4) contribution = 0.4 * signal.weight;
          break;
        }

        case "content_length": {
          // Long content often indicates high frustration
          const length = Number(signal.value);
          if (length > 1000) contribution = 0.5 * signal.weight;
          else if (length > 500) contribution = 0.3 * signal.weight;
          else if (length > 200) contribution = 0.1 * signal.weight;
          break;
        }

        case "urgency_words": {
          // Content contains urgency words
          const text = String(signal.value).toLowerCase();
          const matchCount = URGENCY_WORDS.filter((w) => text.includes(w)).length;
          if (matchCount >= 3) contribution = 0.9 * signal.weight;
          else if (matchCount >= 2) contribution = 0.6 * signal.weight;
          else if (matchCount >= 1) contribution = 0.3 * signal.weight;
          break;
        }

        case "customer_history": {
          // Repeat complainers are more likely to escalate
          const previousComplaints = Number(signal.value);
          if (previousComplaints >= 3) contribution = 0.7 * signal.weight;
          else if (previousComplaints >= 2) contribution = 0.4 * signal.weight;
          else if (previousComplaints >= 1) contribution = 0.2 * signal.weight;
          break;
        }

        case "response_time": {
          // Long response times increase probability
          const hours = Number(signal.value);
          if (hours > 48) contribution = 0.6 * signal.weight;
          else if (hours > 24) contribution = 0.3 * signal.weight;
          else if (hours > 12) contribution = 0.1 * signal.weight;
          break;
        }

        default: {
          // Generic signal: treat value as direct probability contribution
          const val = Number(signal.value);
          if (!isNaN(val)) {
            contribution = Math.min(val, 1) * signal.weight;
          }
          break;
        }
      }

      probability += contribution;
      signalResults.push({ type: signal.type, contribution });
    }

    // Normalize probability to 0-1 range
    if (totalWeight > 0) {
      probability = Math.min(probability / totalWeight, 0.99);
    }
    probability = Math.round(probability * 1000) / 1000;

    // Determine risk level
    let riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "LOW";
    if (probability >= 0.8) riskLevel = "CRITICAL";
    else if (probability >= 0.6) riskLevel = "HIGH";
    else if (probability >= 0.3) riskLevel = "MODERATE";

    console.log(
      `${LOG_PREFIX} Escalation probability: ${probability} (risk: ${riskLevel}) from ${signals.length} signals`,
    );

    // ── Check if threshold is met ────────────────────────────────────
    if (probability < ESCALATION_THRESHOLD) {
      console.log(
        `${LOG_PREFIX} Probability ${probability} below threshold ${ESCALATION_THRESHOLD}, no escalation.`,
      );
      return;
    }

    // ── Idempotency: check for existing alert ────────────────────────
    const existingAlert = await prisma.escalationAlert.findFirst({
      where: {
        tenantId,
        feedbackId: feedbackId ?? undefined,
        customerId: customerId ?? undefined,
        resolvedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingAlert && !existingAlert.acknowledged) {
      console.log(
        `${LOG_PREFIX} Existing unacknowledged alert ${existingAlert.id} found, updating.`,
      );
      // Update existing alert if risk level is higher
      if (
        probability > existingAlert.probability ||
        getRiskWeight(riskLevel) > getRiskWeight(existingAlert.riskLevel)
      ) {
        await prisma.escalationAlert.update({
          where: { id: existingAlert.id },
          data: {
            riskLevel,
            probability,
            description: buildDescription(riskLevel, probability, signalResults),
          },
        });
      }
      return;
    }

    // ── Create EscalationAlert ───────────────────────────────────────
    const title = `${riskLevel} Risk Escalation Detected`;
    const description = buildDescription(riskLevel, probability, signalResults);
    const suggestedAction = getSuggestedAction(riskLevel);

    const alert = await prisma.escalationAlert.create({
      data: {
        tenantId,
        customerId: customerId ?? null,
        feedbackId: feedbackId ?? null,
        alertType: "escalation_risk",
        riskLevel,
        probability,
        title,
        description,
        suggestedAction,
      },
    });

    // ── Record Usage Meter ───────────────────────────────────────────
    await prisma.usageMeter.create({
      data: {
        tenantId,
        meterType: "ESCALATION_EVENT",
        quantity: 1,
        metadata: {
          alertId: alert.id,
          riskLevel,
          probability,
          correlationId,
          jobId: job.id,
        },
      },
    });

    // ── Emit escalation.detected event ───────────────────────────────
    await eventBus.emit({
      tenantId,
      eventType: EVENT_TYPES.ESCALATION_DETECTED,
      eventVersion: 1,
      aggregateType: "EscalationAlert",
      aggregateId: alert.id,
      payload: {
        tenantId,
        correlationId,
        timestamp: new Date().toISOString(),
        version: 1,
        alertId: alert.id,
        riskLevel,
        probability,
        description,
      },
      correlationId,
    });

    console.log(
      `${LOG_PREFIX} Escalation alert created: ${alert.id} (risk: ${riskLevel}, probability: ${probability})`,
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`${LOG_PREFIX} Escalation detection failed:`, errorMsg);
    throw err;
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getRiskWeight(level: string): number {
  switch (level) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MODERATE":
      return 2;
    case "LOW":
      return 1;
    default:
      return 0;
  }
}

function buildDescription(
  riskLevel: string,
  probability: number,
  signalResults: { type: string; contribution: number }[],
): string {
  const topSignals = signalResults
    .filter((s) => s.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map((s) => s.type)
    .join(", ");

  return `Escalation risk detected with ${(probability * 100).toFixed(1)}% probability (${riskLevel}). Top contributing signals: ${topSignals || "none"}.`;
}

function getSuggestedAction(riskLevel: string): string {
  switch (riskLevel) {
    case "CRITICAL":
      return "Immediately assign to a senior team member for direct customer outreach within 1 hour.";
    case "HIGH":
      return "Prioritize for same-day follow-up. Prepare recovery offer and assign to team lead.";
    case "MODERATE":
      return "Schedule follow-up within 24 hours. Review customer history before contact.";
    default:
      return "Monitor and include in regular review cycle.";
  }
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<EscalationDetectionJob> | null = null;

export function startEscalationDetectionWorker(): Worker<EscalationDetectionJob> {
  if (worker) return worker;

  worker = new Worker<EscalationDetectionJob>(QUEUE_NAME, processEscalationDetection, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 5,
    limiter: {
      max: 100,
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

export async function stopEscalationDetectionWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log(`${LOG_PREFIX} Worker stopped`);
  }
}

export { processEscalationDetection };
