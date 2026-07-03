import { NextRequest, NextResponse } from 'next/server';
import { riskOverview } from '../../../../lib/signals/scoring';
import { resolveTenant, requirePlan } from '../../../../lib/signals/auth-adapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/reputation/risk[?refresh=1] */
export async function GET(req: NextRequest) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await requirePlan(auth, 'pro'))) {
    return NextResponse.json({ error: 'plan_required', minPlan: 'pro' }, { status: 402 });
  }

  try {
    const overview = await riskOverview(auth.tenantId, {
      refresh: req.nextUrl.searchParams.get('refresh') === '1',
    });
    return NextResponse.json(overview);
  } catch (err) {
    console.error('[signals] risk overview failed:', err);
    return NextResponse.json({ error: 'compute_failed' }, { status: 500 });
  }
}
