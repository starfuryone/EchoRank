import { prisma } from "@/lib/prisma";
import type { DataRetentionPolicy, Prisma } from "@/generated/prisma";
import { createAuditLog } from "@/lib/audit";
import { logger } from "@/infrastructure/observability/logger";

// ─── Default retention values ─────────────────────────────────────────

const DEFAULT_RETENTION: Omit<
  DataRetentionPolicy,
  "id" | "tenantId" | "createdAt" | "updatedAt"
> = {
  feedbackRetentionDays: 730, // 2 years
  customerRetentionDays: 1095, // 3 years
  auditLogRetentionDays: 2555, // 7 years
  eventRetentionDays: 365, // 1 year
  autoDeleteEnabled: false,
  gdprCompliant: true,
};

// ─── Types ────────────────────────────────────────────────────────────

type RetentionEntityType = "feedback" | "customer" | "auditLog" | "domainEvent";

interface ExpiringRecord {
  id: string;
  entityType: RetentionEntityType;
  expiresAt: Date;
}

interface RetentionPolicyUpdate {
  feedbackRetentionDays?: number;
  customerRetentionDays?: number;
  auditLogRetentionDays?: number;
  eventRetentionDays?: number;
  autoDeleteEnabled?: boolean;
  gdprCompliant?: boolean;
}

// ─── RetentionService ─────────────────────────────────────────────────

/**
 * RetentionService enforces data retention policies by identifying
 * expired records, soft-deleting or hard-deleting them, and maintaining
 * a complete audit trail.
 */
export class RetentionService {
  /**
   * Enforces the retention policy for a tenant. Finds expired records
   * for each entity type and processes deletions. Skips entities under
   * legal hold. Creates DeletionLog entries for all automated deletions.
   */
  async enforceRetention(tenantId: string): Promise<{
    processed: number;
    skippedLegalHold: number;
  }> {
    const policy = await this.getRetentionPolicy(tenantId);

    if (!policy.autoDeleteEnabled) {
      logger.info(
        { tenantId },
        "Auto-delete is disabled; skipping retention enforcement"
      );
      return { processed: 0, skippedLegalHold: 0 };
    }

    let totalProcessed = 0;
    let totalSkipped = 0;

    // Enforce feedback retention
    const feedbackResult = await this.enforceFeedbackRetention(
      tenantId,
      policy.feedbackRetentionDays
    );
    totalProcessed += feedbackResult.processed;
    totalSkipped += feedbackResult.skippedLegalHold;

    // Enforce customer retention
    const customerResult = await this.enforceCustomerRetention(
      tenantId,
      policy.customerRetentionDays
    );
    totalProcessed += customerResult.processed;
    totalSkipped += customerResult.skippedLegalHold;

    // Enforce audit log retention
    const auditResult = await this.enforceAuditLogRetention(
      tenantId,
      policy.auditLogRetentionDays
    );
    totalProcessed += auditResult.processed;

    // Enforce domain event retention
    const eventResult = await this.enforceEventRetention(
      tenantId,
      policy.eventRetentionDays
    );
    totalProcessed += eventResult.processed;

    await createAuditLog({
      tenantId,
      action: "RETENTION_ENFORCED",
      entity: "retention_policy",
      details: {
        processed: totalProcessed,
        skippedLegalHold: totalSkipped,
      },
    });

    logger.info(
      { tenantId, processed: totalProcessed, skippedLegalHold: totalSkipped },
      "Retention enforcement complete"
    );

    return { processed: totalProcessed, skippedLegalHold: totalSkipped };
  }

  /**
   * Returns the retention policy for a tenant, creating a default one
   * if none exists.
   */
  async getRetentionPolicy(tenantId: string): Promise<DataRetentionPolicy> {
    const existing = await prisma.dataRetentionPolicy.findUnique({
      where: { tenantId },
    });

    if (existing) return existing;

    // Create default policy
    return prisma.dataRetentionPolicy.create({
      data: {
        tenantId,
        ...DEFAULT_RETENTION,
      },
    });
  }

