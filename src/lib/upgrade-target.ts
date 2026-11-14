// src/lib/upgrade-target.ts — which plan a locked thing is "included in".
//
// THE RULE (owner, 2026-11-14): the CHEAPEST plan that includes the tool AND
// everything the tenant's current plan includes — every area it opens
// (src/lib/plan-access.ts) and every feature it has (src/lib/feature-flags.ts).
// So the plan named is always an upgrade, never a sideways move: an AI
// Visibility tenant looking at the crawler is sent to Starter, not to the
// crawler-only plan, which would take its AI visibility away.
//
// COMPUTED, NEVER TYPED. Plans are ordered by PLAN_CONFIGS price (custom-
// priced last); the tool's needs come from the same area and feature gates its
// route enforces (PAGE_GATES below, pinned to the routes by
// tests/upgrade-target.test.ts). Limits are NOT counted: a plan "includes" a
// tool when its gates open, whatever its allowance. Counting the crawler's
// limits would send a crawler-only tenant to Agency for anything at all (that
// plan has Agency's crawl limits); that is a pricing question, left to the owner.
//
// ROLLOUTS ARE NOT PLANS. A page behind a build-progress switch (AI Search
// Intelligence, the Keyword Opportunity Finder's live data, the assistant) is
// HIDDEN for a tenant outside the rollout, never shown locked: no plan
// unlocks it.
//
// Dependency-free apart from the configs, like plan-access.ts: the proxy, the
// (dashboard) layout, the tool hubs and the plan hub all read it.

import type { PlanType } from "@/generated/prisma";
import { getFeaturesForPlan, hasFeature, type Feature } from "@/lib/feature-flags";
import {
  ALL_AREAS,
  PLAN_UPGRADE_REQUIRED,
  areaForPage,
  planAllowsArea,
  planIsRestricted,
  type AccessArea,
} from "@/lib/plan-access";
import { PLAN_CONFIGS } from "@/lib/plan-config";

/** Every plan, cheapest first by PLAN_CONFIGS; custom-priced (Enterprise) last. */
export const PLANS_BY_PRICE: readonly PlanType[] = (Object.keys(PLAN_CONFIGS) as PlanType[])
  .map((plan, i) => ({ plan, i, price: PLAN_CONFIGS[plan].isCustomPricing ? Infinity : PLAN_CONFIGS[plan].monthlyPrice }))
  .sort((a, b) => a.price - b.price || a.i - b.i)
  .map((x) => x.plan);

export interface Need {
  /** The page's area; null for an unclassified page (open to unrestricted plans only). */
  area?: AccessArea | null;
  features?: readonly Feature[];
}

/** Does `plan` include everything `need` asks for? */
export function planMeets(plan: PlanType, need: Need): boolean {
  if (need.area === null && planIsRestricted(plan)) return false;
  if (need.area && !planAllowsArea(plan, need.area)) return false;
  return (need.features ?? []).every((f) => hasFeature(plan, f));
}

/** Does `candidate` include every area and feature `current` has? */
function keepsEverything(candidate: PlanType, current: PlanType): boolean {
  return (
    ALL_AREAS.every((a) => !planAllowsArea(current, a) || planAllowsArea(candidate, a)) &&
    getFeaturesForPlan(current).every((f) => hasFeature(candidate, f))
  );
}

/**
 * The plan to name on something `current` does not include: the cheapest that
 * meets `need` and keeps everything `current` has. Null when `current` already
 * meets it, or when no plan does.
 */
export function upgradeTarget(current: PlanType | null | undefined, need: Need): PlanType | null {
  if (current && planMeets(current, need)) return null;
  for (const plan of PLANS_BY_PRICE) {
    if (plan === current) continue;
    if (!planMeets(plan, need)) continue;
    if (current && !keepsEverything(plan, current)) continue;
    return plan;
  }
  return null;
}

/** The plan's display name (the crawler-only plan's from its brand config). */
export function planName(plan: PlanType): string {
  return PLAN_CONFIGS[plan].name;
}

