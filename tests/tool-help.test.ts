// Shared help-modal convention: the illustrations render, and every tool's
// help copy maps onto ToolHelpModal without a hole in it.
//
// These are SERVER-RENDER smoke tests (react-dom/server), deliberately not DOM
// tests: this repo has no jsdom/testing-library setup, and adding one for a
// handful of decorative SVGs would be a larger change than the thing it tests.
// What can break here without a browser — a missing aria-hidden, translatable
// text sneaking into a graphic, a copy key that is undefined — is exactly what
// these cover.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RankTrackerArt } from "@/components/seo-tools/help-illustrations/rank-tracker";
import { BacklinksArt } from "@/components/seo-tools/help-illustrations/backlinks";
import { LighthouseArt } from "@/components/seo-tools/help-illustrations/lighthouse";
import { SiteAuditArt } from "@/components/seo-tools/help-illustrations/site-audit";
import { SerpCheckerArt } from "@/components/seo-tools/help-illustrations/serp-checker";
import { SiteExplorerArt } from "@/components/seo-tools/help-illustrations/site-explorer";
import { KeywordsExplorerArt } from "@/components/seo-tools/help-illustrations/keywords-explorer";
import { GscInsightsArt } from "@/components/seo-tools/help-illustrations/gsc-insights";
import { BrandRadarArt } from "@/components/seo-tools/help-illustrations/brand-radar";
import { CustomPromptsArt } from "@/components/seo-tools/help-illustrations/custom-prompts";
import { AiLensArt } from "@/components/seo-tools/help-illustrations/ai-lens";

import {
  AI_LENS_HELP_COPY,
  BACKLINKS_HELP_COPY,
  BRAND_RADAR_HELP_COPY,
  CUSTOM_PROMPTS_HELP_COPY,
  GSC_HELP_COPY,
  KEYWORDS_EXPLORER_HELP_COPY,
  LIGHTHOUSE_HELP_COPY,
  RANK_TRACKER_HELP_COPY,
  SERP_CHECKER_HELP_COPY,
  SITE_AUDIT_HELP_COPY,
  SITE_EXPLORER_HELP_COPY,
} from "@/lib/i18n/dashboard";

const LOCALES = ["en", "fr", "de-CH"] as const;

const ILLUSTRATIONS = [
  ["rank-tracker", RankTrackerArt],
  ["backlinks", BacklinksArt],
  ["lighthouse", LighthouseArt],
  ["site-audit", SiteAuditArt],
  ["serp-checker", SerpCheckerArt],
  ["site-explorer", SiteExplorerArt],
  ["keywords-explorer", KeywordsExplorerArt],
  ["gsc-insights", GscInsightsArt],
  ["brand-radar", BrandRadarArt],
  ["custom-prompts", CustomPromptsArt],
  ["ai-lens", AiLensArt],
] as const;

describe.each(ILLUSTRATIONS)("%s illustration", (name, Art) => {
  const html = renderToStaticMarkup(createElement(Art));

  it("renders", () => {
    expect(html.startsWith("<svg")).toBe(true);
    expect(html.length).toBeGreaterThan(200);
  });

  it("is decorative: aria-hidden and not focusable", () => {
    // The numbered steps beside it carry the same information as text, so a
    // screen reader must skip the graphic entirely rather than read coordinates.
    expect(html).toMatch(/^<svg[^>]*aria-hidden="true"/);
    expect(html).toMatch(/^<svg[^>]*focusable="false"/);
  });

  it("uses the shared 480x150 canvas", () => {
    expect(html).toContain('viewBox="0 0 480 150"');
  });

  it("honours prefers-reduced-motion wherever it animates", () => {
    if (!html.includes("er-help-flow")) return; // no motion in this one
    expect(html).toContain("prefers-reduced-motion");
    expect(html).toContain("@keyframes erHelpFlow");
  });

  it("carries no translatable text", () => {
    // Only digits, "#", metric abbreviations and arrows are allowed — glyphs
    // that read identically in en / fr / de-CH.
    const texts = [...html.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1].trim());
    for (const text of texts) {
      expect(
        /^[#\d\s.,%↑↓→–-]*$/u.test(text),
        `${name} illustration contains translatable text: "${text}"`,
      ).toBe(true);
    }
  });

  it("stays inside the size budget", () => {
    // ~6 KB rendered; these ship in the client bundle of every tool page.
    expect(html.length).toBeLessThan(6144);
  });
});

// ─── Copy completeness ──────────────────────────────────────────────────────

/**
 * Every string a migrated modal reads. A missing key renders as `undefined` in
 * the dialog rather than throwing, so this is the only thing that catches it.
 */
