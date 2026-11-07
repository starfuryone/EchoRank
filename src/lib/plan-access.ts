// src/lib/plan-access.ts — which areas of the product each plan includes.
//
// ONE ALLOWLIST, READ BY EVERY GATE (ECHORANK-AI-TIER.md, 2026-11-07):
//   - pages: the (dashboard) layout renders the upgrade screen for an
//     excluded route (server-side, never client-only hiding);
//   - tenant API routes: the proxy answers 403 PLAN_UPGRADE_REQUIRED;
//   - public API v1 / MCP: key auth refuses the plan (src/lib/api-keys.ts);
//   - navigation: sidebar and tools-hub cards are derived from it;
//   - workers: jobs re-check the tenant's plan when they run;
//   - plan changes: a downgrade pauses excluded schedules, an upgrade resumes.
//
// Only AI_VISIBILITY (the $29 AI-only plan) is restricted. Every other plan
// includes every area, and its existing per-tool gates (features, quotas,
// requirePlan) still apply inside them; this file never grants anything those
// gates withhold. Staff overrides change limits inside included areas only.
//
// EVERY ROUTE IS CLASSIFIED. tests/plan-access.test.ts walks every (dashboard)
// page and every /api route on disk and fails on one with no area, so a new
// route cannot slip through. At run time an unclassified route is refused for
// the restricted plan (default excluded).
//
// Dependency-free: the proxy, the sidebar (a Client Component) and the workers
// all import it.

import type { PlanType } from "@/generated/prisma";

export type AccessArea =
  /** The AI visibility dashboard, monitoring, Custom Prompts, Brand Radar, AI Lens, audits. */
  | "ai_visibility"
  /** Settings, Account, Billing, Help, Team, Notifications. */
  | "account"
  /** /dashboard: every plan has a home; the AI-only plan's is /visibility. */
  | "home"
  /** The SEO tools hub's tools (Site Explorer, Keywords, Rank Tracker, GSC, SERP, Backlinks, Lighthouse, analytics, content, reporting, AI insight tools). */
  | "seo_tools"
  /** The site crawler (CRAWLER_BRAND): /crawler and the crawl API. */
  | "crawler"
  /** Reviews, campaigns, feedback requests, recovery, monitoring, intelligence, data sources, extension import. */
  | "reputation"
  | "marketing_studio"
  /** White-label, client workspaces, funnels, portfolios. */
  | "client_management"
  /** Public API v1, MCP server, API keys. */
  | "public_api"
  /** The Pro assistant. */
  | "assistant"
  /** Not tenant plan-gated: auth, webhooks, free tools, public/partner key APIs (gated at key auth), staff. */
  | "exempt";

export const ALL_AREAS: readonly AccessArea[] = [
  "ai_visibility",
  "account",
  "home",
  "seo_tools",
  "crawler",
  "reputation",
  "marketing_studio",
  "client_management",
  "public_api",
  "assistant",
  "exempt",
];

/** What the AI-only plan includes. Everything else is excluded. */
export const AI_VISIBILITY_AREAS: ReadonlySet<AccessArea> = new Set<AccessArea>(["ai_visibility", "account", "home", "exempt"]);

export function planAllowsArea(plan: PlanType | null | undefined, area: AccessArea): boolean {
  if (area === "exempt") return true;
  if (plan === "AI_VISIBILITY") return AI_VISIBILITY_AREAS.has(area);
  return true;
}

/** Does this plan exclude any area at all? (Only the AI-only plan does.) */
export function planIsRestricted(plan: PlanType | null | undefined): boolean {
  return ALL_AREAS.some((area) => !planAllowsArea(plan, area));
}

/** The plan to upgrade to for an area the AI-only plan does not include. */
export const UPGRADE_PLAN_FOR_EXCLUDED: PlanType = "STARTER";

interface RouteRule {
  /** A path prefix; matched on whole segments. */
  prefix: string;
  area: AccessArea;
  /** Restrict the rule to these HTTP methods (API only). */
  methods?: readonly string[];
  /** Match the prefix exactly, not its sub-paths. */
  exact?: boolean;
}

