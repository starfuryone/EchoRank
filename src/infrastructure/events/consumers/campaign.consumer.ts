import type { DomainEvent } from "@/generated/prisma";
import { eventBus } from "@/infrastructure/events/bus";
import { EVENT_TYPES, type CampaignCompletedEvent } from "@/infrastructure/events/types";
import { addJob } from "@/infrastructure/queue/registry";
import { JOB_PRIORITY } from "@/infrastructure/queue/jobs/schemas";
import { prisma } from "@/lib/prisma";

const LOG_PREFIX = "[Consumer:campaign]";

/**
 * Campaign consumer: listens for campaign.completed events.
 *
 * Triggers:
 * - Aggregates campaign results (update campaign record)
 * - Triggers analytics aggregation for the campaign period
 */

async function handleCampaignCompleted(
  event: DomainEvent,
  payload: CampaignCompletedEvent,
): Promise<void> {
  const { tenantId, campaignId, totalSent, totalResponses, avgRating, correlationId } =
    payload;

  console.log(
    `${LOG_PREFIX} Handling campaign.completed: campaign=${campaignId}, sent=${totalSent}, responses=${totalResponses}, avgRating=${avgRating}, tenant=${tenantId}`,
  );

  // ── 1. Update Campaign Record ──────────────────────────────────────
  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        tenantId,
      },
    });

    if (campaign) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          totalSent,
          totalResponses,
        },
      });
      console.log(`${LOG_PREFIX} Updated campaign ${campaignId} as completed`);

      // ── 2. Trigger Analytics Aggregation ─────────────────────────
      // Aggregate for the campaign period
      const periodStart = campaign.startedAt ?? campaign.createdAt;
      const periodEnd = new Date();

      await addJob(
        "analytics-aggregation",
        "aggregate-campaign-period",
        {
          tenantId,
          periodType: "daily" as const,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          correlationId,
        },
        { priority: JOB_PRIORITY.LOW },
      );
      console.log(
        `${LOG_PREFIX} Queued analytics aggregation for campaign ${campaignId} period`,
      );
    } else {
      console.warn(`${LOG_PREFIX} Campaign ${campaignId} not found for tenant ${tenantId}`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`${LOG_PREFIX} Error processing campaign completion:`, errorMsg);
    throw err;
  }

  // ── 3. Trigger Reputation Scoring ──────────────────────────────────
  // After a campaign completes, recalculate reputation to include new data
  await addJob(
    "reputation-scoring",
    "recalculate-score-campaign",
    {
      tenantId,
      triggerEvent: "scheduled" as const,
      correlationId,
    },
    { priority: JOB_PRIORITY.LOW },
  );

  console.log(`${LOG_PREFIX} Campaign completed event fully processed for ${campaignId}`);
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerCampaignConsumer(): void {
  eventBus.on(
    EVENT_TYPES.CAMPAIGN_COMPLETED,
    handleCampaignCompleted,
    "campaign-consumer",
  );
  console.log(`${LOG_PREFIX} Registered for ${EVENT_TYPES.CAMPAIGN_COMPLETED}`);
}

export { handleCampaignCompleted };
