// Bot Analytics log parser.
//
// Takes an uploaded access log, counts the crawler visits in it, writes the
// aggregates to the BotLogAnalysis row, and DELETES THE FILE.
//
// The deletion is the point, not a tidy-up. Access logs are full of visitor IP
// addresses — personal data we have no product reason to hold — so the file
// exists only for as long as it takes to turn it into counts. It is deleted in a
// `finally`, which means it goes away on the success path, on a parse error, on a
// gzip-bomb refusal, and on an unexpected throw. The only way for an upload to
// survive this worker is for the process to die mid-job, which is why the queue
// is configured for a single attempt: a retry would find no file and fail for a
// confusing reason instead of the real one.
//
// This runs in echorank360-workers, not the web process: a 200MB decompressed
// log and a few million regex executions would block the event loop serving the
// dashboard.

import { unlink } from "node:fs/promises";
import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { BotLogAnalysisJob } from "@/infrastructure/queue/jobs/schemas";
import { prisma } from "@/lib/prisma";
import { aggregate, parseLogText } from "@/lib/bot-analytics/log-parser";
import { buildIpVerifier } from "@/lib/bot-analytics/ip-ranges";
import { readLogFile, DecompressionLimitError } from "@/lib/bot-analytics/upload";
import { logger } from "@/infrastructure/observability/logger";
import { withSpan } from "@/infrastructure/observability/telemetry";

const QUEUE_NAME = "bot-log-analysis";

export async function processBotLogAnalysis(job: Job<BotLogAnalysisJob>): Promise<void> {
  const { analysisId, tenantId, path, gzipped } = job.data;

  try {
    // Tenant-scoped from the first query: the job payload names a tenant, and a
    // row that does not belong to it is not ours to write to.
    const row = await prisma.botLogAnalysis.findFirst({
      where: { id: analysisId, tenantId },
      select: { id: true, status: true },
    });
    if (!row) {
      logger.warn({ analysisId, tenantId, queue: QUEUE_NAME }, "bot log row missing");
      return;
    }

    await prisma.botLogAnalysis.update({
      where: { id: analysisId },
      data: { status: "PROCESSING" },
    });

    let text: string;
    try {
      text = await readLogFile(path, gzipped);
    } catch (error) {
      const tooBig = error instanceof DecompressionLimitError;
      await prisma.botLogAnalysis.update({
        where: { id: analysisId },
        data: {
          status: "FAILED",
          error: tooBig
            ? "The decompressed log is larger than 200 MB."
            : "The file could not be read.",
          completedAt: new Date(),
        },
      });
      return;
    }

    const { records, linesSkipped } = parseLogText(text);
    if (records.length === 0) {
      await prisma.botLogAnalysis.update({
        where: { id: analysisId },
        data: {
          status: "FAILED",
          error:
            "No recognizable log lines. Supported: Apache/nginx combined and Caddy JSON.",
          linesSkipped,
          completedAt: new Date(),
        },
      });
      return;
    }

    // Range lists are fetched once per job and cached in Redis for a day. A
    // failure here downgrades every hit to "unverified" rather than failing the
    // parse — an unverified count is still a useful count.
    const verifyIp = await buildIpVerifier();
    const aggregates = aggregate({ records, linesSkipped, verifyIp });

    await prisma.botLogAnalysis.update({
      where: { id: analysisId },
      data: {
        status: "COMPLETE",
        error: null,
        periodStart: aggregates.periodStart ? new Date(aggregates.periodStart) : null,
        periodEnd: aggregates.periodEnd ? new Date(aggregates.periodEnd) : null,
        linesParsed: aggregates.linesParsed,
        linesSkipped: aggregates.linesSkipped,
        botHits: aggregates.totalBotHits,
        // Aggregates only. No raw line and no IP reaches this column — see the
        // shape in src/lib/bot-analytics/log-parser.ts.
        aggregates: aggregates as unknown as object,
        completedAt: new Date(),
      },
    });

    logger.info(
      {
        analysisId,
        tenantId,
        queue: QUEUE_NAME,
        botHits: aggregates.totalBotHits,
        linesParsed: aggregates.linesParsed,
        linesSkipped: aggregates.linesSkipped,
      },
      "bot log analysis complete",
    );
  } finally {
    // Unconditional. The upload's whole permitted lifetime is this function.
    await unlink(path).catch((err: unknown) => {
      // A leaked log is a privacy problem, so this is an error even though the
      // analysis itself may have succeeded.
      logger.error({ err, path, analysisId, queue: QUEUE_NAME }, "failed to delete uploaded log");
    });
  }
}

let worker: Worker<BotLogAnalysisJob> | null = null;

export function startBotLogAnalysisWorker(): Worker<BotLogAnalysisJob> {
  if (worker) return worker;

  // Concurrency 1: each job can hold up to 200MB of decompressed log in memory,
  // and this process runs sixteen other workers. Two at once is an OOM on a box
  // that also serves the site.
  worker = new Worker<BotLogAnalysisJob>(
    QUEUE_NAME,
    (job) => withSpan("bot-log-analysis.process", () => processBotLogAnalysis(job)),
    {
      connection: getSubscriberConnection(),
      prefix: REDIS_CONFIG.queues.prefix,
      concurrency: 1,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err, queue: QUEUE_NAME }, "bot log analysis failed");
  });
  worker.on("error", (err) => {
    logger.error({ err, queue: QUEUE_NAME }, "bot-log-analysis worker error");
  });

  return worker;
}
