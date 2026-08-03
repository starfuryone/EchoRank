// src/lib/reputation-tools.ts
//
// The Reputation Tools hub config. Same shape and same rules as seo-tools.ts —
// one typed source, cards rendered from it, parity asserted by a test.
//
// WHY THIS EXISTS. Eleven top-level sidebar rows for eleven reputation
// surfaces made the sidebar the product's table of contents, and a table of
// contents with eighteen entries is a list nobody reads. These eleven collapse
// to one row and one grouped page.
//
// NO ROUTES MOVED. Every card points at the surface that already exists, so
// deep links, bookmarks and anything a customer has pasted into a doc keep
// working, and there are no redirects to maintain. This file is navigation
// only — it grants nothing and enforces nothing.
//
// LOCKS MIRROR, THEY DO NOT CREATE. A card's `feature` names the gate its
// DESTINATION already enforces (monitoring's API is requireFeature
// "reputation_monitoring"; intelligence's alerts API is "ai_analysis"). It is
// there so the card can show the same lock state the page would, rather than
// sending someone to a wall. Adding a `feature` here that the destination does
// not enforce would be a lie in the safe direction; omitting one the
// destination DOES enforce is a lie in the unsafe direction. The parity test
// covers the routes; keeping these two honest is a review job.

import type { ComponentType } from "react";
import {
  Users,
  MessageSquare,
  Send,
  HeartHandshake,
  BarChart3,
  Brain,
  Radar,
  Database,
  Puzzle,
  FileText,
  ExternalLink,
} from "lucide-react";
import type { PlanType } from "@/generated/prisma";
import { hasFeature, getMinimumPlan, type Feature } from "@/lib/feature-flags";
import { canAccessPath } from "@/lib/plan-routing";

export const REPUTATION_HUB = "/reputation";

export type ReputationGroupId =
  | "customer_feedback"
  | "risk_recovery"
  | "analytics"
  | "data";

export type ReputationToolId =
  | "customers"
  | "feedback"
  | "campaigns"
  | "review_links"
  | "templates"
  | "recovery"
  | "intelligence"
  | "monitoring"
  | "reputation_analytics"
  | "data_sources"
  | "extension";

export interface ReputationTool {
  id: ReputationToolId;
  /** The EXISTING route. Never a new one. */
  href: string;
  icon: ComponentType<{ className?: string }>;
  /**
   * The feature its destination already requires, when it requires one.
   * Absent = reachable on every paid plan that can reach the hub at all.
   */
  feature?: Feature;
}

export interface ReputationToolGroup {
  id: ReputationGroupId;
  tools: ReputationTool[];
}

export const REPUTATION_TOOL_GROUPS: ReputationToolGroup[] = [
  {
    id: "customer_feedback",
    tools: [
      { id: "customers", href: "/customers", icon: Users },
      { id: "feedback", href: "/feedback", icon: MessageSquare },
      { id: "campaigns", href: "/campaigns", icon: Send },
      { id: "review_links", href: "/review-links", icon: ExternalLink },
      { id: "templates", href: "/templates", icon: FileText },
    ],
  },
  {
    id: "risk_recovery",
    tools: [
      { id: "recovery", href: "/recovery", icon: HeartHandshake },
      // /api/ai/alerts is requireFeature("ai_analysis") — GROWTH and up.
      { id: "intelligence", href: "/intelligence", icon: Brain, feature: "ai_analysis" },
      // /api/monitoring/* is requireFeature("reputation_monitoring") — AGENCY+.
      { id: "monitoring", href: "/monitoring", icon: Radar, feature: "reputation_monitoring" },
    ],
  },
  {
    id: "analytics",
    tools: [{ id: "reputation_analytics", href: "/analytics", icon: BarChart3 }],
  },
  {
    id: "data",
    tools: [
      { id: "data_sources", href: "/imports", icon: Database },
      { id: "extension", href: "/extension", icon: Puzzle },
    ],
  },
];

export const ALL_REPUTATION_TOOLS: ReputationTool[] = REPUTATION_TOOL_GROUPS.flatMap(
  (g) => g.tools,
);

export interface ToolLockState {
  locked: boolean;
  /** The cheapest plan that carries the feature. Null when nothing is locked. */
  requiredPlan: PlanType | null;
}

/**
 * Whether to render this card locked.
 *
 * Locked, not hidden — matching the Marketing Studio landing and the
 * /visibility lock cards. A hidden feature cannot be wanted; a locked one with
 * the plan that unlocks it named on the card can.
 */
export function toolLockState(tool: ReputationTool, plan: PlanType | null | undefined): ToolLockState {
  if (!tool.feature) return { locked: false, requiredPlan: null };
  if (plan && hasFeature(plan, tool.feature)) return { locked: false, requiredPlan: null };
  return { locked: true, requiredPlan: getMinimumPlan(tool.feature) };
}

/**
 * Groups this plan may see at all.
 *
 * Distinct from the lock state: canAccessPath is a ROUTE allowlist, and
 * AI_VISIBILITY is confined to /visibility, /settings, /billing and /team. For
 * that plan every reputation surface is off-limits, so the hub shows nothing
 * and the sidebar link is filtered out — a locked card offering an upgrade to
 * a product they did not buy would be noise, not an upsell.
 */
export function visibleReputationGroups(
  plan: PlanType | null | undefined,
): ReputationToolGroup[] {
  return REPUTATION_TOOL_GROUPS.map((group) => ({
    ...group,
    tools: group.tools.filter((t) => canAccessPath(plan, t.href)),
  })).filter((group) => group.tools.length > 0);
}

/** True when this plan can reach the hub at all. Drives the sidebar link. */
export function canSeeReputationHub(plan: PlanType | null | undefined): boolean {
  return canAccessPath(plan, REPUTATION_HUB);
}
