import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/signals/db';
import { resolveTenant, requirePlan } from '../../../lib/signals/auth-adapter';
import {
  competitorDeltas,
  snapshotHistory,
  ownReviewPace7d,
  upsertSnapshot,
  snapshotPlacesCompetitor,
  COMPETITOR_LIMITS,
  placesConfigured,
} from '../../../lib/signals/competitors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/competitors — list with latest snapshot, deltas + sparkline history */
export async function GET(req: NextRequest) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await requirePlan(auth, 'pro'))) {
    return NextResponse.json({ error: 'plan_required', minPlan: 'pro' }, { status: 402 });
  }

  const rows = await prisma.competitor.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, placeId: true, address: true, platform: true, active: true, notes: true },
  });

  const competitors = await Promise.all(
    rows.map(async (c) => ({
      ...c,
      deltas: await competitorDeltas(c.id),
      history: await snapshotHistory(c.id),
    })),
  );
  const own7 = await ownReviewPace7d(auth.tenantId);

  return NextResponse.json({ competitors, own7, placesConfigured: placesConfigured() });
}

function optionalRating(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 5 ? v : null;
}
function optionalCount(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}

/** POST /api/competitors — { name, placeId?, address?, rating?, reviewCount?, notes? } */
export async function POST(req: NextRequest) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await requirePlan(auth, 'pro'))) {
    return NextResponse.json({ error: 'plan_required', minPlan: 'pro' }, { status: 402 });
  }

  let body: {
    name?: unknown;
    placeId?: unknown;
    address?: unknown;
    rating?: unknown;
    reviewCount?: unknown;
    notes?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const placeId =
    typeof body.placeId === 'string' && body.placeId.trim() ? body.placeId.trim().slice(0, 200) : null;
  const address =
    typeof body.address === 'string' && body.address.trim() ? body.address.trim().slice(0, 300) : null;
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : null;

  const count = await prisma.competitor.count({ where: { tenantId: auth.tenantId } });
  if (count >= COMPETITOR_LIMITS.maxPerTenant) {
    return NextResponse.json(
      { error: 'limit_reached', limit: COMPETITOR_LIMITS.maxPerTenant },
      { status: 400 },
    );
  }

  if (placeId) {
    const dup = await prisma.competitor.findFirst({
      where: { tenantId: auth.tenantId, placeId },
      select: { id: true },
    });
    if (dup) return NextResponse.json({ error: 'duplicate_place' }, { status: 409 });
    // A manual row with the same name is almost certainly the same business —
    // point the user at "Link to Places" on that row instead of duplicating.
    const manualTwin = await prisma.competitor.findFirst({
      where: { tenantId: auth.tenantId, placeId: null, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (manualTwin) return NextResponse.json({ error: 'duplicate_manual_name' }, { status: 409 });
  } else {
    const dup = await prisma.competitor.findFirst({
      where: { tenantId: auth.tenantId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (dup) return NextResponse.json({ error: 'duplicate_name' }, { status: 409 });
  }

  const competitor = await prisma.competitor.create({
    data: { tenantId: auth.tenantId, name, placeId, address, notes },
    select: { id: true, name: true, placeId: true, address: true, platform: true, active: true, notes: true },
  });

  // First snapshot immediately for Places-linked rows so they never start
  // empty. The search response already carried rating/review count — reuse it
  // (zero extra Places calls); fall back to one details fetch if absent.
  if (placeId) {
    const rating = optionalRating(body.rating);
    const reviewCount = optionalCount(body.reviewCount);
    if (rating !== null || reviewCount !== null) {
      await upsertSnapshot(competitor.id, { rating, reviewCount, raw: { source: 'add', address } });
    } else {
      await snapshotPlacesCompetitor(competitor.id, placeId);
    }
  }

  return NextResponse.json({ competitor }, { status: 201 });
}
