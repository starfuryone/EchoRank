// @vitest-environment jsdom
//
// tests/site-crawler-ux-pages.test.tsx — the Pages view (/crawler/[id]/pages
// and the Results Pages tab): hero and crawl card, debounced server-side
// search, scope select (and segments), the table (path + title, status pill,
// issues with the high-priority superscript, page score pill by band,
// inlinks), sortable headers, the Columns menu (crawl details, metric groups,
// off by default), the cursor pager, the CSV with the active filters, the
// mobile cards, and the detail panel (findings with how to fix, facts,
// metrics, extraction, inlinks; Esc and focus). Also the moved Phase 4a/4b/4d
// Pages cases: Found on and inlinks, the custom-search column and filter, the
// metric groups and their sort. axe on the view and the open panel.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/flags", () => ({ flag: (k: string) => ["crawl.links", "crawl.linkScore", "crawl.extraction", "crawl.segments"].includes(k) }));

import { RULE_COPY } from "@/lib/crawl-rules-meta";
import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { PAGES_PAGE_SIZE, PagesView, pagePath, statusTone } from "@/components/seo-tools/site-crawler-pages";
import { CrawlPagesPage } from "@/components/seo-tools/site-crawler-pages-page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const LOCALES = ["en", "fr", "de-CH"] as const;

const crawl = {
  id: "c1",
  rootUrl: "https://shop.example/",
  status: "COMPLETED",
  urlCap: 500,
  pagesCrawled: 1234,
  issueCount: 9,
  stoppedReason: null,
  startedAt: null,
  finishedAt: null,
  createdAt: "2026-11-01T10:00:00Z",
  renderMode: "none",
  renderCap: 0,
  pagesRendered: 0,
  mode: "spider",
  config: { extractors: [{ name: "Price" }], searches: [{ name: "GTM" }, { name: "Price" }] },
  pinned: false,
  dataPurgedAt: null,
} as never;
const row = (i: number, extra: Record<string, unknown> = {}) => ({
  id: `p${i}`,
  url: `https://shop.example/blog/post-${i}?x=1`,
  statusCode: 200,
  title: `Post ${i}`,
  depth: 2,
  inlinkCount: 3,
  inSitemap: true,
  wordCount: 100,
  foundOn: "https://shop.example/blog/",
  issueCount: 2,
  issueTotal: 2,
  issueHigh: 1,
  pageScore: 67,
  linkScore: 12.34,
  searchHits: { "0": 12, "1": 0 },
  ...extra,
});
const ROWS = [
  row(0),
  row(1, { statusCode: 301, pageScore: 90, issueHigh: 0, issueTotal: 1 }),
  row(2, { statusCode: 404, pageScore: 30, issueTotal: 5, issueHigh: 3 }),
  row(3, {
    statusCode: null,
    pageScore: null,
    issueTotal: null,
    issueHigh: null,
    issueCount: 4,
    metrics: { gsc: { clicks: 12, impressions: 400, ctr: 0.03, position: 4.25 } },
  }),
];
const DETAIL = {
  page: {
    ...row(0),
    metaDescription: "Desc",
    h1First: "Hello",
    canonical: "https://shop.example/blog/post-0",
    noindex: false,
    redirectTarget: null,
    contentType: "text/html",
    fetchMs: 120,
    internalLinks: 9,
  },
  issues: [
    { id: "i1", ruleId: "response_codes.internal_4xx", kind: "issue", priority: "high", evidence: { target: "https://shop.example/gone" } },
    { id: "i2", ruleId: "images.missing_alt", kind: "warning", priority: "medium", evidence: {} },
  ],
  issuesTruncated: false,
  metrics: { gsc: { clicks: 3, impressions: 90, ctr: 0.033, position: 7 } },
  extractions: [{ kind: "extract", index: 0, values: ["€12", "€15"] }],
};

