// tests/site-crawler-health.test.ts — Site health 0–100 and the Fix first
// ranking (UX restructure), pinned against hand-computed fixtures.
import { describe, expect, it } from "vitest";
import { HEALTH_VERSION, fixFirst, healthOf, priorityCounts, siteHealth } from "@/lib/site-crawler/site-health";

describe("siteHealth", () => {
  // [high, medium, low, pages] → score (weighted = 3H + M + 0.25L; 100 − min(100, 10 × weighted / pages))
  const fixtures: [number, number, number, number, number][] = [
    [0, 0, 0, 50, 100], // clean
    [100, 0, 0, 100, 70], // one high per page
    [0, 100, 0, 100, 90], // one medium per page
    [0, 0, 100, 100, 98], // 0.25 per page → 2.5 → 97.5 rounds to 98
    [10, 20, 40, 200, 97], // 30 + 20 + 10 = 60; 10 × 60 / 200 = 3
    [400, 0, 0, 100, 0], // penalty 120 capped at 100
    [1, 0, 0, 2476, 100], // one finding on a big site barely moves it
  ];
  it.each(fixtures)("H%i M%i L%i over %i pages → %i", (high, medium, low, pages, score) => {
    expect(siteHealth({ high, medium, low }, pages)?.score).toBe(score);
  });

  it("keeps its inputs and version, and is null without pages", () => {
    expect(siteHealth({ high: 1, medium: 2, low: 4 }, 10)).toEqual({ score: 94, weighted: 6, pages: 10, version: HEALTH_VERSION });
    expect(siteHealth({ high: 5, medium: 0, low: 0 }, 0)).toBeNull();
  });

  it("counts every kind by priority, from the summary's tallies", () => {
    const counts = priorityCounts({
      a: { count: 3, priority: "high" },
      b: { count: 2, priority: "high" },
      c: { count: 7, priority: "medium" },
      d: { count: 8, priority: "low" },
    });
    expect(counts).toEqual({ high: 5, medium: 7, low: 8 });
  });

  it("reads the stored score, null on an older crawl", () => {
    expect(healthOf({ health: { score: 81 } })).toBe(81);
    expect(healthOf({ issues: {} })).toBeNull();
    expect(healthOf(null)).toBeNull();
  });
});

describe("fixFirst", () => {
  it("ranks high-priority rules by pages affected, then findings, then id; top five", () => {
    const issues = {
      "missing-title": { count: 40, pages: 40, priority: "high" },
      "broken-link": { count: 300, pages: 12, priority: "high" }, // many findings, few pages
      "noindex-in-sitemap": { count: 12, pages: 12, priority: "high" }, // ties on pages, fewer findings
      "h1-missing": { count: 90, pages: 90, priority: "medium" }, // not high
      "dup-title": { count: 0, pages: 0, priority: "high" }, // nothing to fix
      a: { count: 5, pages: 5, priority: "high" },
      b: { count: 5, pages: 5, priority: "high" },
      c: { count: 1, pages: 1, priority: "high" },
    };
    expect(fixFirst(issues).map((i) => i.ruleId)).toEqual(["missing-title", "broken-link", "noindex-in-sitemap", "a", "b"]);
  });

  it("falls back to findings when a tally predates the page count", () => {
    expect(fixFirst({ x: { count: 3, priority: "high" }, y: { count: 9, priority: "high" } })).toEqual([
      { ruleId: "y", pages: 9, count: 9 },
      { ruleId: "x", pages: 3, count: 3 },
    ]);
  });
});
