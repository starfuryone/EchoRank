import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/signals/db';
import { resolveTenant, requirePlan } from '../../../../lib/signals/auth-adapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULTS = {
  monthlyRevenue: null as number | null,
  currency: 'USD',
  riskElasticity: 0.1,
  alertEmails: null as string | null,
  alertsEnabled: true,
};

/** GET /api/reputation/config */
export async function GET(req: NextRequest) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await requirePlan(auth, 'pro'))) {
    return NextResponse.json({ error: 'plan_required', minPlan: 'pro' }, { status: 402 });
  }

  const cfg = await prisma.tenantRiskConfig.findUnique({
    where: { tenantId: auth.tenantId },
    select: {
      monthlyRevenue: true, currency: true, riskElasticity: true,
      alertEmails: true, alertsEnabled: true,
    },
  });
  return NextResponse.json({ config: cfg ?? DEFAULTS });
}

/** PATCH /api/reputation/config — session only */
export async function PATCH(req: NextRequest) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (auth.via !== 'session') {
    return NextResponse.json({ error: 'session_required' }, { status: 403 });
  }
  if (!(await requirePlan(auth, 'pro'))) {
    return NextResponse.json({ error: 'plan_required', minPlan: 'pro' }, { status: 402 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if ('monthlyRevenue' in body) {
    const v = body.monthlyRevenue;
    if (v === null) data.monthlyRevenue = null;
    else if (typeof v === 'number' && v >= 0 && v < 1e10) data.monthlyRevenue = v;
    else return NextResponse.json({ error: 'monthlyRevenue must be a non-negative number' }, { status: 400 });
  }
  if ('currency' in body) {
    const v = body.currency;
    if (typeof v === 'string' && /^[A-Z]{3}$/.test(v)) data.currency = v;
    else return NextResponse.json({ error: 'currency must be a 3-letter code' }, { status: 400 });
  }
  if ('riskElasticity' in body) {
    const v = body.riskElasticity;
    if (typeof v === 'number' && v > 0 && v <= 1) data.riskElasticity = v;
    else return NextResponse.json({ error: 'riskElasticity must be in (0, 1]' }, { status: 400 });
  }
  if ('alertEmails' in body) {
    const v = body.alertEmails;
    if (v === null || v === '') data.alertEmails = null;
    else if (typeof v === 'string' && v.length <= 500) {
      const emails = v.split(',').map((e) => e.trim()).filter(Boolean);
      if (emails.every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) && emails.length <= 10) {
        data.alertEmails = emails.join(',');
      } else {
        return NextResponse.json({ error: 'alertEmails must be up to 10 valid comma-separated emails' }, { status: 400 });
      }
    } else return NextResponse.json({ error: 'alertEmails invalid' }, { status: 400 });
  }
  if ('alertsEnabled' in body) {
    if (typeof body.alertsEnabled === 'boolean') data.alertsEnabled = body.alertsEnabled;
    else return NextResponse.json({ error: 'alertsEnabled must be boolean' }, { status: 400 });
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const cfg = await prisma.tenantRiskConfig.upsert({
    where: { tenantId: auth.tenantId },
    create: { tenantId: auth.tenantId, ...data },
    update: data,
    select: {
      monthlyRevenue: true, currency: true, riskElasticity: true,
      alertEmails: true, alertsEnabled: true,
    },
  });

  return NextResponse.json({ config: cfg });
}
