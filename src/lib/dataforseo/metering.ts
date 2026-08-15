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
  meteredCallResult,
  type ApiResult,
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

/**
 * Sum of PLAN-FUNDED billed USD for a tenant since the start of the month.
 *
 * CREDIT-FUNDED ROWS ARE EXCLUDED, and that exclusion is what the monthly cap
 * means. The cap protects our spend on usage a plan includes; a credit-funded
 * call was paid for in advance by the tenant, so counting it here would let a
 * customer's own prepaid purchase exhaust the allowance they get for free — buy
 * more lookups, get less of everything else. The rows are still written (see
 * SeoApiCall.creditFunded), so total upstream cost remains fully accounted for;
 * this aggregate is deliberately narrower than "everything we were charged".
 */
export async function spentThisMonth(tenantId: string): Promise<number> {
  const agg = await prisma.seoApiCall.aggregate({
    _sum: { costUsd: true },
    where: { tenantId, creditFunded: false, createdAt: { gte: startOfBillingMonth() } },
  });
  return Number(agg._sum.costUsd ?? 0);
}

export async function recordCall(row: {
  tenantId: string;
  feature: CreditFeature;
  path: string;
  costUsd: number;
  ok: boolean;
  /**
   * DataForSEO's task uuid, for standard-queue (task_post) calls. Supplying it
   * marks the row as awaiting a result: `resultAt` stays null until the poller
   * stamps it, so the call bills against the USD cap immediately but does not
   * consume a search until the tenant has something to look at.
   */
  dataforseoTaskId?: string | null;
  /**
   * Paid for by a prepaid credit rather than plan-included usage. Excluded from
   * spentThisMonth() and therefore from the cap, but still recorded — see
   * SeoApiCall.creditFunded.
   */
  creditFunded?: boolean;
}): Promise<void> {
  const { dataforseoTaskId = null, ...rest } = row;
  await prisma.seoApiCall.create({
    data: {
      ...rest,
      dataforseoTaskId,
      // Live endpoints return their result in the same call, so success is
      // known now. Standard-queue rows wait for markSeoCallResult().
      resultAt: dataforseoTaskId === null && row.ok ? new Date() : null,
    },
  });
}

/**
 * Stamp a standard-queue row as having produced a usable result.
 *
 * Called by the poller once task_get returns content. Idempotent by the
 * `resultAt: null` filter — a task collected twice (a duplicate id in one
 * tasks_ready page, or a retry across ticks) updates zero rows the second time,
 * so a tenant can never be charged two searches for one keyword.
 */
export async function markSeoCallResult(
  dataforseoTaskId: string,
  at = new Date(),
): Promise<number> {
  const { count } = await prisma.seoApiCall.updateMany({
    where: { dataforseoTaskId, resultAt: null },
    data: { resultAt: at },
  });
  return count;
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

/**
 * seoMeteredCall that keeps the envelope. Async-queue task_post callers need
 * the DataForSEO task id and the billed cost to persist alongside their row.
 */
export async function seoMeteredCallResult<T>(
  tenantId: string,
  path: string,
  task: Record<string, unknown>,
): Promise<ApiResult<T>> {
  const cap = await monthlyCapUsd(tenantId);
  return meteredCallResult<T>({ tenantId, monthlyCapUsd: cap }, path, task, {
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
