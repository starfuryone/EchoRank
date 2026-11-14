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
// Two plans are restricted: AI_VISIBILITY (the AI-only plan) and NOSY_BAT
// (the crawler-only plan, 2026-11-10). Each reaches only the areas in its set
// below. Every other plan includes every area, and its existing per-tool gates
// (features, quotas, requirePlan) still apply inside them; this file never
// grants anything those gates withhold. Staff overrides change limits inside
// included areas only.
//
// EVERY ROUTE IS CLASSIFIED. tests/plan-access.test.ts walks every (dashboard)
// page and every /api route on disk and fails on one with no area, so a new
// route cannot slip through. At run time an unclassified route is refused for
// a restricted plan (default excluded); tests/plan-access-nosy-bat.test.ts
// walks the same table for a crawler-only tenant.
//
// Dependency-free: the proxy, the sidebar (a Client Component) and the workers
// all import it.

import type { PlanType } from "@/generated/prisma";

export type AccessArea =
  /** The AI visibility dashboard, monitoring, Custom Prompts, Brand Radar, AI Lens, audits. */
  | "ai_visibility"
  /** Settings, Account, Billing, Help: the account basics every plan has. */
  | "account"
  /** Team invites and members (/team, /api/team). Not on the crawler-only plan: one user. */
  | "team"
  /** The in-app notification centre (funnel alerts today). Not on the crawler-only plan. */
  | "notifications"
  /**
   * The Google connections the crawler reads: Search Console (connect,
   * callback, status, property pick, disconnect) and GA4 (connect, property
   * list, property pick). The connections only, not the SEO tools built on
   * them (GSC insights, the sync, performance data).
   */
  | "google_connections"
  /**
   * The tools hub INDEX (/visibility/tools, exact). Open on every plan: each
   * card on it is gated by the page it opens (planAllowsPage), so a restricted
   * plan sees its own tools there and nothing it cannot open is a link.
   */
  | "tools_hub"
  /**
   * Credit packs (/api/billing/credits): lookups spent in the SEO and AI tools.
   * Not on the crawler-only plan, which has none of the tools they buy.
   */
  | "credits"
  /** /dashboard: every plan has a home; the AI-only plan's is /visibility. */
  | "home"
  /** The SEO tools hub's tools (Site Explorer, Keywords, Rank Tracker, GSC, SERP, Backlinks, Lighthouse, analytics, content, reporting, AI insight tools). */
  | "seo_tools"
  /**
   * The Link Authority Checker: an SEO tool, and the ONLY one on the AI-only
   * plan (2026-11-09). Its own area so the allowlist below names it
   * explicitly rather than opening "seo_tools" or filing it under AI visibility.
   */
  | "link_authority"
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
  "team",
  "notifications",
  "google_connections",
  "tools_hub",
  "credits",
  "home",
  "seo_tools",
  "link_authority",
  "crawler",
  "reputation",
  "marketing_studio",
  "client_management",
  "public_api",
  "assistant",
  "exempt",
];

/**
 * What the AI-only plan includes. Everything else is excluded. "link_authority"
 * is the one SEO tool on it (the Link Authority Checker, 2026-11-09).
 */
export const AI_VISIBILITY_AREAS: ReadonlySet<AccessArea> = new Set<AccessArea>([
  "ai_visibility",
  "account",
  // Team and notifications were part of "account" until 2026-11-10; the AI-only plan keeps them.
  "team",
  "notifications",
  // The tools hub index, its own area since 2026-11-10 (it was "ai_visibility").
  "tools_hub",
  // Credit packs, their own area since 2026-11-10 (they were "account").
  "credits",
  "home",
  "link_authority",
  "exempt",
]);

/**
 * What the crawler-only plan (NOSY_BAT, 2026-11-10) includes: the crawler
 * (/crawler, the crawl API, its CSV and PDF reports, site verification), the
 * Google connections the crawler reads, and the account basics (settings,
 * billing, profile, help, sign-out). DENY BY DEFAULT: every other area, and
 * every route no rule classifies, is excluded. Its home is /crawler.
 */
export const NOSY_BAT_AREAS: ReadonlySet<AccessArea> = new Set<AccessArea>(["crawler", "google_connections", "account", "tools_hub", "exempt"]);

/** The restricted plans and what each includes. A plan not listed includes every area. */
const RESTRICTED: Partial<Record<PlanType, ReadonlySet<AccessArea>>> = {
  AI_VISIBILITY: AI_VISIBILITY_AREAS,
  NOSY_BAT: NOSY_BAT_AREAS,
};

export function planAllowsArea(plan: PlanType | null | undefined, area: AccessArea): boolean {
  if (area === "exempt") return true;
  const allowed = plan ? RESTRICTED[plan] : undefined;
  return allowed ? allowed.has(area) : true;
}

/** Does this plan exclude any area at all? (The AI-only and the crawler-only plans.) */
export function planIsRestricted(plan: PlanType | null | undefined): boolean {
  return Boolean(plan && RESTRICTED[plan]);
}

/**
 * Does the plan see LOCKED TEASERS (cards and rows for tools it does not
 * include, shown locked)? The AI-only plan does. The crawler-only plan does
 * not (owner, 2026-11-10): the sidebar and the tools hub show only what it
 * has, plus one "Upgrade for more tools" link.
 */
const NO_TEASERS: ReadonlySet<PlanType> = new Set<PlanType>(["NOSY_BAT"]);
export function planShowsLockedTeasers(plan: PlanType | null | undefined): boolean {
  return !(plan && NO_TEASERS.has(plan));
}

