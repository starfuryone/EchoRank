// src/lib/bot-analytics/limits.ts — the log-upload allowance, dependency-free
// so the locked message (src/lib/locked-plan.ts) names the plan this table
// opens. upload.ts (server: fs, zlib, Redis) re-exports it.
import type { PlanType } from "@/generated/prisma";

/**
 * Monthly upload allowance. STARTER is absent on purpose — it has no access to
 * this half at all and sees an upsell card instead, so there is no number to
 * enforce.
 */
const UPLOADS_PER_MONTH: Partial<Record<PlanType, number>> = {
  GROWTH: 5,
  AGENCY: 20,
  ENTERPRISE: 20,
};

export function uploadLimit(plan: PlanType): number {
  return UPLOADS_PER_MONTH[plan] ?? 0;
}

export function canUploadLogs(plan: PlanType): boolean {
  return uploadLimit(plan) > 0;
}
