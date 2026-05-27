import { NextResponse } from "next/server";
import { requireRole } from "@/lib/tenant";

export async function GET() {
  try {
    const membership = await requireRole(["OWNER", "ADMIN"]);

    const { getRegisteredQueues, getQueue } = await import(
      "@/infrastructure/queue/registry"
    );

    const names = getRegisteredQueues();
    const stats = await Promise.all(
      names.map(async (name) => {
        try {
          const q = getQueue(name);
          const counts = await q.getJobCounts();
          return { name, ...counts };
        } catch {
          return { name, error: "unavailable" };
        }
      })
    );

    return NextResponse.json({
      tenantId: membership.tenantId,
      queues: stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
