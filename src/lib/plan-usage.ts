// src/lib/plan-usage.ts — the "Your plan" hub's server loader (PLAN-HUB
// Part 2): usage counts for the limits getPlanResources() returns, and the
// billing facts for the plan & billing card.
//
// EVERY COUNT COMES FROM THE HELPER THE TOOL ITSELF ENFORCES WITH — no new
// table, no migration, no second way of counting. A helper that fails leaves
// that meter at "limit only" rather than failing the page.
import "server-only";
import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { seoSearchesUsed } from "@/lib/seo-quota";
import { trackedKeywordCount } from "@/lib/rank-tracker/quota";
import { pageAllowance } from "@/lib/site-crawler/page-allowance";
import { linkAuthorityUsage } from "@/lib/authority-checker/quota";
import { analysesUsedThisMonth } from "@/lib/keyword-opportunity/store";
import { buildMarketingUsage } from "@/lib/marketing/service";
import { feedbackRequestsThisMonth } from "@/lib/feedback-limit";
import { apiRequestsToday } from "@/lib/api-daily-quota";
import { chargeForPrice, type SubscriptionCharge } from "@/lib/billing/subscription-charge";
import type { LimitKey, PlanLimit } from "@/lib/plan-resources";

export interface MeterUsage {
  used: number | null;
  /** A per-tenant figure that overrides the plan's (staff override, contract). */
  limitOverride?: number | null;
}

const COUNTERS: Partial<Record<LimitKey, (tenantId: string, plan: PlanType) => Promise<MeterUsage>>> = {
  seo_searches: async (t) => ({ used: await seoSearchesUsed(t) }),
  tracked_keywords: async (t) => ({ used: await trackedKeywordCount(t) }),
  crawl_pages: async (t, p) => {
    const a = await pageAllowance(t, p);
    return { used: a.used, limitOverride: a.limit };
  },
  link_authority: async (t, p) => {
    const u = await linkAuthorityUsage(t, p);
    return { used: u.used, limitOverride: u.limit };
  },
  kof_analyses: async (t) => ({ used: await analysesUsedThisMonth(t) }),
  marketing_tokens: async (t, p) => ({ used: (await buildMarketingUsage(t, p)).used }),
  feedback_requests: async (t) => ({ used: await feedbackRequestsThisMonth(t) }),
  api_requests: async (t) => ({ used: await apiRequestsToday(t) }),
};

/** Usage for every counted limit; a failed helper is { used: null }. */
export async function loadPlanUsage(tenantId: string, plan: PlanType, limits: PlanLimit[]): Promise<Partial<Record<LimitKey, MeterUsage>>> {
  const out: Partial<Record<LimitKey, MeterUsage>> = {};
  await Promise.all(
    limits
      .filter((l) => l.counted && COUNTERS[l.key])
      .map(async (l) => {
        out[l.key] = await COUNTERS[l.key]!(tenantId, plan).catch(() => ({ used: null }));
      }),
  );
  return out;
}

// ── Billing ─────────────────────────────────────────────────────────────────

const CHARGE_TTL_MS = 5 * 60_000;
const chargeCache = new Map<string, { at: number; charge: SubscriptionCharge | null }>();

/**
 * What THIS subscription is charged, from its own Stripe price (a
 * grandfathered subscriber keeps an old price; PLAN_CONFIGS shows the one on
 * sale). Cached five minutes per price in process: it is a read cache, not a
 * counter. Null when Stripe cannot say: the card then shows the date alone.
 */
export async function subscriptionCharge(priceId: string | null | undefined, now = Date.now()): Promise<SubscriptionCharge | null> {
  if (!priceId) return null;
  const hit = chargeCache.get(priceId);
  if (hit && now - hit.at < CHARGE_TTL_MS) return hit.charge;
  const answer = await chargeForPrice(priceId).catch(() => ({ kind: "unknown" as const }));
  const charge = answer.kind === "charge" ? answer.charge : null;
  chargeCache.set(priceId, { at: now, charge });
  return charge;
}

/** For tests. */
export function clearChargeCache(): void {
  chargeCache.clear();
}

export interface PlanBilling {
  /** The PLAN Subscription row's status, else the tenant column. */
  status: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  charge: SubscriptionCharge | null;
  hasPortal: boolean;
  /** A PLAN row with a Stripe subscription id: something cancel can act on. */
  hasSubscription: boolean;
}

export async function loadPlanBilling(tenantId: string, stripeCustomerId: string | null, tenantStatus: string | null): Promise<PlanBilling> {
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { productKind: true, status: true, cancelAtPeriodEnd: true, currentPeriodEnd: true, stripePriceId: true, stripeSubscriptionId: true },
  });
  const row = sub?.productKind === "PLAN" ? sub : null;
  return {
    status: row?.status ?? tenantStatus,
    cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: row?.currentPeriodEnd?.toISOString() ?? null,
    charge: row ? await subscriptionCharge(row.stripePriceId) : null,
    hasPortal: Boolean(stripeCustomerId),
    hasSubscription: Boolean(row?.stripeSubscriptionId),
  };
}
