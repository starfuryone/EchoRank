import type { DomainEvent } from "@/generated/prisma";
import { eventBus } from "@/infrastructure/events/bus";
import { EVENT_TYPES, type EscalationDetectedEvent } from "@/infrastructure/events/types";
import { addJob } from "@/infrastructure/queue/registry";
import { JOB_PRIORITY } from "@/infrastructure/queue/jobs/schemas";
import { prisma } from "@/lib/prisma";

const LOG_PREFIX = "[Consumer:escalation]";

/**
 * Escalation consumer: listens for escalation.detected events.
 *
 * Triggers:
 * - Notification to tenant owner (queues email)
 * - Updates customer status to NEEDS_FOLLOWUP
 */

async function handleEscalationDetected(
  event: DomainEvent,
  payload: EscalationDetectedEvent,
): Promise<void> {
  const { tenantId, alertId, riskLevel, probability, description, correlationId } = payload;

  console.log(
    `${LOG_PREFIX} Handling escalation.detected: alert=${alertId}, risk=${riskLevel}, tenant=${tenantId}`,
  );

  // ── 1. Find the escalation alert to get customer info ──────────────
  const alert = await prisma.escalationAlert.findUnique({
    where: { id: alertId },
  });

  if (!alert) {
    console.warn(`${LOG_PREFIX} Alert ${alertId} not found, skipping.`);
    return;
  }

  // ── 2. Send notification to tenant owner ───────────────────────────
  const tenantOwner = await prisma.tenantMember.findFirst({
    where: {
      tenantId,
      role: "OWNER",
    },
    include: {
      user: { select: { email: true, name: true } },
    },
  });

  if (tenantOwner?.user?.email) {
    const urgencyLabel =
      riskLevel === "CRITICAL"
        ? "URGENT"
        : riskLevel === "HIGH"
          ? "HIGH PRIORITY"
          : "ATTENTION NEEDED";

    await addJob(
      "email-delivery",
      "escalation-notification",
      {
        tenantId,
        customerId: alert.customerId ?? "system",
        to: tenantOwner.user.email,
        subject: `[${urgencyLabel}] Escalation Alert - ${riskLevel} Risk Detected`,
        body: buildNotificationBody({
          ownerName: tenantOwner.user.name ?? "Team",
          riskLevel,
          probability,
          description,
          alertId,
          suggestedAction: alert.suggestedAction ?? "Review and respond promptly.",
        }),
        correlationId,
      },
      {
        priority:
          riskLevel === "CRITICAL"
            ? JOB_PRIORITY.CRITICAL
            : JOB_PRIORITY.HIGH,
      },
    );

    console.log(
      `${LOG_PREFIX} Queued notification email to ${tenantOwner.user.email} for alert ${alertId}`,
    );
  } else {
    console.warn(`${LOG_PREFIX} No owner found for tenant ${tenantId}, skipping email.`);
  }

  // ── 3. Update customer status ──────────────────────────────────────
  if (alert.customerId) {
    await prisma.customer.update({
      where: { id: alert.customerId },
      data: { status: "NEEDS_FOLLOWUP" },
    });
    console.log(
      `${LOG_PREFIX} Updated customer ${alert.customerId} status to NEEDS_FOLLOWUP`,
    );
  }

  console.log(`${LOG_PREFIX} Escalation detected event fully processed for alert ${alertId}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildNotificationBody(params: {
  ownerName: string;
  riskLevel: string;
  probability: number;
  description: string;
  alertId: string;
  suggestedAction: string;
}): string {
  const { ownerName, riskLevel, probability, description, alertId, suggestedAction } =
    params;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: ${riskLevel === "CRITICAL" ? "#dc2626" : riskLevel === "HIGH" ? "#ea580c" : "#d97706"}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Escalation Alert: ${riskLevel} Risk</h2>
      </div>
      <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Hi ${ownerName},</p>
        <p>An escalation has been detected in your Echorank account that requires your attention.</p>
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Risk Level:</strong> ${riskLevel}</p>
          <p style="margin: 0 0 8px 0;"><strong>Probability:</strong> ${(probability * 100).toFixed(1)}%</p>
          <p style="margin: 0 0 8px 0;"><strong>Details:</strong> ${description}</p>
          <p style="margin: 0;"><strong>Alert ID:</strong> ${alertId}</p>
        </div>
        <div style="background-color: #eff6ff; padding: 16px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Suggested Action:</strong> ${suggestedAction}</p>
        </div>
        <p style="color: #6b7280; font-size: 12px;">This is an automated alert from Echorank. Please do not reply to this email.</p>
      </div>
    </div>
  `.trim();
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerEscalationConsumer(): void {
  eventBus.on(
    EVENT_TYPES.ESCALATION_DETECTED,
    handleEscalationDetected,
    "escalation-consumer",
  );
  console.log(`${LOG_PREFIX} Registered for ${EVENT_TYPES.ESCALATION_DETECTED}`);
}

export { handleEscalationDetected };
