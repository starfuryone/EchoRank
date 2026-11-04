// @vitest-environment jsdom
//
// tests/site-crawler-howto.test.tsx — the crawler's "How to" walkthroughs:
// each view's button (Overview / Results+Issues / Pages / History /
// Schedules) opens its own walkthrough on the shared Modal; the step count
// matches the copy source (howto-copy.ts) and its pictograms; steps move with
// Previous / Next and ← / →; Esc closes and focus returns; ?howto=1 opens it;
// each view opens it by itself once (first visit); "Don't show again" is
// stored per view; blocked storage never throws. Three locales; axe.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let search = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/crawler",
}));
vi.mock("@/lib/flags", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags")>();
  const on = { ...real.FLAGS, "crawl.schedule": true };
  return { ...real, FLAGS: on, flag: (n: keyof typeof on) => on[n] === true };
});

import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { HOWTO_ART, HOWTO_COPY, HOWTO_VIEWS, howtoStorageKey, type HowtoView } from "@/lib/site-crawler/howto-copy";
import { HOWTO_ART_IDS, HowtoArt } from "@/components/seo-tools/howto-art";
import { CrawlerHeader, SiteCrawlerClient } from "@/components/seo-tools/site-crawler-client";
import { CrawlHistory } from "@/components/seo-tools/site-crawler-history";
import { CrawlIssuesPage } from "@/components/seo-tools/site-crawler-issues-page";
import { CrawlPagesPage } from "@/components/seo-tools/site-crawler-pages-page";
import { CrawlSchedulesView } from "@/components/seo-tools/site-crawler-schedules-view";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const LOCALES = ["en", "fr", "de-CH"] as const;

const crawl = {
  id: "c1",
  rootUrl: "https://shop.example/",
  status: "COMPLETED",
  urlCap: 500,
  pagesCrawled: 10,
  issueCount: 1,
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
  health: 80,
  kinds: { issue: 1, warning: 0, opportunity: 0 },
};
const quota = {
  urlCap: 5000,
  renderCap: 0,
  monthlyLimit: 20,
  used: 0,
  remaining: 20,
  allowed: true,
  locked: false,
  crawlsKept: 10,
  scheduleCap: 1,
  scheduleCadences: ["monthly"],
};

let el: HTMLElement;
let root: Root;
beforeEach(() => {
  search = "";
  localStorage.clear();
  el = document.createElement("main");
  document.body.appendChild(el);
  root = createRoot(el);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string) => {
      const ok = (body: unknown) => ({ ok: true, json: async () => body });
      if (u === "/api/seo/v1/crawl") return ok({ crawls: [crawl], quota });
      if (u.startsWith("/api/seo/v1/crawl?history=1")) return ok({ crawls: [crawl], quota, total: 1, nextCursor: null, pageSize: 20, hosts: [] });
      if (u === "/api/seo/v1/crawl/schedules") return ok({ schedules: [], cap: 1, cadences: ["monthly"], timezone: "UTC" });
      if (u === "/api/seo/v1/crawl/c1") return ok(crawl);
      if (u.startsWith("/api/seo/v1/crawl/c1/rules")) return ok({ pagesCrawled: 10, rules: [] });
      if (u.startsWith("/api/seo/v1/crawl/c1/pages")) return ok({ pages: [], page: 1, pageSize: 50, total: 0, totalPages: 1, nextCursor: null });
      return { ok: false, json: async () => null };
    }),
  );
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"] [data-testid="howto"]');
const openDialog = async () => vi.waitFor(() => expect(dialog()).not.toBeNull(), { timeout: 3000 }).then(() => dialog()!);
const seenAll = () => HOWTO_VIEWS.forEach((v) => localStorage.setItem(howtoStorageKey(v), "seen"));

