// src/lib/plan-resources.ts — what a plan includes, for the "Your plan" hub
// (/plan, PLAN-HUB Part 2). ONE PURE FUNCTION, getPlanResources(plan, ctx).
//
// NOTHING HERE IS A SECOND FEATURE LIST. Every item comes from a catalog that
// already exists and already drives a page:
//   - the tools: SEO_TOOL_GROUPS (seo-tools.ts), AI_TOOL_GROUPS (ai-tools.ts),
//     REPUTATION_TOOL_GROUPS (reputation-tools.ts), plus the sidebar's account
//     destinations (team, notifications, settings, billing, help, assistant);
//   - whether the plan opens each one: pageState() (upgrade-target.ts), the
//     same area + feature + rollout gates the route enforces;
//   - the plan named on a locked one: upgradeTarget(), computed from those
//     gates and PLAN_CONFIGS prices;
//   - every limit: PLAN_CONFIGS (and effectiveFeedbackLimit for feedback).
// The only hand-kept data is presentation: the hub group of each access area,
// the nav destinations' icons and description keys, which limit sits on which
// card, and the guide-slug → area relevance map (RESOURCE_RELEVANCE, every
// slug asserted to exist by tests/plan-resources.test.ts).
//
// Pure: no I/O. Usage counts are a separate server loader
// (src/lib/plan-usage.ts); copy is resolved by the page.

import type { ComponentType } from "react";
import { Bell, CreditCard, HelpCircle, Settings, Sparkle, UserPlus } from "lucide-react";
import type { PlanType } from "@/generated/prisma";
import { SEO_TOOL_GROUPS, seoToolStatus, type SeoToolStatus } from "@/lib/seo-tools";
import { AI_TOOL_GROUPS } from "@/lib/ai-tools";
import { REPUTATION_TOOL_GROUPS } from "@/lib/reputation-tools";
import { areaForPage, planAllowsArea, type AccessArea } from "@/lib/plan-access";
import { MARKETING_MONTHLY_OUTPUT_TOKENS, PLAN_CONFIGS } from "@/lib/plan-config";
import { effectiveFeedbackLimit } from "@/lib/feedback-limit";
import { planIncludesApi } from "@/lib/api-access";
import { LEARN_GUIDES } from "@/lib/learn-content";
import { pageState, type RolloutState } from "@/lib/upgrade-target";
import { flag } from "@/lib/flags";

// ── Groups ──────────────────────────────────────────────────────────────────

export type HubGroup =
  | "ai_visibility"
  | "crawler"
  | "seo_tools"
  | "reputation"
  | "marketing_studio"
  | "developers"
  | "team_account";

/** Display order on the hub. */
export const HUB_GROUPS: readonly HubGroup[] = [
  "ai_visibility",
  "crawler",
  "seo_tools",
  "reputation",
  "marketing_studio",
  "developers",
  "team_account",
];

/**
 * The hub group of each access area. Null: not a resource card (the home
 * dashboard, the hub indexes, routes no tenant navigates to).
 */
const AREA_GROUP: Record<AccessArea, HubGroup | null> = {
  ai_visibility: "ai_visibility",
  // The agency prospecting tools grade prospects' AI visibility.
  client_management: "ai_visibility",
  assistant: "ai_visibility",
  crawler: "crawler",
  google_connections: "team_account",
  seo_tools: "seo_tools",
  link_authority: "seo_tools",
  reputation: "reputation",
  marketing_studio: "marketing_studio",
  public_api: "developers",
  account: "team_account",
  team: "team_account",
  notifications: "team_account",
  credits: null,
  home: null,
  tools_hub: null,
  exempt: null,
};

// ── Items ───────────────────────────────────────────────────────────────────

export type ResourceSource = "seo" | "ai" | "reputation" | "nav";

export interface PlanResourceItem {
  /** `${source}:${id}` — stable, unique. */
  key: string;
  source: ResourceSource;
  /** The catalog id (an SEO/AI/reputation tool id, or the nav href). */
  id: string;
  href: string;
  group: HubGroup;
  icon: ComponentType<{ className?: string }>;
  /** available, or not usable by anyone yet (no Open button). */
  status: SeoToolStatus;
  /** A sister product's page (EchoPilot), labelled as such. */
  partner?: "echopilot";
}

export interface LockedResourceItem extends PlanResourceItem {
  /** The plan that includes it (upgrade-target.ts). Never null here. */
  upgradeTo: PlanType;
}

/**
 * The sidebar's account destinations that are not tools. Hand-kept: icons
 * and copy keys only; which plan opens each is planAllowsPage's answer.
 */
export const NAV_DESTINATIONS: readonly { href: string; icon: ComponentType<{ className?: string }> }[] = [
  { href: "/assistant", icon: Sparkle },
  { href: "/team", icon: UserPlus },
  { href: "/notifications", icon: Bell },
  { href: "/settings", icon: Settings },
  { href: "/billing", icon: CreditCard },
  { href: "/help", icon: HelpCircle },
];