const MIGRATED = [
  ["rank-tracker", RANK_TRACKER_HELP_COPY, ["step1Title", "step2Title", "step3Title", "step4Title"]],
  ["backlinks", BACKLINKS_HELP_COPY, ["backlinksTitle", "dofollowTitle", "anchorsTitle", "historyTitle", "freshnessTitle"]],
  ["lighthouse", LIGHTHOUSE_HELP_COPY, ["labFieldTitle", "scoresTitle", "devicesTitle", "fluctuationTitle"]],
  ["site-audit", SITE_AUDIT_HELP_COPY, ["scoreTitle", "severityTitle", "limitsTitle", "vsVisibilityTitle"]],
  ["serp-checker", SERP_CHECKER_HELP_COPY, ["snapshotTitle", "targetingTitle", "featuresTitle", "timingTitle"]],
  ["site-explorer", SITE_EXPLORER_HELP_COPY, ["estimatesTitle", "distributionTitle", "competitorsTitle", "backlinksTitle", "quotaTitle"]],
  ["keywords-explorer", KEYWORDS_EXPLORER_HELP_COPY, ["crawlTitle", "scoringTitle", "contentTitle", "promptsTitle", "promptsLink", "aiTitle"]],
  ["gsc-insights", GSC_HELP_COPY, ["connectTitle", "metricsTitle", "timingTitle", "syncTitle"]],
  ["brand-radar", BRAND_RADAR_HELP_COPY, ["scoreTitle", "scoreLink", "mentionTitle", "enginesTitle", "alertsTitle", "emptyTitle"]],
  ["custom-prompts", CUSTOM_PROMPTS_HELP_COPY, ["trackTitle", "runsTitle", "trendTitle", "writeTitle", "auditTitle", "auditLink"]],
  ["ai-lens", AI_LENS_HELP_COPY, ["whyTitle", "gapTitle", "fixTitle", "goalTitle"]],
] as const;

describe("migrated help copy", () => {
  it.each(MIGRATED)("%s has every section title in every locale", (name, copy, keys) => {
    for (const locale of LOCALES) {
      const t = copy[locale] as unknown as Record<string, unknown>;
      // Chrome the shared modal always renders.
      for (const key of ["title", "close", "button", "buttonAria"]) {
        expect(typeof t[key], `${name}.${locale}.${key}`).toBe("string");
        expect((t[key] as string).length).toBeGreaterThan(0);
      }
      for (const key of keys) {
        expect(typeof t[key], `${name}.${locale}.${key}`).toBe("string");
        expect((t[key] as string).length).toBeGreaterThan(0);
      }
    }
  });

  // The reason the GSC modal was written: a healthy sync on a low-traffic
  // property stores zero query rows, which reads as a broken integration. If
  // this section ever loses that explanation the page starts lying by omission.
  it("gsc-insights explains the reporting lag AND the empty-query case", () => {
    const CLAIMS: Record<(typeof LOCALES)[number], RegExp[]> = {
      en: [/two days/i, /anonym/i, /no query rows|query rows at all/i],
      fr: [/deux jours/i, /anonym/i, /aucune ligne de requête/i],
      "de-CH": [/zwei Tage/i, /anonym/i, /keine Zeilen mit Suchanfragen/i],
    };
    for (const locale of LOCALES) {
      for (const claim of CLAIMS[locale]) {
        expect(
          GSC_HELP_COPY[locale].timingBody,
          `gsc timingBody.${locale} no longer states ${claim}`,
        ).toMatch(claim);
      }
    }
  });

  // The prompt allowance is per plan and per tenant, so the copy interpolates
  // it rather than stating a number. A locale that dropped one of the two
  // placeholders would read as a confident wrong figure.
  it("custom-prompts quotes the live prompt allowance, not a hardcoded one", () => {
    for (const locale of LOCALES) {
      const line = CUSTOM_PROMPTS_HELP_COPY[locale].trackQuota(3, 25);
      expect(line, `${locale} trackQuota lost the used count`).toContain("3");
      expect(line, `${locale} trackQuota lost the limit`).toContain("25");
    }
    // ...and the static body must not smuggle a number back in.
    for (const locale of LOCALES) {
      expect(
        CUSTOM_PROMPTS_HELP_COPY[locale].trackBody,
        `${locale} trackBody hardcodes an allowance`,
      ).not.toMatch(/\b\d+\s*(prompts|requêtes|Prompts)\b/);
    }
  });

  it("never renders a raw translation key as visible copy", () => {
    // A key that leaked instead of its value looks like "step1Title" on screen.
    for (const [name, copy] of MIGRATED) {
      for (const locale of LOCALES) {
        for (const [key, value] of Object.entries(copy[locale])) {
          if (typeof value !== "string") continue;
          expect(value, `${name}.${locale}.${key} looks like a raw key`).not.toBe(key);
        }
      }
    }
  });
});
