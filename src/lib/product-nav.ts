// src/lib/product-nav.ts
// Single typed source of truth for the "Products" navigation. Both the
// desktop mega-menu (components/layout/products-menu.tsx) and the mobile
// drawer accordion (components/layout/sidebar-products.tsx) render from this.
//
// Names/descriptions are NOT stored here: they live in the dashboard i18n
// catalogs (PRODUCT_NAV_COPY in src/lib/i18n/dashboard.ts), keyed by the ids
// below — the typed equivalent of nameKey/descriptionKey. Adding an item here
// without adding its copy to all three DashLocale catalogs is a type error.
//
// Visibility is NOT authorization: the menu filters by canAccessPath() purely
// so users are not offered links their plan cannot reach; every route still
// enforces auth/plan server-side ((dashboard)/layout.tsx + API guards).

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
} from "lucide-react";
import { canAccessPath } from "@/lib/plan-routing";
import type { PlanType } from "@/generated/prisma";

export type ProductNavGroupId =
  | "search_marketing"
  | "website_performance"
  | "content_marketing"
  | "reporting"
  | "local_seo";

export type ProductNavItemId =
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
  | "gbp_monitor";

/** Items that render a scaffold page (everything not mapped to an existing surface). */
export type ScaffoldId = Exclude<
  ProductNavItemId,
  "keywords_explorer" | "custom_prompts" | "site_audit" | "dashboard"
>;

/**
 * Real existing surfaces a scaffold can point at today (secondary link on the
 * starter state). Kept here, next to the routes, rather than in the i18n
 * catalogs — labels for these live in PRODUCT_NAV_COPY.scaffolds[id].related.
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

export interface ProductNavItem {
  id: ProductNavItemId;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: "new";
  /** True when the item points at an already-shipped surface (vs a scaffold). */
  existing?: boolean;
}

export interface ProductNavGroup {
  id: ProductNavGroupId;
  items: ProductNavItem[];
}

export const PRODUCT_NAV: ProductNavGroup[] = [
  {
    id: "search_marketing",
    items: [
      { id: "site_explorer", href: "/site-explorer", icon: Globe },
      // The existing SEO Keyword Suggester IS Keywords Explorer (kept at its
      // current URL; available to all tiers).
      { id: "keywords_explorer", href: "/visibility/keywords", icon: KeyRound, existing: true },
      { id: "rank_tracker", href: "/rank-tracker", icon: LineChart },
      { id: "gsc_insights", href: "/gsc-insights", icon: SearchCheck },
      { id: "brand_radar", href: "/visibility/brand-radar", icon: RadarIcon },
      // Tracked prompts (AnswerTrackingCard) on the AI Visibility page.
      { id: "custom_prompts", href: "/visibility#prompts", icon: MessageSquareText, existing: true },
    ],
  },
  {
    id: "website_performance",
    items: [
      // The av-visibility sidecar audit surface on /visibility.
      { id: "site_audit", href: "/visibility", icon: ScanSearch, existing: true },
      { id: "web_analytics", href: "/web-analytics", icon: AreaChart },
      { id: "bot_analytics", href: "/bot-analytics", icon: Bot, badge: "new" },
    ],
  },
  {
    id: "content_marketing",
    items: [
      { id: "content_explorer", href: "/content-explorer", icon: Compass },
      { id: "ai_content_helper", href: "/ai-content-helper", icon: PenTool },
      { id: "social_media_manager", href: "/social-media-manager", icon: Share2 },
    ],
  },
  {
    id: "reporting",
    items: [
      { id: "dashboard", href: "/dashboard", icon: LayoutDashboard, existing: true },
      { id: "portfolios", href: "/portfolios", icon: FolderKanban },
      { id: "report_builder", href: "/report-builder", icon: FileBarChart2 },
    ],
  },
  {
    id: "local_seo",
    items: [
      { id: "gbp_monitor", href: "/gbp-monitor", icon: Store, badge: "new" },
    ],
  },
];

/** Strip a #fragment before consulting plan-routing (it matches path prefixes). */
export function navPath(href: string): string {
  return href.split("#")[0];
}

/**
 * Groups filtered to what this plan's route allowlist can reach. Empty groups
 * are dropped. `plan` undefined (no membership resolved yet) shows everything —
 * server-side guards still apply on navigation.
 */
export function visibleProductNav(plan: PlanType | null | undefined): ProductNavGroup[] {
  if (!plan) return PRODUCT_NAV;
  return PRODUCT_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessPath(plan, navPath(item.href))),
  })).filter((group) => group.items.length > 0);
}

/**
 * Active-route test for menu highlighting: hash-insensitive, prefix-aware,
 * longest-match wins so /visibility (Site Audit) does not light up while on
 * /visibility/keywords (Keywords Explorer).
 */
export function isItemActive(pathname: string, href: string): boolean {
  const path = navPath(href);
  const matches = pathname === path || pathname.startsWith(path + "/");
  if (!matches) return false;
  const allPaths = PRODUCT_NAV.flatMap((g) => g.items.map((i) => navPath(i.href)));
  const longest = allPaths
    .filter((p) => pathname === p || pathname.startsWith(p + "/"))
    .reduce((a, b) => (b.length > a.length ? b : a), "");
  return path === longest;
}
