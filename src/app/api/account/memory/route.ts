/**
 * /api/account/memory — the workspace's AI memory (Settings → AI memory).
 *   GET    ?cursor=N           → { included, enabled, total, items, nextCursor, allowance, addsUsed }
 *   PUT    { enabled }         → switch memory on or off (owner or admin)
 *   DELETE { confirm: "DELETE" } → delete every memory (owner or admin); the switch stays as it is
 *
 * The tenant is the session's (requirePaidPlan), never a body or query field:
 * a `tenantId` sent in the body is ignored. AUTHENTICATED — /api/account/* is
 * not in publicPaths (src/proxy.ts) and must not be.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan, PaidPlanRequiredError } from "@/lib/paid-plan";
import {
  getMemorySettings,
  listMemories,
  MemoryUnavailableError,
  purgeTenantMemory,
  setMemoryEnabled,
} from "@/lib/memory/client";
import { memoryAllowance, planHasMemory } from "@/lib/memory/limits";
import { memoryAddsUsed } from "@/lib/memory/quota";

export const dynamic = "force-dynamic";

type Member = Awaited<ReturnType<typeof requirePaidPlan>>;

async function member(): Promise<Member | NextResponse> {
  try {
    return await requirePaidPlan();
  } catch (err) {
    if (err instanceof PaidPlanRequiredError) return NextResponse.json({ error: "paid_plan_required" }, { status: 403 });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}

const canManage = (m: Member) => m.role === "OWNER" || m.role === "ADMIN";

function unavailable(err: unknown) {
  if (err instanceof MemoryUnavailableError) return NextResponse.json({ error: "memory_unavailable" }, { status: 503 });
  throw err;
}

export async function GET(request: Request) {
  const m = await member();
  if (m instanceof NextResponse) return m;
  const plan = m.tenant.planType;
  const allowance = memoryAllowance(plan);
  if (!planHasMemory(plan)) {
    return NextResponse.json({ included: false, allowance, canManage: canManage(m) });
  }
  const cursor = Math.max(0, Number(new URL(request.url).searchParams.get("cursor")) || 0);
  try {
    const [settings, page, addsUsed] = await Promise.all([
      getMemorySettings(m.tenantId),
      listMemories(m.tenantId, cursor),
      memoryAddsUsed(m.tenantId),
    ]);
    return NextResponse.json({
      included: true,
      enabled: settings.enabled,
      total: page.total,
      items: page.items,
      nextCursor: page.nextCursor,
      allowance,
      addsUsed,
      canManage: canManage(m),
    });
  } catch (err) {
    return unavailable(err);
  }
}

const PutBody = z.object({ enabled: z.boolean() });

export async function PUT(request: Request) {
  const m = await member();
  if (m instanceof NextResponse) return m;
  if (!canManage(m)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!planHasMemory(m.tenant.planType)) return NextResponse.json({ error: "not_on_plan" }, { status: 403 });
  const parsed = PutBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const s = await setMemoryEnabled(m.tenantId, parsed.data.enabled);
    return NextResponse.json({ enabled: s.enabled, total: s.total });
  } catch (err) {
    return unavailable(err);
  }
}

export async function DELETE(request: Request) {
  const m = await member();
  if (m instanceof NextResponse) return m;
  if (!canManage(m)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { confirm?: string } | null;
  if (body?.confirm !== "DELETE") return NextResponse.json({ error: "confirm_required" }, { status: 400 });
  try {
    const r = await purgeTenantMemory(m.tenantId);
    return NextResponse.json({ deleted: r?.purged.memories ?? 0 });
  } catch (err) {
    return unavailable(err);
  }
}
