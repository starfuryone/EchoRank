// @vitest-environment jsdom
//
// tests/site-crawler-ux-issues.test.tsx — the Issues view (/crawler/[id]/issues
// and the Results Issues tab): hero and crawl card, the biggest-impact banner,
// kind pills with counts, family and segment selects, the impact sort and its
// alternatives, expandable rule rows (aria-expanded) with how to fix, evidence
// columns, the first 10 URLs with "found on", See all pages and CSV; empty
// states per filter; axe. In every dashboard locale.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

import { RULE_COPY } from "@/lib/crawl-rules-meta";
import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { IssuesView, impactSummary, ruleImpact, sortRules, type IssueRule } from "@/components/seo-tools/site-crawler-issues";
import { CrawlIssuesPage } from "@/components/seo-tools/site-crawler-issues-page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const LOCALES = ["en", "fr", "de-CH"] as const;

const rule = (ruleId: string, family: string, kind: IssueRule["kind"], priority: IssueRule["priority"], urls: number, pages: number | null): IssueRule => ({
  ruleId,
  family,
  kind,
  priority,
  urls,
  pages,
  share: 1.5,
});
// Impact: 4xx 3×40=120, titles 3×10=30, alt 1×100=100, next-gen 0.25×300=75.
const RULES: IssueRule[] = [
  rule("page_titles.missing", "page_titles", "issue", "high", 10, 10),
  rule("images.missing_alt", "images", "warning", "medium", 120, 100),
  rule("response_codes.internal_4xx", "response_codes", "issue", "high", 45, 40),
  rule("images.not_next_gen_format", "images", "opportunity", "low", 300, 300),
];
const crawl = {
  id: "c1",
  rootUrl: "https://shop.example/",
  status: "COMPLETED",
  urlCap: 500,
  pagesCrawled: 400,
  issueCount: 475,
  stoppedReason: null,
  startedAt: null,
  finishedAt: null,
  createdAt: "2026-11-01T10:00:00Z",
  renderMode: "none",
  renderCap: 0,
  pagesRendered: 0,
  mode: "spider",
  config: null,
  pinned: false,
  dataPurgedAt: null,
} as never;

