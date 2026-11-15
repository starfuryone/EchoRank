/**
 * DELETE /api/account/memory/:id — delete one memory of the session's workspace.
 *
 * Tenant-scoped in the sidecar: it loads the item and answers 404 unless its
 * scope is this tenant's, so another workspace's id is indistinguishable from
 * a missing one. Any member may delete a memory: removing a wrong fact is
 * never a privilege. AUTHENTICATED (/api/account/* is not public).
 */

import { NextResponse } from "next/server";
import { requirePaidPlan, PaidPlanRequiredError } from "@/lib/paid-plan";
import { deleteMemory, MemoryUnavailableError } from "@/lib/memory/client";

export const dynamic = "force-dynamic";

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  let m;
  try {
    m = await requirePaidPlan();
  } catch (err) {
    if (err instanceof PaidPlanRequiredError) return NextResponse.json({ error: "paid_plan_required" }, { status: 403 });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const deleted = await deleteMemory(m.tenantId, id);
    if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ deleted: id });
  } catch (err) {
    if (err instanceof MemoryUnavailableError) return NextResponse.json({ error: "memory_unavailable" }, { status: 503 });
    throw err;
  }
}
