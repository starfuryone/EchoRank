import type { DomainEvent } from "@/generated/prisma";
import { eventBus } from "@/infrastructure/events/bus";
import { EVENT_TYPES, type AiRiskDetectedEvent } from "@/infrastructure/events/types";
import { addJob } from "@/infrastructure/queue/registry";
import { JOB_PRIORITY } from "@/infrastructure/queue/jobs/schemas";
import { prisma } from "@/lib/prisma";
import { notifyEscalationAlert } from "@/lib/notifications/adapters";

const LOG_PREFIX = "[Consumer:ai]";

/**
 * AI consumer: listens for ai.risk_detected events.
 *
 * Triggers:
 * - Creates escalation alerts for high-risk findings
 * - Triggers additional analysis if confidence is low
 */

async function handleAiRiskDetected(
  event: DomainEvent,
  payload: AiRiskDetectedEvent,
): Promise<void> {
  const { tenantId, analysisId, riskLevel, riskType, confidence, correlationId } = payload;

  console.log(
    `${LOG_PREFIX} Handling ai.risk_detected: analysis=${analysisId}, risk=${riskLevel}, type=${riskType}, confidence=${confidence}, tenant=${tenantId}`,
  );

  // ── 1. Create Escalation Alert for HIGH/CRITICAL Risk ──────────────
  if (riskLevel === "HIGH" || riskLevel === "CRITICAL") {
    // Find the AI analysis to get associated feedback/review info
    const analysis = await prisma.aiAnalysis.findUnique({
      where: { id: analysisId },
    });

    if (analysis) {
      // Check for existing alert to avoid duplicates
      const existingAlert = await prisma.escalationAlert.findFirst({
        where: {
          tenantId,
          feedbackId: analysis.feedbackId ?? undefined,
          externalReviewId: analysis.externalReviewId ?? undefined,
          alertType: "ai_risk",
          resolvedAt: null,
        },
      });

      if (!existingAlert) {
        const alert = await prisma.escalationAlert.create({
          data: {
            tenantId,
            customerId: null,
            feedbackId: analysis.feedbackId,
            externalReviewId: analysis.externalReviewId,
            alertType: "ai_risk",
            riskLevel,
            probability: analysis.escalationProbability ?? confidence,
            title: `AI Risk Detection: ${riskLevel} ${riskType}`,
            description: `AI analysis detected ${riskLevel.toLowerCase()} risk (${riskType}) with ${(confidence * 100).toFixed(1)}% confidence. ${analysis.suggestedAction ?? "Review recommended."}`,
            suggestedAction: analysis.suggestedAction,
          },
        });

        console.log(
          `${LOG_PREFIX} Created escalation alert ${alert.id} for AI risk (${riskLevel})`,
        );

        await notifyEscalationAlert(tenantId, {
          alertId: alert.id,
          alertType: "ai_risk",
          riskLevel,
          probability: analysis.escalationProbability ?? confidence,
          title: alert.title,
          description: alert.description,
        });

        // Record usage
        await prisma.usageMeter.create({
          data: {
            tenantId,
            meterType: "ESCALATION_EVENT",
            quantity: 1,
            metadata: {
              alertId: alert.id,
              analysisId,
              riskLevel,
              riskType,
              source: "ai_risk_detection",
              correlationId,
            },
          },
        });
      } else {
        console.log(
          `${LOG_PREFIX} Existing alert found for this analysis, skipping duplicate.`,
        );
      }
    }
  }

  // ── 2. Trigger Additional Analysis if Confidence is Low ────────────
  if (confidence < 0.6 && (riskLevel === "HIGH" || riskLevel === "CRITICAL")) {
    // Low confidence on a high-risk finding: run another analysis pass
    const analysis = await prisma.aiAnalysis.findUnique({
      where: { id: analysisId },
    });

    if (analysis) {
      // Find the original content to re-analyze
      let content: string | null = null;

      if (analysis.feedbackId) {
        const feedback = await prisma.feedback.findUnique({
          where: { id: analysis.feedbackId },
          select: { comment: true },
        });
        content = feedback?.comment ?? null;
      } else if (analysis.externalReviewId) {
        const review = await prisma.externalReview.findUnique({
          where: { id: analysis.externalReviewId },
          select: { content: true },
        });
        content = review?.content ?? null;
      }

      if (content) {
        // Use a different analysis type for the second pass
        const secondPassType =
          analysis.analysisType === "sentiment"
            ? "escalation_risk"
            : "sentiment";

        await addJob(
          "ai-processing",
          "additional-analysis",
          {
            tenantId,
            feedbackId: analysis.feedbackId ?? undefined,
            externalReviewId: analysis.externalReviewId ?? undefined,
            analysisType: secondPassType as "sentiment" | "escalation_risk",
            content,
            correlationId,
          },
          { priority: JOB_PRIORITY.HIGH },
        );

        console.log(
          `${LOG_PREFIX} Queued additional ${secondPassType} analysis for low-confidence risk`,
        );
      }
    }
  }

  console.log(
    `${LOG_PREFIX} AI risk detected event fully processed for analysis ${analysisId}`,
  );
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerAiConsumer(): void {
  eventBus.on(
    EVENT_TYPES.AI_RISK_DETECTED,
    handleAiRiskDetected,
    "ai-consumer",
  );
  console.log(`${LOG_PREFIX} Registered for ${EVENT_TYPES.AI_RISK_DETECTED}`);
}

export { handleAiRiskDetected };
