import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { createAuditLog } from "@/lib/audit";
import { logger } from "@/infrastructure/observability/logger";

// ─── Supported entity types ───────────────────────────────────────────

export type SoftDeletableEntityType =
  | "customer"
  | "feedback"
  | "recovery_ticket"
  | "campaign";

/**
 * Maps entity types to their Prisma model delegates and soft-delete fields.
 */
const ENTITY_CONFIG: Record<
  SoftDeletableEntityType,
  {
    model: "customer" | "feedback" | "recoveryTicket" | "campaign";
    hasLegalHold: boolean;
  }
> = {
  customer: { model: "customer", hasLegalHold: true },
  feedback: { model: "feedback", hasLegalHold: true },
  recovery_ticket: { model: "recoveryTicket", hasLegalHold: false },
  campaign: { model: "campaign", hasLegalHold: false },
};

// ─── Error types ──────────────────────────────────────────────────────

export class LegalHoldError extends Error {
  constructor(entityType: string, entityId: string) {
    super(
      `Cannot delete ${entityType} ${entityId}: entity is under legal hold`
    );
    this.name = "LegalHoldError";
  }
}

export class EntityNotFoundError extends Error {
  constructor(entityType: string, entityId: string) {
    super(`${entityType} ${entityId} not found`);
    this.name = "EntityNotFoundError";
  }
}

// ─── Pagination options ───────────────────────────────────────────────

export interface DeletionLogOptions {
  page?: number;
  limit?: number;
  entityType?: string;
}

// ─── SoftDeleteService ────────────────────────────────────────────────

/**
 * SoftDeleteService implements soft-delete, restore, and legal hold
 * operations with full audit logging and snapshot preservation.
 */
export class SoftDeleteService {
  /**
   * Soft-deletes an entity by setting its `deletedAt` timestamp.
   * Takes a snapshot of the entity data and creates a DeletionLog record.
   * Respects legal hold -- throws LegalHoldError if entity is held.
   */
  async softDelete(
    tenantId: string,
    entityType: SoftDeletableEntityType,
    entityId: string,
    deletedBy: string,
    reason?: string
  ): Promise<void> {
    const config = ENTITY_CONFIG[entityType];
    if (!config) {
      throw new Error(`Unsupported entity type: ${entityType}`);
    }

    // Fetch the entity to snapshot and check legal hold
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = prisma[config.model] as any;
    const entity = await delegate.findFirst({
      where: { id: entityId, tenantId },
    });

    if (!entity) {
      throw new EntityNotFoundError(entityType, entityId);
    }

    // Check legal hold
    if (config.hasLegalHold && entity.legalHold) {
      throw new LegalHoldError(entityType, entityId);
    }

    // Already deleted?
    if (entity.deletedAt) {
      logger.warn(
        { tenantId, entityType, entityId },
        "Entity is already soft-deleted"
      );
      return;
    }

    const now = new Date();

    // Perform soft-delete and create deletion log in a transaction
    await prisma.$transaction(async (tx) => {
      // Set deletedAt on the entity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txDelegate = (tx as any)[config.model];
      await txDelegate.update({
        where: { id: entityId },
        data: { deletedAt: now },
      });

      // Create deletion log with snapshot
      await tx.deletionLog.create({
        data: {
          tenantId,
          entityType,
          entityId,
          deletedBy,
          reason,
          legalHold: false,
          restorable: true,
          snapshotData: entity as unknown as Prisma.InputJsonValue,
          deletedAt: now,
          expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), // 90 days
        },
      });

      // Audit log
      await createAuditLog({
        tenantId,
        userId: deletedBy,
        action: "SOFT_DELETE",
        entity: entityType,
        entityId,
        details: { reason },
      });
    });

