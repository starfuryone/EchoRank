// tests/site-crawler-4d-public.test.ts — Phase 4d on the public /site-crawler
// page and in the dashboard copy: the cards and rows the shipped flags open,
// Google Analytics held back by its flag, caps read from plan-config, and the
// 4d catalogs complete in en / fr / de-CH.
import { describe, expect, it } from "vitest";
import { FLAGS, type Flags } from "@/lib/flags";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { CRAWL_CAPABILITIES, CRAWL_FEATURE_ROWS, capabilityBody, featureCells, visibleCapabilities, visibleFeatureRows } from "@/lib/site-crawler/marketing-copy";
import { SITE_CRAWLER_4D } from "@/lib/i18n/site-crawler-4d";
import { INTEGRATIONS_COPY } from "@/lib/i18n/integrations";
import { RULES } from "@/lib/crawl-rules";
import { PUBLIC_RULES } from "@/lib/site-crawler/rule-count";

const ctx = (flags: Flags = FLAGS) => ({ families: new Set<string>(["mobile"]), flags });
const ids = <T extends { id: string }>(xs: T[]) => xs.map((x) => x.id);

describe("flags shipped in 4d", () => {
  it("gsc, psi and backlinks are on; ga4 stays off", () => {
    expect([FLAGS["crawl.gsc"], FLAGS["crawl.psi"], FLAGS["crawl.backlinks"], FLAGS["crawl.ga4"]]).toEqual([true, true, true, false]);
  });

  it("the Search Console, PageSpeed and Backlink cards and rows render; Google Analytics does not", () => {
    const cards = ids(visibleCapabilities(ctx()));
    for (const id of ["search-console", "pagespeed", "backlinks"]) expect(cards).toContain(id);
    expect(cards).not.toContain("google-analytics");
    const rows = ids(visibleFeatureRows(ctx()));
    for (const id of ["search-console", "pagespeed", "link-metrics"]) expect(rows).toContain(id);
    expect(rows).not.toContain("google-analytics");
  });

  it('the mobile card now says "and Lighthouse"', () => {
    const card = CRAWL_CAPABILITIES.find((c) => c.id === "mobile-usability")!;
    expect(capabilityBody(card, "en")).toMatch(/and Lighthouse\.$/);
    expect(capabilityBody(card, "fr")).toMatch(/et Lighthouse\.$/);
  });

  it("the analytics rules stay out of the public count until crawl.ga4", () => {
    expect(RULES.some((r) => r.family === "analytics")).toBe(true);
    expect(PUBLIC_RULES.some((r) => r.family === "analytics")).toBe(false);
    expect(PUBLIC_RULES.some((r) => r.family === "search_console")).toBe(true);
    expect(PUBLIC_RULES.some((r) => r.family === "backlinks")).toBe(true);
  });
});

describe("feature-table cells read from plan-config", () => {
  const plans = { STARTER: PLAN_CONFIGS.STARTER, GROWTH: PLAN_CONFIGS.GROWTH, AGENCY: PLAN_CONFIGS.AGENCY };
  const cells = (id: string, b: "en" | "fr") => Object.values(featureCells(CRAWL_FEATURE_ROWS.find((r) => r.id === id)!, plans, b));
  it.each([
    ["pagespeed", "en", ["10 pages per crawl, mobile and desktop", "50 pages per crawl, mobile and desktop", "100 pages per crawl, mobile and desktop"]],
    ["pagespeed", "fr", ["10 pages par exploration, mobile et ordinateur", "50 pages par exploration, mobile et ordinateur", "100 pages par exploration, mobile et ordinateur"]],
    ["link-metrics", "en", ["10 pages per crawl", "50 pages per crawl", "100 pages per crawl"]],
    ["link-metrics", "fr", ["10 pages par exploration", "50 pages par exploration", "100 pages par exploration"]],
    ["search-console", "en", [true, true, true]],
  ] as const)("%s (%s)", (id, b, want) => {
    expect(cells(id, b)).toEqual(want);
  });

  it("follows plan-config, not a literal", () => {
    const changed = { ...plans, STARTER: { ...PLAN_CONFIGS.STARTER, crawlBacklinkPages: 7 } };
    expect(featureCells(CRAWL_FEATURE_ROWS.find((r) => r.id === "link-metrics")!, changed, "en").STARTER).toBe("7 pages per crawl");
  });
});

describe("4d copy", () => {
  const sample = (v: unknown): string =>
    typeof v === "function" ? String((v as (...a: unknown[]) => unknown)("X", "Y", "Z", "W")) : typeof v === "object" ? JSON.stringify(v) : String(v);

  it.each([
    ["p4d", SITE_CRAWLER_4D],
    ["integrations", INTEGRATIONS_COPY],
  ] as const)("%s: same keys in every locale, all filled, de-CH without ß", (_n, cat) => {
    const keys = Object.keys(cat.en).sort();
    for (const l of ["fr", "de-CH"] as const) expect(Object.keys(cat[l]).sort()).toEqual(keys);
    for (const l of ["en", "fr", "de-CH"] as const) {
      for (const [k, v] of Object.entries(cat[l])) {
        expect(sample(v).trim().length, `${l}.${k}`).toBeGreaterThan(0);
        expect(sample(v), `${l}.${k}`).not.toMatch(/undefined|NaN|\[object/);
      }
    }
    expect(JSON.stringify(Object.values(cat["de-CH"]).map(sample))).not.toContain("ß");
  });

  it("the column labels cover the same metric keys in every locale", () => {
    const keys = Object.keys(SITE_CRAWLER_4D.en.colLabels).sort();
    for (const l of ["fr", "de-CH"] as const) expect(Object.keys(SITE_CRAWLER_4D[l].colLabels).sort()).toEqual(keys);
  });
});
