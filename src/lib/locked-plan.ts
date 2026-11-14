// src/lib/locked-plan.ts — the plan an in-tool locked message names.
//
// Every "X is on <plan>", "Upgrade to <plan>", "Daily checks are available on
// <plan>" inside a tool reads its plan name here, never from a literal string
// (2026-11-14). Each lock is the Need its route enforces: the area, the
// feature, and, where the lock IS a limit (an allowance of 0, daily checks,
// any-URL analysis), the plan-config predicate the route uses. The plan named
// is src/lib/upgrade-target.ts's rule: the cheapest plan that clears the lock
// and keeps everything the tenant already has.
//
// tests/locked-plan.test.ts pins each lock to its route's own check and each
// message to this helper.
//
// Dependency-free like upgrade-target.ts: client components read it through
// useLockedPlanName (src/components/plan/plan-context.tsx).

import type { PlanType } from "@/generated/prisma";
import { planCanUseAiCitations } from "@/lib/ai-citations/plans";
import { CROSS_DOMAIN_PLANS } from "@/lib/ai-lens/options";
import { backlinksCapability, planCanAnalyzeBacklinks } from "@/lib/backlinks/options";
import { canUploadLogs } from "@/lib/bot-analytics/limits";
import { planCanSearchContent } from "@/lib/content-explorer/options";
import type { Feature } from "@/lib/feature-flags";
import { areaForApi, areaForPage } from "@/lib/plan-access";
import { planAllowsFrequency, planCanTrack } from "@/lib/rank-tracker/options";
import { PLANS_BY_PRICE, pageNeed, planMeets, planName, upgradeTarget, type Need } from "@/lib/upgrade-target";
import { benchmarkDailyLimit, monitorDailyAllowed } from "@/lib/visibility-limits";

type Limit = (plan: PlanType) => boolean;

/** A tool page's gates (area + PAGE_GATES features), plus a limit. */
const page = (path: string, limit?: Limit): Need => ({ ...pageNeed(path), ...(limit ? { limit } : {}) });
/** An API route's gates: the proxy's area and the route's requireFeature(). */
const api = (path: string, features: readonly Feature[], limit?: Limit): Need => ({
  area: areaForApi(path),
  features,
  ...(limit ? { limit } : {}),
});

export const LOCKS = {
  // ── Feature gates ──────────────────────────────────────────────────────────
  /** /imports → /api/imports: requireFeature("ai_analysis"). */
  csv_import: api("/api/imports", ["ai_analysis"]),
  /** /settings, white-label and custom domain. */
  whitelabel: { area: areaForPage("/settings"), features: ["whitelabel", "custom_domain"] },
  /** MonitorCard → /api/ai/visibility/monitor: requireFeature("ai_visibility"). */
  visibility_monitor: api("/api/ai/visibility/monitor", ["ai_visibility"]),
  /** BenchmarkCard → /api/ai/visibility/benchmark. */
  benchmark: api("/api/ai/visibility/benchmark", ["ai_visibility"]),
  /** AnswerTrackingCard → /api/ai/visibility/prompts: requireFeature("answer_tracking"). */
  answer_tracking: api("/api/ai/visibility/prompts", ["answer_tracking"]),
  /** /visibility attribution → /api/ai/visibility/attribute. */
  roi_attribution: api("/api/ai/visibility/attribute", ["ai_visibility"]),
  /** /visibility generated fixes → /api/ai/visibility/remediate. */
  remediation: api("/api/ai/visibility/remediate", ["ai_visibility"]),
  /** The SEO tools hub's tools, for a workspace with no plan yet. */
  seo_tools: { area: "seo_tools" },
  marketing_studio: page("/visibility/tools/ai-content-helper"),
  action_agent: page("/visibility/tools/action-agent"),
  share_of_voice: page("/visibility/tools/share-of-voice"),
  opportunity_scanner: page("/visibility/tools/opportunity-scanner"),
  funnels: page("/visibility/tools/funnels"),
  monitoring: page("/monitoring"),
  intelligence: page("/intelligence"),
  /** /settings/account: hasFeature(plan, "matrix_chat"). */
  team_chat: { area: areaForPage("/settings/account"), features: ["matrix_chat"] },

  // ── Limits (the plan config's own numbers) ─────────────────────────────────
  /** Bot analytics, log upload: canUploadLogs (an allowance above 0). */
  bot_logs: page("/visibility/tools/bot-analytics", canUploadLogs),
  content_explorer: page("/visibility/tools/content-explorer", planCanSearchContent),
  ai_citations: page("/visibility/tools/ai-citations", planCanUseAiCitations),
  rank_tracker: page("/visibility/tools/rank-tracker", planCanTrack),
  rank_daily: page("/visibility/tools/rank-tracker", (p) => planCanTrack(p) && planAllowsFrequency(p, "daily")),
  backlinks: page("/visibility/tools/backlinks", planCanAnalyzeBacklinks),
  /** Everything the Basic tier's upsell lists. */
  backlinks_full: page("/visibility/tools/backlinks", (p) => {
    const c = backlinksCapability(p);
    return planCanAnalyzeBacklinks(p) && c.scope === "full" && c.filters && c.csv && c.history && c.deepEndpoints;
  }),
  /** AI Lens on any URL, a competitor's included: CROSS_DOMAIN_PLANS. */
  ai_lens_any_url: page("/visibility/tools/ai-lens", (p) => CROSS_DOMAIN_PLANS.includes(p)),
  /** A DAILY visibility monitor: requirePlan(MONITOR_DAILY_MIN_PLAN). */
  monitor_daily: api("/api/ai/visibility/monitor", ["ai_visibility"], monitorDailyAllowed),
  /** More than one benchmark competitor a day (the card's line shows at 1). */
  benchmark_more: api("/api/ai/visibility/benchmark", ["ai_visibility"], (p) => benchmarkDailyLimit(p) > 1),
} satisfies Record<string, Need>;

export type LockId = keyof typeof LOCKS;
export const LOCK_IDS = Object.keys(LOCKS) as LockId[];

/** Does `plan` clear the lock? (Drives the locked state where no route decides it.) */
export function lockOpen(plan: PlanType | null | undefined, id: LockId): boolean {
  return Boolean(plan && planMeets(plan, LOCKS[id]));
}

/**
 * The plan a locked message names: upgradeTarget's answer for this tenant.
 * Never null, because a message always names a plan: on a plan that already
 * clears the lock (help text, a stale card) it is the cheapest plan that does;
 * Enterprise if, against today's configs, none does.
 */
export function lockedPlan(current: PlanType | null | undefined, id: LockId): PlanType {
  const need = LOCKS[id];
  return (
    upgradeTarget(current, need) ??
    upgradeTarget(null, need) ??
    PLANS_BY_PRICE[PLANS_BY_PRICE.length - 1]!
  );
}

export function lockedPlanName(current: PlanType | null | undefined, id: LockId): string {
  return planName(lockedPlan(current, id));
}
