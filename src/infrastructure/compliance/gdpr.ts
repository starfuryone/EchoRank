import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { createAuditLog } from "@/lib/audit";
import { logger } from "@/infrastructure/observability/logger";
import { createHash } from "node:crypto";

// ─── Types ────────────────────────────────────────────────────────────

interface CustomerDataExport {
  customer: Record<string, unknown>;
  feedback: Record<string, unknown>[];
  emailLogs: Record<string, unknown>[];
  smsLogs: Record<string, unknown>[];
  recoveryTickets: Record<string, unknown>[];
  exportedAt: string;
  tenantId: string;
  customerId: string;
}

interface DataProcessingRecord {
  tenantId: string;
  processingActivities: ProcessingActivity[];
  generatedAt: string;
}

interface ProcessingActivity {
  category: string;
  purpose: string;
  dataTypes: string[];
  retentionPeriod: string;
  legalBasis: string;
}

// ─── GdprService ──────────────────────────────────────────────────────

/**
 * GdprService implements GDPR compliance operations including
 * data export (right of access), erasure (right to be forgotten),
 * and data processing records.
 */
export class GdprService {
  /**
   * Exports all data associated with a customer (right of access / data portability).
   * Returns a comprehensive JSON blob of the customer's data.
   */
  async exportCustomerData(
    tenantId: string,
    customerId: string
  ): Promise<CustomerDataExport> {
    // Verify customer belongs to tenant
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      throw new Error(`Customer ${customerId} not found in tenant ${tenantId}`);
    }

