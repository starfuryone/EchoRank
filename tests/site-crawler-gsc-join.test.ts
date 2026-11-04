// tests/site-crawler-gsc-join.test.ts — Phase 4d Search Console join: which
// properties cover a crawl, merging rows per join key, the 28-day window,
// paging at 25,000 rows, and every reason the join does not run.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const conn = vi.fn();
const searchAnalytics = vi.fn();
const joinChunkByUrl = vi.fn(async (_j: string, _s: string, m: Map<string, unknown>) => m.size);
vi.mock("@/lib/gsc/service", () => ({
  getConnection: () => conn(),
  latestAvailableDay: () => "2026-11-01",
  withAccessToken: (_c: unknown, fn: (t: string) => unknown) => fn("tok"),
}));
vi.mock("@/lib/gsc/client", () => ({ searchAnalytics: (...a: unknown[]) => searchAnalytics(...a) }));
vi.mock("@/lib/site-crawler/metrics", () => ({ joinChunkByUrl: (...a: [string, string, Map<string, unknown>]) => joinChunkByUrl(...a) }));

const { propertyCovers, mergeRows, gscWindow, joinGsc, GSC_PAGE_ROWS } = await import("@/lib/site-crawler/gsc-join");
const row = (page: string, clicks: number, impressions: number, position = 5) => ({ keys: [page], clicks, impressions, ctr: 0, position });

beforeEach(() => vi.clearAllMocks());

describe("propertyCovers", () => {
  it.each([
    ["sc-domain:example.com", "https://example.com/", true],
    ["sc-domain:example.com", "https://www.Example.com/shop", true],
    ["sc-domain:example.com", "https://notexample.com/", false],
    ["https://www.example.com/", "https://www.example.com/", true],
    ["https://www.example.com/", "https://WWW.example.com/a", true],
    ["https://www.example.com/", "http://www.example.com/", false],
    ["https://www.example.com/", "https://example.com/", false],
    ["https://www.example.com/blog/", "https://www.example.com/blog", true],
    ["https://www.example.com/blog/", "https://www.example.com/shop", false],
  ])("%s covers %s → %s", (prop, root, want) => {
    expect(propertyCovers(prop, root)).toBe(want);
  });
});

describe("mergeRows", () => {
  it("merges http/https and slash variants: sums, recomputed CTR, impression-weighted position", () => {
    const m = mergeRows([row("https://x.com/a/", 3, 30, 2), row("http://x.com/a", 1, 10, 6), row("https://x.com/b", 0, 0, 0)]);
    expect(m.get("x.com/a")).toEqual({ clicks: 4, impressions: 40, ctr: 0.1, position: 3 });
    expect(m.get("x.com/b")).toEqual({ clicks: 0, impressions: 0, ctr: 0, position: 0 });
  });
});

it("the window is the 28 days ending on GSC's latest day", () => {
  expect(gscWindow()).toEqual({ startDate: "2026-10-05", endDate: "2026-11-01" });
});

describe("joinGsc", () => {
  const ok = { status: "ACTIVE", siteUrl: "sc-domain:x.com" };

  it("pages at 25,000 rows until a short page, joining each before fetching the next", async () => {
    conn.mockResolvedValue(ok);
    const full = Array.from({ length: GSC_PAGE_ROWS }, (_, i) => row(`https://x.com/p${i}`, 1, 1));
    searchAnalytics.mockResolvedValueOnce(full).mockResolvedValueOnce([row("https://x.com/last", 1, 2)]);
    const out = await joinGsc("j1", "t1", "https://x.com/");
    expect(out).toMatchObject({ status: "ok", property: "sc-domain:x.com", rows: GSC_PAGE_ROWS + 1, pages: GSC_PAGE_ROWS + 1 });
    expect(searchAnalytics.mock.calls.map((c) => (c[2] as { startRow: number }).startRow)).toEqual([0, GSC_PAGE_ROWS]);
    expect(searchAnalytics.mock.calls[0]![2]).toMatchObject({ dimensions: ["page"], rowLimit: 25_000, startDate: "2026-10-05", endDate: "2026-11-01" });
    expect(joinChunkByUrl).toHaveBeenCalledTimes(2);
  });

  it.each([
    [null, "not_connected"],
    [{ status: "NEEDS_REAUTH", siteUrl: "sc-domain:x.com" }, "needs_reauth"],
    [{ status: "ACTIVE", siteUrl: null }, "no_property"],
    [{ status: "ACTIVE", siteUrl: "sc-domain:y.com" }, "not_covered"],
  ])("%j → %s, and nothing is fetched", async (c, status) => {
    conn.mockResolvedValue(c);
    expect(await joinGsc("j1", "t1", "https://x.com/")).toEqual({ status });
    expect(searchAnalytics).not.toHaveBeenCalled();
  });

  it("an API failure is reported, not thrown; a dead token reads as needs_reauth", async () => {
    conn.mockResolvedValue(ok);
    searchAnalytics.mockRejectedValueOnce(new Error("Search analytics query failed: 500"));
    expect(await joinGsc("j1", "t1", "https://x.com/")).toEqual({ status: "failed", error: "Search analytics query failed: 500" });
    searchAnalytics.mockRejectedValueOnce(Object.assign(new Error("x"), { name: "GscReauthError" }));
    expect(await joinGsc("j1", "t1", "https://x.com/")).toEqual({ status: "needs_reauth" });
  });
});
