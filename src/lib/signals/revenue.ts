import { prisma } from './db';

const BASELINE_SCORE = 20; // grade-A ceiling — risk at or below this costs nothing

export interface RevenueAtRisk {
  monthlyRevenue: number;
  currency: string;
  elasticity: number;
  /** Estimated monthly revenue exposure at the current risk score. */
  atRisk: number;
}

/**
 * Deterministic heuristic, documented for the dashboard tooltip:
 *   atRisk = monthlyRevenue × elasticity × max(0, score − 20) / 100
 * Elasticity defaults to 0.10 (≈1% of revenue exposed per 10 risk points
 * above baseline) — tunable per tenant via TenantRiskConfig.riskElasticity.
 */
export async function getRevenueAtRisk(
  tenantId: string,
  score: number,
): Promise<RevenueAtRisk | null> {
  const cfg = await prisma.tenantRiskConfig.findUnique({
    where: { tenantId },
    select: { monthlyRevenue: true, currency: true, riskElasticity: true },
  });
  if (!cfg?.monthlyRevenue || cfg.monthlyRevenue <= 0) return null;

  const elasticity = cfg.riskElasticity > 0 ? cfg.riskElasticity : 0.1;
  const excess = Math.max(0, Math.min(100, score) - BASELINE_SCORE);
  return {
    monthlyRevenue: cfg.monthlyRevenue,
    currency: cfg.currency,
    elasticity,
    atRisk: Math.round(cfg.monthlyRevenue * elasticity * (excess / 100)),
  };
}
