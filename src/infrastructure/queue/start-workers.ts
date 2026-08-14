/**
 * Worker process entry point.
 * Run with: npx tsx src/infrastructure/queue/start-workers.ts
 *
 * This starts all BullMQ workers in a single process. For production,
 * scale by running multiple instances or splitting workers across processes.
 */
import "dotenv/config";

import { initTelemetry } from "@/infrastructure/observability/telemetry";
import { eventBus } from "@/infrastructure/events/bus";
import { registerFeedbackConsumer } from "@/infrastructure/events/consumers/feedback.consumer";
import { registerEscalationConsumer } from "@/infrastructure/events/consumers/escalation.consumer";
import { registerCampaignConsumer } from "@/infrastructure/events/consumers/campaign.consumer";
import { registerReviewConsumer } from "@/infrastructure/events/consumers/review.consumer";
import { registerAiConsumer } from "@/infrastructure/events/consumers/ai.consumer";
import { startEmailDeliveryWorker } from "./workers/email-delivery.worker";
import { startTrialNoticeWorker } from "./workers/trial-notice.worker";
import { startSmsDeliveryWorker } from "./workers/sms-delivery.worker";
import { startWebhookDeliveryWorker } from "./workers/webhook-delivery.worker";
import { startAiProcessingWorker } from "./workers/ai-processing.worker";
import { startReviewMonitoringWorker } from "./workers/review-monitoring.worker";
import { startReputationScoringWorker } from "./workers/reputation-scoring.worker";
import { startEscalationDetectionWorker } from "./workers/escalation-detection.worker";
import { startAnalyticsAggregationWorker } from "./workers/analytics-aggregation.worker";
import { startFeedbackRoutingWorker } from "./workers/feedback-routing.worker";
import { startCsvImportWorker } from "./workers/csv-import.worker";
import { startExtensionImportWorker } from "./workers/extension-import.worker";
import { startVisibilityMonitoringWorker } from "./workers/visibility-monitoring.worker";
import { startOnboardingEmailWorker } from "./workers/onboarding-email.worker";
import { startSerpCheckWorker } from "./workers/serp-check.worker";
import { startRankTrackerWorker } from "./workers/rank-tracker.worker";
import { startSiteAuditWorker } from "./workers/site-audit.worker";
import { startBotLogAnalysisWorker } from "./workers/bot-log-analysis.worker";
import { startSiteCrawlWorker } from "./workers/site-crawl.worker";
import { startFreeToolsVolatilityWorker } from "./workers/free-tools-volatility.worker";
import { startAiCheckupWorker } from "./workers/ai-checkup.worker";
import { startSovAggregationWorker } from "./workers/sov-aggregation.worker";

/**
 * How often to drain domain events that are still PENDING/FAILED in the DB.
 * The event bus dispatches inline on emit(), so this is a safety net for events
 * whose inline dispatch failed (handler error -> FAILED) or that were persisted
 * before any consumer was registered.
 */
const EVENT_DISPATCH_INTERVAL_MS = 30_000;

/**
 * Register all domain-event consumers on the shared event bus. Without this the
 * workers emit events that reach zero handlers and the downstream pipeline
 * (AI passes, escalation, reputation recalc, usage metering) never runs.
 */
function registerEventConsumers(): void {
  registerFeedbackConsumer();
  registerEscalationConsumer();
  registerCampaignConsumer();
  registerReviewConsumer();
  registerAiConsumer();
  console.log("[Workers] Registered event consumers");
}

async function startWorkers() {
  console.log("[Workers] Starting Echorank worker processes...");

  // Start OpenTelemetry so worker spans (withSpan) are exported too.
  initTelemetry();

  // Wire up event handlers before any worker can emit.
  registerEventConsumers();

  // Drain any backlog left from before consumers existed, then poll on an
  // interval. A guard prevents overlapping runs if a drain is slow.
  let draining = false;
  const drainEvents = async () => {
    if (draining) return;
    draining = true;
    try {
      await eventBus.processUnprocessed();
    } catch (err) {
      console.error("[Workers] Event dispatch sweep failed:", err);
    } finally {
      draining = false;
    }
  };
  void drainEvents();
  const dispatchTimer = setInterval(drainEvents, EVENT_DISPATCH_INTERVAL_MS);

  const workers: Array<{ name: string; start: () => unknown }> = [
    { name: "email-delivery", start: startEmailDeliveryWorker },
    { name: "trial-notice", start: startTrialNoticeWorker },
    { name: "sms-delivery", start: startSmsDeliveryWorker },
    { name: "webhook-delivery", start: startWebhookDeliveryWorker },
    { name: "ai-processing", start: startAiProcessingWorker },
    { name: "review-monitoring", start: startReviewMonitoringWorker },
    { name: "reputation-scoring", start: startReputationScoringWorker },
    { name: "escalation-detection", start: startEscalationDetectionWorker },
    { name: "analytics-aggregation", start: startAnalyticsAggregationWorker },
    { name: "feedback-routing", start: startFeedbackRoutingWorker },
    { name: "csv-import", start: startCsvImportWorker },
    { name: "extension-import", start: startExtensionImportWorker },
    { name: "visibility-monitoring", start: startVisibilityMonitoringWorker },
    { name: "onboarding-email", start: startOnboardingEmailWorker },
    { name: "serp-checks", start: startSerpCheckWorker },
    { name: "rank-tracker", start: startRankTrackerWorker },
    { name: "site-audit", start: startSiteAuditWorker },
    { name: "bot-log-analysis", start: startBotLogAnalysisWorker },
    { name: "site-crawl", start: startSiteCrawlWorker },
    { name: "free-tools-volatility", start: startFreeToolsVolatilityWorker },
    { name: "ai-checkup", start: startAiCheckupWorker },
    { name: "sov-aggregation", start: startSovAggregationWorker },
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
    clearInterval(dispatchTimer);
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

// Signal spine — reputation risk recompute (hourly sweep + on-demand)
import { startSignalsWorker } from '../../workers/signals.worker';
startSignalsWorker();
