import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { SmsDeliveryJob } from "@/infrastructure/queue/jobs/schemas";
import { prisma } from "@/lib/prisma";

const QUEUE_NAME = "sms-delivery";
const LOG_PREFIX = `[Worker:${QUEUE_NAME}]`;

/**
 * SMS delivery worker.
 *
 * - Processes SMS delivery jobs from the queue
 * - Checks idempotency via SmsLog status (skip if already SENT/DELIVERED)
 * - In production, sends via SMS gateway; in dev mode, logs the message
 * - Updates SmsLog status in the database
 * - Records usage meter for billing
 * - Retries 3 times with exponential backoff (base 2s)
 */

async function processSmsDelivery(job: Job<SmsDeliveryJob>): Promise<void> {
  const { tenantId, customerId, to, body, correlationId } = job.data;

  console.log(`${LOG_PREFIX} Processing job ${job.id} - sending to ${to} for tenant ${tenantId}`);

  // ── Idempotency Check ──────────────────────────────────────────────────
  const existingLog = await prisma.smsLog.findFirst({
    where: {
      tenantId,
      customerId,
      to,
      status: { in: ["SENT", "DELIVERED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingLog) {
    console.log(`${LOG_PREFIX} Idempotency: SMS already sent (log ${existingLog.id}), skipping.`);
    return;
  }

  // ── Create or find SmsLog ──────────────────────────────────────────────
  let smsLog = await prisma.smsLog.findFirst({
    where: {
      tenantId,
      customerId,
      to,
      status: "QUEUED",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!smsLog) {
    smsLog = await prisma.smsLog.create({
      data: {
        tenantId,
        customerId,
        to,
        body,
        status: "QUEUED",
      },
    });
  }

  try {
    // ── Send SMS ───────────────────────────────────────────────────────
    const isDev = process.env.NODE_ENV !== "production";

    if (isDev) {
      console.log(`${LOG_PREFIX} [DEV] SMS to: ${to}`);
      console.log(`${LOG_PREFIX} [DEV] Body: ${body.substring(0, 160)}`);
    } else {
      // Production: integrate with SMS provider (Twilio, Vonage, etc.)
      // For now, use HTTP-based SMS gateway pattern
      const smsApiUrl = process.env.SMS_API_URL;
      const smsApiKey = process.env.SMS_API_KEY;
      const smsFromNumber = process.env.SMS_FROM_NUMBER;

      if (!smsApiUrl || !smsApiKey) {
        throw new Error("SMS_API_URL and SMS_API_KEY must be configured");
      }

      const response = await fetch(smsApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${smsApiKey}`,
        },
        body: JSON.stringify({
          from: smsFromNumber,
          to,
          body,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`SMS API returned ${response.status}: ${text}`);
      }
    }

    // ── Update SmsLog to SENT ────────────────────────────────────────
    await prisma.smsLog.update({
      where: { id: smsLog.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });

    // ── Record Usage Meter ───────────────────────────────────────────
    await prisma.usageMeter.create({
      data: {
        tenantId,
        meterType: "SMS_SENT",
        quantity: 1,
        metadata: {
          smsLogId: smsLog.id,
          correlationId,
          jobId: job.id,
        },
      },
    });

    console.log(`${LOG_PREFIX} SMS sent successfully to ${to} (log ${smsLog.id})`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`${LOG_PREFIX} Failed to send SMS to ${to}:`, errorMsg);

    // Update SmsLog to FAILED
    await prisma.smsLog.update({
      where: { id: smsLog.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        errorMessage: errorMsg.substring(0, 500),
      },
    });

    // Throw to trigger BullMQ retry
    throw err;
  }
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<SmsDeliveryJob> | null = null;

export function startSmsDeliveryWorker(): Worker<SmsDeliveryJob> {
  if (worker) return worker;

  worker = new Worker<SmsDeliveryJob>(QUEUE_NAME, processSmsDelivery, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 3,
    limiter: {
      max: 50,
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

export async function stopSmsDeliveryWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log(`${LOG_PREFIX} Worker stopped`);
  }
}

export { processSmsDelivery };
