// src/lib/seo-tools.ts
// Single typed source of truth for the SEO Tools hub: the sidebar "SEO Tools"
// entry, the hub grid at /visibility/tools, and the tool scaffolds all render
// from this. (Adapted from the superseded mega-menu's product-nav config.)
//
// Names/descriptions are NOT stored here: they live in the dashboard i18n
// catalogs (SEO_TOOLS_COPY in src/lib/i18n/dashboard.ts), keyed by the ids
// below — the typed equivalent of nameKey/descriptionKey. Adding a tool here
// without copy in all three DashLocale catalogs is a type error.
//
// Visibility is NOT authorization: the hub filters cards by canAccessPath()
// purely so no tier is offered a link its route allowlist would bounce; the
// hub and every /visibility/tools/* page are additionally paid-gated server-
// side (src/lib/paid-plan.ts via the tools layout).

import type { ComponentType } from "react";
import {
  Globe,
  KeyRound,
  LineChart,
  SearchCheck,
  RadarIcon,
  MessageSquareText,
  ScanSearch,
  AreaChart,
  Bot,
  Compass,
  PenTool,
  Share2,
  LayoutDashboard,
  FolderKanban,
  FileBarChart2,
  Store,
  Code2,
  Plug,
  ListOrdered,
  Link2,
  Gauge,
  ScanEye,
  History,
  Network,
} from "lucide-react";
import { canAccessPath } from "@/lib/plan-routing";
import type { PlanType } from "@/generated/prisma";

export const SEO_TOOLS_HUB = "/visibility/tools";

export type SeoToolGroupId =
  | "search_marketing"
  | "website_performance"
  | "content_marketing"
  | "reporting"
  | "local_seo"
  | "developers";

export type SeoToolId =
  | "site_explorer"
  | "keywords_explorer"
  | "rank_tracker"
  | "gsc_insights"
  | "brand_radar"
  | "custom_prompts"
  | "site_audit"
  | "web_analytics"
  | "bot_analytics"
  | "content_explorer"
  | "ai_content_helper"
  | "social_media_manager"
  | "dashboard"
  | "portfolios"
  | "report_builder"
  | "gbp_monitor"
  | "api_access"
  | "mcp_server"
  | "serp_checker"
  | "backlinks"
  | "lighthouse"
  | "ai_lens"
  | "historical"
  | "site_crawler";

/** Tools that render a scaffold page under /visibility/tools/<slug>. */
// Note: brand_radar/bot_analytics/content_explorer remain ScaffoldIds although
// their pages are real now — their scaffold copy (CTA/related labels) still
// feeds the tool-hub cards, and dropping an id from this union would make the
// copy objects fail their excess-property check for no gain. Read this union as
// "has scaffold copy", NOT as "is unimplemented": that misreading has now sent
// three separate sessions hunting for a placeholder that was already a real
// page. api_access/mcp_server never had scaffold copy, and ai_lens ships with
// its own empty/error states in AI_LENS_COPY so it never had any either.
export type ScaffoldId = Exclude<
  SeoToolId,
  | "keywords_explorer"
  | "custom_prompts"
  | "site_audit"
  | "dashboard"
  | "api_access"
  | "mcp_server"
  | "ai_lens"
  // Same reason as ai_lens: Historical shipped as a real page with its own
  // empty and error states in HISTORICAL_COPY, so it never had scaffold copy
  // to inherit.
  | "historical"
  // Site Crawler shipped as a real page in one go — its empty, running and
  // locked states live in SITE_CRAWLER_COPY, so there was never a scaffold.
  | "site_crawler"
>;

export interface SeoTool {
  id: SeoToolId;
  /** URL slug under the hub for scaffolds; informational for existing surfaces. */
  slug: string;
  /** Card destination. Scaffolds live under the hub; `existing` tools point at shipped surfaces. */
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: "new";
  /** True when the card links to an already-shipped surface (vs a scaffold). */
  existing?: boolean;
  /**
   * True while the tool's page is still a FeatureScaffold placeholder.
   *
   * This exists for the PUBLIC homepage, which showcases the hub to logged-out
   * visitors and must not advertise a placeholder as shipped — or, worse, badge
   * a shipped tool as unreleased. It is asserted against the actual route files
   * by `seo-tools.test.ts`, so flipping a scaffold to a real page without
   * clearing this flag fails the suite rather than quietly mislabelling a live
   * feature on the marketing site.
   *
   * Absent = live. Only the five remaining scaffolds carry it.
   */
  comingSoon?: true;
}

export interface SeoToolGroup {
  id: SeoToolGroupId;
  tools: SeoTool[];
}

const t = (
  id: SeoToolId,
  slug: string,
  icon: SeoTool["icon"],
  extra?: Partial<SeoTool>,
): SeoTool => ({
  id,
  slug,
  href: `${SEO_TOOLS_HUB}/${slug}`,
  icon,
  ...extra,
});

