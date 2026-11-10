/**
 * Crawler process entry point: the pm2 app echorank360-crawlers.
 * Run with: npm run crawlers (NODE_OPTIONS=--conditions=react-server, like the workers).
 *
 * Runs ONLY the site-crawl worker, CRAWL_CONCURRENCY_PER_PROCESS crawls at a
 * time (src/lib/site-crawler/capacity.ts). pm2 starts CRAWL_PROCESSES of these;
 * with CRAWL_PROCESSES set, echorank360-workers stops running crawls, so AI
 * checks, alerts and email never wait behind one. Started without
 * CRAWL_PROCESSES it refuses to run: the workers would still be crawling too.
 *
 * SIGTERM: running crawls write what they hold and go back to the queue for
 * the next process (stopSiteCrawlWorker); pm2's kill_timeout must leave room
 * for a batch to finish (the ecosystem sets 120 s).
 */
import "dotenv/config";

import { initTelemetry } from "@/infrastructure/observability/telemetry";
import { connectionBudget, crawlConcurrencyPerProcess, crawlProcesses } from "@/lib/site-crawler/capacity";
import { disconnectPrisma } from "@/lib/prisma";
import { startSiteCrawlWorker, stopSiteCrawlWorker } from "./workers/site-crawl.worker";

async function startCrawlers(): Promise<void> {
  const processes = crawlProcesses();
  if (processes === 0) {
    console.error("[Crawlers] CRAWL_PROCESSES is not set: echorank360-workers still runs crawls, so this process will not. Set it (the pm2 ecosystem does).");
    process.exit(1);
  }
  initTelemetry();

  const budget = connectionBudget();
  const pool = Number.parseInt(process.env.DB_POOL_MAX ?? "20", 10);
  console.log(
    `[Crawlers] ${crawlConcurrencyPerProcess()} crawls in this process (${processes} processes); pg pool ${pool}, ` +
      `budget ${budget.budget} of max_connections ${budget.maxConnections} (web ${budget.web} + workers ${budget.workers} + ${processes} × ${budget.perCrawler})`,
  );
  if (pool > budget.perCrawler) {
    console.warn(`[Crawlers] DB_POOL_MAX ${pool} is above this process's share (${budget.perCrawler}): the pools together can exceed ${budget.budget} connections.`);
  }

  startSiteCrawlWorker();
  console.log("[Crawlers] site-crawl worker running");

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`[Crawlers] ${signal}: stopping running crawls at their next page boundary…`);
    try {
      await stopSiteCrawlWorker();
      const { closeAllQueues } = await import("./registry");
      await closeAllQueues();
    } catch (err) {
      console.error("[Crawlers] shutdown:", err);
    }
    await disconnectPrisma();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

startCrawlers().catch((err) => {
  console.error("[Crawlers] Fatal error:", err);
  process.exit(1);
});
