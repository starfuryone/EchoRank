// @vitest-environment jsdom
//
// tests/site-crawler-4d-ui.test.tsx — Phase 4d in the tabs, every dashboard
// locale: Overview tiles and their notes, the Pages column groups with
// sortable metric headers, metric formatting, CSV columns, and the start
// card's Search Console / GA4 lines.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags")>();
  const on = { ...real.FLAGS, "crawl.gsc": true, "crawl.ga4": true, "crawl.psi": true, "crawl.backlinks": true };
  return { ...real, FLAGS: on, flag: (n: keyof typeof on) => on[n] };
});

import { SITE_CRAWLER_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { MetricTiles, formatMetric, statusNote } from "@/components/seo-tools/site-crawler-metrics";
import { PagesPanel } from "@/components/seo-tools/site-crawler-panels";
import { SourceLines } from "@/components/seo-tools/site-crawler-sources";
import { EMPTY_PAGE_FILTERS, pageFilterParams, type CrawlPagesPage } from "@/lib/site-crawler/types";
import { metricCsvColumns } from "@/lib/site-crawler/csv-columns";
import { METRIC_COLUMNS } from "@/lib/site-crawler/metrics-shared";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const LOCALES: DashLocale[] = ["en", "fr", "de-CH"];
const int = new Intl.NumberFormat("en-US");
let host: HTMLDivElement | null = null;
afterEach(() => {
  host?.remove();
  host = null;
  vi.unstubAllGlobals();
});
async function mount(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => createRoot(host!).render(node));
  await act(async () => {});
  return host;
}

describe("Overview tiles", () => {
  it.each(LOCALES)("%s: pages with data / total, and why a source has none", async (l) => {
    const t = SITE_CRAWLER_COPY[l].p4d;
    const el = await mount(
      <MetricTiles
        t={t}
        int={int}
        data={{
          coverage: { gsc: 812, psi: 3, ga4: 0, backlinks: 2 },
          total: 1200,
          status: { gsc: { status: "ok" }, psi: { status: "waiting_quota", targets: 10, completed: 3 }, backlinks: { status: "stopped", stoppedReason: "usd_cap", targets: 10, completed: 2 } },
        }}
      />,
    );
    expect(el.textContent).toContain(t.tilePages("812", "1,200"));
    expect(el.textContent).toContain(t.stWaitingQuota("3", "20"));
    expect(el.textContent).toContain(t.stUsdCap);
    expect(el.textContent).not.toContain(t.srcGa4);
    expect(el.textContent).not.toMatch(/undefined|NaN/);
  });

  it.each([
    ["gsc", "not_covered", "stGscNotCovered"],
    ["gsc", "not_connected", "stGscNotConnected"],
    ["ga4", "no_property", "stGa4NoProperty"],
    ["ga4", "no_access", "stGa4NoAccess"],
    ["gsc", "needs_reauth", "stReauth"],
    ["gsc", "failed", "stFailed"],
  ] as const)("%s %s → %s", (s, status, key) => {
    const t = SITE_CRAWLER_COPY.en.p4d;
    expect(statusNote(s, { status }, t, int)).toBe(t[key]);
    expect(statusNote(s, { status: "ok" }, t, int)).toBeNull();
  });
});

describe("Pages column groups", () => {
  const data: CrawlPagesPage = {
    page: 1,
    pageSize: 50,
    total: 1,
    totalPages: 1,
    pages: [
      {
        id: "p1", url: "https://x.com/a", statusCode: 200, title: null, titleLength: null, metaDescLength: null, h1Count: null, wordCount: null, depth: 1,
        internalLinks: null, inlinkCount: 3, inSitemap: true, canonical: null, redirectTarget: null, contentType: null, foundOn: null, issueCount: 0, fetchMs: 1,
        metrics: { gsc: { clicks: 12, impressions: 400, ctr: 0.03, position: 4.25 }, backlinks: { referringDomains: 4, backlinks: 9, rank: 120 } },
      } as never,
    ],
  };

  it.each(LOCALES)("%s: a toggle per source with data; columns appear and sort", async (l) => {
    const t = SITE_CRAWLER_COPY[l];
    const onFilters = vi.fn();
    const el = await mount(<PagesPanel data={data} filters={EMPTY_PAGE_FILTERS} onFilters={onFilters} onPage={() => {}} t={t} int={int} />);
    const toggles = [...el.querySelectorAll('[role="group"] button')];
    expect(toggles.map((b) => b.textContent)).toEqual([t.p4d.srcGsc, t.p4d.srcBacklinks]);
    expect(el.textContent).not.toContain(t.p4d.colLabels["gsc.clicks"]);
    await act(async () => (toggles[0] as HTMLButtonElement).click());
    expect(el.textContent).toContain("3.0%");
    expect(el.textContent).toContain("4.3");
    const clicks = [...el.querySelectorAll("th button")].find((b) => b.textContent?.startsWith(t.p4d.colLabels["gsc.clicks"]!))!;
    await act(async () => (clicks as HTMLButtonElement).click());
    expect(onFilters).toHaveBeenCalledWith({ ...EMPTY_PAGE_FILTERS, sort: "gsc.clicks", dir: "desc" });
  });

  it("the sorted source's columns stay visible, with the direction marked", async () => {
    const t = SITE_CRAWLER_COPY.en;
    const el = await mount(<PagesPanel data={data} filters={{ ...EMPTY_PAGE_FILTERS, sort: "backlinks.backlinks", dir: "asc" }} onFilters={() => {}} onPage={() => {}} t={t} int={int} />);
    expect(el.querySelector('th[aria-sort="ascending"]')!.textContent).toContain(t.p4d.colLabels["backlinks.backlinks"]);
    expect(pageFilterParams({ ...EMPTY_PAGE_FILTERS, sort: "gsc.clicks", dir: "asc" }).toString()).toBe("sort=gsc.clicks&dir=asc");
  });

  it("every metric column has a label in every locale; formatting", () => {
    for (const l of LOCALES) for (const c of METRIC_COLUMNS) expect(SITE_CRAWLER_COPY[l].p4d.colLabels[c.key], `${l} ${c.key}`).toBeTruthy();
    expect([formatMetric("gsc.ctr", 0.0345, int), formatMetric("psi.mobile.cls", 0.1, int), formatMetric("gsc.clicks", 1234.4, int), formatMetric("x", null, int)]).toEqual(["3.5%", "0.100", "1,234", "—"]);
  });

  it("the CSV carries every metric column of the chosen sources", () => {
    const cols = metricCsvColumns(["gsc", "backlinks"]);
    expect(cols.map((c) => c.header)).toEqual(METRIC_COLUMNS.filter((c) => c.source === "gsc" || c.source === "backlinks").map((c) => c.header));
    const row = { metrics: [{ source: "gsc", data: { clicks: 7 } }] } as never;
    expect(cols[0]!.value(row)).toBe(7);
    expect(cols.find((c) => c.header === "Backlinks")!.value(row)).toBeNull();
  });
});

describe("start card source lines", () => {
  it.each(LOCALES)("%s: covered GSC, uncovered GSC, no GA4 property", async (l) => {
    const t = SITE_CRAWLER_COPY[l].p4d;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ gsc: { connected: true, property: "sc-domain:x.com", covers: true }, ga4: { connected: true, property: null } }) })));
    const el = await mount(<SourceLines t={t} host="x.com" />);
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    await act(async () => {});
    expect(el.textContent).toContain(t.lineGscConnected("sc-domain:x.com"));
    expect(el.textContent).toContain(t.lineGa4None);
    vi.useRealTimers();
  });
});
