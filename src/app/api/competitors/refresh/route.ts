import { NextRequest, NextResponse } from 'next/server';
import { resolveTenant, requirePlan } from '../../../../lib/signals/auth-adapter';
import { riskQueue } from '../../../../lib/signals/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/competitors/refresh — enqueue an immediate sweep for this tenant */
export async function POST(req: NextRequest) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await requirePlan(auth, 'pro'))) {
    return NextResponse.json({ error: 'plan_required', minPlan: 'pro' }, { status: 402 });
  }

  try {
    await riskQueue().add(
      'competitor-sweep-tenant',
      { tenantId: auth.tenantId },
      { jobId: `compsweep-${auth.tenantId}`, removeOnComplete: true, removeOnFail: 20 },
    );
    return NextResponse.json({ queued: true });
  } catch (err) {
    console.error('[competitors] refresh enqueue failed:', (err as Error).message);
    return NextResponse.json({ error: 'enqueue_failed' }, { status: 500 });
  }
}
