// @vitest-environment jsdom
//
// tests/site-crawler-4g-inspection.test.tsx — Phase 4g URL Inspection: the
// API call and parse, the per-property quota (2,000/day, 600/min), the
// config checks, the text columns in the Pages CSV, the start card in every
// dashboard locale, the public line and row.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { INSPECTIONS_PER_DAY, INSPECTIONS_PER_MINUTE, inspectUrl, parseInspection, reserveInspection } from "@/lib/gsc/inspection";
import { CrawlConfigInputSchema, checkCrawlConfig } from "@/lib/site-crawler/crawl-config";
import { METRIC_COLUMNS, METRIC_SORT_KEYS } from "@/lib/site-crawler/metrics-shared";
import { metricCsvColumns } from "@/lib/site-crawler/csv-columns";
import { needsMetrics } from "@/lib/site-crawler/metrics-runner";
import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { InspectionSection } from "@/components/seo-tools/site-crawler-inspection";
import { problemText } from "@/components/seo-tools/site-crawler-config";
import { FLAGS } from "@/lib/flags";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { CRAWL_CAPABILITIES, CRAWL_FEATURE_ROWS, capabilityBody, featureCells } from "@/lib/site-crawler/marketing-copy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const int = new Intl.NumberFormat("en-US");
const API = {
  inspectionResult: {
    indexStatusResult: {
      verdict: "NEUTRAL", coverageState: "Crawled - currently not indexed", indexingState: "INDEXING_ALLOWED", robotsTxtState: "ALLOWED",
      pageFetchState: "SUCCESSFUL", googleCanonical: "https://x.com/a", lastCrawlTime: "2026-10-30T08:00:00Z",
    },
    mobileUsabilityResult: { verdict: "PASS" },
    richResultsResult: { verdict: "PASS" },
  },
};

describe("the API", () => {
  it("POSTs the URL and the property with the token in a header, and keeps the nine fields", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const f = vi.fn(async (url: string, init: RequestInit) => ((seen = { url, init }), new Response(JSON.stringify(API), { status: 200 })));
    const r = await inspectUrl("ya29.token", "sc-domain:x.com", "https://x.com/a", f as never);
    expect(seen!.url).toBe("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect");
    expect((seen!.init.headers as Record<string, string>).Authorization).toBe("Bearer ya29.token");
    expect(JSON.parse(seen!.init.body as string)).toEqual({ inspectionUrl: "https://x.com/a", siteUrl: "sc-domain:x.com", languageCode: "en-US" });
    expect(r).toEqual({
      verdict: "NEUTRAL", coverageState: "Crawled - currently not indexed", indexingState: "INDEXING_ALLOWED", robotsTxtState: "ALLOWED",
      pageFetchState: "SUCCESSFUL", googleCanonical: "https://x.com/a", lastCrawlTime: "2026-10-30T08:00:00Z", mobileUsability: "PASS", richResults: "PASS",
    });
    expect(parseInspection({})).toMatchObject({ verdict: null, googleCanonical: null });
  });
});

describe("quota", () => {
  const fakeRedis = () => {
    const m = new Map<string, number>();
    return {
      m,
      incr: async (k: string) => (m.set(k, (m.get(k) ?? 0) + 1), m.get(k)!),
      decr: async (k: string) => (m.set(k, (m.get(k) ?? 0) - 1), m.get(k)!),
      expire: async () => 1,
    };
  };
  const now = new Date("2026-11-04T10:15:30.000Z");
  it("allows the limits exactly, then stops at the day and waits at the minute, giving the count back", async () => {
    const r = fakeRedis();
    for (let i = 0; i < INSPECTIONS_PER_MINUTE; i++) expect((await reserveInspection(r as never, "sc-domain:x.com", now)).ok).toBe(true);
    const wait = await reserveInspection(r as never, "sc-domain:x.com", now);
    expect(wait).toEqual({ ok: false, reason: "minute", waitMs: 31_000 });
    const dayKey = [...r.m.keys()].find((k) => k.endsWith("2026-11-04"))!;
    expect(r.m.get(dayKey)).toBe(INSPECTIONS_PER_MINUTE);
    r.m.set(dayKey, INSPECTIONS_PER_DAY);
    expect(await reserveInspection(r as never, "sc-domain:x.com", new Date("2026-11-04T10:16:00Z"))).toEqual({ ok: false, reason: "daily_quota" });
    expect(r.m.get(dayKey)).toBe(INSPECTIONS_PER_DAY);
    // Another property has its own counters.
    expect((await reserveInspection(r as never, "https://y.com/", now)).ok).toBe(true);
  });
});

