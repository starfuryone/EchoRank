// /welcome's wait for the Stripe webhook (PLAN-HUB Part 1), as pure functions
// so the timing is testable without a browser: poll GET /api/billing/status
// every 2 s for up to ~60 s, and stop as soon as the tenant shows the bought
// plan, paid.

export interface BillingStatusBody {
  planType: string | null;
  billingStatus: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export const HANDOFF_POLL_MS = 2_000;
/** 30 × 2 s ≈ 60 s. */
export const HANDOFF_MAX_ATTEMPTS = 30;

/**
 * Has the webhook landed for this plan? ACTIVE, or TRIALING with a trial end
 * (a Stripe trial row; the tenant column's legacy TRIALING default has none).
 */
export function handoffReady(body: BillingStatusBody | null, plan: string): boolean {
  if (!body || body.planType !== plan) return false;
  if (body.billingStatus === "ACTIVE") return true;
  return body.billingStatus === "TRIALING" && Boolean(body.trialEnd);
}

/**
 * Poll until ready or out of attempts. A failed fetch counts as one attempt
 * and does not end the wait: a blip should not strand someone who just paid.
 */
export async function pollUntilReady(opts: {
  plan: string;
  fetchStatus: () => Promise<BillingStatusBody | null>;
  sleep: (ms: number) => Promise<void>;
  isCancelled?: () => boolean;
  intervalMs?: number;
  maxAttempts?: number;
}): Promise<"ready" | "timeout" | "cancelled"> {
  const interval = opts.intervalMs ?? HANDOFF_POLL_MS;
  const max = opts.maxAttempts ?? HANDOFF_MAX_ATTEMPTS;
  for (let attempt = 0; attempt < max; attempt++) {
    if (opts.isCancelled?.()) return "cancelled";
    const body = await opts.fetchStatus().catch(() => null);
    if (handoffReady(body, opts.plan)) return "ready";
    if (attempt < max - 1) await opts.sleep(interval);
  }
  return "timeout";
}
