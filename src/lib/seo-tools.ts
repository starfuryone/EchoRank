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
  | "mcp_server";

/** Tools that render a scaffold page under /visibility/tools/<slug>. */
// Note: brand_radar/bot_analytics remain ScaffoldIds although their pages are
// real now — their scaffold copy (CTA/related labels) still feeds their empty
// states. api_access/mcp_server never had scaffold copy.
export type ScaffoldId = Exclude<
  SeoToolId,
  "keywords_explorer" | "custom_prompts" | "site_audit" | "dashboard" | "api_access" | "mcp_server"
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
      t("brand_radar", "brand-radar", RadarIcon),
      // Tracked prompts (AnswerTrackingCard) on the AI Visibility page.
      t("custom_prompts", "custom-prompts", MessageSquareText, {
        href: "/visibility#prompts",
        existing: true,
      }),
    ],
  },
  {
    id: "website_performance",
    tools: [
      // The av-visibility sidecar audit surface on /visibility.
      t("site_audit", "site-audit", ScanSearch, { href: "/visibility", existing: true }),
      t("web_analytics", "web-analytics", AreaChart),
      t("bot_analytics", "bot-analytics", Bot, { badge: "new" }),
    ],
  },
  {
    id: "content_marketing",
    tools: [
      t("content_explorer", "content-explorer", Compass),
      t("ai_content_helper", "ai-content-helper", PenTool),
      t("social_media_manager", "social-media-manager", Share2),
    ],
  },
  {
    id: "reporting",
    tools: [
      t("dashboard", "dashboard", LayoutDashboard, { href: "/dashboard", existing: true }),
      t("portfolios", "portfolios", FolderKanban),
      t("report_builder", "report-builder", FileBarChart2),
    ],
  },
  {
    id: "local_seo",
    tools: [t("gbp_monitor", "gbp-monitor", Store, { badge: "new" })],
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
  brand_radar: "/visibility#prompts",
  web_analytics: "/analytics",
  bot_analytics: "/visibility",
  ai_content_helper: "/templates",
  report_builder: "/visibility",
  gbp_monitor: "/monitoring",
};

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