describe("config, columns", () => {
  const check = (inspection: unknown, ctx: Record<string, unknown> = {}) =>
    checkCrawlConfig(CrawlConfigInputSchema.parse({ inspection }), { urlCap: 100, verified: false, inspectionCap: 200, gscCovers: true, ...ctx }).problems.map((p) => `${p.field}:${p.code}`);
  it.each([
    ["covered, within the cap", { pages: 200, segment: null }, {}, []],
    ["over the cap", { pages: 201, segment: null }, {}, ["inspection:over_plan_cap"]],
    ["GSC does not cover the host", { pages: 10, segment: null }, { gscCovers: false }, ["inspection:gsc_not_covering"]],
  ] as const)("%s", (_n, ins, ctx, codes) => expect(check(ins, ctx)).toEqual(codes));
  it("queues the metrics job", () => expect(needsMetrics({ inspection: { pages: 5, segment: null } })).toBe(true));
  it("adds nine text columns to the Pages CSV; none is sortable", () => {
    const cols = METRIC_COLUMNS.filter((c) => c.source === "gsc_inspection");
    expect(cols).toHaveLength(9);
    expect(cols.every((c) => !METRIC_SORT_KEYS.has(c.key))).toBe(true);
    const csv = metricCsvColumns(["gsc_inspection"]);
    const row = { metrics: [{ source: "gsc_inspection", data: parseInspection(API) }] } as never;
    expect(csv.map((c) => c.header)).toContain("Google canonical");
    expect(csv.find((c) => c.header === "Coverage state")!.value(row)).toBe("Crawled - currently not indexed");
  });
});

describe("start card", () => {
  it.each(["en", "fr", "de-CH"] as const)("%s: offered only when GSC covers the host; quota stated", async (l) => {
    const t = SITE_CRAWLER_COPY[l];
    let covers = false;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ gsc: { connected: true, property: "sc-domain:x.com", covers } }) })));
    const el = document.createElement("div");
    const root = createRoot(el);
    await act(async () => root.render(<InspectionSection t={t.p4g} t4d={t.p4d} host="x.com" cap={200} value={null} segments={[]} int={int} disabled={false} onChange={() => {}} />));
    expect(el.textContent).toContain(t.p4g.insNotCovered);
    expect((el.querySelector("input[type=checkbox]") as HTMLInputElement).disabled).toBe(true);
    root.unmount();
    covers = true;
    const el2 = document.createElement("div");
    const root2 = createRoot(el2);
    await act(async () => root2.render(<InspectionSection t={t.p4g} t4d={t.p4d} host="x.com" cap={200} value={{ pages: 50, segment: null }} segments={[]} int={int} disabled={false} onChange={() => {}} />));
    expect(el2.textContent).toContain(t.p4g.insQuota);
    expect(el2.textContent).toContain(t.p4g.insOn("200"));
    expect(problemText({ field: "inspection", code: "gsc_not_covering" }, t.p4a, t.p4b, t.p4d, t.p4e, t.p4g)).toBe(t.p4g.problemInsGsc);
    if (l === "de-CH") expect(JSON.stringify(t.p4g) + JSON.stringify(t.p4d)).not.toContain("ß");
    root2.unmount();
    vi.unstubAllGlobals();
  });
});

describe("public line and row", () => {
  it("renders behind crawl.inspection with the given wording; cells from plan-config", () => {
    expect(FLAGS["crawl.inspection"]).toBe(true);
    const card = CRAWL_CAPABILITIES.find((c) => c.id === "index-status")!;
    expect(card.title.en).toBe("Index status");
    expect(capabilityBody(card, "en")).toBe("What Google reports for each page: indexed or not, its chosen canonical, last crawl.");
    const plans = { STARTER: PLAN_CONFIGS.STARTER, GROWTH: PLAN_CONFIGS.GROWTH, AGENCY: PLAN_CONFIGS.AGENCY };
    expect(Object.values(featureCells(CRAWL_FEATURE_ROWS.find((r) => r.id === "index-status")!, plans, "en"))).toEqual(["50 pages per crawl", "200 pages per crawl", "500 pages per crawl"]);
  });
});
