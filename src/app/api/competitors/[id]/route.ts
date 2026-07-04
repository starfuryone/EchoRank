import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/signals/db';
import { resolveTenant, requirePlan } from '../../../../lib/signals/auth-adapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function owned(tenantId: string, id: string) {
  const c = await prisma.competitor.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  return !!c;
}

/** PATCH /api/competitors/[id] — { name?, placeId?, active?, notes? } */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await requirePlan(auth, 'pro'))) {
    return NextResponse.json({ error: 'plan_required', minPlan: 'pro' }, { status: 402 });
  }
  const { id } = await ctx.params;
  if (!(await owned(auth.tenantId, id))) return NextResponse.json({ error: 'not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if ('name' in body) {
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 120);
    else return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 });
  }
  if ('placeId' in body) {
    if (body.placeId === null || body.placeId === '') data.placeId = null;
    else if (typeof body.placeId === 'string') data.placeId = body.placeId.trim().slice(0, 200);
    else return NextResponse.json({ error: 'placeId invalid' }, { status: 400 });
  }
  if ('active' in body) {
    if (typeof body.active === 'boolean') data.active = body.active;
    else return NextResponse.json({ error: 'active must be boolean' }, { status: 400 });
  }
  if ('notes' in body) {
    data.notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : null;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

  const competitor = await prisma.competitor.update({
    where: { id },
    data,
    select: { id: true, name: true, placeId: true, platform: true, active: true, notes: true },
  });
  return NextResponse.json({ competitor });
}

/** DELETE /api/competitors/[id] — cascades snapshots */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await requirePlan(auth, 'pro'))) {
    return NextResponse.json({ error: 'plan_required', minPlan: 'pro' }, { status: 402 });
  }
  const { id } = await ctx.params;
  if (!(await owned(auth.tenantId, id))) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await prisma.competitor.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
