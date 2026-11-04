// @vitest-environment jsdom
//
// tests/site-crawler-ux-a11y.test.tsx — axe-core over the crawler's task
// views (Start, Results, History; Schedules too) rendered in jsdom: any
// serious or critical violation fails. jsdom has no layout, so colour
// contrast is checked separately below, by class: the views' text never uses
// the grey shades under 4.5:1 on white, and every animation honours
// prefers-reduced-motion.
import { act } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRoot, type Root } from "react-dom/client";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/crawler" }));

import { SiteCrawlerClient } from "@/components/seo-tools/site-crawler-client";
import { CrawlHistory } from "@/components/seo-tools/site-crawler-history";
import { CrawlSchedulesView } from "@/components/seo-tools/site-crawler-schedules-view";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const crawl = (i: number, extra: Record<string, unknown> = {}) => ({
  id: `c${i}`, rootUrl: `https://site${i}.example/`, status: "COMPLETED", urlCap: 5000, pagesCrawled: 2476, issueCount: 9, stoppedReason: "time_cap",
  startedAt: "2026-11-01T10:00:00Z", finishedAt: "2026-11-01T11:00:00Z", createdAt: "2026-11-01T10:00:00Z", renderMode: "none", renderCap: 0,
  pagesRendered: 0, mode: "spider", config: null, pinned: false, dataPurgedAt: null, health: 73, kinds: { issue: 5, warning: 3, opportunity: 1 }, ...extra,
});
const quota = {
  urlCap: 5000, renderCap: 500, monthlyLimit: 20, used: 2, remaining: 18, allowed: true, locked: false, crawlsKept: 10,
  extractorCap: 5, searchCap: 5, segmentCap: 10, scheduleCap: 2, scheduleCadences: ["weekly", "monthly"], psiCap: 50, backlinkCap: 50,
  lighthouseUsed: 0, lighthouseLimit: 20, backlinkUnitUsd: 0.02, seoBudgetLeftUsd: 10, jsSnippetCap: 3, aiPageCap: 100, semanticCap: 2000,
  inspectionCap: 200, aiTokensUsed: 0, aiTokenLimit: 500000, aiClaude: true, aiKeys: { openai: true, gemini: false },
};
const summary = {
  partial: true,
  issuesByKind: { issue: 5, warning: 3, opportunity: 1 },
  issues: { "response_codes.internal_4xx": { count: 4, pages: 4, priority: "high", kind: "issue" }, x: { count: 1, pages: 1, priority: "high", kind: "issue" } },
};

let el: HTMLElement;
let root: Root;
beforeEach(() => {
  el = document.createElement("main");
  document.body.appendChild(el);
  root = createRoot(el);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string) => {
      if (u === "/api/seo/v1/crawl") return { ok: true, json: async () => ({ crawls: [crawl(0), crawl(1)], quota }) };
      if (u.startsWith("/api/seo/v1/crawl?history=1")) return { ok: true, json: async () => ({ crawls: [crawl(0), crawl(1, { pinned: true })], quota, total: 2, page: 1, pageSize: 50 }) };
      if (u.startsWith("/api/seo/v1/crawl/c0/summary")) return { ok: true, json: async () => summary };
      if (u.startsWith("/api/seo/v1/crawl/c0/rules")) return { ok: true, json: async () => ({ pagesCrawled: 2476, rules: [] }) };
      if (u === "/api/seo/v1/crawl/schedules") return { ok: true, json: async () => ({ schedules: [] }) };
      return { ok: false, json: async () => null };
    }),
  );
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

/** Form controls with no visible <label> (aria-label alone does not count). */
function unlabelled(): string[] {
  return [...el.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")]
    .filter((c) => c.type !== "hidden" && !(c.labels && [...c.labels].some((l) => (l.textContent ?? "").trim() !== "")))
    .map((c) => c.id || c.name || c.outerHTML.slice(0, 80));
}

async function serious(): Promise<string[]> {
  const res = await axe.run(el, { resultTypes: ["violations"], rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
  return res.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
}

describe("axe: no serious or critical violations", () => {
  it.each(["en", "fr", "de-CH"] as const)("Start (%s)", async (l) => {
    await act(async () => root.render(<SiteCrawlerClient locale={l} view="start" />));
    await vi.waitFor(() => expect(el.querySelector('[data-testid="recent-crawls"]')).not.toBeNull());
    // Open every disclosure so the options inside are checked too.
    await act(async () => el.querySelectorAll("details").forEach((d) => (d.open = true)));
    expect(await serious()).toEqual([]);
    expect(unlabelled()).toEqual([]);
  });

  it.each(["en", "fr", "de-CH"] as const)("Results (%s)", async (l) => {
    await act(async () => root.render(<SiteCrawlerClient locale={l} view="results" crawlId="c0" />));
    await vi.waitFor(() => expect(el.querySelector('[data-testid="fix-first"]')).not.toBeNull());
    await act(async () => el.querySelectorAll("details").forEach((d) => (d.open = true)));
    expect(await serious()).toEqual([]);
  });

  it.each(["en", "fr", "de-CH"] as const)("History (%s)", async (l) => {
    await act(async () => root.render(<CrawlHistory locale={l} />));
    await vi.waitFor(() => expect(el.querySelector('[data-testid="history-rows"]')).not.toBeNull(), { timeout: 2000 });
    expect(await serious()).toEqual([]);
    expect(unlabelled()).toEqual([]);
  });

  it("Schedules (en)", async () => {
    await act(async () => root.render(<CrawlSchedulesView locale="en" />));
    await vi.waitFor(() => expect(el.querySelector("#schedule-url")).not.toBeNull());
    expect(await serious()).toEqual([]);
    expect(unlabelled()).toEqual([]);
  });
});

describe("contrast and motion, by class", () => {
  const DIR = join(__dirname, "..", "src", "components", "seo-tools");
  const VIEWS = [
    "site-crawler-client.tsx",
    "site-crawler-results.tsx",
    "site-crawler-history.tsx",
    "site-crawler-nav.tsx",
    "site-crawler-advanced.tsx",
    "site-crawler-schedules.tsx",
    "site-crawler-schedules-view.tsx",
  ];
  it.each(VIEWS)("%s: no text in gray-300/400 (under 4.5:1 on white)", (f) => {
    const src = readFileSync(join(DIR, f), "utf8");
    expect(src.match(/\btext-gray-(?:300|400)\b/g) ?? []).toEqual([]);
  });
  it.each(VIEWS)("%s: every animation or transition has a reduced-motion opt-out", (f) => {
    const src = readFileSync(join(DIR, f), "utf8");
    for (const cls of src.match(/className="[^"]*"/g) ?? []) {
      if (/\banimate-(?:spin|pulse|ping|bounce)\b/.test(cls)) expect(cls).toMatch(/motion-reduce:animate-none/);
      if (/\btransition(?:-[a-z[\]-]+)?\b/.test(cls) && !/\btransition-none\b/.test(cls)) expect(cls, cls).toMatch(/motion-reduce:transition-none/);
    }
  });
});
