// @vitest-environment jsdom
//
// tests/site-crawler-ux-start.test.tsx — the Start view (/crawler) of the UX
// restructure: only mode, URL, rendering, Start and the plan lines outside
// one collapsed "Advanced options"; each option group its own collapsed
// sub-section with a summary line, gated by its flag; the last five crawls
// link to their results; Reset to defaults. In every dashboard locale.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push, replace: vi.fn() }) }));

import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { SiteCrawlerClient } from "@/components/seo-tools/site-crawler-client";
import { CRAWLER_ROUTES } from "@/components/seo-tools/site-crawler-nav";
import { FLAGS } from "@/lib/flags";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const LOCALES = ["en", "fr", "de-CH"] as const;

const crawl = (i: number, extra: Record<string, unknown> = {}) => ({
  id: `c${i}`, rootUrl: `https://site${i}.example/`, status: "COMPLETED", urlCap: 500, pagesCrawled: 100 + i, issueCount: 3, stoppedReason: null,
  startedAt: "2026-11-01T10:00:00Z", finishedAt: "2026-11-01T10:05:00Z", createdAt: "2026-11-01T10:00:00Z", renderMode: "none", renderCap: 0,
  pagesRendered: 0, mode: "spider", config: null, pinned: false, dataPurgedAt: null, health: 80 - i, ...extra,
});
const quota = {
  urlCap: 5000, renderCap: 500, monthlyLimit: 20, used: 2, remaining: 18, allowed: true, locked: false, crawlsKept: 10,
  extractorCap: 5, searchCap: 5, segmentCap: 10, scheduleCap: 2, scheduleCadences: ["weekly", "monthly"], psiCap: 50, backlinkCap: 50,
  lighthouseUsed: 0, lighthouseLimit: 20, backlinkUnitUsd: 0.02, seoBudgetLeftUsd: 10, jsSnippetCap: 3, aiPageCap: 100, semanticCap: 2000,
  inspectionCap: 200, aiTokensUsed: 0, aiTokenLimit: 500000, aiClaude: true, aiKeys: { openai: true, gemini: false },
};

let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string) => {
      if (u === "/api/seo/v1/crawl") return { ok: true, json: async () => ({ crawls: Array.from({ length: 7 }, (_, i) => crawl(i)), quota }) };
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
  await act(async () => root.render(<SiteCrawlerClient locale={l} view="start" />));
  await vi.waitFor(() => expect(el.querySelector('[data-testid="recent-crawls"]')).not.toBeNull());
};

describe.each(LOCALES)("%s", (l) => {
  const t = SITE_CRAWLER_COPY[l];

  it("keeps the core controls outside one collapsed Advanced options", async () => {
    await render(l);
    const advanced = el.querySelector<HTMLDetailsElement>("#crawl-advanced")!;
    expect(advanced).not.toBeNull();
    expect(advanced.open).toBe(false);
    // Outside Advanced: mode, URL, rendering, Start.
    for (const id of ["crawl-mode", "crawl-url", "crawl-render"]) {
      const c = el.querySelector(`#${id}`);
      expect(c, id).not.toBeNull();
      expect(advanced.contains(c)).toBe(false);
    }
    expect([...el.querySelectorAll("button[type=submit]")].some((b) => b.textContent === t.startCta && !advanced.contains(b))).toBe(true);
    // Inside: every option group, each its own collapsed sub-section.
    const subs = [...advanced.querySelectorAll<HTMLDetailsElement>("details[id^=adv-]")];
    expect(subs.every((d) => !d.open)).toBe(true);
    const ids = subs.map((d) => d.id.replace("adv-", ""));
    expect(ids).toContain("config");
    if (FLAGS["crawl.extraction"]) expect(ids).toContain("extraction");
    if (FLAGS["crawl.ai"]) expect(ids).toContain("ai");
    if (FLAGS["crawl.semantic"]) expect(ids).toContain("semantic");
    expect(ids).toContain("add-data");
    // A summary line on each.
    expect(advanced.querySelector('[data-summary="ai"]')!.textContent).toBe(t.ux.notSet);
    expect(advanced.contains(el.querySelector("#cfg-max-urls"))).toBe(true);
    if (l === "de-CH") expect(JSON.stringify(t.ux)).not.toContain("ß");
  });

  it("lists the last five crawls, each linking to its results", async () => {
    await render(l);
    const rows = [...el.querySelectorAll<HTMLAnchorElement>('[data-testid="recent-crawls"] a')];
    expect(rows).toHaveLength(5);
    expect(rows[0]!.getAttribute("href")).toBe(CRAWLER_ROUTES.results("c0"));
    expect(rows[0]!.getAttribute("aria-label")).toBe(t.ux.openCrawl("site0.example"));
    expect(rows[0]!.querySelector("[data-health]")!.textContent).toContain("80");
    const all = [...el.querySelectorAll<HTMLAnchorElement>("a")].find((a) => a.textContent === t.ux.allHistory)!;
    expect(all.getAttribute("href")).toBe("/crawler/history");
  });

  it("Reset to defaults clears the data opt-ins and says so", async () => {
    await render(l);
    const reset = [...el.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === t.ux.reset)!;
    await act(async () => reset.click());
    expect(el.textContent).toContain(t.ux.resetDone);
  });
});

describe("gating", () => {
  it("a sub-section whose flag is off is not rendered", async () => {
    vi.resetModules();
    vi.doMock("@/lib/flags", async (orig) => {
      const real = await orig<typeof import("@/lib/flags")>();
      const off = { ...real.FLAGS, "crawl.semantic": false, "crawl.ai": false };
      return { ...real, FLAGS: off, flag: (n: keyof typeof off) => off[n] === true };
    });
    const { SiteCrawlerClient: Gated } = await import("@/components/seo-tools/site-crawler-client");
    await act(async () => root.render(<Gated locale="en" view="start" />));
    await vi.waitFor(() => expect(el.querySelector("#crawl-advanced")).not.toBeNull());
    expect(el.querySelector("#adv-semantic")).toBeNull();
    expect(el.querySelector("#adv-ai")).toBeNull();
    expect(el.querySelector("#adv-config")).not.toBeNull();
    vi.doUnmock("@/lib/flags");
  });
});
