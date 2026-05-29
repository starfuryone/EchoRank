import { prisma } from "@/lib/prisma";
import type { MeterType, PlanType } from "@/generated/prisma";
import { meteringService } from "./service";
import { logger } from "@/infrastructure/observability/logger";
import { planQuotaDefaults } from "@/lib/plan-config";

// ─── Custom Error ─────────────────────────────────────────────────────

export class QuotaExceededError extends Error {
  public readonly statusCode = 429;
  public readonly tenantId: string;
  public readonly meterType: MeterType;
  public readonly limit: number;
  public readonly current: number;

  constructor(
    tenantId: string,
    meterType: MeterType,
    limit: number,
    current: number
  ) {
    super(
      `Quota exceeded for tenant ${tenantId}: ${meterType} limit is ${limit}, current usage is ${current}`
    );
    this.name = "QuotaExceededError";
    this.tenantId = tenantId;
    this.meterType = meterType;
    this.limit = limit;
    this.current = current;
  }
}

// ─── Default quotas per plan ──────────────────────────────────────────

// Shape consumed by the metering layer. Values come from plan-config.ts (the
// single source of truth) via planQuotaDefaults — no second copy of the numbers.
export type PlanQuotas = ReturnType<typeof planQuotaDefaults>;

// ─── Quota status response types ──────────────────────────────────────

export interface QuotaStatusItem {
  meterType: string;
  limit: number;
  used: number;
  remaining: number;
  percentUsed: number;
}

export interface QuotaStatus {
  tenantId: string;
  quotas: QuotaStatusItem[];
  overageAllowed: boolean;
}

// ─── QuotaEnforcer ────────────────────────────────────────────────────

/**
 * QuotaEnforcer checks and enforces usage limits, manages quota
 * configuration, and provides quota status reporting.
 */
export class QuotaEnforcer {
  /**
   * Checks the quota and throws QuotaExceededError if the requested
   * quantity would exceed the limit (and overage is not allowed).
   */
  async enforce(
    tenantId: string,
    meterType: MeterType,
    quantity: number = 1
  ): Promise<void> {
    const result = await meteringService.checkQuota(
      tenantId,
      meterType,
      quantity
    );

    if (!result.allowed) {
      const current = result.limit - result.remaining;
      logger.warn(
        { tenantId, meterType, limit: result.limit, current, quantity },
        "Quota exceeded"
      );
      throw new QuotaExceededError(
        tenantId,
        meterType,
        result.limit,
        current
      );
    }
  }

  /**
   * Returns the current quota status for all meter types for a tenant.
   */
  async getQuotaStatus(tenantId: string): Promise<QuotaStatus> {
    const quota = await prisma.tenantQuota.findUnique({
      where: { tenantId },
    });

    if (!quota) {
      return {
        tenantId,
        quotas: [],
        overageAllowed: false,
      };
    }

    const monthUsage = await meteringService.getCurrentMonthUsage(tenantId);

    // Also get today's API usage separately since it's a daily limit
    const today = new Date();
    const dayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const dayEnd = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59,
      999
    );
    const apiUsageToday = await meteringService.getUsage(
      tenantId,
      "API_REQUEST" as MeterType,
      dayStart,
      dayEnd
    );