/** Hub indexes: a card for them would be a card for the page you came from. */
const HUB_INDEXES = new Set(["/dashboard", "/visibility/tools", "/ai", "/reputation"]);

interface Candidate {
  source: ResourceSource;
  id: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  status: SeoToolStatus;
  partner?: "echopilot";
}

/** Every resource, deduped by href (the SEO catalog first, then AI, reputation, nav). */
export function allResourceCandidates(): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const add = (c: Candidate) => {
    const path = c.href.split("#")[0]!;
    if (seen.has(path) || HUB_INDEXES.has(path)) return;
    seen.add(path);
    out.push(c);
  };
  for (const t of SEO_TOOL_GROUPS.flatMap((g) => g.tools)) {
    add({ source: "seo", id: t.id, href: t.href, icon: t.icon, status: seoToolStatus(t), partner: t.partner });
  }
  for (const t of AI_TOOL_GROUPS.flatMap((g) => g.tools)) {
    add({ source: "ai", id: t.id, href: t.href, icon: t.icon, status: "available" });
  }
  for (const t of REPUTATION_TOOL_GROUPS.flatMap((g) => g.tools)) {
    add({
      source: "reputation",
      id: t.id,
      href: t.href,
      icon: t.icon,
      status: t.requiresGoogleApproval ? "waiting_approval" : "available",
    });
  }
  for (const n of NAV_DESTINATIONS) add({ source: "nav", id: n.href, href: n.href, icon: n.icon, status: "available" });
  return out;
}

// ── Limits ──────────────────────────────────────────────────────────────────

export type LimitKey =
  | "ai_prompts"
  | "ai_brands"
  | "seo_searches"
  | "tracked_keywords"
  | "crawl_pages"
  | "link_authority"
  | "kof_analyses"
  | "marketing_tokens"
  | "feedback_requests"
  | "api_requests";

export interface PlanResourcesContext {
  /** Build-progress switches for this tenant (tenantRollouts()). */
  rollouts: RolloutState;
  /** Tenant.monthlyRequestLimit: Enterprise's contracted feedback limit. */
  monthlyRequestLimit?: number;
}

interface LimitDef {
  key: LimitKey;
  /** The card it sits on. */
  href: string;
  /** The PLAN_CONFIGS figure. null = no cap; 0 = not included. */
  value: (plan: PlanType, ctx: PlanResourcesContext) => number | null;
  /** An existing helper counts it (src/lib/plan-usage.ts). */
  counted: boolean;
}

const LIMIT_DEFS: readonly LimitDef[] = [
  { key: "ai_prompts", href: "/visibility/tools/custom-prompts", value: (p) => PLAN_CONFIGS[p].aiCheckup.prompts, counted: false },
  { key: "ai_brands", href: "/visibility", value: (p) => PLAN_CONFIGS[p].aiProjects, counted: false },
  { key: "seo_searches", href: "/visibility/keywords", value: (p) => PLAN_CONFIGS[p].seoSearchesPerMonth, counted: true },
  { key: "tracked_keywords", href: "/visibility/tools/rank-tracker", value: (p) => PLAN_CONFIGS[p].trackedKeywords, counted: true },
  { key: "crawl_pages", href: "/crawler", value: (p) => PLAN_CONFIGS[p].crawlPagesPerMonth, counted: true },
  { key: "link_authority", href: "/visibility/tools/link-authority", value: (p) => PLAN_CONFIGS[p].linkAuthorityChecksPerMonth, counted: true },
  { key: "kof_analyses", href: "/visibility/tools/keyword-opportunities", value: (p) => PLAN_CONFIGS[p].keywordOpportunityAnalysesPerMonth, counted: true },
  { key: "marketing_tokens", href: "/visibility/tools/ai-content-helper", value: (p) => MARKETING_MONTHLY_OUTPUT_TOKENS[p], counted: true },
  {
    key: "feedback_requests",
    href: "/feedback",
    value: (p, ctx) => effectiveFeedbackLimit({ planType: p, monthlyRequestLimit: ctx.monthlyRequestLimit ?? 0 }),
    counted: true,
  },
  {
    key: "api_requests",
    href: "/visibility/tools/api-access",
    value: (p) => (planIncludesApi(p) ? PLAN_CONFIGS[p].quotaDefaults.maxApiRequestsPerDay : 0),
    counted: true,
  },
];

export interface PlanLimit {
  key: LimitKey;
  /** The included card it belongs to. */
  itemKey: string;
  /** A number, "unlimited" (no cap) or "custom" (Enterprise, set per contract). */
  limit: number | "unlimited" | "custom";
  counted: boolean;
}

// ── Getting started, help, account ──────────────────────────────────────────

