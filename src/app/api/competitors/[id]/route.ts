import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/signals/db';
import { resolveTenant, requirePlan } from '../../../../lib/signals/auth-adapter';
import { upsertSnapshot, snapshotPlacesCompetitor } from '../../../../lib/signals/competitors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function owned(tenantId: string, id: string) {
  const c = await prisma.competitor.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  return !!c;
}

/**
 * PATCH /api/competitors/[id] — { name?, placeId?, address?, active?, notes?,
 * rating?, reviewCount? }. Setting placeId on a manual row is the "link to
 * Places" upgrade: snapshot history is kept and a first snapshot is recorded
 * immediately (from the passed search-candidate numbers when present,
 * otherwise one details fetch).
 */
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
  if ('address' in body) {
    data.address =
      typeof body.address === 'string' && body.address.trim() ? body.address.trim().slice(0, 300) : null;
  }
  if ('active' in body) {
    if (typeof body.active === 'boolean') data.active = body.active;
    else return NextResponse.json({ error: 'active must be boolean' }, { status: 400 });
  }
  if ('notes' in body) {
    data.notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : null;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

  if (typeof data.placeId === 'string') {
    const dup = await prisma.competitor.findFirst({
      where: { tenantId: auth.tenantId, placeId: data.placeId, NOT: { id } },
      select: { id: true },
    });
    if (dup) return NextResponse.json({ error: 'duplicate_place' }, { status: 409 });
  }

  const competitor = await prisma.competitor.update({
    where: { id },
    data,
    select: { id: true, name: true, placeId: true, address: true, platform: true, active: true, notes: true },
  });

  // Linked to Places just now → record a first snapshot so the row shows data
  // immediately. Candidate numbers from the search response cost nothing.
  if (typeof data.placeId === 'string') {
    const rating =
      typeof body.rating === 'number' && Number.isFinite(body.rating) && body.rating >= 0 && body.rating <= 5
        ? body.rating
        : null;
    const reviewCount =
      typeof body.reviewCount === 'number' && Number.isInteger(body.reviewCount) && body.reviewCount >= 0
        ? body.reviewCount
        : null;
    if (rating !== null || reviewCount !== null) {
      await upsertSnapshot(id, { rating, reviewCount, raw: { source: 'link', address: data.address ?? null } });
    } else {
      await snapshotPlacesCompetitor(id, data.placeId);
    }
  }

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
