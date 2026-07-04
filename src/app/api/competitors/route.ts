import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/signals/db';
import { resolveTenant, requirePlan } from '../../../lib/signals/auth-adapter';
import { competitorDeltas, ownReviewPace7d, COMPETITOR_LIMITS, placesConfigured } from '../../../lib/signals/competitors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/competitors — list with latest snapshot + deltas */
export async function GET(req: NextRequest) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await requirePlan(auth, 'pro'))) {
    return NextResponse.json({ error: 'plan_required', minPlan: 'pro' }, { status: 402 });
  }

  const rows = await prisma.competitor.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, placeId: true, platform: true, active: true, notes: true },
  });

  const competitors = await Promise.all(
    rows.map(async (c) => ({ ...c, deltas: await competitorDeltas(c.id) })),
  );
  const own7 = await ownReviewPace7d(auth.tenantId);

  return NextResponse.json({ competitors, own7, placesConfigured: placesConfigured() });
}

/** POST /api/competitors — { name, placeId? , notes? } */
export async function POST(req: NextRequest) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await requirePlan(auth, 'pro'))) {
    return NextResponse.json({ error: 'plan_required', minPlan: 'pro' }, { status: 402 });
  }

  let body: { name?: unknown; placeId?: unknown; notes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const placeId =
    typeof body.placeId === 'string' && body.placeId.trim() ? body.placeId.trim().slice(0, 200) : null;
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : null;

  const count = await prisma.competitor.count({ where: { tenantId: auth.tenantId } });
  if (count >= COMPETITOR_LIMITS.maxPerTenant) {
    return NextResponse.json({ error: `limit of ${COMPETITOR_LIMITS.maxPerTenant} competitors reached` }, { status: 400 });
  }

  if (placeId) {
    const dup = await prisma.competitor.findFirst({
      where: { tenantId: auth.tenantId, placeId },
      select: { id: true },
    });
    if (dup) return NextResponse.json({ error: 'competitor with this placeId already exists' }, { status: 409 });
  }

  const competitor = await prisma.competitor.create({
    data: { tenantId: auth.tenantId, name, placeId, notes },
    select: { id: true, name: true, placeId: true, platform: true, active: true, notes: true },
  });

  return NextResponse.json({ competitor }, { status: 201 });
}