// ── Page gates ──────────────────────────────────────────────────────────────

/** Build-progress switches, read per tenant at render time. */
export type Rollout = "ai_search" | "kof" | "assistant";
export type RolloutState = Record<Rollout, boolean>;

interface PageGate {
  prefix: string;
  /** Features the page (or the API it is built on) requires. */
  features?: readonly Feature[];
  /** The switch that HIDES the page's purpose when off for this tenant. */
  rollout?: Rollout;
}

/**
 * What a page needs beyond its area, most specific first. Each entry mirrors a
 * hasFeature()/requireFeature() or rollout check its route already makes;
 * tests/upgrade-target.test.ts reads those routes and fails on a mismatch.
 */
export const PAGE_GATES: readonly PageGate[] = [
  { prefix: "/visibility/tools/action-agent", features: ["marketing_studio"] },
  { prefix: "/visibility/tools/ai-content-helper", features: ["marketing_studio"] },
  { prefix: "/visibility/tools/citation-finder", features: ["citation_tracking"] },
  { prefix: "/visibility/tools/citation-opportunities", features: ["citation_tracking"] },
  { prefix: "/visibility/tools/share-of-voice", features: ["advanced_analytics"] },
  { prefix: "/visibility/tools/funnels", features: ["whitelabel"] },
  { prefix: "/visibility/tools/opportunity-scanner", features: ["whitelabel"] },
  { prefix: "/visibility/tools/api-access", features: ["api_access"] },
  { prefix: "/visibility/tools/mcp-server", features: ["api_access"] },
  { prefix: "/visibility/tools/keyword-opportunities", rollout: "kof" },
  { prefix: "/visibility/ai-search", rollout: "ai_search" },
  { prefix: "/intelligence", features: ["ai_analysis"] },
  { prefix: "/monitoring", features: ["reputation_monitoring"] },
  { prefix: "/assistant", rollout: "assistant" },
];

function gateFor(path: string): PageGate | undefined {
  const clean = path.split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";
  return PAGE_GATES.find((g) => clean === g.prefix || clean.startsWith(`${g.prefix}/`));
}

/** Everything a (dashboard) page needs: its area and its features. */
export function pageNeed(path: string): Need {
  return { area: areaForPage(path), features: gateFor(path)?.features ?? [] };
}

/** The rollout a page sits behind, if any. */
export function pageRollout(path: string): Rollout | null {
  return gateFor(path)?.rollout ?? null;
}

export type PageState =
  | { state: "open" }
  | { state: "locked"; upgradeTo: PlanType | null }
  | { state: "hidden" };

/**
 * How a link to `path` renders for `plan`: open, locked (naming the plan that
 * includes it), or hidden (a rollout this tenant is not in). Pass `rollouts`
 * wherever links are drawn; without it no page is hidden.
 */
export function pageState(
  plan: PlanType | null | undefined,
  path: string,
  rollouts?: Partial<RolloutState>,
): PageState {
  const rollout = pageRollout(path);
  if (rollout && rollouts && !rollouts[rollout]) return { state: "hidden" };
  const need = pageNeed(path);
  if (plan && planMeets(plan, need)) return { state: "open" };
  return { state: "locked", upgradeTo: upgradeTarget(plan, need) };
}

/** The plan to name on a page `plan` cannot open. */
export function upgradeTargetForPage(plan: PlanType | null | undefined, path: string): PlanType | null {
  return upgradeTarget(plan, pageNeed(path));
}

/**
 * The 403 body for an API call the plan's area does not include (the proxy,
 * the extension import). The plan named follows the rule above.
 */
export function planUpgradeBody(area: AccessArea | null, plan: PlanType | null | undefined) {
  const target = upgradeTarget(plan, { area });
  return {
    error: target ? `Your plan does not include this. Available from ${planName(target)}.` : "Your plan does not include this.",
    code: PLAN_UPGRADE_REQUIRED,
    area,
    upgradeTo: target,
  };
}
