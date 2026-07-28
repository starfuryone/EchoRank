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
  serp_checker: "/visibility/tools/serp-checker",
  backlinks: "/visibility/tools/backlinks",
  lighthouse: "/visibility/tools/lighthouse",
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
  api_access: "/visibility/tools/api-access",
  mcp_server: "/visibility/tools/mcp-server",
};

test("all five groups present with tools", () => {
  assert.deepEqual(
    SEO_TOOL_GROUPS.map((g) => g.id),
    ["search_marketing", "website_performance", "content_marketing", "reporting", "local_seo", "developers"],
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

// ─── Brand Radar / Bot Analytics (real-data pages) ──────────────────────────
import { BRAND_RADAR_COPY, BOT_ANALYTICS_COPY } from "../i18n/dashboard";
import { BOT_CATALOG, BOT_TOKENS } from "../bot-catalog";

test("bot catalog covers the required crawler tokens exactly once", () => {
  const required = [
    "Googlebot", "Google-Extended", "Bingbot", "GPTBot", "OAI-SearchBot",
    "ClaudeBot", "anthropic-ai", "PerplexityBot", "CCBot", "Bytespider",
    "Amazonbot", "Applebot-Extended",
  ];
  assert.deepEqual([...BOT_TOKENS].sort(), [...required].sort());
  assert.equal(new Set(BOT_TOKENS).size, BOT_TOKENS.length);
  for (const b of BOT_CATALOG) {
    assert.ok(["search", "ai_training", "ai_answers"].includes(b.category), b.token);
    assert.ok(b.org.length, b.token);
  }
});

test("bot-analytics copy complete in all locales (per-bot descriptions included)", () => {
  for (const locale of LOCALES) {
    const c = BOT_ANALYTICS_COPY[locale];
    assert.ok(c.postureNote.length && c.emptyTitle.length && c.emptyBody.length);
    assert.ok(c.statusOpen.length && c.statusBlocked.length && c.loadFailed.length);
    for (const cat of ["search", "ai_training", "ai_answers"]) {
      assert.ok(c.categoryLabels[cat]?.length, `${locale} category ${cat}`);
    }
    for (const token of BOT_TOKENS) {
      assert.ok(c.botDesc[token]?.length, `${locale} botDesc ${token}`);
    }
    assert.ok(c.checkedAt("2026-01-01").includes("2026-01-01"));
    assert.ok(c.staleNote("2026-01-01").includes("2026-01-01"));
  }
});

test("brand-radar copy complete in all locales", () => {
  for (const locale of LOCALES) {
    const c = BRAND_RADAR_COPY[locale];
    assert.ok(c.emptyTitle.length && c.emptyBody.length && c.alertsTitle.length);
    assert.ok(c.enginesTitle.length && c.noAlerts.length && c.noRuns.length);
    assert.ok(c.statMentionRate(30).includes("30"));
    assert.ok(c.engineRuns(1).length && c.engineRuns(2).length);
    assert.ok(c.severityLabels.warning?.length && c.severityLabels.critical?.length);
  }
});

test("real-data pages' copy never uses CamelCase branding", () => {
  const json = JSON.stringify({ BRAND_RADAR_COPY, BOT_ANALYTICS_COPY });
  assert.ok(!json.includes("EchoRank"));
});

// ─── SERP Checker (real-data page) ──────────────────────────────────────────
import { SERP_CHECKER_COPY } from "../i18n/dashboard";
import {
  SERP_LOCATION_CODES,
  SERP_LANGUAGE_CODES,
  DEFAULT_LOCATION_CODE,
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_DEVICE,
} from "../serp/options";
import { SERP_CHECKS_PER_MONTH } from "../serp/quota";

test("serp-checker copy complete in all locales (form, states, table, history)", () => {
  for (const locale of LOCALES) {
    const c = SERP_CHECKER_COPY[locale];
    assert.ok(c.formTitle.length && c.formIntro.length && c.submit.length, locale);
    assert.ok(c.keywordLabel.length && c.locationLabel.length && c.languageLabel.length);
    assert.ok(c.deviceLabel.length && c.deviceDesktop.length && c.deviceMobile.length);
    assert.ok(c.checkingTitle.length && c.checkingBody.length && c.cachedNote.length);
    assert.ok(c.failedTitle.length && c.failedBody.length && c.emptyResults.length);
    assert.ok(c.featuresTitle.length && c.noFeatures.length && c.untitled.length);
    assert.ok(c.historyTitle.length && c.historyEmpty.length && c.view.length);
    assert.ok(c.statusQueued.length && c.statusCompleted.length && c.statusFailed.length);
    assert.ok(c.colPosition.length && c.colTitle.length && c.colDomain.length);
    assert.ok(c.colKeyword.length && c.colDevice.length && c.colStatus.length);
    assert.ok(c.colResults.length && c.colWhen.length);
    assert.ok(c.submitFailed.length && c.loadFailed.length);
    assert.ok(c.quotaTitle.length && c.quotaCta.length);

    // Interpolated strings must actually interpolate.
    assert.ok(c.resultsFor("pizza").includes("pizza"), `${locale} resultsFor`);
    assert.ok(c.resultCount(7).includes("7"), `${locale} resultCount`);
    assert.ok(c.usage(3, 25).includes("3") && c.usage(3, 25).includes("25"), `${locale} usage`);
    assert.ok(c.quotaBody(25).includes("25"), `${locale} quotaBody`);
    assert.ok(c.spend("0.0012").includes("0.0012"), `${locale} spend`);

    // Every code the form offers needs a label in every catalog.
    for (const code of SERP_LOCATION_CODES) {
      assert.ok(c.locationLabels[code]?.length, `${locale} location ${code}`);
    }
    for (const code of SERP_LANGUAGE_CODES) {
      assert.ok(c.languageLabels[code]?.length, `${locale} language ${code}`);
    }
  }
});

test("serp-checker copy never uses CamelCase branding or names the data vendor", () => {
  const json = JSON.stringify(SERP_CHECKER_COPY);
  assert.ok(!json.includes("EchoRank"), "found CamelCase 'EchoRank'");
  assert.ok(!/dataforseo/i.test(json), "user-facing copy must not name the upstream vendor");
});

test("serp check defaults match the keywords/overview route", () => {
  // 2124 = Canada. Drifting apart would silently change which SERP users see.
  assert.equal(DEFAULT_LOCATION_CODE, 2124);
  assert.equal(DEFAULT_LANGUAGE_CODE, "en");
  assert.equal(DEFAULT_DEVICE, "desktop");
  // The default location must be offered by the form, or it can't be re-run.
  assert.ok((SERP_LOCATION_CODES as readonly number[]).includes(DEFAULT_LOCATION_CODE));
});

test("every plan has a monthly SERP check limit, ordered by tier", () => {
  for (const plan of ["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY", "ENTERPRISE"] as const) {
    assert.ok(SERP_CHECKS_PER_MONTH[plan] > 0, plan);
  }
  assert.equal(SERP_CHECKS_PER_MONTH.STARTER, 25);
  assert.equal(SERP_CHECKS_PER_MONTH.GROWTH, 200);
  assert.equal(SERP_CHECKS_PER_MONTH.AGENCY, 1000);
  assert.ok(SERP_CHECKS_PER_MONTH.AI_VISIBILITY <= SERP_CHECKS_PER_MONTH.STARTER);
  assert.ok(SERP_CHECKS_PER_MONTH.ENTERPRISE >= SERP_CHECKS_PER_MONTH.AGENCY);
});

// ─── Site Explorer (real-data page) ─────────────────────────────────────────
import { SITE_EXPLORER_COPY } from "../i18n/dashboard";
import {
  SITE_EXPLORER_ANALYSES_PER_MONTH,
  SITE_EXPLORER_CACHE_TTL_MS,
  RANKED_KEYWORDS_LIMIT,
  COMPETITORS_LIMIT,
  DEFAULT_LOCATION_CODE as SE_DEFAULT_LOCATION_CODE,
  DEFAULT_LANGUAGE_CODE as SE_DEFAULT_LANGUAGE_CODE,
} from "../site-explorer/options";
import { SITE_EXPLORER_SECTIONS } from "../site-explorer/types";
import { normalizeDomain, isValidDomain } from "../site-explorer/domain";

test("site-explorer copy complete in all locales (form, four cards, history)", () => {
  for (const locale of LOCALES) {
    const c = SITE_EXPLORER_COPY[locale];
    assert.ok(c.formTitle.length && c.formIntro.length, locale);
    assert.ok(c.domainLabel.length && c.domainPlaceholder.length && c.domainHint.length);
    assert.ok(c.invalidDomain.length && c.analyzing.length);
    assert.ok(c.analyzingTitle.length && c.analyzingBody.length && c.cachedIntro.length);
    assert.ok(c.partialNote.length && c.sectionFailedTitle.length && c.sectionFailedBody.length);

    // One card title per persisted section, so no section can render untitled.
    assert.ok(c.overviewTitle.length && c.keywordsTitle.length);
    assert.ok(c.competitorsTitle.length && c.backlinksTitle.length);

    assert.ok(c.metricTraffic.length && c.metricKeywords.length && c.metricTrafficValue.length);
    assert.ok(c.metricTrafficUnit.length && c.metricKeywordsUnit.length && c.metricTrafficValueUnit.length);
    assert.ok(c.distributionTitle.length && c.noDistribution.length);
    assert.ok(c.metricBacklinks.length && c.metricReferringDomains.length);
    assert.ok(c.metricRank.length && c.metricRankUnit.length && c.metricBroken.length);
    assert.ok(c.metricDofollow.length && c.noDofollowData.length);

    assert.ok(c.sortHint.length && c.emptyKeywords.length && c.emptyCompetitors.length);
    assert.ok(c.colKeyword.length && c.colPosition.length && c.colVolume.length);
    assert.ok(c.colEtv.length && c.colUrl.length && c.colDomain.length);
    assert.ok(c.colIntersections.length && c.colAvgPosition.length);
    assert.ok(c.competitorsSubtitle.length);

    assert.ok(c.historyTitle.length && c.historyEmpty.length && c.view.length);
    assert.ok(c.colStatus.length && c.colCost.length && c.colWhen.length);
    assert.ok(c.statusCompleted.length && c.statusPartial.length);
    assert.ok(c.quotaTitle.length && c.quotaCta.length);
    assert.ok(c.submitFailed.length && c.loadFailed.length);

    // Every rank bucket the overview card renders needs a label.
    for (const key of ["pos1", "pos2_3", "pos4_10", "pos11_20", "pos21_100"] as const) {
      assert.ok(c.distributionLabels[key]?.length, `${locale} bucket ${key}`);
    }

    // Interpolated strings must actually interpolate.
    assert.ok(c.analyzedAgo("3 hours ago").includes("3 hours ago"), `${locale} analyzedAgo`);
    assert.ok(c.reRunIn(21).includes("21"), `${locale} reRunIn`);
    assert.ok(c.reRunIn(1).length, `${locale} reRunIn singular`);
    assert.ok(c.keywordsSubtitle(100, 5000).includes("100"), `${locale} keywordsSubtitle`);
    assert.ok(c.usage(3, 5).includes("3") && c.usage(3, 5).includes("5"), `${locale} usage`);
    assert.ok(c.remaining(1).length && c.remaining(4).includes("4"), `${locale} remaining`);
    assert.ok(c.quotaBody(5).includes("5"), `${locale} quotaBody`);
    assert.ok(c.spend("0.0746").includes("0.0746"), `${locale} spend`);
    assert.ok(c.dofollowRatio("76.1").includes("76.1"), `${locale} dofollowRatio`);
  }
});

test("site-explorer copy never uses CamelCase branding or names the data vendor", () => {
  const json = JSON.stringify(SITE_EXPLORER_COPY);
  assert.ok(!json.includes("EchoRank"), "found CamelCase 'EchoRank'");
  assert.ok(!/dataforseo/i.test(json), "user-facing copy must not name the upstream vendor");
});

test("site explorer defaults match the keywords/overview route", () => {
  // 2124 = Canada. Drifting apart would silently change which market users see.
  assert.equal(SE_DEFAULT_LOCATION_CODE, 2124);
  assert.equal(SE_DEFAULT_LANGUAGE_CODE, "en");
});

test("cost levers are the specified caps: 100 keywords, 20 competitors, 24 h cache", () => {
  // ranked_keywords is billed per row returned, so this limit IS the price.
  assert.equal(RANKED_KEYWORDS_LIMIT, 100);
  assert.equal(COMPETITORS_LIMIT, 20);
  assert.equal(SITE_EXPLORER_CACHE_TTL_MS, 24 * 60 * 60 * 1000);
});

test("every plan has a monthly analysis limit, ordered by tier", () => {
  for (const plan of ["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY", "ENTERPRISE"] as const) {
    assert.ok(SITE_EXPLORER_ANALYSES_PER_MONTH[plan] > 0, plan);
  }
  assert.equal(SITE_EXPLORER_ANALYSES_PER_MONTH.STARTER, 5);
  assert.equal(SITE_EXPLORER_ANALYSES_PER_MONTH.GROWTH, 50);
  assert.equal(SITE_EXPLORER_ANALYSES_PER_MONTH.AGENCY, 200);
  assert.ok(SITE_EXPLORER_ANALYSES_PER_MONTH.AI_VISIBILITY <= SITE_EXPLORER_ANALYSES_PER_MONTH.STARTER);
  assert.ok(SITE_EXPLORER_ANALYSES_PER_MONTH.ENTERPRISE >= SITE_EXPLORER_ANALYSES_PER_MONTH.AGENCY);
});

test("the four sections are the four cards the page renders", () => {
  assert.deepEqual([...SITE_EXPLORER_SECTIONS], [
    "overview",
    "rankedKeywords",
    "competitors",
    "backlinks",
  ]);
});

test("domain normalization collapses the forms users actually paste", () => {
  assert.equal(normalizeDomain("HTTPS://WWW.Example.com/pricing?a=1"), "example.com");
  assert.equal(normalizeDomain("example.com"), "example.com");
  assert.ok(isValidDomain("sub.example.co.uk"));
  assert.ok(!isValidDomain("localhost"));
  assert.ok(!isValidDomain("10.0.0.1"));
});
