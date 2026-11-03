import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/platform-admin";

// Every queue's counts are platform-wide, so this is staff only
// (PLATFORM_ADMIN_EMAILS), not any tenant's OWNER/ADMIN.
export async function GET() {
  const admin = await requirePlatformAdminApi();
  if (admin instanceof NextResponse) return admin;
  try {
    const { getQueue } = await import("@/infrastructure/queue/registry");
    const { QUEUE_NAMES } = await import("@/infrastructure/redis/config");
    const { alertRedis } = await import("@/infrastructure/queue/failure-alert");
    const { queueAlertStatus } = await import("@/lib/queue-alerts");

    // Every queue, not getRegisteredQueues(): that lists only the queues this
    // web process happens to have instantiated, which is few of them.
    const stats = await Promise.all(
      QUEUE_NAMES.map(async (name) => {
        try {
          const counts = await getQueue(name).getJobCounts();
          return { name, ...counts };
        } catch {
          return { name, error: "unavailable" };
        }
      })
    );

    return NextResponse.json({
      queues: stats,
      failedTotal: stats.reduce((n, q) => n + Number((q as { failed?: number }).failed ?? 0), 0),
      // The workers process emails support@ on every final failure, including
      // jobs removed on failure, which the counts above cannot show.
      failureAlert: await queueAlertStatus(alertRedis()).catch(() => null),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
