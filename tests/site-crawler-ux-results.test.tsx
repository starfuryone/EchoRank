// @vitest-environment jsdom
//
// tests/site-crawler-ux-results.test.tsx — the Results view (/crawler/[id]) of
// the UX restructure: the completeness banner, the Site health hero beside
// pages and the three kind totals, Fix first (top five high-priority rules by
// pages, each linking to its affected pages), the grouped tab strip with a
// roving tabindex, and the Exports menu. In every dashboard locale.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { SiteCrawlerClient } from "@/components/seo-tools/site-crawler-client";
import { completenessLines } from "@/components/seo-tools/site-crawler-results";
import type { CrawlDto } from "@/lib/site-crawler/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const LOCALES = ["en", "fr", "de-CH"] as const;

const crawl = {
  id: "c1", rootUrl: "https://shop.example/", status: "COMPLETED", urlCap: 5000, pagesCrawled: 2476, issueCount: 900, stoppedReason: "time_cap",
  startedAt: "2026-11-01T10:00:00Z", finishedAt: "2026-11-01T11:00:00Z", createdAt: "2026-11-01T10:00:00Z", renderMode: "none", renderCap: 0,
  pagesRendered: 0, mode: "spider", config: null, pinned: false, dataPurgedAt: null, health: 73,
};
const tally = (count: number, pages: number, priority: string, kind = "issue") => ({ count, pages, priority, kind });
const summary = {
  // The tallies-only shape (an older crawl): enough for the hero and Fix first.
  partial: true,
  issuesByKind: { issue: 700, warning: 150, opportunity: 50 },
  issues: {
    r1: tally(40, 40, "high"), r2: tally(300, 12, "high"), r3: tally(12, 12, "high"), r4: tally(9, 9, "high"),
    r5: tally(8, 8, "high"), r6: tally(7, 7, "high"), m1: tally(500, 500, "medium", "warning"),
  },
};
const quota = { urlCap: 5000, renderCap: 500, monthlyLimit: 20, used: 2, remaining: 18, allowed: true, locked: false, crawlsKept: 10 };

let el: HTMLDivElement;
let root: Root;
let calls: string[];
beforeEach(() => {
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string) => {
      calls.push(u);
      if (u === "/api/seo/v1/crawl") return { ok: true, json: async () => ({ crawls: [crawl], quota }) };
      if (u.startsWith("/api/seo/v1/crawl/c1/summary")) return { ok: true, json: async () => summary };
      if (u.startsWith("/api/seo/v1/crawl/c1/rules")) return { ok: true, json: async () => ({ pagesCrawled: 2476, rules: [] }) };
      return { ok: false, json: async () => null };
    }),
  );
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

const render = async (l: (typeof LOCALES)[number]) => {
  await act(async () => root.render(<SiteCrawlerClient locale={l} view="results" crawlId="c1" />));
  await vi.waitFor(() => expect(el.querySelector('[data-testid="fix-first"]')).not.toBeNull());
};

