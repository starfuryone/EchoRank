// tests/site-crawler-4c-public.test.ts — Phase 4c on the public /site-crawler
// page and in the dashboard copy: which cards and rows the shipped flags
// open, that nothing claims Sheets or a Looker Studio template before
// crawl.sheets, the schedule cells read from plan-config, and the p4c
// catalogs complete in en / fr / de-CH.
import { describe, expect, it } from "vitest";
import { FLAGS, type Flags } from "@/lib/flags";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import {
  CRAWL_CAPABILITIES,
  CRAWL_FEATURE_ROWS,
  capabilityBody,
  featureCells,
  visibleCapabilities,
  visibleFeatureRows,
} from "@/lib/site-crawler/marketing-copy";
import { SITE_CRAWLER_4C } from "@/lib/i18n/site-crawler-4c";

const ctx = (flags: Flags = FLAGS) => ({ families: new Set<string>(), flags });
const ids = <T extends { id: string }>(xs: T[]) => xs.map((x) => x.id);

describe("flags shipped in 4c", () => {
  it("visualise, compare, schedule and reports are on; sheets stays off", () => {
    expect([FLAGS["crawl.visualise"], FLAGS["crawl.compare"], FLAGS["crawl.schedule"], FLAGS["crawl.reports"], FLAGS["crawl.sheets"]]).toEqual([true, true, true, true, false]);
  });

  it('the "Site structure" line that waited on crawl.visualise now renders, with the visualisation and 4c cards', () => {
    const cards = ids(visibleCapabilities(ctx()));
    for (const id of ["site-structure", "visualisations", "crawl-comparison", "scheduling", "reports"]) expect(cards).toContain(id);
    const rows = ids(visibleFeatureRows(ctx()));
    for (const id of ["visualisations", "scheduling", "crawl-comparison"]) expect(rows).toContain(id);
  });

  it("nothing claims Sheets, Looker Studio or a template while crawl.sheets is off", () => {
    expect(ids(visibleFeatureRows(ctx()))).not.toContain("looker-studio");
    for (const c of visibleCapabilities(ctx())) {
      for (const base of ["en", "fr"] as const) {
        expect(`${c.title[base]} ${capabilityBody(c, base)}`).not.toMatch(/Sheets|Looker|template|modèle/i);
      }
    }
  });

  it("with crawl.sheets on, the scheduling card adds Sheets + Looker Studio and the Looker row appears — still no template", () => {
    const on: Flags = { ...FLAGS, "crawl.sheets": true };
    const card = CRAWL_CAPABILITIES.find((c) => c.id === "scheduling")!;
    expect(capabilityBody(card, "en", on)).toMatch(/Google Sheets.*Looker Studio/);
    expect(capabilityBody(card, "fr", on)).toMatch(/Google Sheets.*Looker Studio/);
    expect(capabilityBody(card, "en", on)).not.toMatch(/template/i);
    expect(ids(visibleFeatureRows(ctx(on)))).toContain("looker-studio");
  });
});

describe("feature-table cells read from plan-config", () => {
  const plans = { STARTER: PLAN_CONFIGS.STARTER, GROWTH: PLAN_CONFIGS.GROWTH, AGENCY: PLAN_CONFIGS.AGENCY };
  const row = CRAWL_FEATURE_ROWS.find((r) => r.id === "scheduling")!;
  it.each([
    ["en", ["1 scheduled crawl · monthly", "2 scheduled crawls · weekly or monthly", "10 scheduled crawls · daily, weekly or monthly"]],
    ["fr", ["1 exploration planifiée · mensuelle", "2 explorations planifiées · hebdomadaire ou mensuelle", "10 explorations planifiées · quotidienne, hebdomadaire ou mensuelle"]],
  ] as const)("scheduling (%s)", (base, want) => {
    expect(Object.values(featureCells(row, plans, base))).toEqual(want);
  });

  it("follows plan-config, not a literal", () => {
    const changed = { ...plans, STARTER: { ...PLAN_CONFIGS.STARTER, crawlSchedules: 3, crawlScheduleCadences: ["weekly", "monthly"] as const } };
    expect(featureCells(row, changed, "en").STARTER).toBe("3 scheduled crawls · weekly or monthly");
  });
});

describe("p4c dashboard copy", () => {
  const sample = (v: unknown): string => (typeof v === "function" ? String((v as (...a: unknown[]) => unknown)("X", "Y", "Z")) : String(v));

  it("has the same keys in every locale, all filled", () => {
    const keys = Object.keys(SITE_CRAWLER_4C.en).sort();
    for (const l of ["fr", "de-CH"] as const) expect(Object.keys(SITE_CRAWLER_4C[l]).sort()).toEqual(keys);
    for (const l of ["en", "fr", "de-CH"] as const) {
      for (const [k, v] of Object.entries(SITE_CRAWLER_4C[l])) {
        const s = sample(v);
        expect(s.trim().length, `${l}.${k}`).toBeGreaterThan(0);
        expect(s, `${l}.${k}`).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });

  it("de-CH uses ss, never ß; French and German are not English", () => {
    expect(JSON.stringify(Object.values(SITE_CRAWLER_4C["de-CH"]).map(sample))).not.toContain("ß");
    for (const l of ["fr", "de-CH"] as const) {
      // Product names read the same in every language.
      const names = new Set(["shTitle"]);
      const same = Object.keys(SITE_CRAWLER_4C.en).filter((k) => {
        if (names.has(k)) return false;
        const a = sample(SITE_CRAWLER_4C.en[k as keyof typeof SITE_CRAWLER_4C.en]);
        return a.length > 12 && a === sample(SITE_CRAWLER_4C[l][k as keyof typeof SITE_CRAWLER_4C.en]);
      });
      expect(same, l).toEqual([]);
    }
  });
});
