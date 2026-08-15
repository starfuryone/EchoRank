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
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SEO_TOOL_GROUPS,
  SEO_TOOLS_HUB,
  SCAFFOLD_RELATED,
  CLASSIC_SEO_TOOL_IDS,
  visibleSeoToolGroups,
  navPath,
} from "../seo-tools";
import { SEO_TOOLS_COPY, dashNav } from "../i18n/dashboard";
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
  custom_prompts: "/visibility/tools/custom-prompts",
  ai_lens: "/visibility/tools/ai-lens",
  site_audit: "/visibility/tools/site-audit",
  site_crawler: "/visibility/tools/site-crawler",
  web_analytics: "/visibility/tools/web-analytics",
  bot_analytics: "/visibility/tools/bot-analytics",
  ai_attribution: "/visibility/tools/ai-attribution",
  share_of_voice: "/visibility/tools/share-of-voice",
  citation_finder: "/visibility/tools/citation-finder",
  citation_opportunities: "/visibility/tools/citation-opportunities",
  opportunity_scanner: "/visibility/tools/opportunity-scanner",
  audit_funnels: "/visibility/tools/funnels",
  ai_revenue: "/visibility/tools/revenue",
  content_explorer: "/visibility/tools/content-explorer",
  ai_content_helper: "/visibility/tools/ai-content-helper",
  historical: "/visibility/tools/historical",
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

test('"New" badges exactly on AI Attribution, AI Lens, AI Revenue, Audit Funnels, Bot Analytics, Citation Finder, Citation Opportunities, GBP Monitor, Historical, Opportunity Scanner and Share of Voice', () => {
  const badged = ALL_TOOLS.filter((i) => i.badge === "new").map((i) => i.id).sort();
  assert.deepEqual(badged, [
    "ai_attribution",
    "ai_lens",
    "ai_revenue",
    "audit_funnels",
    "bot_analytics",
    "citation_finder",
    "citation_opportunities",
    "gbp_monitor",
    "historical",
    "opportunity_scanner",
    "share_of_voice",
  ]);
});

// The public homepage badges every tool LIVE or COMING SOON from the
// `comingSoon` flag. Marketing therefore asserts something about the product to
// logged-out visitors, and the two ways to get it wrong are both bad: promising a
// placeholder, or telling the world a shipped, paid feature is not available yet.
// (The second nearly happened — a brief described SERP Checker, Backlinks,
// Lighthouse and Rank Tracker as scaffolds months after all four shipped.)
//
// So the flag is checked against the route files themselves rather than trusted.
// A page is a placeholder iff it renders FeatureScaffold.
test("comingSoon flags match the actual route files", () => {
  const appDir = join(process.cwd(), "src", "app", "(dashboard)");
  const wrong: string[] = [];

  for (const tool of ALL_TOOLS) {
    const page = join(appDir, tool.href, "page.tsx");
    assert.ok(existsSync(page), `${tool.id}: no route at ${tool.href}`);
    const isScaffold = readFileSync(page, "utf8").includes(
      "@/components/scaffold/feature-scaffold",
    );
    const flagged = tool.comingSoon === true;
    if (isScaffold !== flagged) {
      wrong.push(
        `${tool.id}: route is ${isScaffold ? "a scaffold" : "real"} but comingSoon is ${flagged}`,
      );
    }
  }

  assert.deepEqual(wrong, [], wrong.join("\n"));
});

