// tests/site-crawler-4b-config.test.ts
//
// Phase 4b configuration: extractors and searches validated and capped per
// plan, the segment snapshot never taken from input, the plan caps, and the
// segment rules.

import { describe, expect, it } from "vitest";
import { CrawlConfigInputSchema, EXTRACTOR_PRESETS, checkCrawlConfig, regexProblem, readStoredConfig } from "@/lib/site-crawler/crawl-config";
import { planConfig } from "@/lib/plan-config";
import { featureCapsForPlan } from "@/lib/site-crawler/quota";
import { SegmentDefSchema, parseSegmentParam, segmentCell, segmentMatcher, statusClassOf, type SegmentDef } from "@/lib/site-crawler/segments";

const input = (over: Record<string, unknown> = {}) => CrawlConfigInputSchema.parse(over);
const ex = (over: Record<string, unknown> = {}) => ({ name: "x", kind: "css", expr: "h1", ...over });
const caps = { urlCap: 100, verified: false, extractorCap: 3, searchCap: 2 };

describe("plan caps (crawlExtractors / crawlSearches / crawlSegments)", () => {
  it.each([
    ["STARTER", 3, 2, 3],
    ["GROWTH", 5, 5, 10],
    ["AGENCY", 10, 5, 25],
    ["ENTERPRISE", 10, 5, 25],
  ] as const)("%s: %i extractors, %i searches, %i segments", (plan, e, s, g) => {
    expect(featureCapsForPlan(plan)).toEqual({ extractorCap: e, searchCap: s, segmentCap: g });
    expect(planConfig(plan)).toMatchObject({ crawlExtractors: e, crawlSearches: s, crawlSegments: g });
  });
});

describe("extractors and searches in checkCrawlConfig", () => {
  it("defaults to none, and a pre-4b stored config reads as none", () => {
    expect(input()).toMatchObject({ extractors: [], searches: [] });
    expect(readStoredConfig({ maxUrls: 5 })).toMatchObject({ extractors: [], searches: [] });
  });

  it.each([
    ["extractors", { extractors: [ex(), ex(), ex(), ex()] }, 3],
    ["searches", { searches: [{ name: "a", pattern: "a" }, { name: "b", pattern: "b" }, { name: "c", pattern: "c" }] }, 2],
  ] as const)("refuses more %s than the plan allows", (field, over, limit) => {
    expect(checkCrawlConfig(input(over), caps).problems).toEqual([{ field, code: "over_plan_cap", limit }]);
  });

  it("refuses everything when a caller passes no caps", () => {
    expect(checkCrawlConfig(input({ extractors: [ex()] }), { urlCap: 100, verified: true }).problems).toEqual([
      { field: "extractors", code: "over_plan_cap", limit: 0 },
    ]);
  });

  it.each([
    ["(a+)+$", "unsafe_regex"],
    ["(x|xx)*y", "unsafe_regex"],
    ["(\\w)\\1", "unsafe_regex"],
    ["[unclosed", "invalid_regex"],
    ['"sku":"([^"]+)"', null],
  ])("regex %s → %s", (source, reason) => {
    expect(regexProblem(source)).toBe(reason);
  });

  it("checks regex extractors and regex searches, not literal searches", () => {
    const out = checkCrawlConfig(
      input({
        extractors: [ex({ kind: "regex", expr: "(a+)+" })],
        searches: [{ name: "lit", pattern: "(a+)+" }, { name: "re", pattern: "(a+)+", isRegex: true }],
      }),
      caps,
    );
    expect(out.problems).toEqual([
      { field: "extractors", code: "invalid_expression", index: 0, reason: "unsafe_regex" },
      { field: "searches", code: "invalid_expression", index: 1, reason: "unsafe_regex" },
    ]);
  });

  it("hands css / xpath to the server-side checker", () => {
    const out = checkCrawlConfig(input({ extractors: [ex(), ex({ kind: "xpath", expr: "//[" })] }), {
      ...caps,
      checkExpr: (e) => (e.kind === "xpath" ? "invalid_xpath" : null),
    });
    expect(out.problems).toEqual([{ field: "extractors", code: "invalid_expression", index: 1, reason: "invalid_xpath" }]);
  });

  it("caps expressions at 500 characters and blank attr reads as none", () => {
    expect(CrawlConfigInputSchema.safeParse({ extractors: [ex({ expr: "a".repeat(501) })] }).success).toBe(false);
    expect(checkCrawlConfig(input({ extractors: [ex({ attr: " " })] }), caps).config.extractors[0]!.attr).toBeNull();
  });

  it("never takes the segment snapshot from input", () => {
    const parsed = { ...input(), segments: [{ name: "x", rule: { kind: "depthMax", max: 1 } }] } as ReturnType<typeof input>;
    expect(checkCrawlConfig(parsed, caps).config.segments).toBeUndefined();
  });

  it("every preset is a valid extractor", () => {
    for (const p of Object.values(EXTRACTOR_PRESETS)) {
      expect(checkCrawlConfig(input({ extractors: [p] }), { ...caps, extractorCap: 10 }).problems).toEqual([]);
    }
  });
});

