// @vitest-environment jsdom
//
// tests/site-crawler-ux-history.test.tsx — /crawler/history: hero, card rows
// (state tile, kind line, Pages · Findings · Health, status pill, report link,
// pin), site and status filters, cursor pages, the incomplete-crawl note,
// retention, and the empty states. In every dashboard locale.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { CrawlHistory, healthWhy, historyQuery, historyState, kindLine } from "@/components/seo-tools/site-crawler-history";
import { CRAWL_PIN_MAX, RETENTION_UNFINISHED_DAYS } from "@/lib/site-crawler/constants";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const LOCALES = ["en", "fr", "de-CH"] as const;

const crawl = (i: number, extra: Record<string, unknown> = {}) => ({
  id: `c${i}`, rootUrl: `https://site${i}.example/`, status: "COMPLETED", urlCap: 500, pagesCrawled: 100 + i, issueCount: 3, stoppedReason: null,
  startedAt: null, finishedAt: null, createdAt: "2026-11-01T10:00:00Z", renderMode: "none", renderCap: 0, pagesRendered: 0, mode: "spider",
  config: null, pinned: false, dataPurgedAt: null, health: 80 - i, kinds: { issue: 5, warning: 4, opportunity: 3 }, ...extra,
});
const quota = { urlCap: 5000, crawlsKept: 10 };

let el: HTMLDivElement;
let root: Root;
let calls: { url: string; init?: RequestInit }[];
let empty = false;
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  calls = [];
  empty = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.startsWith("/api/seo/v1/crawl?history=1")) {
        if (empty) return { ok: true, json: async () => ({ crawls: [], quota, total: 0, nextCursor: null, pageSize: 20, hosts: [] }) };
        const second = url.includes("cursor=c4");
        const crawls = second
          ? [crawl(5)]
          : [
              crawl(0, { scheduled: true }),
              crawl(1, { pinned: true, mode: "list" }),
              crawl(2, { dataPurgedAt: "2026-10-01T00:00:00Z", kinds: null }),
              crawl(3, { status: "COMPLETED", stoppedReason: "time_cap", pagesCrawled: 50 }),
              crawl(4, { status: "RUNNING", health: null, kinds: null }),
            ];
        return { ok: true, json: async () => ({ crawls, quota, total: 6, nextCursor: second ? null : "c4", pageSize: 5, hosts: ["site0.example", "site1.example"] }) };
      }
      if (init?.method === "PATCH") return { ok: true, json: async () => ({ pinned: true }) };
      return { ok: false, json: async () => null };
    }),
  );
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const render = async (l: (typeof LOCALES)[number]) => {
  await act(async () => root.render(<CrawlHistory locale={l} />));
  await vi.waitFor(() => expect(el.querySelector('[data-testid="history-rows"]')).not.toBeNull());
};

const u0 = SITE_CRAWLER_COPY.en.ux;
const int0 = new Intl.NumberFormat("en-US");

it("builds its query from the filters and the cursor", () => {
  expect(historyQuery("", "", null)).toBe("history=1");
  expect(historyQuery(" shop.example ", "STOPPED", "c9")).toBe("history=1&host=shop.example&status=STOPPED&cursor=c9");
});

it("classifies each crawl: only a clean finish is a full report", () => {
  expect(historyState({ status: "COMPLETED", stoppedReason: null })).toBe("complete");
  expect(historyState({ status: "QUEUED", stoppedReason: null })).toBe("running");
  expect(historyState({ status: "RUNNING", stoppedReason: null })).toBe("running");
  expect(historyState({ status: "COMPLETED", stoppedReason: "url_cap" })).toBe("stopped");
  expect(historyState({ status: "COMPLETED", stoppedReason: "time_cap" })).toBe("stopped");
  expect(historyState({ status: "COMPLETED", stoppedReason: "list_expired" })).toBe("failed");
  expect(historyState({ status: "FAILED", stoppedReason: "boom" })).toBe("failed");
  expect(historyState({ status: "CANCELLED", stoppedReason: "cancelled" })).toBe("cancelled");
});

