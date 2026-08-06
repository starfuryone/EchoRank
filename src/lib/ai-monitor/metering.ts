// src/lib/ai-monitor/metering.ts
//
// Per-tenant metering and the monthly USD cap for AI provider spend.
//
// SAME SHAPE AS DataForSEO METERING (src/lib/dataforseo/metering.ts): every
// billed call writes one row, spend is summed from those rows rather than kept
// in a counter, and the cap is checked BEFORE the upstream request. Summing
// rows rather than incrementing a tally is not a style choice — this box
// restarts several times a day and an in-process number would hand every tenant
// a fresh allowance on each deploy.
//
// WHY NOT REDIS, when CLAUDE.md says counters live in Redis? Redis is for
// counters that only ever increment (rate limits, request counts). Spend is an
// aggregate over rows that already have to exist for cost attribution — the
// AiProviderCall rows are written either way, so a parallel Redis tally would
// be a second source of truth that can disagree with the ledger. seo-quota.ts
// makes the same call for the same reason.
//
// A CHECKUP ABORTS AT THE CAP, IT DOES NOT FAIL. Hitting the cap throws
// AiCapReachedError, which the runner turns into status CAPPED with a
// stoppedReason — nothing went wrong, we simply refused to spend more, and the
// dashboard says so rather than showing a red error.

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import {
  AiCapReachedError,
  aiMonthlyCapUsd,
  capState,
  startOfAiBillingMonth,
  type CapState,
} from "./cap";
import {
  type AiProvider,
  type CallPurpose,
  type TokenUsage,
  TOKEN_FREE_PROVIDERS,
  costUsdFor,
  rateEnvName,
  roundUsd,
} from "./pricing";

/** Postgres text columns are unbounded, but an upstream stack trace is noise. */
const MAX_ERROR_CHARS = 500;

// The cap arithmetic is pure and lives in cap.ts so the dashboard and the tests
// can use it without Prisma. Re-exported here so callers have one import.
export {
  AiCapReachedError,
  aiMonthlyCapUsd,
  capState,
  startOfAiBillingMonth,
  type CapState,
} from "./cap";

/** Sum of AI provider spend for a tenant since the start of this month. */
export async function aiSpentThisMonth(
  tenantId: string,
  now: Date = new Date(),
): Promise<number> {
  const agg = await prisma.aiProviderCall.aggregate({
    _sum: { costUsd: true },
    where: { tenantId, createdAt: { gte: startOfAiBillingMonth(now) } },
  });
  return Number(agg._sum.costUsd ?? 0);
}

/** Where a tenant stands against its cap right now. */
export async function checkAiCap(
  tenantId: string,
  plan: PlanType,
  now: Date = new Date(),
): Promise<CapState> {
  return capState(await aiSpentThisMonth(tenantId, now), aiMonthlyCapUsd(plan));
}

export interface AiCallSpec {
  provider: AiProvider;
  model: string;
  purpose: CallPurpose;
  checkupId?: string | null;
}

export interface AiCallRecord extends AiCallSpec {
  tenantId: string;
  usage?: Partial<TokenUsage>;
  /**
   * Cost supplied by the caller, for providers not billed per token — Google
   * AI Overviews carries its DataForSEO cost through here. Ignored for
   * token-billed providers, whose cost is always derived from their usage.
   */
  costUsd?: number;
  ok?: boolean;
  error?: string | null;
}

export interface RecordedAiCall {
  costUsd: number;
  /** False when no rates were configured — the spend is real but uncounted. */
  priced: boolean;
}

function fullUsage(usage: Partial<TokenUsage> | undefined): TokenUsage {
  return {
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    cachedInputTokens: usage?.cachedInputTokens ?? 0,
  };
}

/**
 * Write one AiProviderCall row, deriving its cost from the tokens reported.
 *
 * Every call goes through here, including failures: a provider that errors
 * after generating tokens has still been billed for them, and a row with
 * ok=false and zero tokens is how a failure that cost nothing is distinguished
 * from one that was never attempted.
 */
export async function recordAiCall(row: AiCallRecord): Promise<RecordedAiCall> {
  const usage = fullUsage(row.usage);
  const derived = costUsdFor(row.provider, row.model, usage);

  // Token-billed providers are ALWAYS priced from their own reported usage —
  // a caller-supplied figure is ignored there, so no code path can talk its way
  // past the cap by claiming a call was cheap. Only providers billed some other
  // way (Google AI Overviews, via DataForSEO) supply their own cost.
  const costUsd = TOKEN_FREE_PROVIDERS.has(row.provider)
    ? roundUsd(row.costUsd ?? 0)
    : derived.costUsd;

  if (!derived.priced) {
    logger.error(
      { provider: row.provider, model: row.model, env: rateEnvName(row.provider) },
      "AI call has no configured rates — spend will not count against the monthly cap",
    );
  }

  await prisma.aiProviderCall.create({
    data: {
      tenantId: row.tenantId,
      checkupId: row.checkupId ?? null,
      provider: row.provider,
      model: row.model,
      purpose: row.purpose,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      costUsd,
      ok: row.ok ?? true,
      error: row.error ? row.error.slice(0, MAX_ERROR_CHARS) : null,
    },
  });

  return { costUsd, priced: derived.priced };
}

/** What an adapter hands back: its answer plus what the answer cost. */
export interface AiCallOutcome<T> {
  value: T;
  usage?: Partial<TokenUsage>;
  /** The model the provider actually served, when it differs from the request. */
  model?: string;
  /** For providers not billed per token. */
  costUsd?: number;
}

/**
 * The one entry point for a call that spends money at an AI provider.
 *
 * Checks the cap, runs the call, records the row. Never call an adapter
 * directly from a runner or a route — this is what keeps the cap honest and
 * the ledger complete.
 *
 * The cap is checked before the request rather than after, so a tenant can
 * overshoot by at most the single call in flight. Checking after would let a
 * fan-out of parallel calls all pass a stale reading; checking before bounds
 * the overshoot to one call per concurrent worker, which at these prices is
 * cents.
 */
export async function meteredAiCall<T>(
  ctx: { tenantId: string; plan: PlanType },
  spec: AiCallSpec,
  fn: () => Promise<AiCallOutcome<T>>,
  now: Date = new Date(),
): Promise<T> {
  const state = await checkAiCap(ctx.tenantId, ctx.plan, now);
  if (state.capped) {
    throw new AiCapReachedError(state.spent, state.cap ?? 0);
  }

  try {
    const outcome = await fn();
    await recordAiCall({
      ...spec,
      tenantId: ctx.tenantId,
      model: outcome.model ?? spec.model,
      usage: outcome.usage,
      costUsd: outcome.costUsd,
      ok: true,
    });
    return outcome.value;
  } catch (err) {
    await recordAiCall({
      ...spec,
      tenantId: ctx.tenantId,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
