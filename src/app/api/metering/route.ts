import { requireTenant } from "@/lib/tenant";
import { meteringService } from "@/infrastructure/metering/service";
import { quotaEnforcer } from "@/infrastructure/metering/quota";
import { usageAggregator } from "@/infrastructure/metering/aggregation";

/**
 * GET /api/metering
 *
 * Returns current month usage for the authenticated tenant,
 * including quota status, usage breakdown, and cost estimate.
 */
export async function GET() {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    // Fetch usage breakdown and quota status in parallel
    const [monthUsage, quotaStatus] = await Promise.all([
      meteringService.getCurrentMonthUsage(tenantId),
      quotaEnforcer.getQuotaStatus(tenantId),
    ]);

    // Calculate estimated cost for the current month
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

    // Build a snapshot-like object for cost calculation
    const snapshot = await usageAggregator.calculateCost({
      id: "",
      tenantId,
      periodStart,
      periodEnd,
      emailsSent: monthUsage["EMAIL_SENT"] ?? 0,
      smsSent: monthUsage["SMS_SENT"] ?? 0,
      webhookCalls: monthUsage["WEBHOOK_CALL"] ?? 0,
      apiRequests: monthUsage["API_REQUEST"] ?? 0,
      aiTokensUsed: monthUsage["AI_TOKEN_USAGE"] ?? 0,
      aiInferences: monthUsage["AI_INFERENCE"] ?? 0,
      aiCost: 0,
      feedbackRequests: monthUsage["FEEDBACK_REQUEST"] ?? 0,
      reviewConversions: monthUsage["REVIEW_CONVERSION"] ?? 0,
      escalationEvents: monthUsage["ESCALATION_EVENT"] ?? 0,
      monitoringChecks: monthUsage["MONITORING_CHECK"] ?? 0,
      totalCost: 0,
      createdAt: new Date(),
    });

    return Response.json({
      tenantId,
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
      usage: monthUsage,
      quotas: quotaStatus.quotas,
      overageAllowed: quotaStatus.overageAllowed,
      estimatedCost: snapshot,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.error("Error fetching metering data:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