describe.each(LOCALES)("%s", (l) => {
  const t = SITE_CRAWLER_COPY[l];
  const int = new Intl.NumberFormat(l === "en" ? "en-US" : l);

  it("heads with host, banner, health beside pages and the kind totals", async () => {
    await render(l);
    expect(el.querySelector('[data-testid="results-host"]')!.textContent).toContain("shop.example");
    expect(el.querySelector('[data-testid="completeness"]')!.textContent).toContain(t.ux.bannerTime(int.format(2476), int.format(5000)));
    const hero = el.querySelector('[data-testid="results-hero"]')!;
    expect(hero.querySelector("[data-health]")!.textContent).toBe("73");
    expect(hero.querySelector('[data-kind="pages"]')!.textContent).toContain(int.format(2476));
    expect(hero.querySelector('[data-kind="issue"]')!.textContent).toContain("700");
    expect(hero.querySelector('[data-kind="opportunity"]')!.textContent).toContain(t.ux.kindOpportunity);
    if (l === "de-CH") expect(JSON.stringify(t.ux)).not.toContain("ß");
  });

  it("Fix first: five high-priority rules by pages; the link opens Issues › By rule on that rule", async () => {
    await render(l);
    const items = [...el.querySelectorAll<HTMLLIElement>('[data-testid="fix-first"] > li')];
    expect(items.map((i) => i.dataset.rule)).toEqual(["r1", "r2", "r3", "r4", "r5"]);
    expect(items[0]!.textContent).toContain(t.ux.fixPages(int.format(40)));
    const link = [...items[1]!.querySelectorAll("a")].find((a) => a.textContent === t.ux.fixSee)!;
    expect(link.getAttribute("href")).toBe("/crawler/c1?rule=r2");
    await act(async () => link.click());
    await vi.waitFor(() => expect(calls.some((u) => u.startsWith("/api/seo/v1/crawl/c1/rules/r2"))).toBe(true));
    const group = el.querySelector<HTMLButtonElement>('[role=tab][aria-selected="true"]')!;
    expect(group.textContent).toBe(t.ux.grpIssues);
  });

  it("groups the tabs with a roving tabindex and keyboard arrows", async () => {
    await render(l);
    const strip = el.querySelector<HTMLElement>(`[role=tablist][aria-label="${t.ux.tabsLabel}"]`)!;
    const tabs = () => [...strip.querySelectorAll<HTMLButtonElement>("[role=tab]")];
    expect(tabs().map((b) => b.textContent).slice(0, 4)).toEqual([t.ux.grpIssues, t.ux.grpPages, t.ux.grpLinks, t.ux.grpData]);
    expect(tabs().filter((b) => b.tabIndex === 0)).toHaveLength(1);
    await act(async () => tabs()[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(tabs()[1]!.getAttribute("aria-selected")).toBe("true");
    expect(tabs()[1]!.tabIndex).toBe(0);
    expect(document.activeElement).toBe(tabs()[1]);
    // Links holds Duplicates and Redirects as sub-views.
    await act(async () => tabs()[2]!.click());
    const sub = el.querySelector<HTMLElement>(`[role=tablist][aria-label="${t.ux.subTabsLabel}"]`)!;
    expect([...sub.querySelectorAll("[role=tab]")].map((b) => b.textContent)).toEqual(expect.arrayContaining([t.tabDuplicates, t.tabRedirects]));
  });

  it("puts the CSV views in one Exports menu", async () => {
    await render(l);
    const menu = el.querySelector<HTMLElement>('[data-testid="exports-menu"]')!;
    expect(menu.hidden).toBe(true);
    const btn = [...el.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === t.ux.exports)!;
    await act(async () => btn.click());
    expect(menu.hidden).toBe(false);
    const hrefs = [...menu.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/api/seo/v1/crawl/c1/export?view=issues");
    expect(hrefs).toContain("/api/seo/v1/crawl/c1/pages?format=csv");
  });
});

describe("completeness banner", () => {
  const t = SITE_CRAWLER_COPY.en;
  const int = new Intl.NumberFormat("en-US");
  const c = (extra: Partial<CrawlDto>) => ({ ...crawl, stoppedReason: null, ...extra }) as CrawlDto;
  it("says nothing for a full crawl and names each partial case", () => {
    expect(completenessLines(c({}), null, t, int)).toEqual([]);
    expect(completenessLines(c({ stoppedReason: "time_cap" }), null, t, int)).toEqual([
      "Stopped at the one-hour limit after 2,476 of 5,000 pages — the report covers those pages.",
    ]);
    expect(completenessLines(c({ status: "CANCELLED", stoppedReason: "cancelled" }), null, t, int)[0]).toBe(t.ux.bannerCancelled("2,476"));
    expect(completenessLines(c({ mode: "list" }), null, t, int)).toEqual([t.ux.bannerList]);
    const budget = { ...summary, metricOverview: { status: { backlinks: { status: "stopped", stoppedReason: "usd_cap" } } } } as never;
    expect(completenessLines(c({}), budget, t, int)).toEqual([t.ux.bannerUsdCap]);
  });
});
