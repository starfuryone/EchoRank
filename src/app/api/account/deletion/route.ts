/**
 * /api/account/deletion — the signed-in user's own deletion request.
 *   GET    → the pending request, if any
 *   POST   { confirm: "DELETE" } → request deletion (14-day grace, src/lib/privacy/deletion.ts)
 *   DELETE → cancel the pending request
 *
 * AUTHENTICATED — do not add /api/account/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { cancelDeletion, pendingDeletion, requestDeletion } from "@/lib/privacy/deletion";

const view = (r: { id: string; scope: string; requestedAt: Date; runAfter: Date } | null) =>
  r ? { id: r.id, scope: r.scope, requestedAt: r.requestedAt.toISOString(), runAfter: r.runAfter.toISOString() } : null;

async function member() {
  try {
    return await requireTenant();
  } catch {
    return null;
  }
}

export async function GET() {
  const m = await member();
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ pending: view(await pendingDeletion(m.userId)), role: m.role });
}

export async function POST(request: Request) {
  const m = await member();
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { confirm?: string } | null;
  if (body?.confirm !== "DELETE") return NextResponse.json({ error: "confirm_required" }, { status: 400 });
  const row = await requestDeletion(m.userId, m.tenantId);
  return NextResponse.json({ pending: view(row) }, { status: 201 });
}

export async function DELETE() {
  const m = await member();
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const row = await cancelDeletion(m.userId);
  return NextResponse.json({ cancelled: !!row });
}
