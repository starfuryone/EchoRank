// Product navigation config integrity — run with:
//   npm run test:nav   (node --test --import tsx, same harness as test:imports)
//
// Covers what a config-level test can: groups/items/hrefs/badges, i18n
// completeness across all three DashLocale catalogs, plan-visibility rules,
// and active-route resolution. Menu interaction (open/close/keyboard) has no
// DOM test infrastructure in this repo and is verified manually.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCT_NAV,
  SCAFFOLD_RELATED,
  visibleProductNav,
  isItemActive,
  navPath,
} from "../product-nav";
import { PRODUCT_NAV_COPY, dashNav } from "../i18n/dashboard";
import { canAccessPath } from "../plan-routing";

const ALL_ITEMS = PRODUCT_NAV.flatMap((g) => g.items);
const LOCALES = ["en", "fr", "de-CH"] as const;

const EXPECTED_HREFS: Record<string, string> = {
  site_explorer: "/site-explorer",
  keywords_explorer: "/visibility/keywords",
  rank_tracker: "/rank-tracker",
  gsc_insights: "/gsc-insights",
  brand_radar: "/visibility/brand-radar",
  custom_prompts: "/visibility#prompts",
  site_audit: "/visibility",
  web_analytics: "/web-analytics",
  bot_analytics: "/bot-analytics",
  content_explorer: "/content-explorer",
  ai_content_helper: "/ai-content-helper",
  social_media_manager: "/social-media-manager",
  dashboard: "/dashboard",
  portfolios: "/portfolios",
  report_builder: "/report-builder",
  gbp_monitor: "/gbp-monitor",
};

test("all five groups present with items", () => {
  assert.deepEqual(
    PRODUCT_NAV.map((g) => g.id),
    ["search_marketing", "website_performance", "content_marketing", "reporting", "local_seo"],
  );
  for (const g of PRODUCT_NAV) assert.ok(g.items.length >= 1, g.id);
});

test("item ids are unique and hrefs match the route table", () => {
  const ids = ALL_ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, Object.keys(EXPECTED_HREFS).length);
  for (const item of ALL_ITEMS) {
    assert.equal(item.href, EXPECTED_HREFS[item.id], item.id);
  }
});

test('"New" badges exactly on Bot Analytics and GBP Monitor', () => {
  const badged = ALL_ITEMS.filter((i) => i.badge === "new").map((i) => i.id).sort();
  assert.deepEqual(badged, ["bot_analytics", "gbp_monitor"]);
});

test("every locale catalog covers every group, item, and scaffold", () => {
  for (const locale of LOCALES) {
    const copy = PRODUCT_NAV_COPY[locale];
    for (const g of PRODUCT_NAV) {
      assert.ok(copy.groups[g.id]?.length, `${locale} group ${g.id}`);
    }
    for (const item of ALL_ITEMS) {
      const it = copy.items[item.id];
      assert.ok(it?.name?.length, `${locale} name ${item.id}`);
      assert.ok(it?.description?.length, `${locale} description ${item.id}`);
    }
    for (const [sid, sc] of Object.entries(copy.scaffolds)) {
      assert.ok(sc.cta.length, `${locale} cta ${sid}`);
    }
    assert.ok(copy.menuLabel.length && copy.newBadge.length && copy.newBadgeSr.length);
    // scaffold `related` labels must exist exactly where a related href exists
    for (const sid of Object.keys(SCAFFOLD_RELATED)) {
      assert.ok(
        copy.scaffolds[sid as keyof typeof copy.scaffolds].related?.length,
        `${locale} related label ${sid}`,
      );
    }
  }
});

test("copy never uses CamelCase branding", () => {
  const json = JSON.stringify(PRODUCT_NAV_COPY);
  assert.ok(!json.includes("EchoRank"), "found CamelCase 'EchoRank' in nav copy");
});

test("header titles exist for every product route in all locales", () => {
  for (const locale of LOCALES) {
    for (const item of ALL_ITEMS) {
      const path = navPath(item.href);
      const exact = dashNav[locale][path];
      const prefix = Object.keys(dashNav[locale]).some((k) => path.startsWith(k + "/") || path === k);
      assert.ok(exact || prefix, `${locale} title for ${path}`);
    }
  }
});

test("AI_VISIBILITY tier sees exactly its /visibility-scoped items", () => {
  const groups = visibleProductNav("AI_VISIBILITY");
  const ids = groups.flatMap((g) => g.items.map((i) => i.id)).sort();
  assert.deepEqual(ids, ["brand_radar", "custom_prompts", "keywords_explorer", "site_audit"]);
  // and the underlying allowlist agrees for both scoped and unscoped routes
  assert.ok(canAccessPath("AI_VISIBILITY", "/visibility/brand-radar"));
  assert.ok(!canAccessPath("AI_VISIBILITY", "/site-explorer"));
});

test("unrestricted tiers see every group and item", () => {
  for (const plan of ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"] as const) {
    const groups = visibleProductNav(plan);
    assert.equal(groups.flatMap((g) => g.items).length, ALL_ITEMS.length, plan);
  }
});

test("active-route resolution: longest match wins, hash-insensitive", () => {
  assert.ok(isItemActive("/visibility/keywords", "/visibility/keywords"));
  assert.ok(!isItemActive("/visibility/keywords", "/visibility"));
  assert.ok(isItemActive("/visibility", "/visibility"));
  assert.ok(isItemActive("/visibility", "/visibility#prompts"));
  assert.ok(isItemActive("/bot-analytics", "/bot-analytics"));
  assert.ok(!isItemActive("/bot-analytics", "/dashboard"));
});