    logger.info(
      { tenantId, entityType, entityId, deletedBy, reason },
      "Entity soft-deleted"
    );
  }

  /**
   * Restores a soft-deleted entity by clearing its `deletedAt` timestamp.
   * Updates the DeletionLog to mark it as no longer restorable (consumed).
   */
  async restore(
    tenantId: string,
    entityType: SoftDeletableEntityType,
    entityId: string,
    restoredBy: string
  ): Promise<void> {
    const config = ENTITY_CONFIG[entityType];
    if (!config) {
      throw new Error(`Unsupported entity type: ${entityType}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = prisma[config.model] as any;
    const entity = await delegate.findFirst({
      where: { id: entityId, tenantId },
    });

    if (!entity) {
      throw new EntityNotFoundError(entityType, entityId);
    }

    if (!entity.deletedAt) {
      logger.warn(
        { tenantId, entityType, entityId },
        "Entity is not soft-deleted"
      );
      return;
    }

    await prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txDelegate = (tx as any)[config.model];
      await txDelegate.update({
        where: { id: entityId },
        data: { deletedAt: null },
      });

      // Mark the deletion log entry as consumed (no longer restorable)
      const deletionLog = await tx.deletionLog.findFirst({
        where: { tenantId, entityType, entityId, restorable: true },
        orderBy: { deletedAt: "desc" },
      });

      if (deletionLog) {
        await tx.deletionLog.update({
          where: { id: deletionLog.id },
          data: { restorable: false },
        });
      }

      await createAuditLog({
        tenantId,
        userId: restoredBy,
        action: "RESTORE",
        entity: entityType,
        entityId,
      });
    });

    logger.info(
      { tenantId, entityType, entityId, restoredBy },
      "Entity restored"
    );
  }

  /**
   * Sets or removes a legal hold on an entity, preventing or allowing deletion.
   */
  async setLegalHold(
    tenantId: string,
    entityType: SoftDeletableEntityType,
    entityId: string,
    hold: boolean
  ): Promise<void> {
    const config = ENTITY_CONFIG[entityType];
    if (!config || !config.hasLegalHold) {
      throw new Error(
        `Legal hold is not supported for entity type: ${entityType}`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = prisma[config.model] as any;
    const entity = await delegate.findFirst({
      where: { id: entityId, tenantId },
    });

    if (!entity) {
      throw new EntityNotFoundError(entityType, entityId);
    }

    await delegate.update({
      where: { id: entityId },
      data: { legalHold: hold },
    });

    await createAuditLog({
      tenantId,
      action: hold ? "LEGAL_HOLD_SET" : "LEGAL_HOLD_REMOVED",
      entity: entityType,
      entityId,
      details: { legalHold: hold },
    });

    logger.info(
      { tenantId, entityType, entityId, hold },
      `Legal hold ${hold ? "set" : "removed"}`
    );
  }

  /**
   * Checks whether an entity is currently soft-deleted.
   */
  async isDeleted(
    entityType: SoftDeletableEntityType,
    entityId: string
  ): Promise<boolean> {
    const config = ENTITY_CONFIG[entityType];
    if (!config) return false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = prisma[config.model] as any;
    const entity = await delegate.findUnique({
      where: { id: entityId },
      select: { deletedAt: true },
    });

    return entity?.deletedAt != null;
  }

  /**
   * Returns a paginated list of deletion log entries for a tenant.
   */
  async getDeletionLog(
    tenantId: string,
    options?: DeletionLogOptions
  ): Promise<{
    logs: Awaited<ReturnType<typeof prisma.deletionLog.findMany>>;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options?.page ?? 1;
    const limit = Math.min(options?.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.DeletionLogWhereInput = { tenantId };
    if (options?.entityType) {
      where.entityType = options.entityType;
    }

    const [logs, total] = await Promise.all([
      prisma.deletionLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deletedAt: "desc" },
      }),
      prisma.deletionLog.count({ where }),
    ]);

    return { logs, total, page, limit };
  }
}

/**
 * Singleton soft-delete service instance.
 */
export const softDeleteService = new SoftDeleteService();