// The plan to upgrade to is no longer a constant here ("STARTER" for every
// excluded area, until 2026-11-14): src/lib/upgrade-target.ts computes it per
// tool and per current plan.

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
  // Cited sources: which pages the engines cite, and which to get listed on.
  // Core to an AI visibility plan (2026-11-07); the pages gate on the
  // citation_tracking feature too, which every plan from AI Visibility up has.
  { prefix: "/visibility/tools/citation-finder", area: "ai_visibility" },
  { prefix: "/visibility/tools/citation-opportunities", area: "ai_visibility" },
  // The hub index itself: open on every plan. The AI-only plan sees excluded
  // cards locked; the crawler-only plan sees only its own (planShowsLockedTeasers).
  { prefix: "/visibility/tools", area: "tools_hub", exact: true },
  { prefix: "/visibility/tools/action-agent", area: "marketing_studio" },
  { prefix: "/visibility/tools/ai-content-helper", area: "marketing_studio" },
  // Social posting, by EchoPilot: a page promoting the sister product, on
  // every paid plan, the AI-only one included. The old Social Media Manager
  // URL only redirects to it, so it is classified the same way.
  { prefix: "/visibility/tools/social-posting", area: "ai_visibility" },
  { prefix: "/visibility/tools/social-media-manager", area: "ai_visibility" },
  { prefix: "/visibility/tools/funnels", area: "client_management" },
  { prefix: "/visibility/tools/opportunity-scanner", area: "client_management" },
  { prefix: "/visibility/tools/portfolios", area: "client_management" },
  { prefix: "/visibility/tools/api-access", area: "public_api" },
  { prefix: "/visibility/tools/mcp-server", area: "public_api" },
  { prefix: "/visibility/tools/site-crawler", area: "crawler" },
  { prefix: "/visibility/tools/gbp-monitor", area: "reputation" },
  // The Link Authority Checker: the one SEO tool every paid plan has.
  { prefix: "/visibility/tools/link-authority", area: "link_authority" },
  { prefix: "/visibility/tools", area: "seo_tools" },
  { prefix: "/visibility/keywords", area: "seo_tools" },
  { prefix: "/visibility", area: "ai_visibility" },
  { prefix: "/crawler", area: "crawler" },
  { prefix: "/dashboard", area: "home" },
  { prefix: "/settings", area: "account" },
  { prefix: "/billing", area: "account" },
  { prefix: "/help", area: "account" },
  { prefix: "/team", area: "team" },
  { prefix: "/notifications", area: "notifications" },
  // The AI tools hub: open, showing only the cards whose page the plan opens
  // (visibleAiGroups filters with planAllowsPage). AI Attribution, Share of
  // Voice, revenue and the scanner live under /visibility/tools and stay out.
  { prefix: "/ai", area: "ai_visibility" },
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
  // The Search Console connection itself (the crawler joins it): connect,
  // the OAuth callback, status, the property pick, disconnect. The rest of
  // /api/ai/visibility/gsc (performance data, the sync) is the GSC tool.
  { prefix: "/api/ai/visibility/gsc/connect", area: "google_connections" },
  { prefix: "/api/ai/visibility/gsc/callback", area: "google_connections" },
  { prefix: "/api/ai/visibility/gsc/status", area: "google_connections" },
  { prefix: "/api/ai/visibility/gsc/select", area: "google_connections" },
  { prefix: "/api/ai/visibility/gsc/disconnect", area: "google_connections" },
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
  // GA4 for the crawler's join: connect, the property list, the property pick.
  { prefix: "/api/seo/v1/ga4", area: "google_connections" },
  { prefix: "/api/seo/v1/link-authority", area: "link_authority" },
  { prefix: "/api/seo", area: "seo_tools" },
  { prefix: "/api/keyword-opportunities", area: "seo_tools" },
  { prefix: "/api/citation-opportunities", area: "ai_visibility" },
  // The click on the EchoPilot page's CTA, recorded for every paid plan like
  // the page itself (/visibility/tools/social-posting).
  { prefix: "/api/echopilot/click", area: "ai_visibility" },
  // Account.
  // Matrix team chat is team, not an account basic (one user on the crawler-only plan).
  { prefix: "/api/account/matrix", area: "team" },
  { prefix: "/api/account", area: "account" },
  // Credit packs buy lookups for the SEO and AI tools; the watcher is the AI
  // visibility add-on. Neither is a billing basic of the crawler-only plan.
  { prefix: "/api/billing/credits", area: "credits" },
  { prefix: "/api/billing/watcher-status", area: "ai_visibility" },
  { prefix: "/api/billing", area: "account" },
  { prefix: "/api/team", area: "team" },
  { prefix: "/api/notifications", area: "notifications" },
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

/** Unclassified routes are refused for a restricted plan (default excluded). */
export function planAllowsPage(plan: PlanType | null | undefined, path: string): boolean {
  const area = areaForPage(path);
  if (area === null) return !planIsRestricted(plan);
  return planAllowsArea(plan, area);
}

export function planAllowsApi(plan: PlanType | null | undefined, path: string, method?: string): boolean {
  const area = areaForApi(path, method);
  if (area === null) return !planIsRestricted(plan);
  return planAllowsArea(plan, area);
}

/**
 * The code every refused API call carries. The body itself, naming the plan
 * that includes the area, is planUpgradeBody in src/lib/upgrade-target.ts.
 */
export const PLAN_UPGRADE_REQUIRED = "PLAN_UPGRADE_REQUIRED" as const;
