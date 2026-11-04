// tests/site-crawler-4e-public.test.ts — Phase 4e on the public /site-crawler
// page and in the dashboard copy: the four flags on, their cards and rows
// rendering, the Spelling card's grammar sentence behind crawl.ai, caps read
// from plan-config, the new families public, and the 4e catalog complete in
// en / fr / de-CH.
import { describe, expect, it } from "vitest";
import { FLAGS, type Flags } from "@/lib/flags";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { CRAWL_CAPABILITIES, CRAWL_FEATURE_ROWS, capabilityBody, featureCells, visibleCapabilities, visibleFeatureRows } from "@/lib/site-crawler/marketing-copy";
import { SITE_CRAWLER_4E } from "@/lib/i18n/site-crawler-4e";
import { PUBLIC_RULES } from "@/lib/site-crawler/rule-count";

const ctx = (flags: Flags = FLAGS) => ({ families: new Set<string>(["spelling"]), flags });
const ids = <T extends { id: string }>(xs: T[]) => xs.map((x) => x.id);

describe("flags shipped in 4e", () => {
  it("amp, customJs, ai and login are on", () => {
    expect([FLAGS["crawl.amp"], FLAGS["crawl.customJs"], FLAGS["crawl.ai"], FLAGS["crawl.login"]]).toEqual([true, true, true, true]);
  });

  it("the AMP, Custom JavaScript, AI prompts and Forms-based authentication cards and rows render", () => {
    const cards = ids(visibleCapabilities(ctx()));
    for (const id of ["amp", "custom-javascript", "ai-prompts", "forms-login"]) expect(cards).toContain(id);
    const rows = ids(visibleFeatureRows(ctx()));
    for (const id of ["amp", "custom-javascript", "ai-crawl", "forms-auth"]) expect(rows).toContain(id);
  });

  it("each is held back by its own flag", () => {
    const off = (name: keyof Flags) => ({ ...FLAGS, [name]: false }) as Flags;
    expect(ids(visibleCapabilities(ctx(off("crawl.amp"))))).not.toContain("amp");
    expect(ids(visibleCapabilities(ctx(off("crawl.customJs"))))).not.toContain("custom-javascript");
    expect(ids(visibleCapabilities(ctx(off("crawl.ai"))))).not.toContain("ai-prompts");
    expect(ids(visibleCapabilities(ctx(off("crawl.login"))))).not.toContain("forms-login");
    expect(ids(visibleFeatureRows(ctx(off("crawl.login"))))).not.toContain("forms-auth");
  });

  it("the Spelling card appends its grammar sentence only with crawl.ai", () => {
    const card = CRAWL_CAPABILITIES.find((c) => c.id === "spelling")!;
    expect(capabilityBody(card, "en", FLAGS)).toMatch(/Grammar checks run through the AI prompts\.$/);
    expect(capabilityBody(card, "fr", FLAGS)).toMatch(/requêtes IA\.$/);
    expect(capabilityBody(card, "en", { ...FLAGS, "crawl.ai": false })).not.toMatch(/Grammar/);
  });

  it("the amp and ai families are public now", () => {
    expect(PUBLIC_RULES.some((r) => r.family === "amp")).toBe(true);
    expect(PUBLIC_RULES.some((r) => r.family === "ai")).toBe(true);
  });
});

describe("feature-table cells read from plan-config", () => {
  const plans = { STARTER: PLAN_CONFIGS.STARTER, GROWTH: PLAN_CONFIGS.GROWTH, AGENCY: PLAN_CONFIGS.AGENCY };
  const cells = (id: string, b: "en" | "fr") => Object.values(featureCells(CRAWL_FEATURE_ROWS.find((r) => r.id === id)!, plans, b));
  it.each([
    ["custom-javascript", "en", ["1 snippet per crawl", "3 snippets per crawl", "5 snippets per crawl"]],
    ["custom-javascript", "fr", ["1 extrait par exploration", "3 extraits par exploration", "5 extraits par exploration"]],
    ["ai-crawl", "en", ["20 pages per crawl, 3 prompts", "100 pages per crawl, 3 prompts", "500 pages per crawl, 3 prompts"]],
    ["ai-crawl", "fr", ["20 pages par exploration, 3 requêtes", "100 pages par exploration, 3 requêtes", "500 pages par exploration, 3 requêtes"]],
    ["amp", "en", [true, true, true]],
    ["forms-auth", "en", [true, true, true]],
  ] as const)("%s (%s)", (id, b, want) => {
    expect(cells(id, b)).toEqual(want);
  });

  it("follows plan-config, not a literal", () => {
    const changed = { ...plans, STARTER: { ...PLAN_CONFIGS.STARTER, crawlAiPages: 7, crawlJsSnippets: 2 } };
    expect(featureCells(CRAWL_FEATURE_ROWS.find((r) => r.id === "ai-crawl")!, changed, "en").STARTER).toBe("7 pages per crawl, 3 prompts");
    expect(featureCells(CRAWL_FEATURE_ROWS.find((r) => r.id === "custom-javascript")!, changed, "en").STARTER).toBe("2 snippets per crawl");
  });
});

describe("the 4e dashboard catalog", () => {
  const keysOf = (o: object): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keysOf(v).map((x) => `${k}.${x}`) : [k])).sort();
  it("has the same keys in en, fr and de-CH, de-CH without ß, every string non-empty", () => {
    expect(keysOf(SITE_CRAWLER_4E.fr)).toEqual(keysOf(SITE_CRAWLER_4E.en));
    expect(keysOf(SITE_CRAWLER_4E["de-CH"])).toEqual(keysOf(SITE_CRAWLER_4E.en));
    for (const l of ["en", "fr", "de-CH"] as const) {
      const strings = JSON.stringify(SITE_CRAWLER_4E[l]);
      expect(strings).not.toMatch(/""/);
      if (l === "de-CH") expect(strings).not.toContain("ß");
    }
  });
});