    const quotaItems: QuotaStatusItem[] = [
      {
        meterType: "EMAIL_SENT",
        limit: quota.maxEmailsPerMonth,
        used: monthUsage["EMAIL_SENT"] ?? 0,
        remaining: Math.max(
          0,
          quota.maxEmailsPerMonth - (monthUsage["EMAIL_SENT"] ?? 0)
        ),
        percentUsed:
          quota.maxEmailsPerMonth > 0
            ? Math.round(
                ((monthUsage["EMAIL_SENT"] ?? 0) / quota.maxEmailsPerMonth) *
                  100
              )
            : 0,
      },
      {
        meterType: "SMS_SENT",
        limit: quota.maxSmsPerMonth,
        used: monthUsage["SMS_SENT"] ?? 0,
        remaining: Math.max(
          0,
          quota.maxSmsPerMonth - (monthUsage["SMS_SENT"] ?? 0)
        ),
        percentUsed:
          quota.maxSmsPerMonth > 0
            ? Math.round(
                ((monthUsage["SMS_SENT"] ?? 0) / quota.maxSmsPerMonth) * 100
              )
            : 0,
      },
      {
        meterType: "WEBHOOK_CALL",
        limit: quota.maxWebhooksPerMonth,
        used: monthUsage["WEBHOOK_CALL"] ?? 0,
        remaining: Math.max(
          0,
          quota.maxWebhooksPerMonth - (monthUsage["WEBHOOK_CALL"] ?? 0)
        ),
        percentUsed:
          quota.maxWebhooksPerMonth > 0
            ? Math.round(
                ((monthUsage["WEBHOOK_CALL"] ?? 0) /
                  quota.maxWebhooksPerMonth) *
                  100
              )
            : 0,
      },
      {
        meterType: "API_REQUEST",
        limit: quota.maxApiRequestsPerDay,
        used: apiUsageToday,
        remaining: Math.max(0, quota.maxApiRequestsPerDay - apiUsageToday),
        percentUsed:
          quota.maxApiRequestsPerDay > 0
            ? Math.round(
                (apiUsageToday / quota.maxApiRequestsPerDay) * 100
              )
            : 0,
      },
      {
        meterType: "AI_INFERENCE",
        limit: quota.maxAiInferencesPerMonth,
        used: monthUsage["AI_INFERENCE"] ?? 0,
        remaining: Math.max(
          0,
          quota.maxAiInferencesPerMonth - (monthUsage["AI_INFERENCE"] ?? 0)
        ),
        percentUsed:
          quota.maxAiInferencesPerMonth > 0
            ? Math.round(
                ((monthUsage["AI_INFERENCE"] ?? 0) /
                  quota.maxAiInferencesPerMonth) *
                  100
              )
            : 0,
      },
      {
        meterType: "MONITORING_CHECK",
        limit: quota.maxMonitoringChecks,
        used: monthUsage["MONITORING_CHECK"] ?? 0,
        remaining: Math.max(
          0,
          quota.maxMonitoringChecks - (monthUsage["MONITORING_CHECK"] ?? 0)
        ),
        percentUsed:
          quota.maxMonitoringChecks > 0
            ? Math.round(
                ((monthUsage["MONITORING_CHECK"] ?? 0) /
                  quota.maxMonitoringChecks) *
                  100
              )
            : 0,
      },
    ];

    return {
      tenantId,
      quotas: quotaItems,
      overageAllowed: quota.overageAllowed,
    };
  }

  /**
   * Updates the quota configuration for a tenant.
   * Invalidates the metering service cache afterwards.
   */
  async setQuota(
    tenantId: string,
    quotas: Partial<PlanQuotas> & { overageAllowed?: boolean }
  ): Promise<void> {
    await prisma.tenantQuota.upsert({
      where: { tenantId },
      create: {
        tenantId,
        maxEmailsPerMonth: quotas.maxEmailsPerMonth ?? 300,
        maxSmsPerMonth: quotas.maxSmsPerMonth ?? 0,
        maxWebhooksPerMonth: quotas.maxWebhooksPerMonth ?? 1000,
        maxApiRequestsPerDay: quotas.maxApiRequestsPerDay ?? 10000,
        maxAiInferencesPerMonth: quotas.maxAiInferencesPerMonth ?? 100,
        maxMonitoringChecks: quotas.maxMonitoringChecks ?? 0,
        overageAllowed: quotas.overageAllowed ?? false,
      },
      update: {
        ...(quotas.maxEmailsPerMonth !== undefined && {
          maxEmailsPerMonth: quotas.maxEmailsPerMonth,
        }),
        ...(quotas.maxSmsPerMonth !== undefined && {
          maxSmsPerMonth: quotas.maxSmsPerMonth,
        }),
        ...(quotas.maxWebhooksPerMonth !== undefined && {
          maxWebhooksPerMonth: quotas.maxWebhooksPerMonth,
        }),
        ...(quotas.maxApiRequestsPerDay !== undefined && {
          maxApiRequestsPerDay: quotas.maxApiRequestsPerDay,
        }),
        ...(quotas.maxAiInferencesPerMonth !== undefined && {
          maxAiInferencesPerMonth: quotas.maxAiInferencesPerMonth,
        }),
        ...(quotas.maxMonitoringChecks !== undefined && {
          maxMonitoringChecks: quotas.maxMonitoringChecks,
        }),
        ...(quotas.overageAllowed !== undefined && {
          overageAllowed: quotas.overageAllowed,
        }),
      },
    });

    meteringService.invalidateCache(tenantId);

    logger.info({ tenantId, quotas }, "Tenant quotas updated");
  }

  /**
   * Returns the default quota values for a given plan type.
   */
  getDefaultQuotas(planType: PlanType): PlanQuotas {
    return planQuotaDefaults(planType);
  }
}

/**
 * Singleton quota enforcer instance.
 */
export const quotaEnforcer = new QuotaEnforcer();
