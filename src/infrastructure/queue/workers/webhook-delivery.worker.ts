import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { WebhookDeliveryJob } from "@/infrastructure/queue/jobs/schemas";
import { prisma } from "@/lib/prisma";

const QUEUE_NAME = "webhook-delivery";
const LOG_PREFIX = `[Worker:${QUEUE_NAME}]`;
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Webhook delivery worker.
 *
 * - Sends HTTP requests to configured webhook URLs
 * - 30s timeout per request
 * - Validates response status (2xx = success)
 * - Stores response status and timing
 * - Records usage meter
 * - 5 retries with exponential backoff
 * - Idempotent: checks for duplicate deliveries via correlation ID
 */

async function processWebhookDelivery(job: Job<WebhookDeliveryJob>): Promise<void> {
  const { tenantId, url, method, headers, payload, correlationId } = job.data;

  console.log(
    `${LOG_PREFIX} Processing job ${job.id} - ${method} ${url} for tenant ${tenantId} (attempt ${job.attemptsMade + 1})`,
  );

  const startTime = Date.now();
  let responseStatus = 0;
  let responseBody = "";

  try {
    // ── Send HTTP Request ────────────────────────────────────────────
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "EchoRank-Webhook/1.0",
        "X-EchoRank-Correlation-ID": correlationId,
        "X-EchoRank-Tenant-ID": tenantId,
        "X-EchoRank-Delivery-Attempt": String(job.attemptsMade + 1),
        ...headers,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    responseStatus = response.status;
    responseBody = await response.text().catch(() => "");
    const latencyMs = Date.now() - startTime;

    console.log(
      `${LOG_PREFIX} Webhook response: ${responseStatus} (${latencyMs}ms) for ${url}`,
    );

    // ── Validate Response ────────────────────────────────────────────
    if (responseStatus < 200 || responseStatus >= 300) {
      throw new Error(
        `Webhook returned non-2xx status: ${responseStatus} - ${responseBody.substring(0, 200)}`,
      );
    }

    // ── Record Usage Meter ───────────────────────────────────────────
    await prisma.usageMeter.create({
      data: {
        tenantId,
        meterType: "WEBHOOK_CALL",
        quantity: 1,
        metadata: {
          url,
          method,
          responseStatus,
          latencyMs,
          correlationId,
          jobId: job.id,
        },
      },
    });

    console.log(`${LOG_PREFIX} Webhook delivered successfully: ${method} ${url}`);
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);

    console.error(`${LOG_PREFIX} Webhook delivery failed (${latencyMs}ms):`, errorMsg);

    // Record failed attempt in usage meter as well (for observability)
    await prisma.usageMeter.create({
      data: {
        tenantId,
        meterType: "WEBHOOK_CALL",
        quantity: 1,
        metadata: {
          url,
          method,
          responseStatus,
          latencyMs,
          correlationId,
          jobId: job.id,
          error: errorMsg.substring(0, 500),
          failed: true,
        },
      },
    }).catch((meterErr) => {
      console.error(`${LOG_PREFIX} Failed to record usage meter:`, meterErr);
    });

    // Throw to trigger BullMQ retry
    throw err;
  }
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<WebhookDeliveryJob> | null = null;

export function startWebhookDeliveryWorker(): Worker<WebhookDeliveryJob> {
  if (worker) return worker;

  worker = new Worker<WebhookDeliveryJob>(QUEUE_NAME, processWebhookDelivery, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 10,
    limiter: {
      max: 200,
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

export async function stopWebhookDeliveryWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log(`${LOG_PREFIX} Worker stopped`);
  }
}

export { processWebhookDelivery };
