// Phase 4b crawler UI: the extractor editor and presets, the Extraction tab,
// its query string, and the 4b problems, in every dashboard locale with no
// missing string.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/flags", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags")>();
  const on = { ...real.FLAGS, "crawl.extraction": true, "crawl.segments": true };
  return { ...real, FLAGS: on, flag: (name: keyof typeof on) => on[name] };
});

import { SITE_CRAWLER_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { problemText } from "@/components/seo-tools/site-crawler-config";
import { ExtractorsEditor, PRESET_GROUPS, SearchesEditor, withPreset } from "@/components/seo-tools/site-crawler-config-4b";
import { searchHitsText } from "@/components/seo-tools/site-crawler-panels";
import { SegmentsEditor, blankRule, segmentsPayload } from "@/components/seo-tools/site-crawler-config-4b";
import { SegmentOverview, SegmentPicker } from "@/components/seo-tools/site-crawler-segments";
import { ExtractionPanel, extractionQuery } from "@/components/seo-tools/site-crawler-extraction";
import { crawlTabs } from "@/components/seo-tools/site-crawler-client";
import { EXTRACTOR_PRESETS, type Extractor } from "@/lib/site-crawler/crawl-config";

const LOCALES: DashLocale[] = ["en", "fr", "de-CH"];
const UNDEFINED = /undefined|\[object Object\]|NaN/;
const css = (name: string): Extractor => ({ name, kind: "css", expr: "h1", attr: null, multiple: false });

describe("presets", () => {
  it("every preset sits in exactly one group", () => {
    const grouped = PRESET_GROUPS.flatMap((g) => g.presets).sort();
    expect(grouped).toEqual(Object.keys(EXTRACTOR_PRESETS).sort());
  });

  it("adds a group's rows, never past the plan cap", () => {
    expect(withPreset([], "og", 10).map((e) => e.name)).toEqual(["og:title", "og:description", "og:image"]);
    expect(withPreset([css("a")], "og", 3)).toHaveLength(3);
    expect(withPreset([css("a"), css("b"), css("c")], "product", 3)).toHaveLength(3);
  });
});

describe("extractor editor", () => {
  it.each(LOCALES)("%s: renders rows and the add / preset controls under the cap", (l) => {
    const t = SITE_CRAWLER_COPY[l].p4b;
    const html = renderToStaticMarkup(<ExtractorsEditor t={t} value={[css("Heading")]} cap={3} capText="3" onChange={() => {}} />);
    expect(html).toContain(t.exAdd);
    expect(html).toContain(t.presetOg);
    expect(html).toContain('value="Heading"');
    expect(html).not.toMatch(UNDEFINED);
  });

  it.each(LOCALES)("%s: at the cap, says so instead of offering more", (l) => {
    const t = SITE_CRAWLER_COPY[l].p4b;
    const html = renderToStaticMarkup(<ExtractorsEditor t={t} value={[css("a"), css("b")]} cap={2} capText="2" onChange={() => {}} />);
    expect(html).not.toContain(t.exAdd);
    expect(html).toContain(t.capReached("2"));
  });
});

describe("Extraction tab", () => {
  it("shows only for crawls that ran extractors", () => {
    expect(crawlTabs({ config: null })).not.toContain("extraction");
    expect(crawlTabs({ config: { extractors: [] } as never })).not.toContain("extraction");
    expect(crawlTabs({ config: { extractors: [css("a")] } as never })).toContain("extraction");
    // Phase 4c: Structure while the pages are kept.
    expect(crawlTabs({ config: null })).toContain("structure");
    expect(crawlTabs({ config: null, dataPurgedAt: "2026-11-01T00:00:00.000Z" })).not.toContain("structure");
  });

  it.each([
    ["", null, undefined, ""],
    ["2:has", null, 3, "extractor=2&has=true&page=3"],
    ["0:empty", "1", undefined, "extractor=0&has=false&segment=1"],
  ])("filter %s, segment %s → %s", (filter, segment, page, q) => {
    expect(extractionQuery(filter, segment, page)).toBe(q);
  });

  it.each(LOCALES)("%s: renders its filter with one has / empty pair per extractor", (l) => {
    const t = SITE_CRAWLER_COPY[l];
    const html = renderToStaticMarkup(
      <ExtractionPanel crawlId="c1" extractorNames={["Price", "SKU"]} t={t} int={new Intl.NumberFormat(l)} />,
    );
    expect(html).toContain(t.p4b.exFilterHas("Price"));
    expect(html).toContain(t.p4b.exFilterEmpty("SKU"));
    expect(html).toContain("/api/seo/v1/crawl/c1/extractions?&amp;format=csv");
    expect(html).not.toMatch(UNDEFINED);
  });
});

describe("custom search", () => {
  it.each(LOCALES)("%s: the search editor renders its rows and add button", (l) => {
    const t = SITE_CRAWLER_COPY[l].p4b;
    const html = renderToStaticMarkup(
      <SearchesEditor t={t} value={[{ name: "GTM", pattern: "googletagmanager", isRegex: false }]} cap={2} capText="2" onChange={() => {}} />,
    );
    expect(html).toContain(t.srAdd);
    expect(html).toContain('value="googletagmanager"');
    expect(html).not.toMatch(UNDEFINED);
  });

  // Pages: the custom-search column, filter and CSV moved with the Pages view (tests/site-crawler-ux-pages.test.tsx).

  it("lists only the searches that matched", () => {
    const int = new Intl.NumberFormat("en");
    expect(searchHitsText({ "0": 0, "1": 3 }, ["A", "B"], int)).toBe("B: 3");
    expect(searchHitsText(null, ["A"], int)).toBe("—");
  });
});

describe("segments", () => {
  it.each(LOCALES)("%s: the editor renders its save button and the plan cap", (l) => {
    const t = SITE_CRAWLER_COPY[l].p4b;
    const html = renderToStaticMarkup(<SegmentsEditor t={t} host="example.com" cap={3} extractorNames={["Price"]} />);
    expect(html).toContain(t.segSave);
    expect(html).toContain(t.segAdd);
    expect(html.replace(/&#x27;/g, "'")).toContain(t.segHelp("3"));
    expect(html).not.toMatch(UNDEFINED);
  });

  it("a fresh rule of each kind, and only complete segments are sent", () => {
    expect(blankRule("statusClass")).toEqual({ kind: "statusClass", cls: "2xx" });
    expect(segmentsPayload([{ name: "Blog", rule: { kind: "urlPattern", pattern: "/blog/*" } }])).toHaveLength(1);
    expect(segmentsPayload([{ name: "", rule: blankRule("depthMax") }])).toBeNull();
    expect(segmentsPayload([{ name: "x", rule: blankRule("urlPattern") }])).toBeNull();
  });

  it.each(LOCALES)("%s: the picker lists every segment, and Overview shows per-segment totals", (l) => {
    const t = SITE_CRAWLER_COPY[l];
    const int = new Intl.NumberFormat(l);
    const picker = renderToStaticMarkup(<SegmentPicker names={["Blog", "Shop"]} value="1" onChange={() => {}} t={t} />);
    expect(picker).toContain(t.p4b.segAll);
    expect(picker).toContain(">Shop</option>");
    expect(renderToStaticMarkup(<SegmentPicker names={[]} value="" onChange={() => {}} t={t} />)).toBe("");
    const overview = renderToStaticMarkup(
      <SegmentOverview segments={[{ index: 0, name: "Blog", pages: 12, totals: { ERROR: 1, WARNING: 2, NOTICE: 3 } }]} onPick={() => {}} t={t} int={int} />,
    );
    expect(overview).toContain(t.p4b.segOverviewTitle);
    expect(overview).toContain("Blog");
    expect(overview).not.toMatch(UNDEFINED);
    const filtered = renderToStaticMarkup(<SegmentOverview segment={{ name: "Blog", pages: 12 }} onPick={() => {}} t={t} int={int} />);
    expect(filtered).toContain("Blog");
  });
});

describe("4b problems", () => {
  it.each(LOCALES)("%s: names the cap and the bad expression", (l) => {
    const c = SITE_CRAWLER_COPY[l];
    expect(problemText({ field: "extractors", code: "over_plan_cap", limit: 3 }, c.p4a, c.p4b)).toContain("3");
    expect(problemText({ field: "extractors", code: "invalid_expression", index: 1, reason: "invalid_xpath" }, c.p4a, c.p4b)).toContain("2");
    expect(problemText({ field: "searches", code: "invalid_expression", index: 0, reason: "unsafe_regex" }, c.p4a, c.p4b)).toBe(c.p4b.problemSearch("1"));
  });

  it("de-CH copy uses ss, never ß", () => {
    expect(JSON.stringify(Object.values(SITE_CRAWLER_COPY["de-CH"].p4b).filter((v) => typeof v === "string"))).not.toContain("ß");
  });
});
