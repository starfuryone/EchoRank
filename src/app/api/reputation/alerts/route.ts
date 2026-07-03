import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/signals/db';
import { resolveTenant, requirePlan } from '../../../../lib/signals/auth-adapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/reputation/alerts?days=30&limit=50 */
export async function GET(req: NextRequest) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await requirePlan(auth, 'pro'))) {
    return NextResponse.json({ error: 'plan_required', minPlan: 'pro' }, { status: 402 });
  }

  const sp = req.nextUrl.searchParams;
  const days = Math.min(90, Math.max(1, Number(sp.get('days') ?? 30)));
  const limit = Math.min(100, Math.max(1, Number(sp.get('limit') ?? 50)));

  const alerts = await prisma.alertEvent.findMany({
    where: {
      tenantId: auth.tenantId,
      createdAt: { gte: new Date(Date.now() - days * 86_400_000) },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, kind: true, severity: true, title: true,
      body: true, notifiedAt: true, createdAt: true,
    },
  });

  return NextResponse.json({ alerts, count: alerts.length });
}