    // Fetch all related data in parallel
    const [feedback, emailLogs, smsLogs, recoveryTickets] = await Promise.all([
      prisma.feedback.findMany({
        where: { customerId, tenantId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.emailLog.findMany({
        where: { customerId, tenantId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.smsLog.findMany({
        where: { customerId, tenantId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.recoveryTicket.findMany({
        where: { customerId, tenantId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    await createAuditLog({
      tenantId,
      action: "GDPR_DATA_EXPORT",
      entity: "customer",
      entityId: customerId,
      details: {
        feedbackCount: feedback.length,
        emailLogCount: emailLogs.length,
        smsLogCount: smsLogs.length,
        recoveryTicketCount: recoveryTickets.length,
      },
    });

    logger.info(
      { tenantId, customerId },
      "GDPR data export completed"
    );

    return {
      customer: customer as unknown as Record<string, unknown>,
      feedback: feedback as unknown as Record<string, unknown>[],
      emailLogs: emailLogs as unknown as Record<string, unknown>[],
      smsLogs: smsLogs as unknown as Record<string, unknown>[],
      recoveryTickets: recoveryTickets as unknown as Record<string, unknown>[],
      exportedAt: new Date().toISOString(),
      tenantId,
      customerId,
    };
  }

  /**
   * Erases a customer's personal data (right to be forgotten).
   * Anonymizes PII while preserving aggregate / non-PII data for analytics.
   *
   * Anonymization strategy:
   *  - Customer name -> "Anonymized"
   *  - Customer email -> SHA-256 hash (for deduplication)
   *  - Customer phone -> null
   *  - Feedback comments are preserved (no PII expected)
   *  - Feedback ratings are preserved for analytics
   *  - Email/SMS logs have recipient info anonymized
   */
  async eraseCustomerData(
    tenantId: string,
    customerId: string,
    requestedBy: string
  ): Promise<void> {
    // Verify customer belongs to tenant
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      throw new Error(`Customer ${customerId} not found in tenant ${tenantId}`);
    }

    // Check legal hold
    if (customer.legalHold) {
      throw new Error(
        `Cannot erase data for customer ${customerId}: entity is under legal hold`
      );
    }

    const emailHash = customer.email
      ? createHash("sha256").update(customer.email).digest("hex").slice(0, 16)
      : null;

    await prisma.$transaction(async (tx) => {
      // 1. Anonymize customer record
      await tx.customer.update({
        where: { id: customerId },
        data: {
          name: "Anonymized",
          email: emailHash ? `anon_${emailHash}@erased.local` : null,
          phone: null,
          metadata: Prisma.DbNull,
          deletedAt: new Date(),
        },
      });

      // 2. Anonymize email logs
      await tx.emailLog.updateMany({
        where: { customerId, tenantId },
        data: {
          to: emailHash ? `anon_${emailHash}@erased.local` : "erased",
          subject: "[Erased]",
          body: "[Erased per GDPR request]",
        },
      });

      // 3. Anonymize SMS logs
      await tx.smsLog.updateMany({
        where: { customerId, tenantId },
        data: {
          to: "[Erased]",
          body: "[Erased per GDPR request]",
        },
      });

      // 4. Preserve feedback ratings but mark as anonymized
      // (ratings and non-PII are kept for analytics)
      // No changes to feedback ratings needed -- only the linked customer is anonymized.

      // 5. Create deletion log
      await tx.deletionLog.create({
        data: {
          tenantId,
          entityType: "customer",
          entityId: customerId,
          deletedBy: requestedBy,
          reason: "GDPR erasure request",
          legalHold: false,
          restorable: false, // GDPR erasure is irreversible
          snapshotData: {
            originalName: customer.name,
            hadEmail: !!customer.email,
            hadPhone: !!customer.phone,
          } as Prisma.InputJsonValue,
        },
      });

      // 6. Audit the operation
      await createAuditLog({
        tenantId,
        userId: requestedBy,
        action: "GDPR_ERASURE",
        entity: "customer",
        entityId: customerId,
        details: {
          reason: "GDPR right to erasure",
          anonymized: true,
          irreversible: true,
        },
      });
    });

    logger.info(
      { tenantId, customerId, requestedBy },
      "GDPR erasure completed"
    );
  }

  /**
   * Returns a data processing activities record for the tenant.
   * This documents what data is processed, why, and for how long.
   */
  async getDataProcessingRecord(
    tenantId: string
  ): Promise<DataProcessingRecord> {
    // Fetch retention policy for accurate retention periods
    const policy = await prisma.dataRetentionPolicy.findUnique({
      where: { tenantId },
    });

    const feedbackDays = policy?.feedbackRetentionDays ?? 730;
    const customerDays = policy?.customerRetentionDays ?? 1095;
    const auditDays = policy?.auditLogRetentionDays ?? 2555;
    const eventDays = policy?.eventRetentionDays ?? 365;

    const processingActivities: ProcessingActivity[] = [
      {
        category: "Customer Management",
        purpose:
          "Managing customer relationships, communications, and feedback collection",
        dataTypes: [
          "Name",
          "Email address",
          "Phone number",
          "Customer status",
          "Tags",
          "Location",
        ],
        retentionPeriod: `${customerDays} days`,
        legalBasis: "Legitimate interest / Contractual necessity",
      },
      {
        category: "Feedback Collection",
        purpose:
          "Collecting and analyzing customer feedback to improve services",
        dataTypes: [
          "Feedback rating",
          "Comment text",
          "Submission timestamp",
          "Associated customer reference",
        ],
        retentionPeriod: `${feedbackDays} days`,
        legalBasis: "Legitimate interest",
      },
      {
        category: "Email Communications",
        purpose: "Sending feedback requests and follow-up communications",
        dataTypes: [
          "Recipient email",
          "Email subject",
          "Email body",
          "Delivery status",
        ],
        retentionPeriod: `${customerDays} days`,
        legalBasis: "Legitimate interest / Consent",
      },
      {
        category: "SMS Communications",
        purpose: "Sending SMS-based feedback requests",
        dataTypes: [
          "Recipient phone number",
          "Message body",
          "Delivery status",
        ],
        retentionPeriod: `${customerDays} days`,
        legalBasis: "Consent",
      },
      {
        category: "Recovery Tickets",
        purpose: "Managing dissatisfied customer recovery workflows",
        dataTypes: [
          "Ticket details",
          "Priority",
          "Notes",
          "Resolution status",
        ],
        retentionPeriod: `${feedbackDays} days`,
        legalBasis: "Legitimate interest",
      },
      {
        category: "Audit Logging",
        purpose:
          "Maintaining security and compliance audit trail",
        dataTypes: [
          "User ID",
          "Action performed",
          "Entity affected",
          "Timestamp",
          "IP address",
        ],
        retentionPeriod: `${auditDays} days`,
        legalBasis: "Legal obligation / Legitimate interest",
      },
      {
        category: "Usage Analytics",
        purpose: "Monitoring platform usage for billing and capacity planning",
        dataTypes: [
          "Usage counts by type",
          "Cost calculations",
          "Aggregated metrics",
        ],
        retentionPeriod: `${eventDays} days (events), unlimited (snapshots)`,
        legalBasis: "Contractual necessity",
      },
    ];

    await createAuditLog({
      tenantId,
      action: "GDPR_PROCESSING_RECORD_VIEWED",
      entity: "data_processing_record",
    });

    return {
      tenantId,
      processingActivities,
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Singleton GDPR service instance.
 */
export const gdprService = new GdprService();