describe("the copy source", () => {
  it.each(LOCALES)("%s: every view has 3–5 steps, one per pictogram, each a one-line title and one or two sentences", (l) => {
    for (const v of HOWTO_VIEWS) {
      const w = HOWTO_COPY[l].views[v];
      expect(w.steps.length, `${l} ${v}`).toBe(HOWTO_ART[v].length);
      expect(w.steps.length).toBeGreaterThanOrEqual(3);
      expect(w.steps.length).toBeLessThanOrEqual(5);
      for (const s of w.steps) {
        expect(s.title.trim()).not.toBe("");
        expect(s.title).not.toMatch(/\n/);
        const sentences = s.body.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ«])/).filter(Boolean);
        expect(sentences.length, `${l} ${v}: ${s.body}`).toBeLessThanOrEqual(2);
      }
    }
    const all = JSON.stringify(HOWTO_COPY[l]);
    expect(all).not.toMatch(/Echo ?Rank|echoRank|Nosy Bat/);
    if (l === "de-CH") expect(all).not.toContain("ß");
  });

  it("the walkthroughs cover what each view asks for", () => {
    expect(HOWTO_ART.issues).toContain("kinds");
    expect(HOWTO_ART.pages).toContain("page-score");
    for (const l of LOCALES) {
      expect(HOWTO_COPY[l].views.overview.note).toBeTruthy();
      expect(HOWTO_COPY[l].views.history.note).toBeTruthy();
      expect(HOWTO_COPY[l].views.schedules.note).toBeTruthy();
    }
  });

  it("every pictogram: 120×80, decorative, no text, an emerald accent", () => {
    for (const id of HOWTO_ART_IDS) {
      const html = renderToStaticMarkup(<HowtoArt id={id} />);
      expect(html, id).toContain('viewBox="0 0 120 80"');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('focusable="false"');
      expect(html).not.toMatch(/<text|<title|<image/);
      expect(html).toContain("text-emerald-600");
    }
    expect(new Set(Object.values(HOWTO_ART).flat())).toEqual(new Set(HOWTO_ART_IDS));
  });
});