describe("segments", () => {
  const defs: SegmentDef[] = [
    { name: "Blog", rule: { kind: "urlPattern", pattern: "/blog/*" } },
    { name: "Products", rule: { kind: "urlPattern", pattern: "/\\/p\\/\\d+$/" } },
    { name: "In stock", rule: { kind: "extractorValue", index: 1, equals: "InStock" } },
    { name: "Shallow", rule: { kind: "depthMax", max: 1 } },
    { name: "Broken", rule: { kind: "statusClass", cls: "4xx" } },
    { name: "No answer", rule: { kind: "statusClass", cls: "none" } },
  ];
  const match = segmentMatcher(defs);
  const page = (over: Partial<Parameters<typeof match>[0]> = {}) => ({
    url: "https://s.example.com/",
    depth: 0,
    statusCode: 200,
    extracted: new Map<number, string[]>(),
    ...over,
  });

  it.each([
    ["root", page(), [3]],
    ["blog post at depth 2", page({ url: "https://s.example.com/blog/x", depth: 2 }), [0]],
    ["product in stock", page({ url: "https://s.example.com/p/42", depth: 2, extracted: new Map([[1, [" instock "]]]) }), [1, 2]],
    ["404 at depth 3", page({ depth: 3, statusCode: 404 }), [4]],
    ["no response", page({ depth: 5, statusCode: null }), [5]],
  ])("%s → %o", (_label, p, ids) => {
    expect(match(p)).toEqual(ids);
  });

  it("a rule that does not compile matches nothing", () => {
    expect(segmentMatcher([{ name: "bad", rule: { kind: "urlPattern", pattern: "/(a+)+/" } }])(page())).toEqual([]);
  });

  it("validates rule shapes", () => {
    expect(SegmentDefSchema.safeParse({ name: "x", rule: { kind: "statusClass", cls: "6xx" } }).success).toBe(false);
    expect(SegmentDefSchema.safeParse({ name: "", rule: { kind: "depthMax", max: 1 } }).success).toBe(false);
    expect(SegmentDefSchema.safeParse({ name: "x", rule: { kind: "depthMax", max: 1 } }).success).toBe(true);
  });

  it("names the CSV cell and parses the filter param", () => {
    expect(segmentCell([0, 3], defs)).toBe("Blog; Shallow");
    expect(segmentCell(null, defs)).toBe("");
    expect(parseSegmentParam("4", defs)).toBe(4);
    expect(parseSegmentParam("6", defs)).toBeNull();
    expect(parseSegmentParam("x", defs)).toBeNull();
    expect(parseSegmentParam("0", undefined)).toBeNull();
    expect(statusClassOf(301)).toBe("3xx");
  });
});
