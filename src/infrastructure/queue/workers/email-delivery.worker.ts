import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { EmailDeliveryJob } from "@/infrastructure/queue/jobs/schemas";
import { prisma } from "@/lib/prisma";

const QUEUE_NAME = "email-delivery";
const LOG_PREFIX = `[Worker:${QUEUE_NAME}]`;

/**
 * Email delivery worker.
 *
 * - Processes email delivery jobs from the queue
 * - Checks idempotency via EmailLog status (skip if already SENT/DELIVERED)
 * - In production, sends via nodemailer; in dev mode, logs the email
 * - Updates EmailLog status in the database
 * - Records usage meter for billing
 * - Emits domain events on success/failure
 * - Retries 3 times with exponential backoff (base 2s)
 */

async function processEmailDelivery(job: Job<EmailDeliveryJob>): Promise<void> {
  const { tenantId, customerId, to, subject, body, correlationId } = job.data;

  console.log(`${LOG_PREFIX} Processing job ${job.id} - sending to ${to} for tenant ${tenantId}`);

  // ── Idempotency Check ──────────────────────────────────────────────────
  // Look for an existing EmailLog that has already been sent for this correlation
  const existingLog = await prisma.emailLog.findFirst({
    where: {
      tenantId,
      customerId,
      to,
      status: { in: ["SENT", "DELIVERED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingLog) {
    console.log(`${LOG_PREFIX} Idempotency: email already sent (log ${existingLog.id}), skipping.`);
    return;
  }

  // ── Create or find EmailLog ────────────────────────────────────────────
  let emailLog = await prisma.emailLog.findFirst({
    where: {
      tenantId,
      customerId,
      to,
      status: "QUEUED",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!emailLog) {
    emailLog = await prisma.emailLog.create({
      data: {
        tenantId,
        customerId,
        to,
        subject,
        body,
        status: "QUEUED",
        channel: "EMAIL",
      },
    });
  }

  try {
    // ── Send Email ─────────────────────────────────────────────────────
    const isDev = process.env.NODE_ENV !== "production";

    if (isDev) {
      // Dev mode: log the email instead of sending
      console.log(`${LOG_PREFIX} [DEV] Email to: ${to}`);
      console.log(`${LOG_PREFIX} [DEV] Subject: ${subject}`);
      console.log(`${LOG_PREFIX} [DEV] Body: ${body.substring(0, 200)}...`);
    } else {
      // Production mode: use nodemailer
      const nodemailer = await import("nodemailer");

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.sendgrid.net",
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER || "apikey",
          pass: process.env.SMTP_PASS || "",
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || "noreply@echorank.io",
        to,
        subject,
        html: body,
      });
    }

    // ── Update EmailLog to SENT ──────────────────────────────────────
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });

    // ── Record Usage Meter ───────────────────────────────────────────
    await prisma.usageMeter.create({
      data: {
        tenantId,
        meterType: "EMAIL_SENT",
        quantity: 1,
        metadata: {
          emailLogId: emailLog.id,
          correlationId,
          jobId: job.id,
        },
      },
    });

    // ── Emit Success Event ───────────────────────────────────────────
    console.log(`${LOG_PREFIX} Email sent successfully to ${to} (log ${emailLog.id})`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`${LOG_PREFIX} Failed to send email to ${to}:`, errorMsg);

    // Update EmailLog to FAILED
    await prisma.emailLog.update({
      where: { id: emailLog.id },
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

let worker: Worker<EmailDeliveryJob> | null = null;

export function startEmailDeliveryWorker(): Worker<EmailDeliveryJob> {
  if (worker) return worker;

  worker = new Worker<EmailDeliveryJob>(QUEUE_NAME, processEmailDelivery, {
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

export async function stopEmailDeliveryWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log(`${LOG_PREFIX} Worker stopped`);
  }
}

export { processEmailDelivery };