/** (dashboard) pages, most specific first. */
export const PAGE_RULES: readonly RouteRule[] = [
  // AI visibility, including the three AI tools that live in the tools hub.
  { prefix: "/visibility/tools/brand-radar", area: "ai_visibility" },
  { prefix: "/visibility/tools/ai-lens", area: "ai_visibility" },
  { prefix: "/visibility/tools/custom-prompts", area: "ai_visibility" },
  // The hub index itself: open, with excluded cards shown locked.
  { prefix: "/visibility/tools", area: "ai_visibility", exact: true },
  { prefix: "/visibility/tools/action-agent", area: "marketing_studio" },
  { prefix: "/visibility/tools/ai-content-helper", area: "marketing_studio" },
  { prefix: "/visibility/tools/social-media-manager", area: "marketing_studio" },
  { prefix: "/visibility/tools/funnels", area: "client_management" },
  { prefix: "/visibility/tools/opportunity-scanner", area: "client_management" },
  { prefix: "/visibility/tools/portfolios", area: "client_management" },
  { prefix: "/visibility/tools/api-access", area: "public_api" },
  { prefix: "/visibility/tools/mcp-server", area: "public_api" },
  { prefix: "/visibility/tools/site-crawler", area: "crawler" },
  { prefix: "/visibility/tools/gbp-monitor", area: "reputation" },
  { prefix: "/visibility/tools", area: "seo_tools" },
  { prefix: "/visibility/keywords", area: "seo_tools" },
  { prefix: "/visibility", area: "ai_visibility" },
  { prefix: "/crawler", area: "crawler" },
  { prefix: "/dashboard", area: "home" },
  { prefix: "/settings", area: "account" },
  { prefix: "/billing", area: "account" },
  { prefix: "/help", area: "account" },
  { prefix: "/team", area: "account" },
  { prefix: "/notifications", area: "account" },
  // The AI tools hub: its cards are Growth+ insight tools (share of voice,
  // citations, attribution, revenue, scanner). Excluded (placement unclear in
  // the spec; defaulted to excluded and reported).
  { prefix: "/ai", area: "seo_tools" },
  { prefix: "/assistant", area: "assistant" },
  { prefix: "/reputation", area: "reputation" },
  { prefix: "/campaigns", area: "reputation" },
  { prefix: "/customers", area: "reputation" },
  { prefix: "/feedback", area: "reputation" },
  { prefix: "/recovery", area: "reputation" },
  { prefix: "/review-links", area: "reputation" },
  { prefix: "/templates", area: "reputation" },
  { prefix: "/monitoring", area: "reputation" },
  { prefix: "/intelligence", area: "reputation" },
  { prefix: "/imports", area: "reputation" },
  { prefix: "/extension", area: "reputation" },
  { prefix: "/analytics", area: "reputation" },
];