let el: HTMLElement;
let root: Root;
let calls: string[];
let rulesBody: Record<string, unknown>;
beforeEach(() => {
  el = document.createElement("main");
  document.body.appendChild(el);
  root = createRoot(el);
  calls = [];
  rulesBody = { pagesCrawled: 400, highPages: 44, rules: RULES, segments: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string) => {
      calls.push(u);
      if (u.startsWith("/api/seo/v1/crawl/c1/rules/"))
        return {
          ok: true,
          json: async () => ({
            rows: [
              {
                id: "p1",
                url: "https://shop.example/a",
                statusCode: 404,
                foundOn: "https://shop.example/",
                evidence: { target: "https://shop.example/x", anchor: "Shoes" },
              },
              { id: "p2", url: "https://shop.example/b", statusCode: 404, foundOn: null, evidence: { target: "https://shop.example/y" } },
            ],
            total: 45,
          }),
        };
      if (u.startsWith("/api/seo/v1/crawl/c1/rules")) return { ok: true, json: async () => rulesBody };
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

const names = () => [...el.querySelectorAll<HTMLLIElement>('[data-testid="issue-rows"] > li')].map((li) => li.dataset.rule);
const select = async (id: string, value: string) =>
  act(async () => {
    const s = el.querySelector<HTMLSelectElement>(`#${id}`)!;
    s.value = value;
    s.dispatchEvent(new Event("change", { bubbles: true }));
  });

describe("ranking", () => {
  it("impact = priority weight × pages (findings when no page count)", () => {
    expect(RULES.map(ruleImpact)).toEqual([30, 100, 120, 75]);
    expect(ruleImpact(rule("x", "url", "issue", "high", 7, null))).toBe(21);
  });
  it("sorts by impact, pages, family or rule name", () => {
    const ids = (s: Parameters<typeof sortRules>[1]) => sortRules(RULES, s).map((r) => r.ruleId);
    expect(ids("impact")).toEqual(["response_codes.internal_4xx", "images.missing_alt", "images.not_next_gen_format", "page_titles.missing"]);
    expect(ids("pages")).toEqual(["images.not_next_gen_format", "images.missing_alt", "response_codes.internal_4xx", "page_titles.missing"]);
    expect(ids("family").slice(0, 2)).toEqual(["images.missing_alt", "images.not_next_gen_format"]);
    const byName = [...RULES].map((r) => RULE_COPY[r.ruleId]!.name).sort((a, b) => a.localeCompare(b));
    expect(sortRules(RULES, "rule").map((r) => RULE_COPY[r.ruleId]!.name)).toEqual(byName);
  });
  it("sums high-priority findings for the banner; pages come from the summary", () => {
    expect(impactSummary(RULES, 44)).toEqual({ findings: 55, pages: 44 });
    expect(impactSummary(RULES, null)).toEqual({ findings: 55, pages: null });
  });
});

describe.each(LOCALES)("%s", (l) => {
  const t = SITE_CRAWLER_COPY[l];
  const u = t.ux;
  const int = new Intl.NumberFormat(l === "en" ? "en-US" : l);
  const render = async (props: Partial<Parameters<typeof IssuesView>[0]> = {}) => {
    await act(async () => root.render(<IssuesView crawlId="c1" crawl={crawl} locale={l} t={t} int={int} {...props} />));
    await vi.waitFor(() => expect(el.querySelector('[data-testid="issue-rows"], [data-testid="issues-empty"]')).not.toBeNull());
  };

  it("renders the hero, crawl card, impact banner, pills with counts, and rows by impact", async () => {
    await render();
    const view = el.querySelector('[data-testid="issues-view"]')!;
    expect(view.querySelector("p")!.textContent).toBe(u.issuesEyebrow);
    expect(view.querySelector("h2")!.textContent).toBe(u.issuesTitle);
    expect(view.textContent).toContain(u.issuesSubhead);
    const card = el.querySelector('[data-testid="issues-crawl-card"]')!;
    expect(card.textContent).toContain("shop.example");
    expect(card.textContent).toContain(u.issuesCrawlOn(new Intl.DateTimeFormat(l, { dateStyle: "medium" }).format(new Date("2026-11-01T10:00:00Z"))));
    const banner = el.querySelector('[data-testid="impact-banner"]')!;
    expect(banner.textContent).toContain(u.impactTitle);
    expect(banner.querySelector("[data-impact]")!.textContent).toBe(u.impactBody(int.format(55), int.format(44)));
    expect(banner.querySelector('a[href="/crawler"]')).not.toBeNull();
    const pills = [...el.querySelectorAll<HTMLButtonElement>('[data-testid="kind-pills"] button')];
    expect(pills.map((b) => b.textContent)).toEqual([`${u.pillAll}4`, `${u.pillIssues}2`, `${u.pillWarnings}1`, `${u.pillOpportunities}1`]);
    expect(pills[0]!.getAttribute("aria-pressed")).toBe("true");
    expect(names()).toEqual(["response_codes.internal_4xx", "images.missing_alt", "images.not_next_gen_format", "page_titles.missing"]);
    const first = el.querySelector('[data-rule="response_codes.internal_4xx"]')!;
    expect(first.querySelector("[data-dot]")!.className).toContain("bg-red-500");
    expect(el.querySelector('[data-rule="images.missing_alt"] [data-dot]')!.className).toContain("bg-amber-500");
    expect(el.querySelector('[data-rule="images.not_next_gen_format"] [data-dot]')!.className).toContain("bg-blue-500");
    expect(first.textContent).toContain(RULE_COPY["response_codes.internal_4xx"]!.name);
    expect(first.textContent).toContain(RULE_COPY["response_codes.internal_4xx"]!.description);
    expect(first.querySelector("[data-count]")!.textContent).toBe(u.rulePages(40, int.format(40)));
    expect(first.textContent).toContain(`${t.ovKindIssue} · ${u.families.response_codes}`);
    if (l === "de-CH") expect(JSON.stringify(u)).not.toContain("ß");
  });

  it("filters by kind and family, re-sorts, and says so when a filter is empty", async () => {
    await render();
    const pills = () => [...el.querySelectorAll<HTMLButtonElement>('[data-testid="kind-pills"] button')];
    await act(async () => pills()[2]!.click());
    expect(names()).toEqual(["images.missing_alt"]);
    await select("issues-family", "page_titles");
    expect(el.querySelector('[data-testid="issues-empty"]')!.textContent).toBe(u.emptyKind.warning);
    await act(async () => pills()[0]!.click());
    expect(names()).toEqual(["page_titles.missing"]);
    await select("issues-family", "");
    await select("issues-sort", "pages");
    expect(names()[0]).toBe("images.not_next_gen_format");
  });

  it("expands a rule: how to fix, evidence columns, the first 10 URLs with found on, See all pages, CSV", async () => {
    await render();
    const btn = el.querySelector<HTMLButtonElement>('[data-rule="response_codes.internal_4xx"] button[aria-expanded]')!;
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    const body = document.getElementById(btn.getAttribute("aria-controls")!)!;
    expect(body.hidden).toBe(true);
    await act(async () => btn.click());
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    await vi.waitFor(() => expect(body.querySelector('[data-testid="rule-evidence"]')).not.toBeNull());
    expect(calls).toContain("/api/seo/v1/crawl/c1/rules/response_codes.internal_4xx?page=1&pageSize=10&");
    expect(body.textContent).toContain(RULE_COPY["response_codes.internal_4xx"]!.howToFix);
    const heads = [...body.querySelectorAll("th")].map((h) => h.textContent);
    expect(heads).toEqual([u.colUrl, u.colStatus, "target", "anchor"]);
    expect(body.textContent).toContain(u.firstAffected(int.format(2), int.format(45)));
    expect(body.textContent).toContain(`${t.p4a.colFoundOn}: https://shop.example/`);
    expect(body.querySelector('a[href="/crawler/c1/pages?rule=response_codes.internal_4xx"]')!.textContent).toContain(u.seeAllPages);
    expect(body.querySelector('a[href^="/api/seo/v1/crawl/c1/rules/response_codes.internal_4xx?format=csv"]')).not.toBeNull();
    // A second activation closes it again.
    await act(async () => btn.click());
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(body.hidden).toBe(true);
  });

  it("drives the segment filter, and shows the segment empty state", async () => {
    const onSegment = vi.fn();
    await render({ segmentNames: ["Blog", "Shop"], onSegment });
    await select("issues-segment", "1");
    expect(onSegment).toHaveBeenCalledWith("1");
    rulesBody = { pagesCrawled: 10, highPages: null, rules: [] };
    await render({ segmentNames: ["Blog", "Shop"], onSegment, segment: "1" });
    await vi.waitFor(() => expect(el.querySelector('[data-testid="issues-empty"]')!.textContent).toBe(u.emptySegment));
  });

  it("falls back to findings when the tally has no page count, and to the shorter banner without the summary's pages", async () => {
    rulesBody = { pagesCrawled: 400, highPages: null, rules: [rule("page_titles.missing", "page_titles", "issue", "high", 7, null)] };
    await render();
    expect(el.querySelector("[data-impact]")!.textContent).toBe(u.impactBodyNoPages(int.format(7)));
    expect(el.querySelector("[data-count]")!.textContent).toBe(u.ruleFindings(7, int.format(7)));
  });

  it("standalone page: the title is the h1 and the host links to the full results", async () => {
    await act(async () => root.render(<CrawlIssuesPage locale={l} crawlId="c1" />));
    await vi.waitFor(() => expect(el.querySelector('[data-testid="issues-crawl-card"] a')).not.toBeNull());
    expect(el.querySelector("h1")!.textContent).toBe(u.issuesTitle);
    expect(el.querySelector('[data-testid="issues-crawl-card"] a')!.getAttribute("href")).toBe("/crawler/c1");
  });

  it("has no serious or critical axe violations, with a rule open", async () => {
    await render({ segmentNames: ["Blog"], onSegment: vi.fn() });
    await act(async () => el.querySelector<HTMLButtonElement>("button[aria-expanded]")!.click());
    await vi.waitFor(() => expect(el.querySelector('[data-testid="rule-evidence"]')).not.toBeNull());
    const res = await axe.run(el, { resultTypes: ["violations"], rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(res.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    for (const c of el.querySelectorAll<HTMLSelectElement>("select")) expect([...(c.labels ?? [])].some((x) => x.textContent?.trim())).toBe(true);
  });
});
