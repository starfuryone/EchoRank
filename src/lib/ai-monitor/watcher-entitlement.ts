// src/lib/ai-monitor/watcher-entitlement.ts
//
// The standalone Watcher: what a subscription to it is, and what shape a
// checkup takes when a tenant has one.
//
// PURE. No Prisma, no env. Both answers are decisions over values the caller
// already holds, and both are needed in places that must not drag a database —
// the Stripe webhook decides what it is writing, the runner and the wizard
// decide what to run.
//
// A WATCHER SUBSCRIPTION IS NOT A PAID PLAN. That is the whole reason this
// module exists rather than a boolean somewhere. Subscription.tenantId is
// unique, so a watcher purchase occupies the ONE subscription row a tenant
// gets; the webhook resolves a PlanType from the price and falls back to the
// tenant's existing planType when it cannot. A watcher purchase would therefore
// have written an ACTIVE row carrying whatever tier the tenant defaulted to,
// and requirePaidPlan — which asks only "ACTIVE, with a row?" — would have
// waved it through to every paid tool in the product. One discriminator, used
// by the webhook when it writes and by the paid gate when it reads.

import {
  WATCHER_LOOKUP_KEYS,
  WATCHER_SOLO,
  WATCHER_SOLO_BRANDS,
  WATCHER_SOLO_CAP_USD,
  planConfig,
  type AiCheckupShape,
  type CheckupFrequency,
} from "@/lib/plan-config";
import type { PlanType } from "@/generated/prisma";

/** What a subscription is for. */
export type ProductKind = "PLAN" | "WATCHER";

const WATCHER_KEYS: ReadonlySet<string> = new Set<string>([
  WATCHER_LOOKUP_KEYS.monthly,
  WATCHER_LOOKUP_KEYS.annual,
]);

export function isWatcherLookupKey(lookupKey: string | null | undefined): boolean {
  return WATCHER_KEYS.has((lookupKey ?? "").trim());
}

/**
 * What kind of subscription a Stripe lookup key represents.
 *
 * Defaults to PLAN for anything unrecognised, deliberately. An unknown key is
 * far more likely to be a new tier than a new watcher, and the failure modes
 * are not symmetric: calling a plan a watcher would strip a paying customer of
 * the tools they bought, while the reverse is caught by the tier's own feature
 * gates. Getting a genuinely new watcher SKU wrong here means adding it to
 * WATCHER_LOOKUP_KEYS, which is where it belongs.
 */
export function productKindFor(lookupKey: string | null | undefined): ProductKind {
  return isWatcherLookupKey(lookupKey) ? "WATCHER" : "PLAN";
}

/** Just enough of a subscription row to answer both questions. */
export interface SubscriptionFacts {
  productKind: ProductKind;
  /** Whether the subscription is in a state that grants anything. */
  active: boolean;
}

/**
 * Does this tenant have a live standalone watcher entitlement?
 *
 * Separate from "is on a tier that includes the watcher" — that is a feature
 * flag on the tier, and ../rollout.ts plus the tier's own ai_visibility feature
 * answer it.
 */
export function hasWatcherEntitlement(subscription: SubscriptionFacts | null): boolean {
  return subscription?.productKind === "WATCHER" && subscription.active;
}

export interface WatcherShapeInput {
  /** The tenant's tier. */
  plan: PlanType;
  /**
   * Is the tenant actually PAYING for its tier?
   *
   * NOT "does tenant.planType name a tier that schedules". planType is an enum
   * column with a default, so an unpaid tenant carries one regardless — and a
   * live run proved the cost: a watcher-only tenant whose hasPaidPlan was false
   * throughout still took STARTER's contribution to the composite, because the
   * predicate read the column rather than the payment. That is the same class
   * of bug as the requirePaidPlan hole this module was written to close: an
   * unpaid enum value leaking value.
   *
   * The caller computes this from billing status (see resolveShapeForTenant),
   * because deciding it needs the Subscription row AND the tenant's own
   * billingStatus fallback for tenants that predate Stripe.
   */
  planIsPaid: boolean;
  /** The tenant's subscription, when it has one. */
  subscription: SubscriptionFacts | null;
}

export interface ResolvedWatcherShape {
  shape: AiCheckupShape;
  /** Per-period USD ceiling. Null = uncapped. */
  capUsd: number | null;
  /** Brands the tenant may track. Null = unlimited. */
  maxBrands: number | null;
  /** Where the shape came from, for logs and for the dashboard's plan line. */
  source: "plan" | "watcher_solo" | "both" | "none";
}

/**
 * How often each cadence actually runs, for comparison.
 *
 * `custom` is ENTERPRISE, whose cadence is a contract term; ../schedule.ts
 * resolves it to weekly until one is set, so it ranks there rather than at the
 * top — treating an unset contract as "daily" would multiply spend on the
 * strength of a blank field.
 */
const FREQUENCY_RANK: Readonly<Record<CheckupFrequency, number>> = {
  none: 0,
  custom: 1,
  weekly: 1,
  twice_weekly: 2,
  daily: 3,
};

/**
 * The more frequent of two cadences; ties keep the first.
 *
 * EXPORTED FOR ITS OWN TEST because the composite path cannot exercise it: solo
 * runs weekly and no current tier is less frequent than that, so the resolver
 * always returns the tier's cadence whether it maxes or not. A mutation run
 * showed replacing the max with `config.aiCheckup.frequency` changing nothing.
 * The rule is verified directly instead; the day a tier ships with `none` or a
 * fortnightly cadence, the resolver-level branch becomes observable too.
 */
