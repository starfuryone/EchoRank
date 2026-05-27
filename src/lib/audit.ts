import { prisma } from "./prisma";
import type { Prisma } from "@/generated/prisma";

interface AuditEntry {
  tenantId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function createAuditLog(entry: AuditEntry) {
  return prisma.auditLog.create({
    data: {
      ...entry,
      details: entry.details as Prisma.InputJsonValue | undefined,
    },
  });
}