it("writes the kind line: why it ended early first, then list mode, then scheduled", () => {
  const c = (x: Record<string, unknown>) => crawl(0, x) as never;
  expect(kindLine(c({}), u0, int0)).toBe("Full crawl");
  expect(kindLine(c({ scheduled: true }), u0, int0)).toBe("Scheduled");
  expect(kindLine(c({ mode: "list", scheduled: true }), u0, int0)).toBe("List mode");
  expect(kindLine(c({ stoppedReason: "time_cap", pagesCrawled: 50 }), u0, int0)).toBe("Stopped early — 50 of 500 pages");
  expect(kindLine(c({ status: "CANCELLED", stoppedReason: "cancelled", pagesCrawled: 50 }), u0, int0)).toBe("Stopped early — 50 of 500 pages");
  expect(kindLine(c({ stoppedReason: "url_cap", pagesCrawled: 500 }), u0, int0)).toBe("Stopped at the 500-page limit");
});

it("shows health only for complete crawls, and says why otherwise", () => {
  const c = (x: Record<string, unknown>) => crawl(0, x) as never;
  expect(healthWhy(c({}), u0)).toBeNull();
  expect(healthWhy(c({ health: null }), u0)).toBe(u0.healthWhyOld);
  expect(healthWhy(c({ status: "RUNNING" }), u0)).toBe(u0.healthWhyRunning);
  expect(healthWhy(c({ stoppedReason: "url_cap" }), u0)).toBe(u0.healthWhyIncomplete);
  expect(healthWhy(c({ status: "CANCELLED" }), u0)).toBe(u0.healthWhyIncomplete);
  expect(healthWhy(c({ status: "FAILED" }), u0)).toBe(u0.healthWhyFailed);
});