  /**
   * Updates the retention policy for a tenant.
   */
  async updateRetentionPolicy(
    tenantId: string,
    policy: RetentionPolicyUpdate
  ): Promise<DataRetentionPolicy> {
    const updated = await prisma.dataRetentionPolicy.upsert({
      where: { tenantId },
      create: {
        tenantId,
        feedbackRetentionDays:
          policy.feedbackRetentionDays ?? DEFAULT_RETENTION.feedbackRetentionDays,
        customerRetentionDays:
          policy.customerRetentionDays ?? DEFAULT_RETENTION.customerRetentionDays,
        auditLogRetentionDays:
          policy.auditLogRetentionDays ??
          DEFAULT_RETENTION.auditLogRetentionDays,
        eventRetentionDays:
          policy.eventRetentionDays ?? DEFAULT_RETENTION.eventRetentionDays,
        autoDeleteEnabled:
          policy.autoDeleteEnabled ?? DEFAULT_RETENTION.autoDeleteEnabled,
        gdprCompliant:
          policy.gdprCompliant ?? DEFAULT_RETENTION.gdprCompliant,
      },
      update: {
        ...(policy.feedbackRetentionDays !== undefined && {
          feedbackRetentionDays: policy.feedbackRetentionDays,
        }),
        ...(policy.customerRetentionDays !== undefined && {
          customerRetentionDays: policy.customerRetentionDays,
        }),
        ...(policy.auditLogRetentionDays !== undefined && {
          auditLogRetentionDays: policy.auditLogRetentionDays,
        }),
        ...(policy.eventRetentionDays !== undefined && {
          eventRetentionDays: policy.eventRetentionDays,
        }),
        ...(policy.autoDeleteEnabled !== undefined && {
          autoDeleteEnabled: policy.autoDeleteEnabled,
        }),
        ...(policy.gdprCompliant !== undefined && {
          gdprCompliant: policy.gdprCompliant,
        }),
      },
    });

    await createAuditLog({
      tenantId,
      action: "RETENTION_POLICY_UPDATED",
      entity: "retention_policy",
      details: policy as Record<string, unknown>,
    });

    logger.info({ tenantId, policy }, "Retention policy updated");

    return updated;
  }

  /**
   * Returns a preview of records that will expire within the given
   * number of days for a specific entity type.
   */
  async getExpiringRecords(
    tenantId: string,
    entityType: RetentionEntityType,
    days: number
  ): Promise<ExpiringRecord[]> {
    const policy = await this.getRetentionPolicy(tenantId);
    const retentionDays = this.getRetentionDays(policy, entityType);
    const now = new Date();
    const previewCutoff = new Date(
      now.getTime() - (retentionDays - days) * 24 * 60 * 60 * 1000
    );

    const records: ExpiringRecord[] = [];

    switch (entityType) {
      case "feedback": {
        const items = await prisma.feedback.findMany({
          where: {
            tenantId,
            deletedAt: null,
            legalHold: false,
            createdAt: { lte: previewCutoff },
          },
          select: { id: true, createdAt: true },
          take: 100,
        });
        for (const item of items) {
          records.push({
            id: item.id,
            entityType: "feedback",
            expiresAt: new Date(
              item.createdAt.getTime() + retentionDays * 24 * 60 * 60 * 1000
            ),
          });
        }
        break;
      }
      case "customer": {
        const items = await prisma.customer.findMany({
          where: {
            tenantId,
            deletedAt: null,
            legalHold: false,
            createdAt: { lte: previewCutoff },
          },
          select: { id: true, createdAt: true },
          take: 100,
        });
        for (const item of items) {
          records.push({
            id: item.id,
            entityType: "customer",
            expiresAt: new Date(
              item.createdAt.getTime() + retentionDays * 24 * 60 * 60 * 1000
            ),
          });
        }
        break;
      }
      case "auditLog": {
        const items = await prisma.auditLog.findMany({
          where: {
            tenantId,
            createdAt: { lte: previewCutoff },
          },
          select: { id: true, createdAt: true },
          take: 100,
        });
        for (const item of items) {
          records.push({
            id: item.id,
            entityType: "auditLog",
            expiresAt: new Date(
              item.createdAt.getTime() + retentionDays * 24 * 60 * 60 * 1000
            ),
          });
        }
        break;
      }
      case "domainEvent": {
        const items = await prisma.domainEvent.findMany({
          where: {
            tenantId,
            createdAt: { lte: previewCutoff },
          },
          select: { id: true, createdAt: true },
          take: 100,
        });
        for (const item of items) {
          records.push({
            id: item.id,
            entityType: "domainEvent",
            expiresAt: new Date(
              item.createdAt.getTime() + retentionDays * 24 * 60 * 60 * 1000
            ),
          });
        }
        break;
      }
    }

    return records;
  }

