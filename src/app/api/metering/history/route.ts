import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { usageAggregator } from "@/infrastructure/metering/aggregation";

/**
 * GET /api/metering/history?months=6
 *
 * Returns usage history (monthly snapshots) with trend data
 * for the authenticated tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    const monthsParam = request.nextUrl.searchParams.get("months");
    const months = Math.min(
      24,
      Math.max(1, parseInt(monthsParam || "6", 10))
    );

    const snapshots = await usageAggregator.getUsageTrend(tenantId, months);

    // Calculate trend indicators (month-over-month change)
    const trends: Record<string, number | null>[] = [];
    for (let i = 0; i < snapshots.length; i++) {
      const current = snapshots[i];
      const previous = i > 0 ? snapshots[i - 1] : null;

      trends.push({
        emailsSent: previous
          ? current.emailsSent - previous.emailsSent
          : null,
        smsSent: previous
          ? current.smsSent - previous.smsSent
          : null,
        webhookCalls: previous
          ? current.webhookCalls - previous.webhookCalls
          : null,
        apiRequests: previous
          ? current.apiRequests - previous.apiRequests
          : null,
        aiInferences: previous
          ? current.aiInferences - previous.aiInferences
          : null,
        totalCost: previous
          ? current.totalCost - previous.totalCost
          : null,
      });
    }

    return Response.json({
      tenantId,
      months,
      snapshots: snapshots.map((snapshot, index) => ({
        ...snapshot,
        trend: trends[index],
      })),
      summary: {
        totalRecords: snapshots.length,
        latestPeriod: snapshots.length > 0
          ? {
              start: snapshots[snapshots.length - 1].periodStart,
              end: snapshots[snapshots.length - 1].periodEnd,
            }
          : null,
      },
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

    console.error("Error fetching metering history:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
