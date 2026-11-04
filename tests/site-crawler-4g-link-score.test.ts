// tests/site-crawler-4g-link-score.test.ts — Phase 4g Link Score: PageRank
// over typed arrays (damping 0.85, 20 iterations), the 0–100 log scale, the
// bottom-decile threshold, node sizing, the rule, the public row.
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { DAMPING, ITERATIONS, bottomDecile, logScale, pageRank } from "@/lib/site-crawler/link-score";
import { nodeRadius, nodeSize } from "@/lib/site-crawler/structure-view";
import { FLAGS } from "@/lib/flags";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { CRAWL_FEATURE_ROWS, featureCells, visibleFeatureRows } from "@/lib/site-crawler/marketing-copy";

const edges = (pairs: [number, number][]) => ({ src: Int32Array.from(pairs.map((p) => p[0])), dst: Int32Array.from(pairs.map((p) => p[1])), m: pairs.length });

describe("pageRank", () => {
  it("uses the documented parameters", () => {
    expect([DAMPING, ITERATIONS]).toEqual([0.85, 20]);
  });
  it("is a distribution, and the page everyone links to ranks first", () => {
    // 0 is the hub: 1..4 link to it; it links back to 1 only.
    const e = edges([[1, 0], [2, 0], [3, 0], [4, 0], [0, 1]]);
    const r = pageRank(5, e.src, e.dst, e.m);
    expect(r.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(Math.max(...r)).toBe(r[0]);
    expect(r[1]).toBeGreaterThan(r[2]!);
    expect(r[2]).toBeCloseTo(r[3]!, 12);
  });
  it("spreads a dangling page's rank instead of losing it", () => {
    const e = edges([[0, 1]]); // 1 links nowhere
    const r = pageRank(3, e.src, e.dst, e.m);
    expect(r.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });
  it("handles a 25,000-page, 500,000-edge graph in typed arrays quickly", () => {
    const n = 25_000;
    const m = 500_000;
    const src = new Int32Array(m);
    const dst = new Int32Array(m);
    for (let i = 0; i < m; i++) {
      src[i] = i % n;
      dst[i] = (i * 7919) % n;
    }
    const t = performance.now();
    const r = pageRank(n, src, dst, m);
    expect(performance.now() - t).toBeLessThan(5_000);
    expect(r.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4);
  });
});

describe("scale and threshold", () => {
  it("log-scales to 0–100", () => {
    const s = logScale(Float64Array.from([0.001, 0.01, 0.1]));
    expect(Array.from(s)).toEqual([0, 50, 100]);
    expect(Array.from(logScale(Float64Array.from([0.5, 0.5])))).toEqual([100, 100]);
  });
  it("finds the bottom decile; none for tiny crawls or no spread", () => {
    expect(bottomDecile(Array.from({ length: 20 }, (_, i) => i * 5))).toBe(10);
    // A tie at the bound never sweeps in: 1 low page, 12 equal ones.
    expect(bottomDecile([0, ...Array(12).fill(40), 100])).toBe(40);
    expect(bottomDecile([1, 2, 3])).toBeNull();
    expect(bottomDecile(Array(30).fill(100))).toBeNull();
  });
  it("sizes Structure nodes by Link Score when present, by inlinks otherwise", () => {
    expect(nodeSize({ inlinks: 3, linkScore: 100 }, 10)).toBe(nodeRadius(100, 100));
    expect(nodeSize({ inlinks: 3, linkScore: 0 }, 10)).toBe(3);
    expect(nodeSize({ inlinks: 10, linkScore: null }, 10)).toBe(12);
  });
});

describe("public row", () => {
  it("renders with crawl.linkScore, a tick-like cell on every plan", () => {
    expect(FLAGS["crawl.linkScore"]).toBe(true);
    expect(visibleFeatureRows({ families: new Set(), flags: FLAGS }).map((r) => r.id)).toContain("link-score");
    const plans = { STARTER: PLAN_CONFIGS.STARTER, GROWTH: PLAN_CONFIGS.GROWTH, AGENCY: PLAN_CONFIGS.AGENCY };
    expect(Object.values(featureCells(CRAWL_FEATURE_ROWS.find((r) => r.id === "link-score")!, plans, "fr"))).toEqual(Array(3).fill("Toutes les pages explorées"));
  });
});
