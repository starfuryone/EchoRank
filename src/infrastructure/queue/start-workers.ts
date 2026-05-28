/**
 * Worker process entry point.
 * Run with: npx tsx src/infrastructure/queue/start-workers.ts
 *
 * This starts all BullMQ workers in a single process. For production,
 * scale by running multiple instances or splitting workers across processes.
 */
import "dotenv/config";

import { startEmailDeliveryWorker } from "./workers/email-delivery.worker";
import { startSmsDeliveryWorker } from "./workers/sms-delivery.worker";
import { startWebhookDeliveryWorker } from "./workers/webhook-delivery.worker";
import { startAiProcessingWorker } from "./workers/ai-processing.worker";
import { startReviewMonitoringWorker } from "./workers/review-monitoring.worker";
import { startReputationScoringWorker } from "./workers/reputation-scoring.worker";
import { startEscalationDetectionWorker } from "./workers/escalation-detection.worker";
import { startAnalyticsAggregationWorker } from "./workers/analytics-aggregation.worker";
import { startFeedbackRoutingWorker } from "./workers/feedback-routing.worker";

async function startWorkers() {
  console.log("[Workers] Starting EchoRank worker processes...");

  const workers: Array<{ name: string; start: () => unknown }> = [
    { name: "email-delivery", start: startEmailDeliveryWorker },
    { name: "sms-delivery", start: startSmsDeliveryWorker },
    { name: "webhook-delivery", start: startWebhookDeliveryWorker },
    { name: "ai-processing", start: startAiProcessingWorker },
    { name: "review-monitoring", start: startReviewMonitoringWorker },
    { name: "reputation-scoring", start: startReputationScoringWorker },
    { name: "escalation-detection", start: startEscalationDetectionWorker },
    { name: "analytics-aggregation", start: startAnalyticsAggregationWorker },
    { name: "feedback-routing", start: startFeedbackRoutingWorker },
  ];

  const loaded: string[] = [];

  for (const w of workers) {
    try {
      w.start();
      loaded.push(w.name);
      console.log(`[Workers] Started: ${w.name}`);
    } catch (error) {
      console.error(`[Workers] Failed to start ${w.name}:`, error);
    }
  }

  console.log(`[Workers] ${loaded.length}/${workers.length} workers running`);
  console.log("[Workers] Press Ctrl+C to stop");

  const shutdown = async () => {
    console.log("\n[Workers] Shutting down gracefully...");
    try {
      const { closeAllQueues } = await import("./registry");
      await closeAllQueues();
    } catch {
      // registry may not be loaded yet
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startWorkers().catch((err) => {
  console.error("[Workers] Fatal error:", err);
  process.exit(1);
});