let el: HTMLElement;
let root: Root;
let calls: string[];
let empty = false;
beforeEach(() => {
  el = document.createElement("main");
  document.body.appendChild(el);
  root = createRoot(el);
  calls = [];
  empty = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string) => {
      calls.push(u);
      if (u.startsWith("/api/seo/v1/crawl/c1/pages/p0/inlinks"))
        return { ok: true, json: async () => ({ inlinks: [{ id: "l1", source: "https://shop.example/", anchor: "Post", nofollow: false }], next: null }) };
      if (u.startsWith("/api/seo/v1/crawl/c1/pages/p0")) return { ok: true, json: async () => DETAIL };
      if (u.startsWith("/api/seo/v1/crawl/c1/pages?"))
        return {
          ok: true,
          json: async () =>
            empty
              ? { pages: [], page: 1, pageSize: 50, total: 0, totalPages: 1, nextCursor: null }
              : {
                  pages: u.includes("cursor=p3") ? [row(9)] : ROWS,
                  page: 1,
                  pageSize: 50,
                  total: 51,
                  totalPages: 2,
                  nextCursor: u.includes("cursor=p3") ? null : "p3",
                },
        };
      if (u === "/api/seo/v1/crawl/c1") return { ok: true, json: async () => crawl };
      return { ok: false, json: async () => null };
    }),
  );
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