/**
 * The guides each part of the product points at: slug → the area a plan
 * must include for the guide to be relevant. Every slug must exist (test).
 */
export const RESOURCE_RELEVANCE: readonly { kind: "learn" | "aeo" | "prompt-guides"; slug?: string; area: AccessArea }[] = [
  { kind: "learn", slug: "what-nosy-bat-checks", area: "crawler" },
  // The crawler guides: the learn-content family, not a copy of its slugs.
  ...LEARN_GUIDES.filter((g) => g.group === "nosy-bat").map((g) => ({ kind: "learn" as const, slug: g.slug, area: "crawler" as const })),
  { kind: "aeo", area: "ai_visibility" },
  { kind: "learn", slug: "how-to-get-cited-by-chatgpt", area: "ai_visibility" },
  { kind: "prompt-guides", area: "ai_visibility" },
  { kind: "learn", slug: "review-request-templates", area: "reputation" },
  { kind: "learn", slug: "csv-review-import", area: "reputation" },
  { kind: "learn", slug: "install-browser-extension", area: "reputation" },
];

export type AccountEssential =
  | { key: "invite"; href: "/team" }
  | { key: "notifications"; href: "/notifications" }
  | { key: "language"; href: "/settings" }
  | { key: "gsc"; href: string; status: SeoToolStatus }
  | { key: "api"; href: "/visibility/tools/api-access" }
  | { key: "mcp"; href: "/visibility/tools/mcp-server" }
  | { key: "data"; href: "/settings/account" };

// ── The function ────────────────────────────────────────────────────────────

export interface PlanResources {
  included: PlanResourceItem[];
  locked: LockedResourceItem[];
  limits: PlanLimit[];
  /** Plans with the "More with another plan" section (not Agency, not Enterprise). */
  showMore: boolean;
  help: { kind: "learn" | "aeo" | "prompt-guides"; slug?: string }[];
  account: AccountEssential[];
}

const NO_MORE: ReadonlySet<PlanType> = new Set<PlanType>(["AGENCY", "ENTERPRISE"]);

export function getPlanResources(plan: PlanType, ctx: PlanResourcesContext): PlanResources {
  const included: PlanResourceItem[] = [];
  const locked: LockedResourceItem[] = [];

  for (const c of allResourceCandidates()) {
    const area = areaForPage(c.href);
    const group = area ? AREA_GROUP[area] : null;
    if (!group) continue;
    const state = pageState(plan, c.href, ctx.rollouts);
    if (state.state === "hidden") continue;
    const item: PlanResourceItem = { key: `${c.source}:${c.id}`, source: c.source, id: c.id, href: c.href, group, icon: c.icon, status: c.status, partner: c.partner };
    if (state.state === "open") {
      included.push(item);
    } else if (state.upgradeTo && c.status === "available") {
      // Not-yet-usable tools are not sold as a reason to upgrade.
      locked.push({ ...item, upgradeTo: state.upgradeTo });
    }
  }

  const byHref = new Map(included.map((i) => [i.href, i]));
  const limits: PlanLimit[] = [];
  for (const def of LIMIT_DEFS) {
    const item = byHref.get(def.href);
    if (!item) continue;
    const value = def.value(plan, ctx);
    if (value === 0) continue;
    limits.push({
      key: def.key,
      itemKey: item.key,
      limit: value === null ? (plan === "ENTERPRISE" ? "custom" : "unlimited") : value,
      counted: def.counted,
    });
  }

  const help = RESOURCE_RELEVANCE.filter((r) => planAllowsArea(plan, r.area)).map(({ kind, slug }) => ({ kind, slug }));

  const account: AccountEssential[] = [];
  if (planAllowsArea(plan, "team")) account.push({ key: "invite", href: "/team" });
  if (planAllowsArea(plan, "notifications")) account.push({ key: "notifications", href: "/notifications" });
  account.push({ key: "language", href: "/settings" });
  if (planAllowsArea(plan, "google_connections")) {
    // The crawler-only plan connects Search Console from Settings; plans
    // with the SEO tools do it in GSC Insights, which waits on Google.
    const gsc = SEO_TOOL_GROUPS.flatMap((g) => g.tools).find((t) => t.id === "gsc_insights");
    if (planAllowsArea(plan, "seo_tools") && gsc) {
      account.push({ key: "gsc", href: gsc.href, status: seoToolStatus(gsc) });
    } else if (flag("crawl.gsc")) {
      // The Settings panel shows under the same flag (settings/page-client.tsx).
      account.push({ key: "gsc", href: "/settings", status: "available" });
    }
  }
  if (planIncludesApi(plan)) {
    account.push({ key: "api", href: "/visibility/tools/api-access" }, { key: "mcp", href: "/visibility/tools/mcp-server" });
  }
  account.push({ key: "data", href: "/settings/account" });

  return { included, locked, limits, showMore: !NO_MORE.has(plan) && locked.length > 0, help, account };
}
