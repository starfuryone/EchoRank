// src/lib/free-tools/spend.ts
//
// The daily USD ceiling for everything anonymous.
//
// WHY A SENTINEL TENANT AND NOT NULL. The brief offered either; SeoApiCall.
// tenantId is NOT NULL in the schema, so "null" would have meant a migration to
// make a required column optional — a change that would weaken the constraint
// for every paid row in the table to describe a handful of free ones. A
// sentinel id costs nothing and keeps the column honest. It is deliberately not
// a real Tenant row: SeoApiCall has no FK to Tenant, and creating a fake
// workspace would put it in tenant listings, quota sweeps and billing queries.
//
// COUNTED IN POSTGRES, like every other spend figure here. The rows already
// exist; summing them cannot drift from what was actually billed, and it
// survives the restarts an in-process tally would not.

import { prisma } from "@/lib/prisma";

/**
 * The owner recorded on every free-tools API call.
 *
 * Not a Tenant row — see the header. Anything aggregating real tenants must
 * exclude it; the constant is exported so those queries can name it rather
 * than hardcode the string.
 */
export const FREE_TOOLS_TENANT_ID = "free-tools";

/** Default matches the brief. Override per environment. */
const DEFAULT_DAILY_CAP_USD = 2.0;

export function dailyCapUsd(): number {
  const raw = Number(process.env.FREE_TOOLS_DAILY_USD_CAP);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_DAILY_CAP_USD;
}

function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** USD billed to the free namespace since UTC midnight. */
export async function spentTodayUsd(now: Date = new Date()): Promise<number> {
  const agg = await prisma.seoApiCall.aggregate({
    _sum: { costUsd: true },
    where: { tenantId: FREE_TOOLS_TENANT_ID, createdAt: { gte: startOfUtcDay(now) } },
  });
  return Number(agg._sum.costUsd ?? 0);
}

export interface CapState {
  capped: boolean;
  spent: number;
  cap: number;
}

/**
 * Whether the free namespace may spend right now.
 *
 * Checked BEFORE the upstream call, not after: the point is to avoid the spend,
 * not to notice it. A cap of 0 disables every paid free tool, which is the
 * intended kill switch.
 */
export async function checkDailyCap(now: Date = new Date()): Promise<CapState> {
  const cap = dailyCapUsd();
  const spent = await spentTodayUsd(now);
  return { capped: spent >= cap, spent, cap };
}

// NOTE: there is deliberately no recordFreeCall() here. Every paid free-tools
// call goes through seoMeteredCallResult(FREE_TOOLS_TENANT_ID, ...), which
// writes the SeoApiCall row itself. A second recorder would have been a second
// way to get the ledger wrong.
