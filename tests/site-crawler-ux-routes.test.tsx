// @vitest-environment jsdom
//
// tests/site-crawler-ux-routes.test.tsx — the crawler's task views (UX
// restructure): the route table, the old ?crawl= deep link onto Results, the
// links that point at Results (schedule email, PDF payload), one sidebar row
// active on every view, and the secondary nav strip between them.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => nav.redirect(url),
  usePathname: () => "/crawler",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, replace: () => {} }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/flags", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags")>();
  const on = { ...real.FLAGS, "crawl.schedule": true };
  return { ...real, FLAGS: on, flag: (n: keyof typeof on) => on[n] === true };
});

import StartPage from "@/app/(dashboard)/crawler/page";
import { activeNavHref } from "@/components/layout/sidebar";
import { CRAWLER_ROUTES, CrawlerNav } from "@/components/seo-tools/site-crawler-nav";
import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";

const APP = join(__dirname, "..", "src", "app", "(dashboard)");

beforeEach(() => nav.redirect.mockReset());

describe("route table", () => {
  it.each([
    ["/crawler", "crawler/page.tsx"],
    ["/crawler/[id]", "crawler/[id]/page.tsx"],
    ["/crawler/history", "crawler/history/page.tsx"],
    ["/crawler/schedules", "crawler/schedules/page.tsx"],
  ])("%s has a page under the paid crawler layout", (_route, file) => {
    expect(existsSync(join(APP, file))).toBe(true);
    expect(existsSync(join(APP, "crawler", "layout.tsx"))).toBe(true);
  });

  it("names every view in one place", () => {
    expect(CRAWLER_ROUTES).toMatchObject({ start: "/crawler", history: "/crawler/history", schedules: "/crawler/schedules" });
    expect(CRAWLER_ROUTES.results("c 1")).toBe("/crawler/c%201");
  });
});

describe("redirects", () => {
  it("sends /crawler?crawl=<id> to /crawler/<id>", async () => {
    await StartPage({ searchParams: Promise.resolve({ crawl: "cm1abc_2" }) });
    expect(nav.redirect).toHaveBeenCalledWith("/crawler/cm1abc_2");
    await StartPage({ searchParams: Promise.resolve({ crawl: ["c9", "c8"] }) });
    expect(nav.redirect).toHaveBeenLastCalledWith("/crawler/c9");
  });

  it("ignores a malformed id and renders the Start view", async () => {
    for (const crawl of ["../x", "a/b", "x".repeat(65), ""]) {
      nav.redirect.mockReset();
      await StartPage({ searchParams: Promise.resolve({ crawl }) });
      expect(nav.redirect).not.toHaveBeenCalled();
    }
  });
});

describe("one sidebar row, a strip for the views", () => {
  it("keeps the sidebar's crawler row active on every view", () => {
    const items = [{ href: "/visibility/tools" }, { href: "/crawler" }];
    for (const p of ["/crawler", "/crawler/c1", "/crawler/history", "/crawler/schedules"]) expect(activeNavHref(items, p)).toBe("/crawler");
  });

  it.each(["en", "fr", "de-CH"] as const)("%s: the strip links New crawl, History and Schedules, and marks the current view", (l) => {
    const u = SITE_CRAWLER_COPY[l].ux;
    const html = renderToStaticMarkup(createElement(CrawlerNav, { current: "history", t: u }));
    expect(html).toContain(`aria-label="${u.navLabel.replace(/'/g, "&#x27;")}"`);
    expect(html).toContain(`href="/crawler"`);
    expect(html).toContain(`href="/crawler/schedules"`);
    const current = (h: string) => [...h.matchAll(/<(?:a|span)\b([^>]*)>([^<]*)</g)].filter((m) => m[1]!.includes('aria-current="page"')).map((m) => m[2]);
    expect(current(html)).toEqual([u.navHistory]);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/crawler\/history"/);
    expect(current(renderToStaticMarkup(createElement(CrawlerNav, { current: "results", t: u })))).toEqual([u.navResults]);
  });
});
