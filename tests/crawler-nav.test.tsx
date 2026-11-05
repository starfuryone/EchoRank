// @vitest-environment jsdom
//
// The crawler's own place in the app: /crawler route (the old path 308s), a
// WORKSPACE sidebar row between SEO Tools and Marketing Studio on paid plans,
// and a top-bar title with the "crawler by Echorank" byline.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/dashboard", redirect: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  permanentRedirect: (url: string) => nav.redirect(url),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, replace: () => {} }),
}));

import { Sidebar, activeNavHref } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { dashNav, dashNavByline, SIDEBAR_TOOLTIPS, SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import OldSiteCrawlerPage from "@/app/(dashboard)/visibility/tools/site-crawler/page";
import { SiteCrawlerClient } from "@/components/seo-tools/site-crawler-client";
import { helpArticleFor, learnHref } from "@/lib/help-content";

const APP = join(__dirname, "..", "src", "app", "(dashboard)");

beforeEach(() => {
  nav.pathname = "/dashboard";
  nav.redirect.mockReset();
});

describe("the /crawler route", () => {
  it("has a page and a paid-plan layout of its own", () => {
    expect(existsSync(join(APP, "crawler", "page.tsx"))).toBe(true);
    expect(existsSync(join(APP, "crawler", "layout.tsx"))).toBe(true);
  });

  it("308s the old path to /crawler, keeping the query", async () => {
    await OldSiteCrawlerPage({ searchParams: Promise.resolve({ crawl: "c1", tab: ["rules", "x"] }) });
    expect(nav.redirect).toHaveBeenCalledWith("/crawler?crawl=c1&tab=rules&tab=x");
    await OldSiteCrawlerPage({ searchParams: Promise.resolve({}) });
    expect(nav.redirect).toHaveBeenLastCalledWith("/crawler");
  });
});

describe("the sidebar row", () => {
  const sidebar = (paid: boolean, locale: "en" | "fr" | "de-CH" = "en") =>
    renderToStaticMarkup(createElement(Sidebar, { locale, paid, assistantVisible: false }));

  it("shows the brand name for a paid tenant, between SEO Tools and Marketing Studio", () => {
    const html = sidebar(true);
    expect(html).toContain(`>${CRAWLER_BRAND.name}</a>`);
    const order = ["/visibility/tools\"", "/crawler\"", "/visibility/tools/ai-content-helper\""].map((h) =>
      html.indexOf(`href="${h}`),
    );
    expect(order.every((i) => i > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // The emblem, painted from the currentColor SVG through a mask (tests/nosy-bat-logo.test.tsx).
    expect(html).toContain(CRAWLER_BRAND.mark);
    expect(html).toContain("data-nb-emblem");
    expect(html).toContain('title="Site crawler"');
  });

  it("is hidden for an unpaid tenant", () => {
    const html = sidebar(false);
    expect(html).not.toContain('href="/crawler"');
    expect(html).not.toContain(CRAWLER_BRAND.name);
  });

  it("keeps the name untranslated and translates the tooltip", () => {
    for (const locale of ["en", "fr", "de-CH"] as const) {
      expect(dashNav[locale]["/crawler"]).toBe(CRAWLER_BRAND.name);
      const tooltip = SIDEBAR_TOOLTIPS[locale]["/crawler"]!.replace("'", "&#x27;");
      expect(sidebar(true, locale)).toContain(`title="${tooltip}"`);
    }
    expect(SIDEBAR_TOOLTIPS.fr["/crawler"]).toBe("Robot d'exploration");
    expect(SIDEBAR_TOOLTIPS["de-CH"]["/crawler"]).toBe("Site-Crawler");
  });

  it("is the active row on /crawler and below it", () => {
    const items = [{ href: "/visibility/tools" }, { href: "/crawler" }, { href: "/ai", activePrefixes: ["/visibility"] }];
    expect(activeNavHref(items, "/crawler")).toBe("/crawler");
    expect(activeNavHref(items, "/crawler/abc")).toBe("/crawler");
  });
});

describe("the top bar on /crawler", () => {
  it("titles the page with the brand and the byline", () => {
    nav.pathname = "/crawler";
    const byline = dashNavByline("en", "/crawler");
    expect(byline).toBe(CRAWLER_BRAND.byline);
    expect(dashNavByline("fr", "/crawler/x")).toBe(SITE_CRAWLER_COPY.fr.byline);
    expect(dashNavByline("en", "/visibility/tools")).toBeUndefined();

    const html = renderToStaticMarkup(createElement(Header, { title: dashNav.en["/crawler"]!, byline }));
    // The logo is the title (alt = the name), the byline text beside it.
    expect(html).toMatch(new RegExp(`<h1[^>]*><span[^>]*><img[^>]*alt="${CRAWLER_BRAND.name}"[^>]*/></span><span[^>]*text-xs[^>]*>${CRAWLER_BRAND.byline}</span></h1>`));
  });

  it("sets the browser title to the brand and Echorank", () => {
    for (const locale of ["en", "fr", "de-CH"] as const) {
      expect(SITE_CRAWLER_COPY[locale].pageTitle).toBe(`${CRAWLER_BRAND.name} — Echorank`);
    }
  });
});

describe("the Help button on /crawler", () => {
  // Since the in-app help modal: a <button> opening <CrawlerHelpModal> (tests/site-crawler-help-modal.test.tsx);
  // the /learn guide moved to the modal's footer.
  it("is a button that opens the in-app help, not a link away", () => {
    expect(helpArticleFor("/crawler")).toBeUndefined();
    for (const locale of ["en", "fr"] as const) {
      const html = renderToStaticMarkup(createElement(SiteCrawlerClient, { locale }));
      const aria = SITE_CRAWLER_COPY[locale].helpAria.replace(/'/g, "&#x27;");
      const at = html.indexOf(`<button type="button" aria-label="${aria}" aria-haspopup="dialog"`);
      expect(at).toBeGreaterThan(-1);
      expect(html.slice(at, html.indexOf("</button>", at))).toContain(SITE_CRAWLER_COPY[locale].helpButton);
      expect(html).not.toContain(`href="${learnHref(locale, "/learn/guides/what-nosy-bat-checks")}"`);
    }
  });
});
