import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { EmailDeliveryJob } from "@/infrastructure/queue/jobs/schemas";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { withSpan } from "@/infrastructure/observability/telemetry";

const QUEUE_NAME = "email-delivery";

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
  await withSpan("email-delivery.process", async (span) => {
    const { tenantId, customerId, to, subject, body, correlationId } = job.data;

    span.setAttributes({
      "job.id": job.id ?? "",
      "tenant.id": tenantId,
      "email.to": to,
    });

    logger.info(
      { jobId: job.id, tenantId, to, queue: QUEUE_NAME },
      "Processing job",
    );

    // ── Idempotency Check ──────────────────────────────────────────────────
    // Check if a UsageMeter record already exists with this job's ID in metadata,
    // indicating this exact job was already processed successfully.
    if (job.id) {
      const existingMeter = await prisma.usageMeter.findFirst({
        where: {
          tenantId,
          meterType: "EMAIL_SENT",
          metadata: {
            path: ["jobId"],
            equals: job.id,
          },
        },
      });

      if (existingMeter) {
        logger.info(
          { jobId: job.id, tenantId, meterId: existingMeter.id, queue: QUEUE_NAME },
          "Idempotency: job already processed, skipping",
        );
        return;
      }
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

      // Correlation token echoed back verbatim in every Brevo webhook for this
      // message. Brevo's SMTP relay rewrites the Message-Id header, so we can't
      // rely on it to match webhook events — but it does return X-Mailin-custom
      // unchanged. Embedding this row's id makes webhook→log correlation exact.
      const mailinCustom = JSON.stringify({
        emailLogId: emailLog.id,
        tenantId,
      });

      let providerMessageId: string | null = null;

      if (isDev) {
        // Dev mode: log the email instead of sending
        logger.info(
          { jobId: job.id, tenantId, to, subject, bodyPreview: body.substring(0, 200), queue: QUEUE_NAME },
          "DEV mode: email logged instead of sent",
        );
      } else {
        // Production mode: send via Brevo SMTP relay using nodemailer
        const nodemailer = await import("nodemailer");

        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
          port: parseInt(process.env.SMTP_PORT || "587", 10),
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER || "",
            pass: process.env.SMTP_PASS || "",
          },
        });

        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM || "noreply@echorank.io",
          to,
          subject,
          html: body,
          headers: {
            // Brevo echoes this header value in webhook payloads. Keep the key
            // exactly "X-Mailin-custom" — Brevo matches it case-sensitively.
            "X-Mailin-custom": mailinCustom,
          },
        });

        providerMessageId = info?.messageId ?? null;
      }

      // ── Update EmailLog to SENT ──────────────────────────────────────
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId,
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
      logger.info(
        { jobId: job.id, tenantId, to, emailLogId: emailLog.id, queue: QUEUE_NAME },
        "Email sent successfully",
      );
    } catch (err) {
      logger.error(
        { jobId: job.id, tenantId, to, err, queue: QUEUE_NAME },
        "Failed to send email",
      );

      // Update EmailLog to FAILED
      const errorMsg = err instanceof Error ? err.message : String(err);
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
  });
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
    logger.info({ jobId: job.id, queue: QUEUE_NAME }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, attempt: job?.attemptsMade, err, queue: QUEUE_NAME },
      "Job failed",
    );
  });

  worker.on("error", (err) => {
    logger.error({ err, queue: QUEUE_NAME }, "Worker error");
  });

  logger.info({ queue: QUEUE_NAME }, "Worker started");
  return worker;
}

export async function stopEmailDeliveryWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info({ queue: QUEUE_NAME }, "Worker stopped");
  }
}

export { processEmailDelivery };
