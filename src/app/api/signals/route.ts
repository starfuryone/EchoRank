import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/signals/db';
import { ingestSignals, validateRawSignal } from '../../../lib/signals/ingest';
import { resolveTenant, requirePlan } from '../../../lib/signals/auth-adapter';
import { SIGNAL_SOURCES } from '../../../lib/signals/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/signals?source=review&days=30&limit=50 — tenant-scoped feed */
export async function GET(req: NextRequest) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await requirePlan(auth, 'pro'))) {
    return NextResponse.json({ error: 'plan_required', minPlan: 'pro' }, { status: 402 });
  }

  const sp = req.nextUrl.searchParams;
  const source = sp.get('source');
  const days = Math.min(365, Math.max(1, Number(sp.get('days') ?? 30)));
  const limit = Math.min(200, Math.max(1, Number(sp.get('limit') ?? 50)));

  const signals = await prisma.signal.findMany({
    where: {
      tenantId: auth.tenantId,
      occurredAt: { gte: new Date(Date.now() - days * 86_400_000) },
      ...(source && SIGNAL_SOURCES.includes(source as never) ? { source } : {}),
    },
    orderBy: { occurredAt: 'desc' },
    take: limit,
    select: {
      id: true, source: true, occurredAt: true, sentiment: true, severity: true,
      magnitude: true, title: true, url: true, entityType: true, entityId: true,
    },
  });

  return NextResponse.json({ signals, count: signals.length });
}

/**
 * POST /api/signals — ingest one signal or an array.
 * Service callers (sidecar, workers): x-internal-secret + x-tenant-id headers.
 * Body tenantId is ignored; the authed tenant always wins.
 */
export async function POST(req: NextRequest) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const items = Array.isArray(body) ? body : [body];
  if (items.length > 500) return NextResponse.json({ error: 'max 500 per call' }, { status: 400 });

  const valid = [];
  const errors: { index: number; error: string }[] = [];
  for (let i = 0; i < items.length; i++) {
    const v = validateRawSignal({ ...(items[i] as object), tenantId: auth.tenantId });
    if (v.ok) valid.push(v.value);
    else errors.push({ index: i, error: v.error });
  }

  const ingested = valid.length ? await ingestSignals(valid) : 0;
  return NextResponse.json(
    { ingested, rejected: errors.length, errors: errors.slice(0, 10) },
    { status: errors.length && !ingested ? 400 : 200 },
  );
}
