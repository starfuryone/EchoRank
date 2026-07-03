import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { prisma } from "@/lib/prisma";
import { addJob } from "@/infrastructure/queue/registry";

/** Run all active tracked prompts now (AGENCY+). */
export async function POST() {
  try {
    const membership = await requireTenant();
    await requireFeature("answer_tracking");
    const tenantId = membership.tenantId;

    const result = await prisma.trackedPrompt.updateMany({
      where: { tenantId, active: true },
      data: { nextRunAt: new Date() },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "No active prompts to run." }, { status: 400 });
    }
    await addJob(
      "visibility-monitoring",
      "run-prompt-batch",
      { promptTenantId: tenantId },
      { jobId: `pt-now-${tenantId}-${Date.now()}`, removeOnComplete: true, removeOnFail: true },
    );
    return NextResponse.json({ queued: result.count });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    console.error("[visibility/prompts/run POST]", error);
    return NextResponse.json({ error: "Failed to queue run." }, { status: 500 });
  }
}
