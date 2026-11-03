// Lighthouse runs attached to crawled pages (Phase 3c): which run a page
// gets, how a stored row becomes PsiFacts, and the rules firing on it.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { lighthouseAudit: { findMany: (...a: unknown[]) => findMany(...a) } } }));

import { evaluateSiteRules, type StoredPageFacts } from "@/lib/crawl-rules";
import { PSI_MAX_AGE_DAYS, pickRuns, psiFactsForUrls, toPsiFacts, type LighthouseRow } from "@/lib/site-crawler/psi";

const row = (over: Partial<LighthouseRow>): LighthouseRow => ({
  url: "https://example.com/a",
  strategy: "mobile",
  lighthouseVersion: "13.0.1",
  fetchedAt: new Date("2026-11-01T00:00:00Z"),
  metrics: [],
  crux: null,
  audits: {},
  ...over,
});

describe("pickRuns", () => {
  it("prefers mobile, then the newest, and matches with or without a trailing slash", () => {
    const rows = [
      row({ url: "https://example.com/a/", strategy: "desktop", fetchedAt: new Date("2026-11-02") }),
      row({ url: "https://example.com/a", strategy: "mobile", fetchedAt: new Date("2026-10-01"), lighthouseVersion: "old" }),
      row({ url: "https://example.com/a", strategy: "mobile", fetchedAt: new Date("2026-10-20"), lighthouseVersion: "new" }),
    ];
    const got = pickRuns(["https://example.com/a", "https://example.com/b"], rows);
    expect(got.get("https://example.com/a")).toMatchObject({ strategy: "mobile", lighthouseVersion: "new" });
    expect(got.has("https://example.com/b")).toBe(false);
  });
});

describe("toPsiFacts", () => {
  it("uses the stored audit verdicts when the run has them", () => {
    const f = toPsiFacts(row({ audits: { "dom-size-insight": { score: 0, value: 4000, display: "4,000 elements" } } }));
    expect(f.audits["dom-size-insight"]?.score).toBe(0);
  });

  it("falls back to the five lab metrics on a run from before 3c", () => {
    const f = toPsiFacts(
      row({ audits: null, metrics: [{ key: "LCP", value: 3100, score: 48, display: "3.1 s" }, { key: "TTI", value: 1, score: 1 }] }),
    );
    expect(f.audits).toEqual({ "largest-contentful-paint": { score: 0.48, value: 3100, display: "3.1 s" } });
  });

  it("takes field INP for the page only, never the origin's", () => {
    const metrics = [{ key: "INP", p75: 350 }];
    expect(toPsiFacts(row({ crux: { originFallback: false, metrics } })).inpP75).toBe(350);
    expect(toPsiFacts(row({ crux: { originFallback: true, metrics } })).inpP75).toBeNull();
  });
});

describe("rules on an attached run", () => {
  const page: StoredPageFacts = {
    url: "https://example.com/a", rootUrl: "https://example.com/", depth: 1, statusCode: 200, redirectTarget: null,
    contentType: "text/html", title: "t", metaDescription: null, h1First: null, h2First: null, canonical: null,
    noindex: false, inSitemap: null, inlinkCount: 1, hreflang: [], langAttr: "en", relNext: null, relPrev: null,
  };
  const ctx = (psi: ReturnType<typeof toPsiFacts> | null) => ({
    capabilities: psi ? (["psi"] as const) : ([] as const),
    psi,
    isRoot: false,
    job: { pagesCrawled: 1, langsSeen: 1, sitemap: { found: false, urlCount: 0, largestFileUrls: 0, notCrawled: 0, notCrawledSample: null, declaredInRobots: false } },
    site: {
      duplicateTitleCount: 1, duplicateMetaCount: 1, duplicateH1Count: 1, duplicateH2Count: 1, duplicateContentCount: 1,
      nearDuplicateCount: 0, h1MatchesOtherTitleCount: 0, nofollowInlinkCount: 0, redirectLoop: null, outlinksToRedirect: 0,
      orphan: false, canonicalTarget: null,
      hreflang: { targets: 0, non200: 0, noindex: 0, notCanonical: 0, missingReturn: 0, langMismatch: 0, unlinked: 0, sample: null },
      pagination: { non200: 0, sequenceErrors: 0, sample: null },
    },
  });

  it("fires the LCP rule from an old run's lab metric, and nothing without a run", () => {
    const psi = toPsiFacts(row({ audits: null, metrics: [{ key: "LCP", value: 3100, score: 48, display: "3.1 s" }] }));
    const ids = evaluateSiteRules(page, ctx(psi)).map((i) => i.ruleId);
    expect(ids).toContain("performance.lcp_over_2_5s");
    expect(evaluateSiteRules(page, ctx(null)).filter((i) => i.ruleId.startsWith("performance."))).toEqual([]);
  });
});

describe("psiFactsForUrls", () => {
  it("reads only this tenant's recent runs for the batch's URLs, and nothing for an empty batch", async () => {
    findMany.mockResolvedValue([row({})]);
    const now = new Date("2026-11-03T00:00:00Z");
    const got = await psiFactsForUrls("t1", ["https://example.com/a"], now);
    expect(got.size).toBe(1);
    const where = findMany.mock.calls[0]![0].where;
    expect(where.tenantId).toBe("t1");
    expect(where.url.in).toEqual(["https://example.com/a", "https://example.com/a/"]);
    expect(now.getTime() - where.fetchedAt.gte.getTime()).toBe(PSI_MAX_AGE_DAYS * 86_400_000);
    findMany.mockClear();
    expect((await psiFactsForUrls("t1", [])).size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });
});