test("the live/coming-soon split is what the marketing copy claims", () => {
  // The homepage prints a tool count. If this number moves, the copy in
  // src/lib/i18n/content.ts (toolsSection.count) has to move with it.
  const live = ALL_TOOLS.filter((t) => !t.comingSoon);
  const soon = ALL_TOOLS.filter((t) => t.comingSoon);
  assert.equal(ALL_TOOLS.length, 31, "tool count changed");
  assert.equal(live.length, 27, "live tool count changed — update the homepage copy");
  assert.equal(soon.length, 4);
  assert.deepEqual(
    soon.map((t) => t.id).sort(),
    ["gbp_monitor", "portfolios", "report_builder", "social_media_manager"],
  );
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

test("every tier sees every group and card — no tier is route-confined", () => {
  for (const plan of ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"] as const) {
    const groups = visibleSeoToolGroups(plan);
    assert.equal(groups.flatMap((g) => g.tools).length, ALL_TOOLS.length, plan);
  }
});

test("every scaffold related link points at a real tool route", () => {
  // These used to be filtered per-tier by a route allowlist. No tier is
  // confined now, so the only remaining invariant is that they are well-formed.
  for (const href of Object.values(SCAFFOLD_RELATED)) {
    assert.ok(href!.startsWith("/"), href);
    assert.equal(navPath(href!), href!.split("#")[0]);
  }
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
    "Amazonbot", "Applebot-Extended", "meta-externalagent",
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
    // Both sections plus the domain form must be translated — the tool no
    // longer gates on /visibility, so its own copy is the only copy there is.
    assert.ok(c.introNote.length && c.accessTitle.length && c.logsTitle.length);
    assert.ok(c.domainTitle.length && c.domainIntro.length && c.domainInvalid.length);
    assert.ok(c.loadFailed.length && c.piiNote.length && c.upsellTitle.length);
    for (const cat of ["search", "ai_training", "ai_answers"]) {
      assert.ok(c.categoryLabels[cat]?.length, `${locale} category ${cat}`);
    }
    // Every verdict the API can return needs a label AND an explanation; a
    // missing one renders as an empty chip that reads like "no problem".
    for (const v of ["allowed", "blocked_robots", "blocked_http", "challenged", "unknown"]) {
      assert.ok(c.verdictLabels[v]?.length, `${locale} verdictLabel ${v}`);
      assert.ok(c.verdictHelp[v]?.length, `${locale} verdictHelp ${v}`);
    }
    for (const s of ["PENDING", "PROCESSING", "COMPLETE", "FAILED"]) {
      assert.ok(c.statusLabels[s]?.length, `${locale} statusLabel ${s}`);
    }
    for (const token of BOT_TOKENS) {
      assert.ok(c.botDesc[token]?.length, `${locale} botDesc ${token}`);
    }
    assert.ok(c.checkedAt("2026-01-01").includes("2026-01-01"));
    assert.ok(c.staleNote("2026-01-01").includes("2026-01-01"));
    assert.ok(c.checksUsed(1, 10).includes("10"));
    assert.ok(c.uploadsUsed(1, 5).includes("5"));
    assert.ok(c.aiVisitSummary("GPTBot", 47).includes("47"));
    assert.ok(c.periodLabel("a", "b").includes("a"));
    assert.ok(c.linesLabel(10, 2).includes("10"));
    assert.ok(c.problemSummary(2).includes("2"));
    assert.ok(c.probeStatus(403).includes("403"));
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

// ─── Rank Tracker (real-data page) ──────────────────────────────────────────
import { RANK_TRACKER_COPY } from "../i18n/dashboard";
import {
  RANK_TRACKED_KEYWORDS,
  RANK_CHECKS_PER_MONTH,
  RANK_ALLOWED_FREQUENCIES,
  RANK_FREQUENCIES,
  RANK_DEVICES,
  COST_PER_KEYWORD_USD,
  SCHEDULE_HOUR_UTC,
  planCanTrack,
  planAllowsFrequency,
} from "../rank-tracker/options";

test("rank-tracker copy complete in all locales (list, detail, modal, locked)", () => {
  for (const locale of LOCALES) {
    const c = RANK_TRACKER_COPY[locale];
    assert.ok(c.listTitle.length && c.listIntro.length && c.newProject.length, locale);
    assert.ok(c.emptyTitle.length && c.emptyBody.length);
    assert.ok(c.colProject.length && c.colDomain.length && c.colKeywords.length);
    assert.ok(c.colAvgPosition.length && c.colFrequency.length && c.colLastRun.length);
    assert.ok(c.neverRun.length && c.open.length);

    // The STARTER/AI_VISIBILITY locked card has no other copy source.
    assert.ok(c.lockedTitle.length && c.lockedBody.length && c.lockedCta.length);

    assert.ok(c.backToList.length && c.runNow.length && c.running.length);
    assert.ok(c.runQueued.length && c.editProject.length && c.deleteProject.length);
    assert.ok(c.deleteConfirm.length && c.overCapTitle.length && c.overCapBody.length);
    assert.ok(c.chartTitle.length && c.chartEmpty.length && c.chartAxisNote.length);

    assert.ok(c.keywordsTitle.length && c.colKeyword.length && c.colPosition.length);
    assert.ok(c.colChange.length && c.col30d.length && c.colBestUrl.length && c.colTrend.length);
    assert.ok(c.notRanked.length && c.noData.length && c.unchanged.length);
    assert.ok(c.keywordsEmpty.length);

    assert.ok(c.createTitle.length && c.editTitle.length && c.save.length && c.cancel.length);
    assert.ok(c.nameLabel.length && c.nameHint.length && c.domainLabel.length);
    assert.ok(c.invalidDomain.length && c.keywordsLabel.length && c.keywordsHint.length);
    assert.ok(c.locationLabel.length && c.languageLabel.length && c.deviceLabel.length);
    assert.ok(c.deviceDesktop.length && c.deviceMobile.length && c.frequencyLabel.length);
    assert.ok(c.freqDaily.length && c.freqWeekly.length && c.frequencyLockedNote.length);

    assert.ok(c.quotaTitle.length && c.quotaCta.length && c.capTitle.length);
    assert.ok(c.saveFailed.length && c.runFailed.length && c.loadFailed.length);

    // Interpolated strings must actually interpolate.
    assert.ok(c.weeklyAnchor("Tuesday").includes("Tuesday"), `${locale} weeklyAnchor`);
    assert.ok(c.pendingNote(1).length && c.pendingNote(4).includes("4"), `${locale} pendingNote`);
    assert.ok(c.keywordCounter(3, 50).includes("3") && c.keywordCounter(3, 50).includes("50"));
    assert.ok(c.duplicatesIgnored(1).length && c.duplicatesIgnored(2).includes("2"));
    assert.ok(c.overLimit(60, 50).includes("60") && c.overLimit(60, 50).includes("50"));
    assert.ok(c.usageKeywords(10, 50).includes("10") && c.usageKeywords(10, 50).includes("50"));
    assert.ok(c.usageChecks(4, 400).includes("400"), `${locale} usageChecks`);
    assert.ok(c.quotaBody(400).includes("400"), `${locale} quotaBody`);
    assert.ok(c.capBody(50).includes("50"), `${locale} capBody`);
    assert.ok(c.improvedBy(3).includes("3") && c.droppedBy(3).includes("3"));
    assert.ok(c.spend("0.0180").includes("0.0180"), `${locale} spend`);
  }
});

test("rank-tracker copy never uses CamelCase branding or names the data vendor", () => {
  const json = JSON.stringify(RANK_TRACKER_COPY);
  assert.ok(!json.includes("EchoRank"), "found CamelCase 'EchoRank'");
  assert.ok(!/dataforseo/i.test(json), "user-facing copy must not name the upstream vendor");
});

test("rank-tracker plan caps match the pricing sheet", () => {
  // STARTER is locked by product decision — it sees the upsell card, not a form.
  assert.equal(RANK_TRACKED_KEYWORDS.STARTER, 0);
  assert.equal(RANK_TRACKED_KEYWORDS.GROWTH, 50);
  assert.equal(RANK_TRACKED_KEYWORDS.AGENCY, 250);
  assert.ok(RANK_TRACKED_KEYWORDS.ENTERPRISE >= RANK_TRACKED_KEYWORDS.AGENCY);

  assert.ok(!planCanTrack("STARTER"));
  assert.ok(planCanTrack("GROWTH"));
  assert.ok(planCanTrack("AGENCY"));
});

test("daily tracking is an AGENCY-and-up differentiator", () => {
  assert.deepEqual([...RANK_ALLOWED_FREQUENCIES.GROWTH], ["weekly"]);
  assert.ok(!planAllowsFrequency("GROWTH", "daily"));
  assert.ok(planAllowsFrequency("AGENCY", "daily"));
  assert.ok(planAllowsFrequency("AGENCY", "weekly"));
  // A locked plan may choose nothing at all.
  assert.deepEqual([...RANK_ALLOWED_FREQUENCIES.STARTER], []);
});

test("monthly check allowance covers each plan's scheduled load", () => {
  // GROWTH: 50 kw weekly ~= 220 checks/mo. AGENCY: 250 kw daily ~= 7750/mo.
  assert.ok(RANK_CHECKS_PER_MONTH.GROWTH >= 50 * 4.5, "GROWTH cannot complete its own schedule");
  assert.ok(
    RANK_CHECKS_PER_MONTH.AGENCY >= 250 * 31,
    "AGENCY cannot complete its own daily schedule",
  );
  assert.equal(RANK_CHECKS_PER_MONTH.STARTER, 0);
});

test("worst-case monthly spend matches the depth-100 cost model", () => {
  // Depth 100 costs $0.006/keyword (depth 10 would be $0.0006 but reports
  // nothing below position 10). AGENCY 250 kw daily = 250 * 31 * $0.006.
  assert.equal(COST_PER_KEYWORD_USD, 0.006);
  const agencyScheduled = RANK_TRACKED_KEYWORDS.AGENCY * 31 * COST_PER_KEYWORD_USD;
  assert.ok(
    agencyScheduled > 46 && agencyScheduled < 47,
    `AGENCY scheduled spend ${agencyScheduled}`,
  );
  const growthScheduled = RANK_TRACKED_KEYWORDS.GROWTH * 4.5 * COST_PER_KEYWORD_USD;
  assert.ok(growthScheduled < 2, `GROWTH scheduled spend ${growthScheduled}`);

  // The hard ceiling the Redis counter enforces, manual runs included. This is
  // the number that actually bounds a tenant's bill.
  const agencyCeiling = RANK_CHECKS_PER_MONTH.AGENCY * COST_PER_KEYWORD_USD;
  assert.ok(agencyCeiling <= 54, `AGENCY ceiling ${agencyCeiling}`);
  // The ceiling must clear the schedule, or daily projects stall mid-month.
  assert.ok(agencyCeiling >= agencyScheduled, "AGENCY ceiling below its own schedule");
});

test("rank-tracker enums are what the schema and UI agree on", () => {
  assert.deepEqual([...RANK_FREQUENCIES], ["daily", "weekly"]);
  assert.deepEqual([...RANK_DEVICES], ["desktop", "mobile"]);
  assert.ok(SCHEDULE_HOUR_UTC >= 0 && SCHEDULE_HOUR_UTC <= 23);
  assert.equal(COST_PER_KEYWORD_USD, 0.006);
});

// ─── Rank Tracker help modal ────────────────────────────────────────────────
import { RANK_TRACKER_HELP_COPY } from "../i18n/dashboard";

test("rank-tracker help copy complete in all locales", () => {
  for (const locale of LOCALES) {
    const c = RANK_TRACKER_HELP_COPY[locale];
    assert.ok(c.button.length && c.buttonAria.length, `${locale} trigger`);
    assert.ok(c.title.length && c.close.length, `${locale} chrome`);
    for (const n of [1, 2, 3, 4] as const) {
      assert.ok(c[`step${n}Title`].length, `${locale} step${n} title`);
    }
    assert.ok(c.step1Body.length && c.step2Body.length && c.step3Body.length);
    assert.ok(c.findKeywordsIntro.length && c.findKeywordsLink.length);

    // Four tips, all non-empty — the modal renders the array as-is.
    assert.equal(c.tips.length, 3, `${locale} tips count`);
    for (const tip of c.tips) assert.ok(tip.length, `${locale} tip`);

    // Plan numbers are injected, never hardcoded, so they cannot drift from
    // the config that enforces them.
    const plans = c.step1Plans(RANK_TRACKED_KEYWORDS.GROWTH, RANK_TRACKED_KEYWORDS.AGENCY);
    assert.ok(plans.includes(String(RANK_TRACKED_KEYWORDS.GROWTH)), `${locale} growth cap`);
    assert.ok(plans.includes(String(RANK_TRACKED_KEYWORDS.AGENCY)), `${locale} agency cap`);
  }
});

test("help copy states the plan gating the code actually enforces", () => {
  // Guards against the help text and RANK_ALLOWED_FREQUENCIES drifting apart:
  // the copy claims weekly-only on Growth and daily on Agency.
  assert.ok(!planAllowsFrequency("GROWTH", "daily"), "copy says Growth is weekly-only");
  assert.ok(planAllowsFrequency("AGENCY", "daily"), "copy says Agency can go daily");
  assert.ok(!planCanTrack("STARTER"), "copy says Starter has no Rank Tracker");
});

test("rank-tracker help copy never uses CamelCase branding or names the vendor", () => {
  const json = JSON.stringify(RANK_TRACKER_HELP_COPY);
  assert.ok(!json.includes("EchoRank"), "found CamelCase 'EchoRank'");
  assert.ok(!/dataforseo/i.test(json), "user-facing copy must not name the upstream vendor");
});

// ─── Backlinks (real-data page) ─────────────────────────────────────────────
import { BACKLINKS_TOOL_COPY, BACKLINKS_HELP_COPY } from "../i18n/dashboard";
import {
  BACKLINKS_ANALYSES_PER_MONTH,
  BACKLINKS_CACHE_TTL_MS,
  REFERRING_DOMAINS_LIMIT,
  ANCHORS_LIMIT,
  DOMAIN_PAGES_LIMIT,
  HISTORY_MONTHS,
  planCanAnalyzeBacklinks,
} from "../backlinks/options";
import { BACKLINKS_SECTIONS } from "../backlinks/types";
import { BACKLINKS_MODES, normalizeTarget, includeSubdomainsFor } from "../backlinks/target";

test("backlinks copy complete in all locales (form, five sections, history)", () => {
  for (const locale of LOCALES) {
    const c = BACKLINKS_TOOL_COPY[locale];
    assert.ok(c.formTitle.length && c.formIntro.length && c.analyze.length, locale);
    assert.ok(c.targetLabel.length && c.invalidDomain.length && c.invalidUrl.length);
    assert.ok(c.modeLabel.length && c.modeDomain.length && c.modeExactUrl.length);
    assert.ok(c.modeDomainHint.length && c.modeExactUrlHint.length);
    assert.ok(c.analyzingTitle.length && c.analyzingBody.length && c.cachedIntro.length);
    assert.ok(c.partialNote.length && c.sectionFailedTitle.length && c.sectionFailedBody.length);
    assert.ok(c.lockedTitle.length && c.lockedBody.length && c.lockedCta.length);

    // One title per persisted section, so no section can render untitled.
    assert.ok(c.summaryTitle.length && c.historyTitle.length && c.domainsTitle.length);
    assert.ok(c.anchorsTitle.length && c.pagesTitle.length);

    assert.ok(c.metricBacklinks.length && c.metricReferringDomains.length);
    assert.ok(c.metricRank.length && c.metricBroken.length && c.metricDofollow.length);
    assert.ok(c.metricSpam.length && c.metricSpamUnit.length && c.noDofollowData.length);
    assert.ok(c.legendBacklinks.length && c.legendReferringDomains.length && c.historyEmpty.length);
    assert.ok(c.colDomain.length && c.colRank.length && c.colBacklinks.length && c.colSpam.length);
    assert.ok(c.colFirstSeen.length && c.colAnchor.length && c.colRefDomains.length);
    assert.ok(c.colPage.length && c.colStatus.length && c.noAnchorText.length);
    assert.ok(c.domainsEmpty.length && c.anchorsEmpty.length && c.pagesEmpty.length);
    assert.ok(c.recentTitle.length && c.recentEmpty.length && c.view.length);
    assert.ok(c.statusCompleted.length && c.statusPartial.length && c.lostLabel.length);
    assert.ok(c.quotaTitle.length && c.quotaCta.length);
    assert.ok(c.submitFailed.length && c.loadFailed.length);

    // Interpolated strings must actually interpolate.
    assert.ok(c.analyzedAgo("3 hours ago").includes("3 hours ago"), `${locale} analyzedAgo`);
    assert.ok(c.reRunIn(21).includes("21") && c.reRunIn(1).length, `${locale} reRunIn`);
    assert.ok(c.domainsSubtitle(50, 21046).includes("50"), `${locale} domainsSubtitle`);
    assert.ok(c.anchorsSubtitle(30, 67118).includes("30"), `${locale} anchorsSubtitle`);
    assert.ok(c.pagesSubtitle(20, 1457807).includes("20"), `${locale} pagesSubtitle`);
    assert.ok(c.usage(3, 25).includes("3") && c.usage(3, 25).includes("25"), `${locale} usage`);
    assert.ok(c.remaining(1).length && c.remaining(4).includes("4"), `${locale} remaining`);
    assert.ok(c.quotaBody(25).includes("25"), `${locale} quotaBody`);
    assert.ok(c.dofollowRatio("76.1").includes("76.1"), `${locale} dofollowRatio`);
    assert.ok(c.spend("0.1241").includes("0.1241"), `${locale} spend`);
  }
});

test("backlinks help copy complete in all locales", () => {
  for (const locale of LOCALES) {
    const c = BACKLINKS_HELP_COPY[locale];
    assert.ok(c.button.length && c.buttonAria.length && c.title.length && c.close.length);
    assert.ok(c.intro.length, `${locale} intro`);
    // One plain-language line per concept the modal promises to explain.
    for (const key of ["backlinks", "dofollow", "anchors", "history", "freshness"] as const) {
      assert.ok(c[`${key}Title`].length, `${locale} ${key} title`);
      assert.ok(c[`${key}Body`].length > 40, `${locale} ${key} body`);
    }
  }
});

test("backlinks copy never uses CamelCase branding or names the data vendor", () => {
  const json = JSON.stringify({ BACKLINKS_TOOL_COPY, BACKLINKS_HELP_COPY });
  assert.ok(!json.includes("EchoRank"), "found CamelCase 'EchoRank'");
  assert.ok(!/dataforseo/i.test(json), "user-facing copy must not name the upstream vendor");
});

test("backlinks plan caps match the pricing sheet", () => {
  // STARTER is locked by product decision — it sees the upsell card.
  assert.equal(BACKLINKS_ANALYSES_PER_MONTH.STARTER, 0);
  assert.equal(BACKLINKS_ANALYSES_PER_MONTH.AI_VISIBILITY, 0);
  assert.equal(BACKLINKS_ANALYSES_PER_MONTH.GROWTH, 25);
  assert.equal(BACKLINKS_ANALYSES_PER_MONTH.AGENCY, 100);
  assert.ok(BACKLINKS_ANALYSES_PER_MONTH.ENTERPRISE >= BACKLINKS_ANALYSES_PER_MONTH.AGENCY);

  assert.ok(!planCanAnalyzeBacklinks("STARTER"));
  assert.ok(!planCanAnalyzeBacklinks("AI_VISIBILITY"));
  assert.ok(planCanAnalyzeBacklinks("GROWTH"));
  assert.ok(planCanAnalyzeBacklinks("AGENCY"));
});

test("backlinks row limits are the cost levers, and are pinned", () => {
  // This API bills per request AND per row, so these four numbers ARE the
  // price of an analysis (measured $0.124068/run on 2026-07-29).
  assert.equal(REFERRING_DOMAINS_LIMIT, 50);
  assert.equal(ANCHORS_LIMIT, 30);
  assert.equal(DOMAIN_PAGES_LIMIT, 20);
  assert.equal(HISTORY_MONTHS, 12);
  assert.equal(BACKLINKS_CACHE_TTL_MS, 24 * 60 * 60 * 1000);
});

test("worst-case monthly backlinks spend, at the measured per-run cost", () => {
  const COST_PER_RUN = 0.124068; // measured live, 2026-07-29
  const growth = BACKLINKS_ANALYSES_PER_MONTH.GROWTH * COST_PER_RUN;
  const agency = BACKLINKS_ANALYSES_PER_MONTH.AGENCY * COST_PER_RUN;
  assert.ok(growth < 3.2, `GROWTH worst case ${growth}`);
  assert.ok(agency < 12.5, `AGENCY worst case ${agency}`);
});

test("the five sections are the five cards the page renders", () => {
  assert.deepEqual([...BACKLINKS_SECTIONS], [
    "summary",
    "history",
    "referringDomains",
    "anchors",
    "pages",
  ]);
});

test("the two target modes never share a cache key", () => {
  assert.deepEqual([...BACKLINKS_MODES], ["domain", "exact_url"]);
  assert.notEqual(
    normalizeTarget("example.com", "domain"),
    normalizeTarget("example.com", "exact_url"),
  );
  assert.equal(normalizeTarget("https://WWW.Example.com/a?b=1#top", "domain"), "example.com");
  assert.equal(
    normalizeTarget("https://WWW.Example.com/a?b=1#top", "exact_url"),
    "https://www.example.com/a?b=1",
  );
  // include_subdomains only means something for domain targets.
  assert.ok(includeSubdomainsFor("domain"));
  assert.ok(!includeSubdomainsFor("exact_url"));
});

// ─── Lighthouse (real-data page) ────────────────────────────────────────────
import { LIGHTHOUSE_TOOL_COPY, LIGHTHOUSE_HELP_COPY } from "../i18n/dashboard";
import {
  LIGHTHOUSE_STRATEGIES,
  DEFAULT_STRATEGY,
  LIGHTHOUSE_CACHE_TTL_MS,
  AUDITS_PER_HOUR,
  AUDIT_WINDOW_MS,
  MAX_OPPORTUNITIES,
  METRIC_THRESHOLDS,
  scoreBand,
} from "../lighthouse/options";
import { LIGHTHOUSE_CATEGORIES, LAB_METRICS } from "../lighthouse/types";

test("lighthouse copy complete in all locales", () => {
  for (const locale of LOCALES) {
    const c = LIGHTHOUSE_TOOL_COPY[locale];
    assert.ok(c.formTitle.length && c.formIntro.length && c.run.length, locale);
    assert.ok(c.urlLabel.length && c.invalidUrl.length && c.notPublicUrl.length);
    assert.ok(c.strategyLabel.length && c.strategyMobile.length && c.strategyDesktop.length);
    assert.ok(c.strategyHint.length && c.runningTitle.length && c.runningBody.length);
    assert.ok(c.cachedIntro.length);

    assert.ok(c.scoresTitle.length && c.scoreNotAvailable.length);
    assert.ok(c.scorePerformance.length && c.scoreAccessibility.length);
    assert.ok(c.scoreBestPractices.length && c.scoreSeo.length);
    assert.ok(c.bandGood.length && c.bandAverage.length && c.bandPoor.length);

    assert.ok(c.vitalsTitle.length && c.fieldDataTitle.length && c.fieldDataIntro.length);
    assert.ok(c.fieldDataOriginNote.length && c.labDataTitle.length && c.labDataIntro.length);
    // The no-field-data state is the COMMON case; it must never be missing.
    assert.ok(c.noFieldDataTitle.length && c.noFieldDataBody.length, `${locale} no-field-data`);

    assert.ok(c.opportunitiesTitle.length && c.opportunitiesIntro.length);
    assert.ok(c.opportunitiesEmpty.length);
    assert.ok(c.recentTitle.length && c.recentEmpty.length && c.view.length);
    assert.ok(c.colUrl.length && c.colDevice.length && c.colWhen.length);
    assert.ok(c.limitTitle.length && c.runFailed.length && c.loadFailed.length);

    // Interpolated strings must actually interpolate.
    assert.ok(c.auditedAgo("3 hours ago").includes("3 hours ago"), `${locale} auditedAgo`);
    assert.ok(c.reRunIn(4).includes("4") && c.reRunIn(1).length, `${locale} reRunIn`);
    assert.ok(c.usage(3, 20).includes("3") && c.usage(3, 20).includes("20"), `${locale} usage`);
    assert.ok(c.limitBody(20).includes("20"), `${locale} limitBody`);
    assert.ok(c.savingsMs(1500).includes("1.5"), `${locale} savingsMs`);
    assert.ok(c.savingsBytes("312").includes("312"), `${locale} savingsBytes`);
    assert.ok(c.versionNote("12.2.1").includes("12.2.1"), `${locale} versionNote`);
    assert.ok(c.finalUrlNote("https://x.test/").includes("https://x.test/"));
  }
});

test("lighthouse help copy complete in all locales", () => {
  for (const locale of LOCALES) {
    const c = LIGHTHOUSE_HELP_COPY[locale];
    assert.ok(c.button.length && c.buttonAria.length && c.title.length && c.close.length);
    assert.ok(c.intro.length, `${locale} intro`);
    for (const key of ["labField", "scores", "devices", "fluctuation"] as const) {
      assert.ok(c[`${key}Title`].length, `${locale} ${key} title`);
      assert.ok(c[`${key}Body`].length > 40, `${locale} ${key} body`);
    }
  }
});

test("lighthouse copy never uses CamelCase branding", () => {
  const json = JSON.stringify({ LIGHTHOUSE_TOOL_COPY, LIGHTHOUSE_HELP_COPY });
  assert.ok(!json.includes("EchoRank"), "found CamelCase 'EchoRank'");
  // This tool is powered by Google, not DataForSEO — naming the wrong vendor
  // would be worse than naming none.
  assert.ok(!/dataforseo/i.test(json), "Lighthouse copy must not mention DataForSEO");
});

test("metric abbreviations are NOT translated", () => {
  // LCP/CLS/TBT are the names of the things, identical in every locale and in
  // every other tool the user reads. They must live in code, not catalogs.
  const json = JSON.stringify(LIGHTHOUSE_TOOL_COPY);
  for (const metric of LAB_METRICS) {
    assert.ok(
      !new RegExp(`"${metric}"`).test(json),
      `metric ${metric} must not appear as a translatable string`,
    );
  }
});

test("lighthouse limits and cache window", () => {
  // PSI is free, so this is not a monetization lever — it protects the shared
  // Google quota every tenant on this server draws from.
  assert.equal(AUDITS_PER_HOUR, 20);
  assert.equal(AUDIT_WINDOW_MS, 60 * 60 * 1000);
  assert.equal(LIGHTHOUSE_CACHE_TTL_MS, 6 * 60 * 60 * 1000);
  assert.equal(MAX_OPPORTUNITIES, 8);
});

test("the two strategies are separate audits, mobile first", () => {
  assert.deepEqual([...LIGHTHOUSE_STRATEGIES], ["mobile", "desktop"]);
  // Google indexes mobile first and it is the harsher of the two.
  assert.equal(DEFAULT_STRATEGY, "mobile");
});

test("four categories and six lab metrics, in render order", () => {
  assert.deepEqual([...LIGHTHOUSE_CATEGORIES], [
    "performance",
    "accessibility",
    "bestPractices",
    "seo",
  ]);
  assert.deepEqual([...LAB_METRICS], ["FCP", "LCP", "TBT", "CLS", "SI", "TTI"]);
});

test("score bands are Google's published boundaries, not ours", () => {
  // 0-49 / 50-89 / 90-100 — so a score here matches Chrome DevTools exactly.
  assert.equal(scoreBand(49), "poor");
  assert.equal(scoreBand(50), "average");
  assert.equal(scoreBand(89), "average");
  assert.equal(scoreBand(90), "good");
  assert.equal(scoreBand(null), null);
});

test("Core Web Vitals thresholds match web.dev", () => {
  assert.deepEqual(METRIC_THRESHOLDS.LCP, { good: 2500, poor: 4000 });
  assert.deepEqual(METRIC_THRESHOLDS.INP, { good: 200, poor: 500 });
  assert.deepEqual(METRIC_THRESHOLDS.CLS, { good: 0.1, poor: 0.25 });
});

// ─── Site Audit (real-data page) ────────────────────────────────────────────
import { SITE_AUDIT_COPY, SITE_AUDIT_HELP_COPY } from "../i18n/dashboard";
import {
  CRAWL_PAGES_PER_PLAN,
  AUDITS_PER_MONTH,
  SITE_AUDIT_CACHE_TTL_MS,
  MAX_PAGE_ROWS,
  crawlPageLimit,
  auditLimit,
} from "../site-audit/options";
import { PROBLEM_CHECKS, METRIC_ISSUES, SEVERITY_ORDER, checkDefinition } from "../site-audit/checks";

test("site audit is its own tool page, not a link to /visibility", () => {
  // The hub card used to point at /visibility, which is the AI Visibility
  // audit — a different product that happens to share the word "audit".
  const tool = ALL_TOOLS.find((t) => t.id === "site_audit")!;
  assert.equal(tool.href, "/visibility/tools/site-audit");
  assert.ok(!tool.existing, "site_audit now has a real page of its own");
  assert.equal(tool.href, `${SEO_TOOLS_HUB}/${tool.slug}`);
  // The classic grid renders from the same SEO_TOOL_GROUPS data, so it moves
  // with the hub automatically.
  assert.ok(CLASSIC_SEO_TOOL_IDS.includes("site_audit"));
});

test("site-audit copy complete in all locales", () => {
  for (const locale of LOCALES) {
    const c = SITE_AUDIT_COPY[locale];
    assert.ok(c.formTitle.length && c.formIntro.length && c.start.length, locale);
    assert.ok(c.domainLabel.length && c.invalidDomain.length);
    // The distinction from the AI Visibility audit must exist in every locale.
    assert.ok(c.vsVisibilityNote.length > 40, `${locale} vsVisibilityNote`);
    assert.ok(c.vsVisibilityLink.length, `${locale} vsVisibilityLink`);

    assert.ok(c.crawlingTitle.length && c.crawlingBody.length);
    assert.ok(c.statusQueued.length && c.statusCrawling.length);
    assert.ok(c.statusCompleted.length && c.statusFailed.length);
    assert.ok(c.failedTitle.length && c.failedBody.length && c.cachedIntro.length);

    assert.ok(c.scoreTitle.length && c.scoreUnit.length && c.summaryTitle.length);
    assert.ok(c.metricPagesCrawled.length && c.metricBrokenLinks.length);
    assert.ok(c.metricDuplicateTitles.length && c.metric4xx.length && c.metric5xx.length);

    assert.ok(c.issuesTitle.length && c.issuesEmpty.length);
    assert.ok(c.severityError.length && c.severityWarning.length && c.severityNotice.length);
    assert.ok(c.severityErrorHint.length && c.severityWarningHint.length && c.severityNoticeHint.length);
    assert.ok(c.showAffected.length && c.hideAffected.length && c.noAffectedListed.length);
    // One label per group in checks.ts, or a group renders as a raw key.
    assert.ok(c.groupAvailability.length && c.groupLinks.length && c.groupContent.length);
    assert.ok(c.groupMeta.length && c.groupPerformance.length && c.groupCanonical.length);
    assert.ok(c.groupSecurity.length);

    assert.ok(c.pagesTitle.length && c.pagesEmpty.length && c.colPage.length);
    assert.ok(c.recentTitle.length && c.recentEmpty.length && c.view.length);
    assert.ok(c.quotaTitle.length && c.quotaCta.length);
    assert.ok(c.startFailed.length && c.loadFailed.length);

    // Interpolated strings must actually interpolate.
    assert.ok(c.pageCapNote(25).includes("25"), `${locale} pageCapNote`);
    assert.ok(c.progress(6, 25).includes("6") && c.progress(6, 25).includes("25"));
    assert.ok(c.affectedPages(1).length && c.affectedPages(20).includes("20"));
    assert.ok(c.auditedAgo("3 hours ago").includes("3 hours ago"));
    assert.ok(c.reRunIn(21).includes("21") && c.reRunIn(1).length);
    assert.ok(c.usage(1, 10).includes("1") && c.usage(1, 10).includes("10"));
    assert.ok(c.quotaBody(10).includes("10"));
    assert.ok(c.pagesSubtitle(25, 25).includes("25"));
  }
});

test("site-audit help copy complete in all locales", () => {
  for (const locale of LOCALES) {
    const c = SITE_AUDIT_HELP_COPY[locale];
    assert.ok(c.button.length && c.buttonAria.length && c.title.length && c.close.length);
    assert.ok(c.intro.length);
    for (const key of ["score", "severity", "vsVisibility"] as const) {
      assert.ok(c[`${key}Title`].length, `${locale} ${key} title`);
      assert.ok(c[`${key}Body`].length > 40, `${locale} ${key} body`);
    }
    // Plan caps are injected, never hardcoded, so the help cannot claim a
    // limit the code does not enforce.
    assert.ok(c.limitsTitle.length);
    const limits = c.limitsBody(
      CRAWL_PAGES_PER_PLAN.STARTER,
      CRAWL_PAGES_PER_PLAN.GROWTH,
      CRAWL_PAGES_PER_PLAN.AGENCY,
    );
    assert.ok(limits.includes(String(CRAWL_PAGES_PER_PLAN.STARTER)), `${locale} starter cap`);
    assert.ok(limits.includes(String(CRAWL_PAGES_PER_PLAN.AGENCY)), `${locale} agency cap`);
  }
});

test("site-audit copy never uses CamelCase branding or names the data vendor", () => {
  const json = JSON.stringify({ SITE_AUDIT_COPY, SITE_AUDIT_HELP_COPY });
  assert.ok(!json.includes("EchoRank"), "found CamelCase 'EchoRank'");
  assert.ok(!/dataforseo/i.test(json), "user-facing copy must not name the upstream vendor");
});

test("site-audit plan caps match the pricing sheet", () => {
  assert.equal(CRAWL_PAGES_PER_PLAN.STARTER, 25);
  assert.equal(CRAWL_PAGES_PER_PLAN.GROWTH, 100);
  assert.equal(CRAWL_PAGES_PER_PLAN.AGENCY, 500);
  assert.equal(AUDITS_PER_MONTH.STARTER, 2);
  assert.equal(AUDITS_PER_MONTH.GROWTH, 10);
  assert.equal(AUDITS_PER_MONTH.AGENCY, 50);
  assert.equal(crawlPageLimit("GROWTH"), 100);
  assert.equal(auditLimit("AGENCY"), 50);
  assert.equal(SITE_AUDIT_CACHE_TTL_MS, 24 * 60 * 60 * 1000);
  assert.equal(MAX_PAGE_ROWS, 100);
});

test("worst-case monthly crawl spend, at the measured per-page cost", () => {
  // Measured live 2026-07-29: 25 pages cost $0.011250 = $0.00045/page.
  const PER_PAGE = 0.00045;
  const worst = (plan: "STARTER" | "GROWTH" | "AGENCY") =>
    CRAWL_PAGES_PER_PLAN[plan] * AUDITS_PER_MONTH[plan] * PER_PAGE;
  assert.ok(worst("STARTER") < 0.03, `STARTER ${worst("STARTER")}`);
  assert.ok(worst("GROWTH") < 0.5, `GROWTH ${worst("GROWTH")}`);
  assert.ok(worst("AGENCY") < 12, `AGENCY ${worst("AGENCY")}`);
});

test("the check catalogue never classifies a POSITIVE OnPage check", () => {
  // seo_friendly_url and friends are true when the page PASSES; treating them
  // as problems reported 24 healthy pages as issues in the first live crawl.
  for (const key of [
    "seo_friendly_url",
    "seo_friendly_url_characters_check",
    "seo_friendly_url_dynamic_check",
    "seo_friendly_url_keywords_check",
    "seo_friendly_url_relative_length_check",
    "canonical",
    "is_https",
    "has_html_doctype",
  ]) {
    assert.equal(checkDefinition(key), null, `${key} is a POSITIVE check`);
  }
});

test("every catalogued check has a known severity and group", () => {
  const groups = new Set([
    "availability", "links", "content", "meta", "performance", "canonical", "security",
  ]);
  for (const [key, def] of Object.entries({ ...PROBLEM_CHECKS, ...METRIC_ISSUES })) {
    assert.ok(SEVERITY_ORDER.includes(def.severity), `${key} severity`);
    assert.ok(groups.has(def.group), `${key} group ${def.group}`);
  }
  // Duplicates arrive as page_metrics, not checks — they must be catalogued
  // there or they vanish from the issue list entirely.
  assert.ok(METRIC_ISSUES.duplicate_title, "duplicate_title must be a metric issue");
  assert.equal(METRIC_ISSUES.duplicate_title.severity, "error");
});

// ─── Web Analytics (GA4) ────────────────────────────────────────────────────
import { WEB_ANALYTICS_COPY } from "../i18n/dashboard";
import {
  GA_RANGES,
  DEFAULT_RANGE,
  REPORTS_PER_HOUR,
  REPORT_CACHE_TTL_SECONDS,
  isGaRange,
  windowsFor,
  percentChange,
} from "../ga/options";
import { HEADLINE_METRICS } from "../ga/types";

test("web analytics is its own tool page and keeps the reputation-analytics link", () => {
  const tool = ALL_TOOLS.find((t) => t.id === "web_analytics")!;
  assert.equal(tool.href, "/visibility/tools/web-analytics");
  assert.ok(!tool.existing);
  // The internal reputation analytics page is a DIFFERENT feature; the tool
  // links across to it rather than replacing it.
  assert.equal(SCAFFOLD_RELATED.web_analytics, "/analytics");
});

test("web-analytics copy complete in all locales", () => {
  for (const locale of LOCALES) {
    const c = WEB_ANALYTICS_COPY[locale];
    // Connection states carry the feature before any data exists.
    assert.ok(c.connectTitle.length && c.connectBody.length && c.connectCta.length, locale);
    assert.ok(c.connectPrivacy.length, `${locale} connectPrivacy`);
    assert.ok(c.pickTitle.length && c.pickBody.length && c.pickCta.length);
    assert.ok(c.noProperties.length && c.picking.length);
    assert.ok(c.reauthTitle.length && c.reauthBody.length && c.reauthCta.length);
    assert.ok(c.missingScopeTitle.length && c.missingScopeBody.length);
    assert.ok(c.quotaTitle.length && c.quotaBody.length && c.rateLimitTitle.length);

    // The one-line distinction from the internal reputation analytics page.
    assert.ok(c.vsInternalNote.length > 40, `${locale} vsInternalNote`);
    assert.ok(c.vsInternalLink.length, `${locale} vsInternalLink`);

    // Every callback error code the route can emit needs a message.
    assert.ok(c.errorDenied.length && c.errorBadState.length);
    assert.ok(c.errorNoRefreshToken.length && c.errorNoProperties.length);
    assert.ok(c.errorExchangeFailed.length && c.connectFailed.length && c.loadFailed.length);

    assert.ok(c.changeProperty.length && c.disconnect.length && c.disconnectConfirm.length);
    assert.ok(c.refresh.length && c.refreshing.length && c.cachedNote.length);
    assert.ok(c.rangeLabel.length && c.range7.length && c.range28.length && c.range90.length);
    assert.ok(c.loading.length && c.emptyTitle.length && c.emptyBody.length);

    assert.ok(c.headlineTitle.length && c.metricUnavailable.length && c.metricUnavailableHint.length);
    assert.ok(c.metricSessions.length && c.metricTotalUsers.length && c.metricNewUsers.length);
    assert.ok(c.metricEngagementRate.length && c.metricAvgEngagementTime.length && c.metricConversions.length);
    assert.ok(c.trafficTitle.length && c.legendSessions.length && c.legendUsers.length);
    assert.ok(c.channelsTitle.length && c.colChannel.length && c.colShare.length && c.channelsEmpty.length);
    assert.ok(c.pagesTitle.length && c.colPage.length && c.colViews.length && c.pagesEmpty.length);
    assert.ok(c.referrersTitle.length && c.colSource.length && c.referrersEmpty.length);

    // Interpolated strings must actually interpolate.
    assert.ok(c.connectedTo("My Site").includes("My Site"), `${locale} connectedTo`);
    assert.ok(c.updatedAgo("3 minutes ago").includes("3 minutes ago"));
    assert.ok(c.comparedTo("2026-06-01", "2026-06-28").includes("2026-06-01"));
    assert.ok(c.rateLimitBody(10).includes("10"), `${locale} rateLimitBody`);
  }
});

test("web-analytics copy never uses CamelCase branding or leaks GA4 field names", () => {
  const json = JSON.stringify(WEB_ANALYTICS_COPY);
  assert.ok(!json.includes("EchoRank"), "found CamelCase 'EchoRank'");
  // GA4's raw API field names must never reach the UI.
  for (const field of ["sessionDefaultChannelGroup", "screenPageViews", "sessionSource", "keyEvents"]) {
    assert.ok(!json.includes(field), `raw GA4 field ${field} in user-facing copy`);
  }
});

test("web-analytics ranges, cache and rate limit", () => {
  assert.deepEqual([...GA_RANGES], [7, 28, 90]);
  assert.equal(DEFAULT_RANGE, 28);
  assert.ok(isGaRange(90) && !isGaRange(30));
  // Free API, so the limit protects the property's shared quota, not revenue.
  assert.equal(REPORTS_PER_HOUR, 10);
  assert.equal(REPORT_CACHE_TTL_SECONDS, 3600);
});

test("the comparison window is equal-length and ends before the current one", () => {
  const now = new Date("2026-07-29T09:00:00Z");
  const { current, previous } = windowsFor(28, now);
  // Today is partial in GA4; including it makes every metric look collapsed.
  assert.equal(current.endDate, "2026-07-28");
  assert.ok(previous.endDate < current.startDate);
  const span = (w: { startDate: string; endDate: string }) =>
    (Date.parse(w.endDate) - Date.parse(w.startDate)) / 86_400_000;
  assert.equal(span(current), span(previous));
});

test("percent change refuses to divide by a zero baseline", () => {
  // "First traffic ever" is not "+infinity%".
  assert.equal(percentChange(50, 0), null);
  assert.ok(Math.abs(percentChange(120, 100)! - 20) < 1e-9);
});

test("six headline metrics, in render order", () => {
  assert.deepEqual([...HEADLINE_METRICS], [
    "sessions",
    "totalUsers",
    "newUsers",
    "engagementRate",
    "avgEngagementTime",
    "conversions",
  ]);
});