const pageCalls = () => calls.filter((c) => c.startsWith("/api/seo/v1/crawl/c1/pages?"));
const lastQuery = () => new URLSearchParams(pageCalls().at(-1)!.split("?")[1]);
const change = async (sel: string, value: string) =>
  act(async () => {
    const s = el.querySelector<HTMLSelectElement | HTMLInputElement>(sel)!;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(s), "value")!.set!;
    setter.call(s, value);
    s.dispatchEvent(new Event(s.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });

it("helpers: the path of a URL, the status tone", () => {
  expect(pagePath("https://e.com/a/b?x=1")).toBe("/a/b?x=1");
  expect(pagePath("not a url")).toBe("not a url");
  expect([200, 301, 404, 503, null].map(statusTone)).toEqual([
    "bg-emerald-50 text-emerald-800",
    "bg-amber-50 text-amber-800",
    "bg-red-50 text-red-700",
    "bg-red-50 text-red-700",
    "bg-gray-100 text-gray-700",
  ]);
});

describe.each(LOCALES)("%s", (l) => {
  const t = SITE_CRAWLER_COPY[l];
  const u = t.ux;
  const int = new Intl.NumberFormat(l === "en" ? "en-US" : l);
  const render = async (props: Partial<Parameters<typeof PagesView>[0]> = {}) => {
    await act(async () =>
      root.render(
        <PagesView
          crawlId="c1"
          crawl={crawl}
          locale={l}
          t={t}
          int={int}
          searchNames={["GTM", "Price"]}
          extractionNames={{ extract: ["Price"], js: [], ai: [] }}
          linksOn
          {...props}
        />,
      ),
    );
    await vi.waitFor(() => expect(el.querySelector('[data-testid="pages-table"], [data-testid="pages-empty"]')).not.toBeNull());
  };

  it("renders the hero, crawl card, controls and the table", async () => {
    await render();
    const view = el.querySelector('[data-testid="pages-view"]')!;
    expect(view.querySelector("p")!.textContent).toBe(u.pagesEyebrow);
    expect(view.querySelector("h2")!.textContent).toBe(u.pagesTitle);
    expect(view.textContent).toContain(u.pagesSubhead);
    expect(el.querySelector('[data-testid="pages-crawl-card"]')!.textContent).toContain(
      u.pagesCrawledOn(int.format(1234), new Intl.DateTimeFormat(l, { dateStyle: "medium" }).format(new Date("2026-11-01T10:00:00Z"))),
    );
    expect(el.querySelector<HTMLInputElement>("#pages-q")!.placeholder).toBe(u.pagesSearchPlaceholder);
    expect([...el.querySelectorAll("#pages-scope option")].map((o) => o.textContent)).toEqual([
      u.scopeAll,
      u.scopeIndexable,
      u.scopeNonIndexable,
      u.scopeErrors,
      u.scopeRedirects,
      u.scopeOrphans,
    ]);
    expect(lastQuery().get("pageSize")).toBe(String(PAGES_PAGE_SIZE));
    const first = el.querySelector('[data-testid="pages-table"] tr[data-page="p0"]')!;
    expect(first.textContent).toContain("/blog/post-0?x=1");
    expect(first.textContent).toContain("Post 0");
    expect(first.querySelector("[data-issues]")!.textContent).toContain(int.format(2));
    expect(first.querySelector("[data-high]")!.textContent).toContain(u.highCount(int.format(1)));
    expect(first.querySelector("[data-score-band]")!.getAttribute("data-score-band")).toBe("fair");
    expect(first.querySelector("[data-score-band]")!.textContent).toBe(u.healthScore(int.format(67)));
    expect(el.querySelector('tr[data-page="p1"] [data-score-band]')!.getAttribute("data-score-band")).toBe("good");
    expect(el.querySelector('tr[data-page="p2"] [data-score-band]')!.getAttribute("data-score-band")).toBe("poor");
    expect(el.querySelector('tr[data-page="p2"] span.bg-red-50')!.textContent).toBe("404");
    expect(el.querySelector('tr[data-page="p1"] span.bg-amber-50')!.textContent).toBe("301");
    // An older crawl: no score, and the issue count from the findings.
    expect(el.querySelector('tr[data-page="p3"]')!.textContent).toContain(u.healthNone);
    expect(el.querySelector('tr[data-page="p3"] [data-issues]')!.textContent).toBe(int.format(4));
    expect(el.querySelector('tr[data-page="p0"] button')!.getAttribute("aria-label")).toBe(u.openPage("/blog/post-0?x=1"));
    // Sticky header; cards for phones.
    expect(el.querySelector('[data-testid="pages-table"] thead')!.className).toContain("sticky");
    expect(el.querySelectorAll('[data-testid="pages-cards"] > li')).toHaveLength(4);
    // Columns behind the menu, off by default.
    expect(el.querySelector('[data-testid="pages-columns"]')!.hasAttribute("hidden")).toBe(true);
    expect(el.textContent).not.toContain(t.p4a.colFoundOn);
    if (l === "de-CH") expect(JSON.stringify(u)).not.toContain("ß");
  });

  it("searches server-side after a pause, scopes, sorts from the headers, and keeps the filters in the CSV", async () => {
    await render();
    await change("#pages-q", "post");
    await vi.waitFor(() => expect(lastQuery().get("q")).toBe("post"), { timeout: 2000 });
    await change("#pages-scope", "errors");
    await vi.waitFor(() => expect(lastQuery().get("scope")).toBe("errors"));
    const score = [...el.querySelectorAll<HTMLButtonElement>("th button")].find((b) => b.textContent?.startsWith(u.colScore))!;
    await act(async () => score.click());
    await vi.waitFor(() => expect(lastQuery().get("sort")).toBe("score"));
    expect(lastQuery().get("dir")).toBe("desc");
    expect(score.closest("th")!.getAttribute("aria-sort")).toBe("descending");
    await act(async () => score.click());
    await vi.waitFor(() => expect(lastQuery().get("dir")).toBe("asc"));
    for (const [label, key] of [
      [u.colStatus, "status"],
      [u.colIssues, "issues"],
      [u.colInlinks, "inlinks"],
      [t.p4g.colLinkScore, "linkScore"],
    ] as const) {
      const b = [...el.querySelectorAll<HTMLButtonElement>("th button")].find((x) => x.textContent?.startsWith(label))!;
      await act(async () => b.click());
      await vi.waitFor(() => expect(lastQuery().get("sort")).toBe(key));
    }
    const csv = new URLSearchParams(el.querySelector<HTMLAnchorElement>('[data-testid="pages-csv"]')!.getAttribute("href")!.split("?")[1]);
    expect([csv.get("q"), csv.get("scope"), csv.get("format"), csv.has("pageSize")]).toEqual(["post", "errors", "csv", false]);
  });

  it("walks the cursor and comes back", async () => {
    await render();
    const [prev, next] = [...el.querySelectorAll<HTMLButtonElement>('[data-testid="pages-pager"] button')];
    expect(prev!.disabled).toBe(true);
    await act(async () => next!.click());
    await vi.waitFor(() => expect(lastQuery().get("cursor")).toBe("p3"));
    await vi.waitFor(() => expect(el.querySelectorAll('[data-testid="pages-table"] tbody tr')).toHaveLength(1));
    expect(el.querySelector('[data-testid="pages-pager"]')!.textContent).toContain(u.pagesRange(int.format(51), int.format(51), int.format(51)));
    await act(async () => [...el.querySelectorAll<HTMLButtonElement>('[data-testid="pages-pager"] button')][0]!.click());
    await vi.waitFor(() => expect(el.querySelectorAll('[data-testid="pages-table"] tbody tr')).toHaveLength(4));
  });

  it("Columns: crawl details (Found on, custom search) and a metric group, which then sorts", async () => {
    await render();
    const menu = [...el.querySelectorAll<HTMLButtonElement>("button[aria-controls='pages-columns']")][0]!;
    await act(async () => menu.click());
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    const boxes = [...el.querySelectorAll<HTMLLabelElement>('[data-testid="pages-columns"] label')];
    expect(boxes.map((b) => b.textContent)).toEqual([u.colGroupCrawl, t.p4d.srcGsc]);
    await act(async () => boxes[0]!.querySelector("input")!.click());
    expect(el.textContent).toContain(t.p4a.colFoundOn);
    expect(el.textContent).toContain("GTM: 12");
    expect(el.textContent).not.toContain(t.p4d.colLabels["gsc.clicks"]);
    await act(async () => boxes[1]!.querySelector("input")!.click());
    expect(el.textContent).toContain("3.0%");
    const clicks = [...el.querySelectorAll<HTMLButtonElement>("th button")].find((b) => b.textContent?.startsWith(t.p4d.colLabels["gsc.clicks"]!))!;
    await act(async () => clicks.click());
    await vi.waitFor(() => expect(lastQuery().get("sort")).toBe("gsc.clicks"));
    // The custom-search filter sits under More filters.
    expect(el.querySelector('[data-testid="pages-more-filters"]')!.textContent).toContain(t.p4b.filterSearchNone("Price"));
    await change("#pages-custom-search", "1:none");
    await vi.waitFor(() => expect([lastQuery().get("search"), lastQuery().get("hit")]).toEqual(["1", "false"]));
  });

  it("segments sit in the scope select and drive the shared segment", async () => {
    const onSegment = vi.fn();
    await render({ segmentNames: ["Blog"], onSegment });
    expect([...el.querySelectorAll("#pages-scope option")].at(-1)!.textContent).toBe(u.scopeSegment("Blog"));
    await change("#pages-scope", "seg:0");
    expect(onSegment).toHaveBeenCalledWith("0");
    await render({ segmentNames: ["Blog"], onSegment, segment: "0" });
    expect(lastQuery().get("segment")).toBe("0");
  });

  it("opens a page's detail: findings with how to fix, facts, metrics, extraction, inlinks; Esc closes and focus returns", async () => {
    await render();
    const opener = el.querySelector<HTMLButtonElement>('tr[data-page="p0"] button')!;
    opener.focus();
    await act(async () => opener.click());
    const dialog = await vi.waitFor(() => {
      const d = document.querySelector<HTMLElement>('[role="dialog"]');
      expect(d?.querySelector('[data-testid="page-issues"]')).toBeTruthy();
      return d!;
    });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)!.textContent).toBe("/blog/post-0?x=1");
    expect(document.activeElement!.getAttribute("aria-label")).toBe(u.detailClose);
    const issues = dialog.querySelector('[data-testid="page-issues"]')!;
    expect(issues.textContent).toContain(RULE_COPY["response_codes.internal_4xx"]!.name);
    expect(issues.textContent).toContain("target: https://shop.example/gone");
    expect(issues.querySelector("summary")!.textContent).toBe(t.rulesHowToFix);
    expect(issues.textContent).toContain(RULE_COPY["response_codes.internal_4xx"]!.howToFix);
    expect(dialog.querySelector('[data-testid="score-formula"]')!.textContent).toBe(u.scoreFormula);
    expect(dialog.textContent).toContain("Hello");
    expect(dialog.textContent).toContain(u.detailFetchMs(int.format(120)));
    expect(dialog.textContent).toContain(t.p4d.srcGsc);
    expect(dialog.textContent).toContain("Price");
    expect(dialog.textContent).toContain("€12 | €15");
    await vi.waitFor(() => expect(dialog.textContent).toContain(t.p4a.inlinksTitle("https://shop.example/blog/post-0?x=1")));
    await act(async () => dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("row click opens the panel too; no inlinks without the link graph", async () => {
    await render({ linksOn: false });
    await act(async () => el.querySelector<HTMLTableRowElement>('tr[data-page="p0"]')!.click());
    const dialog = await vi.waitFor(() => {
      const d = document.querySelector<HTMLElement>('[role="dialog"]');
      expect(d?.querySelector('[data-testid="page-issues"]')).toBeTruthy();
      return d!;
    });
    expect(dialog.textContent).not.toContain(t.p4a.inlinksTitle("https://shop.example/blog/post-0?x=1"));
    expect(calls.some((c) => c.includes("/inlinks"))).toBe(false);
  });

  it("shows the empty state, and the rule filter from Issues › See all pages", async () => {
    empty = true;
    await render({ initialFilters: { inSitemap: "", depth: "", minInlinks: "", search: "", urlPrefix: "", rule: "h1.missing" } });
    expect(el.querySelector('[data-testid="pages-empty"]')!.textContent).toBe(t.noPages);
    expect(lastQuery().get("rule")).toBe("h1.missing");
    expect(el.querySelector('[data-testid="pages-rule-filter"]')!.textContent).toContain(u.pagesRuleFilter(RULE_COPY["h1.missing"]!.name));
  });

  it("standalone page: the title is the h1 and the host links to the full results", async () => {
    await act(async () => root.render(<CrawlPagesPage locale={l} crawlId="c1" />));
    await vi.waitFor(() => expect(el.querySelector('[data-testid="pages-crawl-card"] a')).not.toBeNull());
    expect(el.querySelector("h1")!.textContent).toBe(u.pagesTitle);
    expect(el.querySelector('[data-testid="pages-crawl-card"] a')!.getAttribute("href")).toBe("/crawler/c1");
  });

  it("has no serious or critical axe violations, and every control has a visible label (view and open panel)", async () => {
    await render({ segmentNames: ["Blog"], onSegment: vi.fn() });
    const check = async (node: Element) => {
      const res = await axe.run(node, { resultTypes: ["violations"], rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
      return res.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map(
          (v) =>
            `${v.id}: ${v.nodes
              .map((n) => n.target.join(" "))
              .slice(0, 2)
              .join(" | ")}`,
        );
    };
    expect(await check(el)).toEqual([]);
    for (const c of el.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select"))
      expect(
        [...(c.labels ?? [])].some((x) => x.textContent?.trim()),
        c.id || c.outerHTML.slice(0, 60),
      ).toBe(true);
    await act(async () => el.querySelector<HTMLButtonElement>('tr[data-page="p0"] button')!.click());
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"] [data-testid="page-issues"]')).not.toBeNull());
    expect(await check(document.querySelector('[role="dialog"]')!)).toEqual([]);
  });
});
