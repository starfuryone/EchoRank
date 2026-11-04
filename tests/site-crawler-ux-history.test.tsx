// @vitest-environment jsdom
//
// tests/site-crawler-ux-history.test.tsx — /crawler/history (UX restructure):
// every crawl with health, pages, kind totals, pin/unpin and open; filters by
// host and status; retention in one line from the plan's kept-crawl count.
// In every dashboard locale.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { CrawlHistory, historyQuery } from "@/components/seo-tools/site-crawler-history";
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
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.startsWith("/api/seo/v1/crawl?history=1"))
        return { ok: true, json: async () => ({ crawls: [crawl(0), crawl(1, { pinned: true }), crawl(2, { dataPurgedAt: "2026-10-01T00:00:00Z", kinds: null })], quota, total: 3, page: 1, pageSize: 50 }) };
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

it("builds its query from the filters", () => {
  expect(historyQuery("", "", 1)).toBe("history=1");
  expect(historyQuery(" shop.example ", "FAILED", 3)).toBe("history=1&host=shop.example&status=FAILED&page=3");
});

describe.each(LOCALES)("%s", (l) => {
  const t = SITE_CRAWLER_COPY[l];
  const int = new Intl.NumberFormat(l === "en" ? "en-US" : l);

  it("lists each crawl with health, pages, kind totals, pin and open; explains retention", async () => {
    await render(l);
    const rows = [...el.querySelectorAll<HTMLLIElement>('[data-testid="history-rows"] > li')];
    expect(rows).toHaveLength(3);
    expect(rows[0]!.querySelector("[data-health]")!.textContent).toContain("80");
    expect(rows[0]!.querySelector("[data-kinds]")!.textContent).toContain("5 · 4 · 3");
    expect(rows[0]!.querySelector("a")!.getAttribute("href")).toBe("/crawler/c0");
    expect(rows[0]!.querySelector(`button[aria-label="${t.ux.pinCrawl("site0.example")}"]`)).not.toBeNull();
    expect(rows[1]!.querySelector(`button[aria-label="${t.ux.unpinCrawl("site1.example")}"]`)).not.toBeNull();
    // A purged crawl keeps its row, says so, and has nothing to pin.
    expect(rows[2]!.textContent).toContain(t.ux.summaryOnly);
    expect(rows[2]!.querySelector("button")).toBeNull();
    expect(el.querySelector('[data-testid="retention"]')!.textContent).toBe(
      t.ux.historyRetention(int.format(10), int.format(CRAWL_PIN_MAX), int.format(RETENTION_UNFINISHED_DAYS)),
    );
    // Every form control has a visible label.
    for (const id of ["history-host", "history-status"]) expect(el.querySelector(`label[for="${id}"]`)!.textContent).not.toBe("");
    if (l === "de-CH") expect(JSON.stringify(t.ux)).not.toContain("ß");
  });

  it("filters by host and status, and pins", async () => {
    await render(l);
    const status = el.querySelector<HTMLSelectElement>("#history-status")!;
    await act(async () => {
      status.value = "FAILED";
      status.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await vi.waitFor(() => expect(calls.some((c) => c.url === "/api/seo/v1/crawl?history=1&status=FAILED")).toBe(true));
    const pin = el.querySelector<HTMLButtonElement>(`button[aria-label="${t.ux.pinCrawl("site0.example")}"]`)!;
    await act(async () => pin.click());
    await vi.waitFor(() => expect(calls.find((c) => c.init?.method === "PATCH")!.url).toBe("/api/seo/v1/crawl/c0"));
    await vi.waitFor(() => expect(el.querySelector(`button[aria-label="${t.ux.unpinCrawl("site0.example")}"]`)).not.toBeNull());
  });
});
