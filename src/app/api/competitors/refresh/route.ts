import { NextRequest, NextResponse } from 'next/server';
import { resolveTenant, requirePlan } from '../../../../lib/signals/auth-adapter';
import { refreshTenantSnapshots } from '../../../../lib/signals/competitors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/competitors/refresh — snapshot every Places-linked competitor
 * synchronously and report per-competitor success/error. (Previously this
 * enqueued a fire-and-forget sweep job: the UI could never tell whether it
 * ran, and a stale failed job under the fixed jobId silently blocked
 * re-enqueues. Momentum alerts still run with the nightly sweep.)
 */
export async function POST(req: NextRequest) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await requirePlan(auth, 'pro'))) {
    return NextResponse.json({ error: 'plan_required', minPlan: 'pro' }, { status: 402 });
  }

  try {
    const results = await refreshTenantSnapshots(auth.tenantId);
    return NextResponse.json({ results });
  } catch (err) {
    console.error('[competitors] refresh failed:', (err as Error).message);
    return NextResponse.json({ error: 'refresh_failed' }, { status: 500 });
  }
}