describe.each(LOCALES)("%s", (l) => {
  const t = SITE_CRAWLER_COPY[l];
  const VIEWS: [HowtoView, () => React.ReactElement][] = [
    ["overview", () => <SiteCrawlerClient locale={l} view="start" />],
    ["issues", () => <SiteCrawlerClient locale={l} view="results" crawlId="c1" />],
    ["issues", () => <CrawlIssuesPage locale={l} crawlId="c1" />],
    ["pages", () => <CrawlPagesPage locale={l} crawlId="c1" />],
    ["history", () => <CrawlHistory locale={l} />],
    ["schedules", () => <CrawlSchedulesView locale={l} />],
  ];

  it.each(VIEWS)("the %s view's How to button opens its walkthrough", async (view, make) => {
    seenAll();
    await act(async () => root.render(make()));
    const btn = await vi.waitFor(() => {
      const b = el.querySelector<HTMLButtonElement>('[data-testid="howto-button"]');
      expect(b).not.toBeNull();
      return b!;
    });
    expect(btn.textContent).toBe(t.ux.howtoButton);
    expect(btn.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    expect(dialog()).toBeNull();
    await act(async () => btn.click());
    const d = await openDialog();
    expect(d.getAttribute("data-view")).toBe(view);
    expect(document.querySelector('[role="dialog"] h2')!.textContent).toBe(HOWTO_COPY[l].views[view].title);
    expect(d.querySelectorAll('[data-testid="howto-steps"] li')).toHaveLength(HOWTO_ART[view].length);
  });

  it("steps move with the buttons and the arrow keys; Done closes; Esc closes and focus returns", async () => {
    seenAll();
    const ui = HOWTO_COPY[l].ui;
    const steps = HOWTO_COPY[l].views.history.steps;
    await act(async () => root.render(<CrawlerHeader t={t} locale={l} quota={null} howto="history" />));
    const btn = el.querySelector<HTMLButtonElement>('[data-testid="howto-button"]')!;
    btn.focus();
    await act(async () => btn.click());
    const d = await openDialog();
    const current = () => d.querySelector('[data-testid="howto-step"] h3')!.textContent;
    const button = (label: string) => [...d.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label)!;
    expect(current()).toBe(steps[0]!.title);
    expect(d.textContent).toContain(ui.stepOf("1", String(steps.length)));
    expect(button(ui.previous).disabled).toBe(true);
    await act(async () => button(ui.next).click());
    expect(current()).toBe(steps[1]!.title);
    expect(d.querySelector('[aria-current="step"]')!.getAttribute("aria-label")).toBe(ui.goToStep("2", steps[1]!.title));
    await act(async () => d.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(current()).toBe(steps[2]!.title);
    await act(async () => d.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    expect(current()).toBe(steps[1]!.title);
    await act(async () => d.querySelectorAll<HTMLButtonElement>('[data-testid="howto-steps"] button')[steps.length - 1]!.click());
    expect(current()).toBe(steps[steps.length - 1]!.title);
    await act(async () => d.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(current()).toBe(steps[steps.length - 1]!.title);
    expect(d.querySelector('[data-testid="howto-note"]')!.textContent).toContain(HOWTO_COPY[l].views.history.note!.title);
    await act(async () => button(ui.done).click());
    expect(dialog()).toBeNull();
    // Esc, then focus back on the How to button.
    await act(async () => btn.click());
    await openDialog();
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(dialog()).toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(btn));
  });

  it("opens by itself on a view's first visit, once; Don't show again is stored per view", async () => {
    await act(async () => root.render(<CrawlerHeader t={t} locale={l} quota={null} howto="pages" />));
    const d = await openDialog();
    expect(d.getAttribute("data-view")).toBe("pages");
    expect(localStorage.getItem(howtoStorageKey("pages"))).toBe("seen");
    expect(localStorage.getItem(howtoStorageKey("history"))).toBeNull();
    const box = d.querySelector<HTMLInputElement>('[data-testid="howto-dontshow"]')!;
    expect([box.checked, box.closest("label")!.textContent]).toEqual([false, HOWTO_COPY[l].ui.dontShow]);
    await act(async () => box.click());
    expect(localStorage.getItem(howtoStorageKey("pages"))).toBe("off");
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    // A second visit: nothing opens; the box stays checked when opened by hand.
    act(() => root.unmount());
    root = createRoot(el);
    await act(async () => root.render(<CrawlerHeader t={t} locale={l} quota={null} howto="pages" />));
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(dialog()).toBeNull();
    await act(async () => el.querySelector<HTMLButtonElement>('[data-testid="howto-button"]')!.click());
    expect((await openDialog()).querySelector<HTMLInputElement>('[data-testid="howto-dontshow"]')!.checked).toBe(true);
  });

  it("?howto=1 opens it even after Don't show again; blocked storage never throws and never nags", async () => {
    localStorage.setItem(howtoStorageKey("schedules"), "off");
    search = "howto=1";
    await act(async () => root.render(<CrawlerHeader t={t} locale={l} quota={null} howto="schedules" />));
    expect((await openDialog()).getAttribute("data-view")).toBe("schedules");
    act(() => root.unmount());
    search = "";
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    root = createRoot(el);
    await act(async () => root.render(<CrawlerHeader t={t} locale={l} quota={null} howto="overview" />));
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(dialog()).toBeNull();
    await act(async () => el.querySelector<HTMLButtonElement>('[data-testid="howto-button"]')!.click());
    const d = await openDialog();
    await act(async () => d.querySelector<HTMLInputElement>('[data-testid="howto-dontshow"]')!.click());
    expect(d.querySelector<HTMLInputElement>('[data-testid="howto-dontshow"]')!.checked).toBe(true);
    get.mockRestore();
    set.mockRestore();
  });

  it.each(HOWTO_VIEWS)("%s walkthrough: no serious or critical axe violations", async (view) => {
    seenAll();
    await act(async () => root.render(<CrawlerHeader t={t} locale={l} quota={null} howto={view} />));
    await act(async () => el.querySelector<HTMLButtonElement>('[data-testid="howto-button"]')!.click());
    await openDialog();
    const res = await axe.run(document.querySelector('[role="dialog"]')!, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    });
    expect(res.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  });
});
