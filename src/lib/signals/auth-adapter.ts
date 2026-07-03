import type { NextRequest } from 'next/server';
import { requireTenant } from '@/lib/tenant';
import { requirePlan as gatePlan, PlanRequiredError } from '@/lib/plan-enforcement';
import type { PlanType } from '@/generated/prisma';

export interface AuthedContext {
  tenantId: string;
  via: 'internal' | 'session';
}

export async function resolveTenant(req: NextRequest): Promise<AuthedContext | null> {
  const secret = req.headers.get('x-internal-secret');
  if (secret && process.env.INTERNAL_API_SECRET && secret === process.env.INTERNAL_API_SECRET) {
    const tenantId = req.headers.get('x-tenant-id');
    return tenantId ? { tenantId, via: 'internal' } : null;
  }
  try {
    const membership = await requireTenant();
    if (membership?.tenantId) return { tenantId: membership.tenantId, via: 'session' };
  } catch {
    // unauthenticated
  }
  return null;
}

// If your PlanType casing differs, this `satisfies` fails the build and names the line.
const PLAN_MAP = {
  starter: 'STARTER',
  pro: 'GROWTH',
  elite: 'AGENCY',
} as const satisfies Record<'starter' | 'pro' | 'elite', PlanType>;

export async function requirePlan(
  auth: AuthedContext,
  minPlan: keyof typeof PLAN_MAP,
): Promise<boolean> {
  if (auth.via === 'internal') return true; // service calls bypass the gate
  try {
    await gatePlan(PLAN_MAP[minPlan]);
    return true;
  } catch (e) {
    if (e instanceof PlanRequiredError) return false;
    throw e;
  }
}
