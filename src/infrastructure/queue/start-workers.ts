/**
 * Worker process entry point.
 * Run with: npx tsx src/infrastructure/queue/start-workers.ts
 *
 * This starts all BullMQ workers in a single process. For production,
 * scale by running multiple instances or splitting workers across processes.
 */
import "dotenv/config";

async function startWorkers() {
  console.log("[Workers] Starting EchoRank worker processes...");

  const workers: Array<{ name: string; module: string }> = [
    { name: "email-delivery", module: "./workers/email-delivery.worker" },
    { name: "sms-delivery", module: "./workers/sms-delivery.worker" },
    { name: "webhook-delivery", module: "./workers/webhook-delivery.worker" },
    { name: "ai-processing", module: "./workers/ai-processing.worker" },
    { name: "review-monitoring", module: "./workers/review-monitoring.worker" },
    { name: "reputation-scoring", module: "./workers/reputation-scoring.worker" },
    { name: "escalation-detection", module: "./workers/escalation-detection.worker" },
    { name: "analytics-aggregation", module: "./workers/analytics-aggregation.worker" },
  ];

  const loaded: string[] = [];

  for (const w of workers) {
    try {
      await import(w.module);
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