export const SEO_TOOL_GROUPS: SeoToolGroup[] = [
  {
    id: "search_marketing",
    tools: [
      t("site_explorer", "site-explorer", Globe),
      // The shipped SEO Keyword Suggester IS Keywords Explorer — the card
      // links to its existing page rather than duplicating it.
      t("keywords_explorer", "keywords-explorer", KeyRound, {
        href: "/visibility/keywords",
        existing: true,
      }),
      t("rank_tracker", "rank-tracker", LineChart),
      t("gsc_insights", "gsc-insights", SearchCheck),
      t("serp_checker", "serp-checker", ListOrdered),
      t("backlinks", "backlinks", Link2),
      t("brand_radar", "brand-radar", RadarIcon),
      // What an AI crawler actually receives for one page. Sits beside Brand
      // Radar because both answer "are we in the answers"; this one answers
      // "can they even read us".
      t("ai_lens", "ai-lens", ScanEye, { badge: "new" }),
      t("custom_prompts", "custom-prompts", MessageSquareText),
      // Historical. Sits in Search Marketing because its primary axis is SERP
      // movement over time; the page-snapshot half is the "why did it move"
      // companion to that. Reads history the other tools already produced —
      // v1 makes no DataForSEO call of its own.
      t("historical", "historical", History, { badge: "new" }),
    ],
  },
  {
    id: "website_performance",
    tools: [
      // Technical-SEO crawl (DataForSEO OnPage). NOT the audit on /visibility:
      // that one measures AI-engine readability and is a different product.
      // Both are linked from each other's copy so the split is explicit.
      t("site_audit", "site-audit", ScanSearch),
      // Our own BFS crawler: raw HTML, no external API, no JS rendering. Sits
      // beside Site Audit because both answer "what is wrong across the site",
      // but this one is first-party and priced by URLs rather than per page.
      t("site_crawler", "site-crawler", Network),
      t("lighthouse", "lighthouse", Gauge),
      t("web_analytics", "web-analytics", AreaChart),
      t("bot_analytics", "bot-analytics", Bot, { badge: "new" }),
    ],
  },
  {
    id: "content_marketing",
    tools: [
      t("content_explorer", "content-explorer", Compass),
      // Marketing Studio. The card keeps the ai_content_helper id and the
      // ai-content-helper slug — both are wired into dashNav, the homepage grid
      // and the route table in seo-tools.test.ts — while the page titles itself
      // Marketing Studio. It keeps its scaffold copy per the ScaffoldId note
      // above; that union means "has scaffold copy", not "is unimplemented".
      t("ai_content_helper", "ai-content-helper", PenTool),
      t("social_media_manager", "social-media-manager", Share2, { comingSoon: true }),
    ],
  },
  {
    id: "reporting",
    tools: [
      t("dashboard", "dashboard", LayoutDashboard, { href: "/dashboard", existing: true }),
      t("portfolios", "portfolios", FolderKanban, { comingSoon: true }),
      t("report_builder", "report-builder", FileBarChart2, { comingSoon: true }),
    ],
  },
  {
    id: "local_seo",
    tools: [t("gbp_monitor", "gbp-monitor", Store, { badge: "new", comingSoon: true })],
  },
  {
    id: "developers",
    tools: [
      t("api_access", "api-access", Code2),
      t("mcp_server", "mcp-server", Plug),
    ],
  },
];

/**
 * Real existing surfaces a scaffold can point at today (secondary link on the
 * starter state). Labels live in SEO_TOOLS_COPY.scaffolds[id].related. These
 * are ALSO filtered by canAccessPath at render time — several live outside
 * the AI_VISIBILITY allowlist.
 */
export const SCAFFOLD_RELATED: Partial<Record<ScaffoldId, string>> = {
  site_explorer: "/intelligence/competitors",
  rank_tracker: "/visibility/keywords",
  brand_radar: "/visibility/tools/custom-prompts",
  web_analytics: "/analytics",
  bot_analytics: "/visibility",
  ai_content_helper: "/templates",
  report_builder: "/visibility",
  gbp_monitor: "/monitoring",
  serp_checker: "/visibility/keywords",
  lighthouse: "/visibility",
};

/**
 * Classic SEO Tools — curated cross-cutting view rendered ONLY on the
 * dedicated sub-hub at /visibility/tools/classic (second sidebar entry).
 * Deliberately NOT a SeoToolGroup: the main hub grid stays as-is, so no
 * card appears twice there.
 */
export const CLASSIC_SEO_TOOL_IDS: readonly SeoToolId[] = [
  "site_explorer", // Domain Overview ships here (Phase 1)
  "keywords_explorer",
  "serp_checker",
  "rank_tracker",
  "backlinks",
  "lighthouse",
  "site_audit",
  "gsc_insights",
  "ai_lens",
];

/** Strip a #fragment before consulting plan-routing (it matches path prefixes). */
export function navPath(href: string): string {
  return href.split("#")[0];
}

/**
 * Groups filtered to what this plan's route allowlist can reach (e.g. the
 * Dashboard card is dropped for AI_VISIBILITY). Empty groups are dropped.
 * `plan` null/undefined shows everything — server-side guards still apply.
 */
export function visibleSeoToolGroups(plan: PlanType | null | undefined): SeoToolGroup[] {
  if (!plan) return SEO_TOOL_GROUPS;
  return SEO_TOOL_GROUPS.map((group) => ({
    ...group,
    tools: group.tools.filter((tool) => canAccessPath(plan, navPath(tool.href))),
  })).filter((group) => group.tools.length > 0);
}
