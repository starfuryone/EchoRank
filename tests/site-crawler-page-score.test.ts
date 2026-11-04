// tests/site-crawler-page-score.test.ts — the Pages view's page score and the
// Issues banner's page count, written in the summary pass.
//
// pageScore() is the reference: 100 − min(100, 10 × weighted findings on the
// page), weights 3 / 1 / 0.25 (site health with one page). scorePages() does
// the same in SQL; the expected values below are what Postgres 16 returned for
// that SQL on a scratch cluster (one high 70, three lows 93, high + medium +
// low 58 — 57.5 rounded up, as Math.round does — four highs 0, none 100).
import { describe, expect, it, vi } from "vitest";

const executeRaw = vi.fn(async () => 0);
const queryRaw = vi.fn();
const update = vi.fn(async () => ({}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRaw: (...a: unknown[]) => executeRaw(...(a as [])),
    $queryRaw: (...a: unknown[]) => queryRaw(...a),
    crawlIssue: { groupBy: async () => [], count: async () => 5 },
    crawlJob: { findUnique: async () => ({ summary: { kept: true }, pagesCrawled: 10 }), update: (...a: unknown[]) => update(...(a as [])) },
  },
}));

import { HEALTH_SCALE, HEALTH_WEIGHTS, pageScore, scoreBand } from "@/lib/site-crawler/site-health";
const { recountIssues } = await import("@/lib/site-crawler/aggregate");

describe("pageScore", () => {
  it.each([
    [{ high: 0, medium: 0, low: 0 }, 100],
    [{ high: 1, medium: 0, low: 0 }, 70],
    [{ high: 0, medium: 1, low: 0 }, 90],
    [{ high: 0, medium: 0, low: 3 }, 93],
    [{ high: 1, medium: 1, low: 1 }, 58],
    [{ high: 4, medium: 0, low: 0 }, 0],
  ])("%o → %i", (counts, score) => {
    expect(pageScore(counts)).toBe(score);
  });

  it("bands like site health: ≥ 80 good, 50–79 fair, < 50 poor", () => {
    expect([100, 80, 79, 50, 49, 0].map(scoreBand)).toEqual(["good", "good", "fair", "fair", "poor", "poor"]);
  });
});

describe("the summary pass", () => {
  it("writes every page's score and counts, then the summary's highPages", async () => {
    queryRaw.mockImplementation(async (strings: TemplateStringsArray) =>
      strings.join("?").includes("\"priority\" = 'high'") ? [{ pages: BigInt(3) }] : [{ ruleId: "h1.missing", kind: "issue", priority: "high", n: BigInt(4), pages: BigInt(3) }],
    );
    await recountIssues("job1");
    expect(executeRaw).toHaveBeenCalledTimes(2);
    const [reset, score] = executeRaw.mock.calls as unknown as [TemplateStringsArray, ...unknown[]][];
    expect(reset[0].join("?")).toContain('SET "pageScore" = 100, "issueTotal" = 0, "issueHigh" = 0');
    expect(reset.slice(1)).toEqual(["job1"]);
    const sql = score[0].join("?");
    expect(sql).toContain("::numeric");
    expect(sql).toContain('GROUP BY "crawlPageId"');
    // The weights and scale come from site-health.ts, not literals in the SQL.
    expect(score.slice(1)).toEqual(expect.arrayContaining([HEALTH_SCALE, HEALTH_WEIGHTS.high, HEALTH_WEIGHTS.medium, HEALTH_WEIGHTS.low, "job1"]));
    const data = (update.mock.calls[0] as unknown as [{ data: { summary: Record<string, unknown> } }])[0].data.summary;
    expect(data).toMatchObject({ kept: true, highPages: 3, issues: { "h1.missing": { count: 4, pages: 3 } } });
  });
});