describe.each(LOCALES)("%s", (l) => {
  const t = SITE_CRAWLER_COPY[l];
  const u = t.ux;
  const int = new Intl.NumberFormat(l === "en" ? "en-US" : l);

  it("renders the hero, the card rows, the note and retention", async () => {
    await render(l);
    const hero = el.querySelector('[data-testid="history-hero"]')!;
    expect(hero.querySelector("p")!.textContent).toBe(u.histEyebrow);
    expect(hero.querySelector("h1")!.textContent).toBe(u.histTitle);
    expect(hero.textContent).toContain(u.histSubhead);
    expect(hero.querySelector("a")!.getAttribute("href")).toBe("/crawler");

    const rows = [...el.querySelectorAll<HTMLLIElement>('[data-testid="history-rows"] > li')];
    expect(rows.map((r) => r.dataset.state)).toEqual(["complete", "complete", "complete", "stopped", "running"]);
    // Complete: check tile, NN/100, Completed pill, "View report".
    expect(rows[0]!.querySelector("[data-tile]")!.getAttribute("data-tile")).toBe("complete");
    expect(rows[0]!.querySelector("[data-health]")!.textContent).toBe(u.healthScore(int.format(80)));
    expect(rows[0]!.querySelector("[data-kinds]")!.textContent).toContain(int.format(12));
    expect(rows[0]!.querySelector("[data-kind-line]")!.textContent).toContain(u.kindScheduled);
    expect(rows[0]!.querySelector("[data-pill]")!.textContent).toBe(u.pillCompleted);
    const open = rows[0]!.querySelector<HTMLAnchorElement>('a[href="/crawler/c0"]')!;
    expect(open.textContent).toContain(u.viewReport);
    expect(open.getAttribute("aria-label")).toBe(u.viewReportOf("site0.example"));
    expect(rows[1]!.querySelector("[data-kind-line]")!.textContent).toContain(u.kindList);
    // Purged: summary only, nothing to pin.
    expect(rows[2]!.textContent).toContain(u.summaryOnly);
    expect(rows[2]!.querySelector("button")).toBeNull();
    // Stopped at limit: clock tile, "—" with the reason, View details.
    expect(rows[3]!.querySelector("[data-tile]")!.getAttribute("data-tile")).toBe("clock");
    expect(rows[3]!.querySelector("[data-pill]")!.textContent).toBe(u.pillStopped);
    expect(rows[3]!.querySelector("[data-kind-line]")!.textContent).toContain(u.kindStopped(int.format(50), int.format(500)));
    const dash = rows[3]!.querySelector("[data-health] [title]")!;
    expect(dash.getAttribute("title")).toBe(u.healthWhyIncomplete);
    expect(dash.textContent).toContain(u.healthNone);
    expect(rows[3]!.querySelector("a")!.textContent).toContain(u.viewDetails);
    // Running: spinner tile, no pin.
    expect(rows[4]!.querySelector("[data-tile]")!.getAttribute("data-tile")).toBe("running");
    expect(rows[4]!.querySelector("[data-pill]")!.textContent).toBe(u.pillRunning);
    expect(rows[4]!.querySelector("button")).toBeNull();
    // Pin toggles: pinned shows always, unpinned on hover from md up.
    expect(rows[0]!.querySelector(`button[aria-label="${u.pinCrawl("site0.example")}"]`)!.className).toContain("md:opacity-0");
    expect(rows[1]!.querySelector(`button[aria-label="${u.unpinCrawl("site1.example")}"]`)!.className).not.toContain("md:opacity-0");

    expect(el.querySelector('[data-testid="history-note"]')!.textContent).toBe(u.incompleteNote);
    expect(el.querySelector('[data-testid="retention"]')!.textContent).toBe(
      u.historyRetention(int.format(10), int.format(CRAWL_PIN_MAX), int.format(RETENTION_UNFINISHED_DAYS)),
    );
    for (const id of ["history-host", "history-status"]) expect(el.querySelector(`label[for="${id}"]`)!.textContent).not.toBe("");
    // The site filter lists the workspace's sites.
    expect([...el.querySelectorAll("#history-host option")].map((o) => o.textContent)).toEqual([u.filterAllSites, "site0.example", "site1.example"]);
    if (l === "de-CH") expect(JSON.stringify(u)).not.toContain("ß");
  });

  it("filters by site and status, walks the cursor, and pins", async () => {
    await render(l);
    const change = async (sel: string, value: string) =>
      act(async () => {
        const s = el.querySelector<HTMLSelectElement>(sel)!;
        s.value = value;
        s.dispatchEvent(new Event("change", { bubbles: true }));
      });
    const next = () => [...el.querySelectorAll<HTMLButtonElement>('[data-testid="history-pager"] button')][1]!;
    await act(async () => next().click());
    await vi.waitFor(() => expect(calls.some((c) => c.url === "/api/seo/v1/crawl?history=1&cursor=c4")).toBe(true));
    await vi.waitFor(() => expect(el.querySelectorAll('[data-testid="history-rows"] > li')).toHaveLength(1));
    // A filter goes back to the first page.
    await change("#history-status", "STOPPED");
    await vi.waitFor(() => expect(calls.some((c) => c.url === "/api/seo/v1/crawl?history=1&status=STOPPED")).toBe(true));
    await change("#history-host", "site1.example");
    await vi.waitFor(() => expect(calls.some((c) => c.url === "/api/seo/v1/crawl?history=1&host=site1.example&status=STOPPED")).toBe(true));
    await vi.waitFor(() => expect(el.querySelectorAll('[data-testid="history-rows"] > li')).toHaveLength(5));
    const pin = el.querySelector<HTMLButtonElement>(`button[aria-label="${u.pinCrawl("site0.example")}"]`)!;
    await act(async () => pin.click());
    await vi.waitFor(() => expect(calls.find((c) => c.init?.method === "PATCH")!.url).toBe("/api/seo/v1/crawl/c0"));
    await vi.waitFor(() => expect(el.querySelector(`button[aria-label="${u.unpinCrawl("site0.example")}"]`)).not.toBeNull());
  });

  it("shows the mascot and New crawl when there is nothing yet", async () => {
    empty = true;
    await act(async () => root.render(<CrawlHistory locale={l} />));
    await vi.waitFor(() => expect(el.querySelector('[data-testid="history-empty"]')).not.toBeNull());
    const box = el.querySelector('[data-testid="history-empty"]')!;
    // The emblem, decorative, painted in the brand teal (a currentColor mask, no <img>).
    const emblem = box.querySelector("[data-nb-emblem]")!;
    expect(emblem.getAttribute("aria-hidden")).toBe("true");
    expect(emblem.getAttribute("class")).toBe("h-20 w-20");
    expect(box.textContent).toContain(u.historyEmpty);
    expect(box.querySelector('a[href="/crawler"]')).not.toBeNull();
  });
});
