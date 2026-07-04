import { NextRequest, NextResponse } from 'next/server';
import { resolveTenant, requirePlan } from '../../../../lib/signals/auth-adapter';
import { searchPlaces, placesConfigured } from '../../../../lib/signals/competitors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/competitors/search?q=joes+pizza+brooklyn */
export async function GET(req: NextRequest) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await requirePlan(auth, 'pro'))) {
    return NextResponse.json({ error: 'plan_required', minPlan: 'pro' }, { status: 402 });
  }

  if (!placesConfigured()) {
    return NextResponse.json({ error: 'places_not_configured', candidates: [] }, { status: 200 });
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 200);
  if (q.length < 3) return NextResponse.json({ error: 'query too short' }, { status: 400 });

  const candidates = await searchPlaces(q);
  return NextResponse.json({ candidates });
}
