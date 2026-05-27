import { prisma } from "@/lib/prisma";
import type { UsageSnapshot, Prisma } from "@/generated/prisma";
import { logger } from "@/infrastructure/observability/logger";

/**
 * UsageAggregator creates monthly usage snapshots from individual
 * UsageMeter records, calculates costs, and provides trend data.
 */
export class UsageAggregator {
  /**
   * Aggregates all UsageMeter records for a tenant in a given month
   * into a single UsageSnapshot. Uses upsert for idempotency --
   * calling this multiple times for the same period safely overwrites.
   */
  async aggregateMonth(
    tenantId: string,
    year: number,
    month: number
  ): Promise<UsageSnapshot> {
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const results = await prisma.usageMeter.groupBy({
      by: ["meterType"],
      where: {
        tenantId,
        recordedAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { quantity: true, unitCost: true },
    });

    const meterTotals: Record<string, number> = {};
    let totalCost = 0;

    for (const row of results) {
      meterTotals[row.meterType] = row._sum.quantity ?? 0;
      totalCost += row._sum.unitCost ?? 0;
    }

    const snapshotData: Prisma.UsageSnapshotCreateInput = {
      tenant: { connect: { id: tenantId } },
      periodStart,
      periodEnd,
      emailsSent: meterTotals["EMAIL_SENT"] ?? 0,
      smsSent: meterTotals["SMS_SENT"] ?? 0,
      webhookCalls: meterTotals["WEBHOOK_CALL"] ?? 0,
      apiRequests: meterTotals["API_REQUEST"] ?? 0,
      aiTokensUsed: meterTotals["AI_TOKEN_USAGE"] ?? 0,
      aiInferences: meterTotals["AI_INFERENCE"] ?? 0,
      aiCost: totalCost,
      feedbackRequests: meterTotals["FEEDBACK_REQUEST"] ?? 0,
      reviewConversions: meterTotals["REVIEW_CONVERSION"] ?? 0,
      escalationEvents: meterTotals["ESCALATION_EVENT"] ?? 0,
      monitoringChecks: meterTotals["MONITORING_CHECK"] ?? 0,
      totalCost,
    };

    const snapshot = await prisma.usageSnapshot.upsert({
      where: {
        tenantId_periodStart_periodEnd: {
          tenantId,
          periodStart,
          periodEnd,
        },
      },
      create: snapshotData,
      update: {
        emailsSent: snapshotData.emailsSent,
        smsSent: snapshotData.smsSent,
        webhookCalls: snapshotData.webhookCalls,
        apiRequests: snapshotData.apiRequests,
        aiTokensUsed: snapshotData.aiTokensUsed,
        aiInferences: snapshotData.aiInferences,
        aiCost: snapshotData.aiCost,
        feedbackRequests: snapshotData.feedbackRequests,
        reviewConversions: snapshotData.reviewConversions,
        escalationEvents: snapshotData.escalationEvents,
        monitoringChecks: snapshotData.monitoringChecks,
        totalCost: snapshotData.totalCost,
      },
    });

    logger.info(
      { tenantId, year, month, snapshotId: snapshot.id },
      "Usage snapshot aggregated"
    );

    return snapshot;
  }

  /**
   * Aggregates usage for all tenants for the given month.
   * Processes tenants sequentially to avoid overwhelming the database.
   */
  async aggregateAllTenants(
    year: number,
    month: number
  ): Promise<UsageSnapshot[]> {
    const tenants = await prisma.tenant.findMany({
      select: { id: true },
    });

    const snapshots: UsageSnapshot[] = [];

    for (const tenant of tenants) {
      try {
        const snapshot = await this.aggregateMonth(tenant.id, year, month);
        snapshots.push(snapshot);
      } catch (error) {
        logger.error(
          { tenantId: tenant.id, year, month, error },
          "Failed to aggregate usage for tenant"
        );
      }
    }

    logger.info(
      { year, month, totalTenants: tenants.length, aggregated: snapshots.length },
      "Batch usage aggregation complete"
    );

    return snapshots;
  }

  /**
   * Calculates the total cost for a snapshot based on the tenant's
   * plan quotas and overage rates.
   */
  async calculateCost(snapshot: UsageSnapshot): Promise<number> {
    const quota = await prisma.tenantQuota.findUnique({
      where: { tenantId: snapshot.tenantId },
    });

    if (!quota) {
      // No quota configured -- return the snapshot's recorded cost
      return snapshot.totalCost;
    }

    let cost = 0;

    // Email overage
    const emailOverage = Math.max(
      0,
      snapshot.emailsSent - quota.maxEmailsPerMonth
    );
    cost += emailOverage * quota.overageRateEmail;

    // SMS overage
    const smsOverage = Math.max(
      0,
      snapshot.smsSent - quota.maxSmsPerMonth
    );
    cost += smsOverage * quota.overageRateSms;

    // AI overage
    const aiOverage = Math.max(
      0,
      snapshot.aiInferences - quota.maxAiInferencesPerMonth
    );
    cost += aiOverage * quota.overageRateAi;

    return cost;
  }

  /**
   * Returns usage trend data over N months for a tenant,
   * ordered from oldest to newest.
   */
  async getUsageTrend(
    tenantId: string,
    months: number = 6
  ): Promise<UsageSnapshot[]> {
    const now = new Date();
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - months + 1,
      1
    );

    const snapshots = await prisma.usageSnapshot.findMany({
      where: {
        tenantId,
        periodStart: { gte: startDate },
      },
      orderBy: { periodStart: "asc" },
    });

    return snapshots;
  }
}

/**
 * Singleton usage aggregator instance.
 */
export const usageAggregator = new UsageAggregator();
