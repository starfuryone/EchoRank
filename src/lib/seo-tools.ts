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
// Visibility is NOT authorization. No tier is confined to a route subset any
// more, so every tier sees every card; the hub and every /visibility/tools/*
// page are paid-gated server-side (src/lib/paid-plan.ts via the tools layout),
// and capability is gated per-feature by requireFeature.

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
  MousePointerClick,
  PieChart,
  Quote,
  ListChecks,
  Crosshair,
  Megaphone,
} from "lucide-react";
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
  | "site_crawler"
  | "ai_attribution"
  | "share_of_voice"
  | "citation_finder"
  | "citation_opportunities"
  | "opportunity_scanner"
  | "audit_funnels";

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
  // Same: AI Attribution shipped real, with its install, empty and results
  // states in AI_ATTRIBUTION_COPY. No scaffold copy to inherit.
  | "ai_attribution"
  // Same again: Share of Voice shipped real, with its locked and empty states
  // in SHARE_OF_VOICE_COPY.
  | "share_of_voice"
  // And again: Citation Finder ships with its own locked, empty and no-match
  // states in CITATION_FINDER_COPY.
  | "citation_finder"
  // And its downstream tool, for the same reason: Citation Opportunities ships
  // real, with its locked and empty states in CITATION_OPPORTUNITIES_COPY.
  | "citation_opportunities"
  // Same again: the Agency Opportunity Scanner ships real, with its locked,
  // empty and submit states in OPPORTUNITY_SCANNER_COPY.
  | "opportunity_scanner"
  // And the White-Label Audit Funnel, which ships real with its locked, empty
  // and config states in FUNNELS_COPY.
  | "audit_funnels"
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
      // Sits directly after Brand Radar because it is the other half of the
      // same question. Brand Radar asks "are we in the answers"; this one asks
      // "and how much of them is ours, against whom". Built entirely on the
      // Watcher runs those prompts already produced — it buys nothing upstream.
      t("share_of_voice", "share-of-voice", PieChart, { badge: "new" }),
      // The third question about the same answers, after "are we in them" and
      // "how much of them is ours": WHO DID THE ENGINE READ to write them.
      // Sits here rather than in a content group because the action it drives
      // is outreach and listings, which is the same motion as Backlinks two
      // rows up. Built on citations the Watcher already stored — it buys
      // nothing upstream.
      t("citation_finder", "citation-finder", Quote, { badge: "new" }),
      // Directly after Citation Finder because it is that tool's output turned
      // into work. The Finder answers "who did the engine read"; this answers
      // "and which of those can we do something about, in what order". Two
      // cards rather than a tab on one, because the audience differs — the
      // Finder is read by whoever is diagnosing, this is worked by whoever is
      // doing outreach, and burying a worklist inside a diagnostic table is how
      // worklists go unworked.
      t("citation_opportunities", "citation-opportunities", ListChecks, { badge: "new" }),
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
      // The other half of Bot Analytics. That one answers "are AI crawlers
      // reading us"; this one answers "are the humans they answered actually
      // arriving". Phase 1 counts arrivals only — no conversions, no revenue.
      t("ai_attribution", "ai-attribution", MousePointerClick, { badge: "new" }),
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
      // Agency prospecting, and the only tool here pointed at sites the tenant
      // does not own. It sits in Reporting rather than Search Marketing because
      // its output is a deliverable an agency hands to someone else — the same
      // job Report Builder does two rows down — not a diagnostic they read
      // themselves. AGENCY+ only, gated at the route on
      // requireFeature("whitelabel").
      //
      // DELIBERATELY NOT ON THE /ai HUB (src/lib/ai-tools.ts). That hub is
      // about the answers engines give ABOUT YOU; this is a sales tool that
      // happens to use the same audit. Putting it there would file a
      // prospecting list under "your visibility".
      t("opportunity_scanner", "opportunity-scanner", Crosshair, { badge: "new" }),
      // The agency's own lead generation, and the second tool here whose
      // output is meant for somebody who is not the tenant. It sits beside the
      // scanner for that reason: the scanner finds prospects, this one lets
      // prospects find the agency, and both produce an artifact a stranger
      // reads. AGENCY+ only, gated at the routes on requireFeature("whitelabel").
      //
      // DELIBERATELY NOT ON THE /ai HUB (src/lib/ai-tools.ts), the same ruling
      // as the scanner. That hub is about the answers engines give ABOUT YOU;
      // this is a lead-capture widget that happens to run the same audit.
      // Filing it there would put an agency's marketing funnel under "your
      // visibility".
      t("audit_funnels", "funnels", Megaphone, { badge: "new" }),
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
 * starter state). Labels live in SEO_TOOLS_COPY.scaffolds[id].related.
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

/** Strip a #fragment from an href, leaving a comparable path. */
export function navPath(href: string): string {
  return href.split("#")[0];
}

/**
 * Groups this plan may see — now every group, for every tier.
 *
 * This used to drop cards outside the caller's route allowlist (the Dashboard
 * card was hidden from AI_VISIBILITY). That tier is retired and no tier is
 * confined to a route subset, so nothing is filtered. Paid-gating still
 * happens server-side in the tools layout; this was never authorization.
 */
export function visibleSeoToolGroups(
  _plan: PlanType | null | undefined,
): SeoToolGroup[] {
  return SEO_TOOL_GROUPS;
}
