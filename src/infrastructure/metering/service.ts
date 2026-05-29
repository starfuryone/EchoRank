import { prisma } from "@/lib/prisma";
import type { MeterType, Prisma } from "@/generated/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { planQuotaDefaults, type MeteringQuotaDefaults } from "@/lib/plan-config";

/**
 * In-memory cache entry for tenant quotas.
 */
interface CachedQuota {
  data: {
    maxEmailsPerMonth: number;
    maxSmsPerMonth: number;
    maxWebhooksPerMonth: number;
    maxApiRequestsPerDay: number;
    maxAiInferencesPerMonth: number;
    maxMonitoringChecks: number;
    overageAllowed: boolean;
  };
  expiresAt: number;
}

const QUOTA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Maps a MeterType to the corresponding TenantQuota field name.
 */
const METER_TO_QUOTA_FIELD: Record<string, keyof MeteringQuotaDefaults> = {
  EMAIL_SENT: "maxEmailsPerMonth",
  SMS_SENT: "maxSmsPerMonth",
  WEBHOOK_CALL: "maxWebhooksPerMonth",
  API_REQUEST: "maxApiRequestsPerDay",
  AI_INFERENCE: "maxAiInferencesPerMonth",
  AI_TOKEN_USAGE: "maxAiInferencesPerMonth",
  MONITORING_CHECK: "maxMonitoringChecks",
};

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

/**
 * MeteringService handles recording and querying usage meters,
 * and provides quota checking with an in-memory cache.
 */
export class MeteringService {
  private quotaCache = new Map<string, CachedQuota>();

  /**
   * Records a usage event.
   */
  async record(
    tenantId: string,
    meterType: MeterType,
    quantity: number = 1,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.usageMeter.create({
        data: {
          tenantId,
          meterType,
          quantity,
          metadata: metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      logger.error(
        { tenantId, meterType, quantity, error },
        "Failed to record usage meter"
      );
      throw error;
    }
  }

  /**
   * Returns the total usage for a given meter type within a date range.
   */
  async getUsage(
    tenantId: string,
    meterType: MeterType,
    periodStart: Date,
    periodEnd: Date
  ): Promise<number> {
    const result = await prisma.usageMeter.aggregate({
      where: {
        tenantId,
        meterType,
        recordedAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }

  /**
   * Returns a breakdown of all meter types for the current calendar month.
   */
  async getCurrentMonthUsage(
    tenantId: string
  ): Promise<Record<string, number>> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const results = await prisma.usageMeter.groupBy({
      by: ["meterType"],
      where: {
        tenantId,
        recordedAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { quantity: true },
    });

    const usage: Record<string, number> = {};
    for (const row of results) {
      usage[row.meterType] = row._sum.quantity ?? 0;
    }
    return usage;
  }

  /**
   * Checks whether the requested quantity is within the tenant's quota.
   * Uses a 5-minute cache to avoid repeated DB reads.
   */
  async checkQuota(
    tenantId: string,
    meterType: MeterType,
    requestedQuantity: number = 1
  ): Promise<QuotaCheckResult> {
    const quotaField = METER_TO_QUOTA_FIELD[meterType];

    // Meter types without a quota mapping are always allowed
    if (!quotaField) {
      return { allowed: true, remaining: Infinity, limit: 0 };
    }

    const quota = await this.getCachedQuota(tenantId);

    let limit: number;
    let overageAllowed: boolean;
    if (quota) {
      limit = quota.data[quotaField];
      overageAllowed = quota.data.overageAllowed;
    } else {
      // Fail closed: with no provisioned quota row, fall back to the tenant's
      // plan defaults rather than allowing unlimited usage. (Previously this
      // returned allowed:true, so every un-provisioned tenant was unmetered.)
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { planType: true },
      });
      if (!tenant) {
        return { allowed: false, remaining: 0, limit: 0 };
      }
      limit = planQuotaDefaults(tenant.planType)[quotaField];
      overageAllowed = false;
    }

    // Determine the time window for the quota check
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    if (meterType === "API_REQUEST") {
      // Daily quota
      periodStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      periodEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999
      );
    } else {
      // Monthly quota
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );
    }

    const currentUsage = await this.getUsage(
      tenantId,
      meterType,
      periodStart,
      periodEnd
    );

    const remaining = Math.max(0, limit - currentUsage);
    const allowed =
      currentUsage + requestedQuantity <= limit || overageAllowed;

    return { allowed, remaining, limit };
  }

  /**
   * Returns cached quota data, fetching from DB if expired or missing.
   */
  private async getCachedQuota(
    tenantId: string
  ): Promise<CachedQuota | null> {
    const cached = this.quotaCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    const quota = await prisma.tenantQuota.findUnique({
      where: { tenantId },
    });

    if (!quota) {
      this.quotaCache.delete(tenantId);
      return null;
    }

    const entry: CachedQuota = {
      data: {
        maxEmailsPerMonth: quota.maxEmailsPerMonth,
        maxSmsPerMonth: quota.maxSmsPerMonth,
        maxWebhooksPerMonth: quota.maxWebhooksPerMonth,
        maxApiRequestsPerDay: quota.maxApiRequestsPerDay,
        maxAiInferencesPerMonth: quota.maxAiInferencesPerMonth,
        maxMonitoringChecks: quota.maxMonitoringChecks,
        overageAllowed: quota.overageAllowed,
      },
      expiresAt: Date.now() + QUOTA_CACHE_TTL_MS,
    };

    this.quotaCache.set(tenantId, entry);
    return entry;
  }

  /**
   * Invalidates the cached quota for a tenant.
   */
  invalidateCache(tenantId: string): void {
    this.quotaCache.delete(tenantId);
  }
}

/**
 * Singleton metering service instance.
 */
export const meteringService = new MeteringService();
