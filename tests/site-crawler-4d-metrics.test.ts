// tests/site-crawler-4d-metrics.test.ts — Phase 4d caps, the join key, metric columns.
import { describe, expect, it } from "vitest";
import { planConfig } from "@/lib/plan-config";
import { metricCapsForPlan } from "@/lib/site-crawler/quota";
import { METRIC_COLUMNS, METRIC_SOURCES, sortPath, urlKey } from "@/lib/site-crawler/metrics-shared";

describe("plan caps (crawlPsiPages / crawlBacklinkPages)", () => {
  it.each([
    ["STARTER", 10, 10],
    ["GROWTH", 50, 50],
    ["AGENCY", 100, 100],
    ["ENTERPRISE", 100, 100],
  ] as const)("%s: %i PSI pages, %i backlink pages", (plan, psi, bl) => {
    expect(metricCapsForPlan(plan)).toEqual({ psiCap: psi, backlinkCap: bl });
    expect(planConfig(plan)).toMatchObject({ crawlPsiPages: psi, crawlBacklinkPages: bl });
  });
});

describe("urlKey: scheme, trailing slash, host case", () => {
  it.each([
    ["https://Example.com/a/", "example.com/a"],
    ["http://example.com/a", "example.com/a"],
    ["https://example.com/", "example.com"],
    ["https://example.com", "example.com"],
    ["https://example.com/a?page=2#top", "example.com/a?page=2"],
    ["https://example.com/A", "example.com/A"],
    ["https://www.example.com/a", "www.example.com/a"],
    ["not a url", null],
  ])("%s → %s", (raw, key) => {
    expect(urlKey(raw)).toBe(key);
  });
});

describe("metric columns", () => {
  it("cover every source, with unique sort keys that resolve to a jsonb path", () => {
    expect(new Set(METRIC_COLUMNS.map((c) => c.source))).toEqual(new Set(METRIC_SOURCES));
    expect(new Set(METRIC_COLUMNS.map((c) => c.key)).size).toBe(METRIC_COLUMNS.length);
    expect(sortPath("psi.mobile.lcpMs")).toEqual({ source: "psi", path: ["mobile", "lcpMs"] });
    expect(sortPath("gsc.clicks")).toEqual({ source: "gsc", path: ["clicks"] });
    expect(sortPath("gsc.clicks; DROP")).toBeNull();
  });

  it("read numbers, never a failed run", () => {
    const col = (k: string) => METRIC_COLUMNS.find((c) => c.key === k)!;
    expect(col("gsc.clicks").value({ clicks: 3 })).toBe(3);
    expect(col("gsc.clicks").value(null)).toBeNull();
    expect(col("psi.mobile.performance").value({ mobile: { performance: 88 } })).toBe(88);
    expect(col("psi.mobile.performance").value({ mobile: { error: "x" } })).toBeNull();
  });
});
