/**
 * src/lib/dataforseo/metering.ts
 *
 * Tenant metering for DataForSEO spend. Every billed task writes one
 * SeoApiCall row; the monthly USD cap is enforced in meteredCall BEFORE the
 * upstream fetch. Bill from the response `cost` — never from a price table.
 *
 * ASSUMPTION (verify on repo): Prisma client exports from "@/generated/prisma"
 * and a shared instance exists at "@/lib/db" (adjust the import if the repo
 * uses "@/lib/prisma" or similar — grep for `new PrismaClient`).
 */

import { prisma } from "@/lib/prisma";
import {
  meteredCall,
  type CreditFeature,
  DataforseoError,
} from "./client";

/** Conservative default; override per tenant via SeoBudget row or env. */
const DEFAULT_MONTHLY_CAP_USD = Number(
  process.env.SEO_MONTHLY_CAP_USD_DEFAULT ?? "25",
);

export function startOfBillingMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Sum of billed USD for a tenant since the start of the current month. */
export async function spentThisMonth(tenantId: string): Promise<number> {
  const agg = await prisma.seoApiCall.aggregate({
    _sum: { costUsd: true },
    where: { tenantId, createdAt: { gte: startOfBillingMonth() } },
  });
  return Number(agg._sum.costUsd ?? 0);
}

export async function recordCall(row: {
  tenantId: string;
  feature: CreditFeature;
  path: string;
  costUsd: number;
  ok: boolean;
}): Promise<void> {
  await prisma.seoApiCall.create({ data: row });
}

/**
 * Per-tenant cap. Phase 0 keeps this env-driven; a per-tenant override
 * column/model can come later without changing call sites.
 */
export async function monthlyCapUsd(_tenantId: string): Promise<number> {
  return DEFAULT_MONTHLY_CAP_USD;
}

/**
 * The one entry point route handlers use. Wraps client.meteredCall with the
 * Prisma deps. Never call postTask from a route handler — this enforces the
 * cap and writes the SeoApiCall row.
 *
 * Exception (per spec): v3/appendix/user_data and serp task_get are free at
 * DataForSEO — call postTask directly for those, do not meter.
 */
export async function seoMeteredCall<T>(
  tenantId: string,
  path: string,
  task: Record<string, unknown>,
): Promise<T> {
  const cap = await monthlyCapUsd(tenantId);
  return meteredCall<T>({ tenantId, monthlyCapUsd: cap }, path, task, {
    spentThisMonth,
    record: recordCall,
  });
}

/** Typed error body helper for routes. */
export function seoErrorResponse(err: unknown): {
  status: number;
  body: { error: string; code: string };
} {
  if (err instanceof DataforseoError) {
    switch (err.code) {
      case "AUTH_FAILED":
        // Missing creds — the NOT_CONFIGURED contract from the agent spec.
        return {
          status: 503,
          body: { error: "SEO data provider not configured", code: "NOT_CONFIGURED" },
        };
      case "RATE_LIMITED":
        return { status: 429, body: { error: err.message, code: "BUDGET_OR_RATE_LIMIT" } };
      case "INVALID_FIELD":
        return { status: 400, body: { error: err.message, code: "INVALID_REQUEST" } };
      case "UPSTREAM_UNAVAILABLE":
        return { status: 502, body: { error: "SEO data provider unavailable", code: "UPSTREAM_UNAVAILABLE" } };
      default:
        return { status: 502, body: { error: err.message, code: "TASK_FAILED" } };
    }
  }
  return { status: 500, body: { error: "Internal error", code: "INTERNAL" } };
}
