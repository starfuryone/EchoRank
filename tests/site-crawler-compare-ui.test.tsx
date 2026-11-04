// @vitest-environment jsdom
//
// tests/site-crawler-compare-ui.test.tsx — the Compare tab in every dashboard
// locale: default baseline, the stored comparison, summary deltas, buckets with
// CSV links, keyset "show more", the POST body, and error messages.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SITE_CRAWLER_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { ComparePanel, bucketLabel, compareError, summaryRows, type ComparisonDto } from "@/components/seo-tools/site-crawler-compare";
import { crawlTabs } from "@/components/seo-tools/site-crawler-client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const side = (pages: number, errors: number) => ({ pages, indexable: pages - errors, redirects: 0, errors, issues: { ERROR: errors, WARNING: 1, NOTICE: 0 } });
const cmp: ComparisonDto = {
  id: "cmp1",
  jobBId: "b",
  segmentId: null,
  mapping: [],
  createdAt: "2026-11-02T00:00:00.000Z",
  result: {
    counts: { added: 21, removed: 0, changed: 1, issuesNew: 1, issuesResolved: 0 },
    summary: { a: side(12, 2), b: side(10, 0) },
    rules: [{ ruleId: "response_codes.internal_4xx", new: 1, resolved: 0 }],
    samples: {
      added: Array.from({ length: 21 }, (_, i) => `https://x.com/n${i}`),
      removed: [],
      changed: [{ url: "https://x.com/a", fields: ["title", "status"] }],
      issuesNew: [{ url: "https://x.com/n0", ruleId: "response_codes.internal_4xx" }],
      issuesResolved: [],
    },
    truncated: false,
  },
};

describe("pure helpers", () => {
  const c = SITE_CRAWLER_COPY.en.p4c;
  it("summary rows read baseline then this crawl", () => {
    expect(summaryRows(cmp.result.summary, c)[0]).toEqual([c.mPages, 10, 12]);
    expect(summaryRows(cmp.result.summary, c)).toHaveLength(7);
  });

  it.each([
    [{ code: "INVALID_MAPPING", problems: [{ index: 2 }] }, "errMapping3"],
    [{ code: "COMPARE_ERROR", reason: "segment_missing" }, "errSegmentMissing"],
    [{ code: "COMPARE_ERROR", reason: "timeout" }, "errTimeout"],
    [{ code: "COMPARE_ERROR", reason: "invalid_mapping" }, "errMappingAny"],
    [{ code: "COMPARE_ERROR", reason: "not_comparable" }, "errNotComparable"],
    [null, "errGeneric"],
  ] as const)("%j → %s", (body, key) => {
    const want = key === "errMapping3" ? c.errMapping(3) : c[key];
    expect(compareError(body as never, c)).toBe(want);
  });

  it("Compare shows on a completed, kept crawl only", () => {
    expect(crawlTabs({ config: null, status: "COMPLETED" })).toContain("compare");
    expect(crawlTabs({ config: null, status: "FAILED" })).not.toContain("compare");
    expect(crawlTabs({ config: null, status: "COMPLETED", dataPurgedAt: "2026-11-01" })).not.toContain("compare");
  });
});

describe("ComparePanel", () => {
  let host: HTMLDivElement | null = null;
  afterEach(() => {
    host?.remove();
    host = null;
    vi.unstubAllGlobals();
  });
  const int = new Intl.NumberFormat("en-US");

  async function mount(l: DashLocale, fetchImpl: (url: string, init?: RequestInit) => unknown) {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ({ ok: true, json: async () => fetchImpl(url, init) }));
    vi.stubGlobal("fetch", fetchMock);
    host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      createRoot(host!).render(<ComparePanel crawlId="a" segment="1" segmentName="Blog" locale={l} t={SITE_CRAWLER_COPY[l]} int={int} />);
    });
    await act(async () => {});
    return fetchMock;
  }

  const listing = {
    candidates: [
      { id: "b", rootUrl: "https://x.com/", createdAt: "2026-11-02T00:00:00.000Z", pagesCrawled: 10 },
      { id: "z", rootUrl: "https://x.com/", createdAt: "2026-10-01T00:00:00.000Z", pagesCrawled: 9 },
    ],
    defaultBaselineId: "b",
    comparisons: [{ ...cmp, segmentId: 1 }],
  };

  it.each(["en", "fr", "de-CH"] as const)("%s: opens on the stored comparison with deltas, buckets and CSV links", async (l) => {
    await mount(l, () => listing);
    const c = SITE_CRAWLER_COPY[l].p4c;
    const text = host!.textContent!;
    expect(text).toContain(c.cmpSegment("Blog"));
    expect(text).toContain(bucketLabel("added", c));
    expect(text).toContain(c.changedList(`${c.fieldTitle}, ${c.fieldStatus}`));
    expect(text).toContain("+2");
    expect(text).not.toMatch(/undefined|NaN|\[object Object\]/);
    const csv = [...host!.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(csv).toContain("/api/seo/v1/crawl/a/compare/cmp1?bucket=added&format=csv");
    // 21 added: 20 shown, then "show more" reveals the rest of the stored sample.
    expect(host!.querySelectorAll("li").length).toBe(20 + 1 + 1);
  });

  it("Compare POSTs the baseline, the non-empty mapping rules and the segment", async () => {
    const fetchMock = await mount("en", (url, init) => (init?.method === "POST" ? { ...cmp, id: "cmp2" } : listing));
    const run = [...host!.querySelectorAll("button")].find((b) => b.textContent === SITE_CRAWLER_COPY.en.p4c.cmpRun)!;
    await act(async () => run.click());
    const call = fetchMock.mock.calls.find((x) => (x[1] as RequestInit | undefined)?.method === "POST")!;
    expect(call[0]).toBe("/api/seo/v1/crawl/a/compare");
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ baselineId: "b", mapping: [], segment: 1 });
  });

  it("no candidates: says so", async () => {
    await mount("en", () => ({ candidates: [], defaultBaselineId: null, comparisons: [] }));
    expect(host!.textContent).toContain(SITE_CRAWLER_COPY.en.p4c.cmpNoCandidates);
  });
});