export function maxFrequency(a: CheckupFrequency, b: CheckupFrequency): CheckupFrequency {
  return FREQUENCY_RANK[b] > FREQUENCY_RANK[a] ? b : a;
}

/**
 * The larger of two allowances where NULL MEANS UNLIMITED.
 *
 * providers, aiProjects and the USD cap all use null for "no ceiling", so null
 * is the maximum rather than the minimum. Reading it as zero is the bug this
 * exists to prevent: it would silently cap an ENTERPRISE tenant at whatever the
 * $9 add-on allows.
 */
function maxUnlimited(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return Math.max(a, b);
}

/**
 * THE ONE PLACE a checkup's shape is decided.
 *
 * Runner, limits and wizard call this instead of reading
 * planConfig(plan).aiCheckup, so a tenant holding a standalone watcher gets the
 * solo shape everywhere rather than in whichever call site remembered to check.
 *
 * PLAN WINS WHEN BOTH APPLY. Any tier that includes the watcher is at least as
 * generous as the solo shape, so preferring the plan can only ever give a
 * customer more than they would otherwise have had — and the alternative, a
 * paying GROWTH tenant silently dropped to one engine and ten prompts because
 * they also bought a $9 add-on, is the kind of downgrade nobody reports as a
 * bug because it looks like the product working.
 */
export function resolveWatcherShape(input: WatcherShapeInput): ResolvedWatcherShape {
  const config = planConfig(input.plan);
  const entitled = hasWatcherEntitlement(input.subscription);
  // A tier contributes only when it is BOTH paid for and actually schedules.
  const planContributes = input.planIsPaid && planSchedulesCheckups(input.plan);

  if (planContributes && entitled) {
    // FIELD-WISE MAX, not "plan wins". The premise that any plan shape is at
    // least as generous as solo does not hold: STARTER runs one repetition
    // where solo runs three, so preferring the plan would hand a customer who
    // paid for the add-on FEWER repetitions than the SKU promised.
    //
    // THE COMPOSITE CAN MODEL A COST NEITHER SKU INDIVIDUALLY PROMISED — a
    // plan's engine count multiplied by solo's repetitions is a checkup bigger
    // than either was priced for. That is accepted for two reasons and would
    // not be otherwise: the checkout guard refuses a watcher purchase to a
    // tenant on a plan, so this state is reachable only by an administrative
    // grant, and the USD cap — itself the max of the two — still bounds what
    // the composite can spend before the runner starts skipping runs.
    return {
      shape: {
        frequency: maxFrequency(config.aiCheckup.frequency, WATCHER_SOLO.frequency),
        // PROVIDERS IS THE ONE EXCEPTION TO THE MAX. A watcher entitlement may
        // never RAISE the engine count above what the plan itself sells — the
        // $9 SKU buys one engine, and letting it lift a tier's ceiling would
        // hand a tenant more engines than either product was priced for the
        // moment a second adapter ships. The plan's own number stands, and the
        // watcher's contribution is pinned at solo's 1.
        providers: config.aiCheckup.providers,
        prompts: Math.max(config.aiCheckup.prompts, WATCHER_SOLO.prompts),
        repetitions: Math.max(config.aiCheckup.repetitions, WATCHER_SOLO.repetitions),
      },
      capUsd: maxUnlimited(config.aiMonthlyCapUsd, WATCHER_SOLO_CAP_USD),
      maxBrands: maxUnlimited(config.aiProjects, WATCHER_SOLO_BRANDS),
      source: "both",
    };
  }

  if (planContributes) {
    return {
      shape: config.aiCheckup,
      capUsd: config.aiMonthlyCapUsd,
      maxBrands: config.aiProjects,
      source: "plan",
    };
  }
  if (entitled) {
    return {
      shape: WATCHER_SOLO,
      capUsd: WATCHER_SOLO_CAP_USD,
      maxBrands: WATCHER_SOLO_BRANDS,
      source: "watcher_solo",
    };
  }
  // Nothing grants a watcher. The shape is the tier's, which for a tier without
  // the feature is a zero-prompt shape that schedules nothing — returning it
  // rather than throwing keeps the caller's arithmetic total.
  return {
    shape: config.aiCheckup,
    capUsd: config.aiMonthlyCapUsd,
    maxBrands: config.aiProjects,
    source: "none",
  };
}

/**
 * May this tenant start a standalone watcher checkout?
 *
 * NO IF THEY ALREADY HAVE A PLAN SUBSCRIPTION. Subscription.tenantId is unique,
 * so a watcher purchase would overwrite the plan row — and even if it did not,
 * a tier that includes the watcher already grants a shape at least as generous,
 * so the $9 buys nothing. Enforced on the SERVER because hiding the button
 * leaves the endpoint open, and the failure is a customer paying twice for one
 * capability.
 */
export function watcherCheckoutBlock(
  subscription: SubscriptionFacts | null,
): { blocked: boolean; reason: string | null } {
  if (subscription?.productKind === "PLAN" && subscription.active) {
    return {
      blocked: true,
      reason:
        "Your plan already includes AI Search monitoring, so there is nothing to add. " +
        "Manage it from your dashboard.",
    };
  }
  return { blocked: false, reason: null };
}

/**
 * Does this tier schedule checkups of its own?
 *
 * The honest form of "does the plan include a watcher". The ai_visibility
 * feature flag cannot answer it — that is baseline from STARTER up — so the
 * question is whether the tier's own shape asks anything: a cadence and at
 * least one prompt.
 */
export function planSchedulesCheckups(plan: PlanType): boolean {
  const shape = planConfig(plan).aiCheckup;
  return shape.frequency !== "none" && shape.prompts > 0;
}
