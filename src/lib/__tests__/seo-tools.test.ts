// SEO Tools hub config integrity — run with:
//   npm run test:seo-tools   (node --test --import tsx, same harness as test:imports)
//
// Covers what a config-level test can: groups/tools/hrefs/badges, i18n
// completeness across all three DashLocale catalogs, plan-visibility rules,
// and the paid-status predicate. Page rendering and the server-enforced
// upgrade state have no DOM test infrastructure in this repo and are
// verified manually (SSR smoke + curl).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SEO_TOOL_GROUPS,
  SEO_TOOLS_HUB,
  SCAFFOLD_RELATED,
  visibleSeoToolGroups,
  navPath,
} from "../seo-tools";
import { SEO_TOOLS_COPY, dashNav } from "../i18n/dashboard";
import { canAccessPath } from "../plan-routing";
import { isPaidStatus } from "../paid-plan";

const ALL_TOOLS = SEO_TOOL_GROUPS.flatMap((g) => g.tools);
const LOCALES = ["en", "fr", "de-CH"] as const;

const EXPECTED_HREFS: Record<string, string> = {
  site_explorer: "/visibility/tools/site-explorer",
  keywords_explorer: "/visibility/keywords",
  rank_tracker: "/visibility/tools/rank-tracker",
  gsc_insights: "/visibility/tools/gsc-insights",
  brand_radar: "/visibility/tools/brand-radar",
  custom_prompts: "/visibility#prompts",
  site_audit: "/visibility",
  web_analytics: "/visibility/tools/web-analytics",
  bot_analytics: "/visibility/tools/bot-analytics",
  content_explorer: "/visibility/tools/content-explorer",
  ai_content_helper: "/visibility/tools/ai-content-helper",
  social_media_manager: "/visibility/tools/social-media-manager",
  dashboard: "/dashboard",
  portfolios: "/visibility/tools/portfolios",
  report_builder: "/visibility/tools/report-builder",
  gbp_monitor: "/visibility/tools/gbp-monitor",
};

test("all five groups present with tools", () => {
  assert.deepEqual(
    SEO_TOOL_GROUPS.map((g) => g.id),
    ["search_marketing", "website_performance", "content_marketing", "reporting", "local_seo"],
  );
  for (const g of SEO_TOOL_GROUPS) assert.ok(g.tools.length >= 1, g.id);
});

test("tool ids unique, hrefs match the route table, slugs consistent", () => {
  const ids = ALL_TOOLS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, Object.keys(EXPECTED_HREFS).length);
  for (const tool of ALL_TOOLS) {
    assert.equal(tool.href, EXPECTED_HREFS[tool.id], tool.id);
    if (!tool.existing) {
      assert.equal(tool.href, `${SEO_TOOLS_HUB}/${tool.slug}`, tool.id);
    }
  }
});

test('"New" badges exactly on Bot Analytics and GBP Monitor', () => {
  const badged = ALL_TOOLS.filter((i) => i.badge === "new").map((i) => i.id).sort();
  assert.deepEqual(badged, ["bot_analytics", "gbp_monitor"]);
});

test("every locale catalog covers every group, tool, and scaffold", () => {
  for (const locale of LOCALES) {
    const copy = SEO_TOOLS_COPY[locale];
    for (const g of SEO_TOOL_GROUPS) {
      assert.ok(copy.groups[g.id]?.length, `${locale} group ${g.id}`);
    }
    for (const tool of ALL_TOOLS) {
      const it = copy.items[tool.id];
      assert.ok(it?.name?.length, `${locale} name ${tool.id}`);
      assert.ok(it?.description?.length, `${locale} description ${tool.id}`);
    }
    for (const [sid, sc] of Object.entries(copy.scaffolds)) {
      assert.ok(sc.cta.length, `${locale} cta ${sid}`);
    }
    assert.ok(copy.hubTitle.length && copy.hubSubtitle.length);
    assert.ok(copy.upgradeTitle.length && copy.upgradeBody.length && copy.upgradeCta.length);
    assert.ok(copy.newBadge.length && copy.newBadgeSr.length && copy.comingSoon.length);
    for (const sid of Object.keys(SCAFFOLD_RELATED)) {
      assert.ok(
        copy.scaffolds[sid as keyof typeof copy.scaffolds].related?.length,
        `${locale} related label ${sid}`,
      );
    }
  }
});

test("copy never uses CamelCase branding", () => {
  const json = JSON.stringify(SEO_TOOLS_COPY);
  assert.ok(!json.includes("EchoRank"), "found CamelCase 'EchoRank' in hub copy");
});

test("sidebar label + header titles exist for hub and every tool route", () => {
  for (const locale of LOCALES) {
    assert.ok(dashNav[locale][SEO_TOOLS_HUB]?.length, `${locale} hub label`);
    for (const tool of ALL_TOOLS) {
      const path = navPath(tool.href);
      const exact = dashNav[locale][path];
      const prefix = Object.keys(dashNav[locale]).some(
        (k) => path === k || path.startsWith(k + "/"),
      );
      assert.ok(exact || prefix, `${locale} title for ${path}`);
    }
  }
});

test("AI_VISIBILITY sees every card except Dashboard (outside its allowlist)", () => {
  const groups = visibleSeoToolGroups("AI_VISIBILITY");
  const ids = groups.flatMap((g) => g.tools.map((i) => i.id));
  assert.equal(ids.length, ALL_TOOLS.length - 1);
  assert.ok(!ids.includes("dashboard"));
  assert.ok(canAccessPath("AI_VISIBILITY", "/visibility/tools/site-explorer"));
  assert.ok(!canAccessPath("AI_VISIBILITY", "/dashboard"));
});

test("unrestricted tiers see every group and card", () => {
  for (const plan of ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"] as const) {
    const groups = visibleSeoToolGroups(plan);
    assert.equal(groups.flatMap((g) => g.tools).length, ALL_TOOLS.length, plan);
  }
});

test("scaffold related links each tier can't reach are filterable via canAccessPath", () => {
  // The scaffold component filters these at render time; assert the data
  // actually contains cases on both sides for AI_VISIBILITY.
  const reachable = Object.values(SCAFFOLD_RELATED).filter((href) =>
    canAccessPath("AI_VISIBILITY", navPath(href!)),
  );
  const blocked = Object.values(SCAFFOLD_RELATED).filter(
    (href) => !canAccessPath("AI_VISIBILITY", navPath(href!)),
  );
  assert.ok(reachable.length > 0 && blocked.length > 0);
});

test("paid predicate: ACTIVE only", () => {
  assert.ok(isPaidStatus("ACTIVE"));
  assert.ok(!isPaidStatus("TRIALING"));
  assert.ok(!isPaidStatus("PAST_DUE"));
  assert.ok(!isPaidStatus("CANCELED"));
  assert.ok(!isPaidStatus(null));
  assert.ok(!isPaidStatus(undefined));
});