/** /api routes, most specific first. */
export const API_RULES: readonly RouteRule[] = [
  // Not gated here (their own auth): sign-in, webhooks, free tools, public and
  // partner key APIs (plan-checked at key auth), staff, beacons, unsubscribe.
  { prefix: "/api/auth", area: "exempt" },
  { prefix: "/api/webhooks", area: "exempt" },
  { prefix: "/api/free", area: "exempt" },
  { prefix: "/api/public", area: "exempt" },
  { prefix: "/api/partner", area: "exempt" },
  { prefix: "/api/v1", area: "exempt" },
  { prefix: "/api/admin", area: "exempt" },
  { prefix: "/api/collect", area: "exempt" },
  { prefix: "/api/email", area: "exempt" },
  { prefix: "/api/enterprise", area: "exempt" },
  { prefix: "/api/extension/import", area: "exempt" },
  { prefix: "/api/feedback", area: "exempt" },
  { prefix: "/api/assistant/chat", area: "exempt" },
  // AI visibility.
  { prefix: "/api/ai/visibility/keywords", area: "seo_tools" },
  { prefix: "/api/ai/visibility/gsc", area: "seo_tools" },
  { prefix: "/api/ai/visibility/historical", area: "seo_tools" },
  { prefix: "/api/ai/visibility/bots", area: "seo_tools" },
  { prefix: "/api/ai/visibility/attribution-keys", area: "seo_tools" },
  { prefix: "/api/ai/visibility/marketing", area: "marketing_studio" },
  { prefix: "/api/ai/visibility/api-keys", area: "public_api" },
  { prefix: "/api/ai/visibility", area: "ai_visibility" },
  { prefix: "/api/ai-search", area: "ai_visibility" },
  { prefix: "/api/av", area: "ai_visibility" },
  { prefix: "/api/seo/v1/ai-lens", area: "ai_visibility" },
  { prefix: "/api/seo/v1/crawl", area: "crawler" },
  { prefix: "/api/seo", area: "seo_tools" },
  { prefix: "/api/keyword-opportunities", area: "seo_tools" },
  { prefix: "/api/citation-opportunities", area: "seo_tools" },
  // Account.
  { prefix: "/api/account", area: "account" },
  { prefix: "/api/billing", area: "account" },
  { prefix: "/api/team", area: "account" },
  { prefix: "/api/notifications", area: "account" },
  { prefix: "/api/onboarding", area: "account" },
  { prefix: "/api/metering", area: "account" },
  // Creating a client workspace is client management; listing and switching
  // workspaces is account.
  { prefix: "/api/tenants", area: "client_management", methods: ["POST"] },
  { prefix: "/api/tenants", area: "account" },
  { prefix: "/api/agency", area: "client_management" },
  { prefix: "/api/action-agent", area: "marketing_studio" },
  { prefix: "/api/assistant", area: "assistant" },
  // Reputation.
  { prefix: "/api/ai", area: "reputation" },
  { prefix: "/api/campaigns", area: "reputation" },
  { prefix: "/api/competitors", area: "reputation" },
  { prefix: "/api/compliance", area: "reputation" },
  { prefix: "/api/customers", area: "reputation" },
  { prefix: "/api/extension", area: "reputation" },
  { prefix: "/api/imports", area: "reputation" },
  { prefix: "/api/intelligence", area: "reputation" },
  { prefix: "/api/monitoring", area: "reputation" },
  { prefix: "/api/recovery", area: "reputation" },
  { prefix: "/api/reputation", area: "reputation" },
  { prefix: "/api/review-links", area: "reputation" },
  { prefix: "/api/signals", area: "reputation" },
  { prefix: "/api/templates", area: "reputation" },
  { prefix: "/api/analytics", area: "reputation" },
];

function matches(rule: RouteRule, path: string, method?: string): boolean {
  if (rule.methods && (!method || !rule.methods.includes(method.toUpperCase()))) return false;
  if (rule.exact) return path === rule.prefix || path === `${rule.prefix}/`;
  return path === rule.prefix || path.startsWith(`${rule.prefix}/`);
}

function areaFor(rules: readonly RouteRule[], path: string, method?: string): AccessArea | null {
  const clean = path.split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";
  return rules.find((r) => matches(r, clean, method))?.area ?? null;
}

/** The area a (dashboard) page belongs to, or null when unclassified. */
export function areaForPage(path: string): AccessArea | null {
  return areaFor(PAGE_RULES, path);
}

/** The area an /api route belongs to, or null when unclassified. */
export function areaForApi(path: string, method?: string): AccessArea | null {
  return areaFor(API_RULES, path, method);
}

/** Unclassified routes are refused for the restricted plan (default excluded). */
export function planAllowsPage(plan: PlanType | null | undefined, path: string): boolean {
  const area = areaForPage(path);
  if (area === null) return plan !== "AI_VISIBILITY";
  return planAllowsArea(plan, area);
}

export function planAllowsApi(plan: PlanType | null | undefined, path: string, method?: string): boolean {
  const area = areaForApi(path, method);
  if (area === null) return plan !== "AI_VISIBILITY";
  return planAllowsArea(plan, area);
}

/** The body every refused API call gets. */
export const PLAN_UPGRADE_REQUIRED = "PLAN_UPGRADE_REQUIRED" as const;
export function planUpgradeBody(area: AccessArea | null) {
  return {
    error: "Your plan does not include this. Available from Starter.",
    code: PLAN_UPGRADE_REQUIRED,
    area,
    upgradeTo: UPGRADE_PLAN_FOR_EXCLUDED,
  };
}