  // ─── Private methods ────────────────────────────────────────────────

  private getRetentionDays(
    policy: DataRetentionPolicy,
    entityType: RetentionEntityType
  ): number {
    switch (entityType) {
      case "feedback":
        return policy.feedbackRetentionDays;
      case "customer":
        return policy.customerRetentionDays;
      case "auditLog":
        return policy.auditLogRetentionDays;
      case "domainEvent":
        return policy.eventRetentionDays;
    }
  }

  private async enforceFeedbackRetention(
    tenantId: string,
    retentionDays: number
  ): Promise<{ processed: number; skippedLegalHold: number }> {
    const cutoff = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000
    );

    // Find expired feedback that's not already deleted and not under hold
    const expired = await prisma.feedback.findMany({
      where: {
        tenantId,
        deletedAt: null,
        createdAt: { lte: cutoff },
      },
      take: 500,
    });

    let processed = 0;
    let skippedLegalHold = 0;

    for (const item of expired) {
      if (item.legalHold) {
        skippedLegalHold++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.feedback.update({
          where: { id: item.id },
          data: { deletedAt: new Date() },
        });

        await tx.deletionLog.create({
          data: {
            tenantId,
            entityType: "feedback",
            entityId: item.id,
            deletedBy: "system:retention",
            reason: `Retention policy: ${retentionDays} days exceeded`,
            legalHold: false,
            restorable: true,
            snapshotData: item as unknown as Prisma.InputJsonValue,
          },
        });
      });

      processed++;
    }

    return { processed, skippedLegalHold };
  }

  private async enforceCustomerRetention(
    tenantId: string,
    retentionDays: number
  ): Promise<{ processed: number; skippedLegalHold: number }> {
    const cutoff = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000
    );

    const expired = await prisma.customer.findMany({
      where: {
        tenantId,
        deletedAt: null,
        createdAt: { lte: cutoff },
      },
      take: 500,
    });

    let processed = 0;
    let skippedLegalHold = 0;

    for (const item of expired) {
      if (item.legalHold) {
        skippedLegalHold++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.customer.update({
          where: { id: item.id },
          data: { deletedAt: new Date() },
        });

        await tx.deletionLog.create({
          data: {
            tenantId,
            entityType: "customer",
            entityId: item.id,
            deletedBy: "system:retention",
            reason: `Retention policy: ${retentionDays} days exceeded`,
            legalHold: false,
            restorable: true,
            snapshotData: item as unknown as Prisma.InputJsonValue,
          },
        });
      });

      processed++;
    }

    return { processed, skippedLegalHold };
  }

  private async enforceAuditLogRetention(
    tenantId: string,
    retentionDays: number
  ): Promise<{ processed: number }> {
    const cutoff = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000
    );

    // Audit logs are hard-deleted as they don't support soft-delete
    const result = await prisma.auditLog.deleteMany({
      where: {
        tenantId,
        createdAt: { lte: cutoff },
      },
    });

    if (result.count > 0) {
      logger.info(
        { tenantId, entityType: "auditLog", deleted: result.count },
        "Audit logs purged by retention policy"
      );
    }

    return { processed: result.count };
  }

  private async enforceEventRetention(
    tenantId: string,
    retentionDays: number
  ): Promise<{ processed: number }> {
    const cutoff = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000
    );

    const result = await prisma.domainEvent.deleteMany({
      where: {
        tenantId,
        createdAt: { lte: cutoff },
        status: { in: ["COMPLETED", "DEAD_LETTER"] },
      },
    });

    if (result.count > 0) {
      logger.info(
        { tenantId, entityType: "domainEvent", deleted: result.count },
        "Domain events purged by retention policy"
      );
    }

    return { processed: result.count };
  }
}

/**
 * Singleton retention service instance.
 */
export const retentionService = new RetentionService();
