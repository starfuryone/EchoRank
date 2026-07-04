import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/signals/db';
import { resolveTenant, requirePlan } from '../../../../../lib/signals/auth-adapter';
import { upsertSnapshot } from '../../../../../lib/signals/competitors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function owned(tenantId: string, id: string) {
  const c = await prisma.competitor.findFirst({ where: { id, tenantId }, select: { id: true } });
  return !!c;
}

/** GET /api/competitors/[id]/snapshots?days=90 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await requirePlan(auth, 'pro'))) {
    return NextResponse.json({ error: 'plan_required', minPlan: 'pro' }, { status: 402 });
  }
  const { id } = await ctx.params;
  if (!(await owned(auth.tenantId, id))) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get('days') ?? 90)));
  const snapshots = await prisma.competitorSnapshot.findMany({
    where: { competitorId: id, day: { gte: new Date(Date.now() - days * 86_400_000) } },
    orderBy: { day: 'asc' },
    select: { day: true, rating: true, reviewCount: true },
  });
  return NextResponse.json({
    snapshots: snapshots.map((s) => ({
      day: s.day.toISOString().slice(0, 10),
      rating: s.rating,
      reviewCount: s.reviewCount,
    })),
  });
}

/**
 * POST /api/competitors/[id]/snapshots — { rating?, reviewCount?, day? }
 * Manual/extension provider path: works with zero Places key. `day` (ISO date)
 * is optional and defaults to today; accepted so imports can backfill history.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await requirePlan(auth, 'pro'))) {
    return NextResponse.json({ error: 'plan_required', minPlan: 'pro' }, { status: 402 });
  }
  const { id } = await ctx.params;
  if (!(await owned(auth.tenantId, id))) return NextResponse.json({ error: 'not found' }, { status: 404 });

  let body: { rating?: unknown; reviewCount?: unknown; day?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const rating =
    body.rating === undefined || body.rating === null
      ? null
      : typeof body.rating === 'number' && body.rating >= 0 && body.rating <= 5
        ? body.rating
        : undefined;
  if (rating === undefined) return NextResponse.json({ error: 'rating must be 0–5' }, { status: 400 });

  const reviewCount =
    body.reviewCount === undefined || body.reviewCount === null
      ? null
      : Number.isInteger(body.reviewCount) && (body.reviewCount as number) >= 0
        ? (body.reviewCount as number)
        : undefined;
  if (reviewCount === undefined) return NextResponse.json({ error: 'reviewCount must be a non-negative integer' }, { status: 400 });

  if (rating === null && reviewCount === null) {
    return NextResponse.json({ error: 'provide rating and/or reviewCount' }, { status: 400 });
  }

  let day: Date | undefined;
  if (body.day !== undefined) {
    const d = new Date(String(body.day));
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'day invalid' }, { status: 400 });
    day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  const snapshot = await upsertSnapshot(id, { rating, reviewCount, raw: { via: auth.via } }, day);
  return NextResponse.json(
    { snapshot: { day: snapshot.day.toISOString().slice(0, 10), rating: snapshot.rating, reviewCount: snapshot.reviewCount } },
    { status: 201 },
  );
}
