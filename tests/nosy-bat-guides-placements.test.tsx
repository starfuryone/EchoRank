// @vitest-environment jsdom
//
// Where the crawler guides are linked from (NOSY-BAT-GUIDES.md, placements):
// the guides index lists the four cards in its #nosy-bat section, and is the
// only page that does; the hub shows one card pointing there; the public
// /site-crawler page has a single "Guides" link in its hero row and no cards;
// and every crawler view's header carries a Guides link styled exactly like
// Help / How to, opening the section in a new tab.
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(),
}));

import GuidesIndex, { generateMetadata as indexMeta } from "@/app/[locale]/learn/guides/page";
import LearnHub from "@/app/[locale]/learn/page";
import SiteCrawlerPage from "@/app/[locale]/site-crawler/page";
import { CrawlerHeader } from "@/components/seo-tools/site-crawler-client";
import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { NOSY_BAT_GUIDES } from "@/lib/learn-nosy-bat";
import { LEARN_GUIDES, guideCopy, learnRoutes } from "@/lib/learn-content";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const crawlerCards = (html: string) => NOSY_BAT_GUIDES.filter((g) => html.includes(`/learn/guides/${g.slug}"`)).map((g) => g.slug);

describe("the guides index", () => {
  it("is a registered, sitemap-listed route", () => {
    expect(learnRoutes()).toContain("/learn/guides");
    expect(LOCALIZED_ROUTES.some((r) => r.path === "/learn/guides")).toBe(true);
  });

  it.each(["en", "fr"] as const)("lists the four crawler guides in #nosy-bat (%s), then the ultimate guides", async (l) => {
    const html = renderToStaticMarkup(await GuidesIndex({ params: Promise.resolve({ locale: l }) }));
    const doc = new DOMParser().parseFromString(html, "text/html");
    const section = doc.getElementById("nosy-bat")!;
    expect(section).not.toBeNull();
    const hrefs = [...section.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(NOSY_BAT_GUIDES.map((g) => `/${l}/learn/guides/${g.slug}`));
    for (const g of NOSY_BAT_GUIDES) expect(section.textContent).toContain(guideCopy(g, l).title);
    const ultimate = doc.getElementById("ultimate")!;
    expect(ultimate.querySelectorAll("a")).toHaveLength(LEARN_GUIDES.filter((g) => !g.group).length);
    const meta = await indexMeta({ params: Promise.resolve({ locale: l }) });
    expect(String(meta.alternates?.canonical)).toMatch(/\/en\/learn\/guides$/);
  });
});

describe("the hub", () => {
  it("shows one card for the crawler guides, pointing at the index section, not the four", async () => {
    const html = renderToStaticMarkup(await LearnHub({ params: Promise.resolve({ locale: "en" }) }));
    expect(html).toContain('href="/en/learn/guides#nosy-bat"');
    expect(crawlerCards(html)).toEqual([]);
  });
});

describe("/site-crawler", () => {
  it.each(["en", "fr"] as const)("has one Guides link in the hero row and no guide cards (%s)", async (l) => {
    const html = renderToStaticMarkup(await SiteCrawlerPage({ params: Promise.resolve({ locale: l }) }));
    const doc = new DOMParser().parseFromString(html, "text/html");
    const links = [...doc.querySelectorAll('[data-testid="crawler-guides-link"]')];
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe(`/${l}/learn/guides#nosy-bat`);
    expect(links[0].textContent).toBe("Guides");
    // In the hero's secondary-link row, beside the comparison link — not above the FAQ.
    expect(links[0].parentElement?.querySelector('a[href="#hosted"]')).not.toBeNull();
    expect(crawlerCards(html)).toEqual([]);
  });
});

describe("the crawler header (every /crawler/* view)", () => {
  it.each(["en", "fr", "de-CH"] as const)("carries Guides beside Help and How to, same style, new tab (%s)", async (l) => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);
    const t = SITE_CRAWLER_COPY[l];
    await act(async () => root.render(<CrawlerHeader t={t} locale={l} quota={null} howto="overview" />));
    const guides = el.querySelector<HTMLAnchorElement>('[data-testid="guides-link"]')!;
    const help = el.querySelector<HTMLButtonElement>(`button[aria-label="${t.helpAria}"]`)!;
    const howto = el.querySelector<HTMLButtonElement>('[data-testid="howto-button"]')!;
    expect(guides.getAttribute("href")).toBe(`/${l}/learn/guides#nosy-bat`);
    expect(guides.getAttribute("target")).toBe("_blank");
    expect(guides.getAttribute("rel")).toContain("noopener");
    expect(guides.textContent).toBe(t.ux.guidesButton);
    expect(guides.className).toBe(help.className);
    expect(guides.className).toBe(howto.className);
    // Same row, after Help.
    expect(guides.parentElement).toBe(help.parentElement);
    expect([...guides.parentElement!.children].indexOf(guides)).toBeGreaterThan([...guides.parentElement!.children].indexOf(help));
    // The accessible name contains the visible text (WCAG 2.5.3).
    expect(guides.getAttribute("aria-label")!.toLowerCase()).toContain(t.ux.guidesButton.toLowerCase());
    act(() => root.unmount());
    el.remove();
  });

  it("renders even on a view with no How to (the locked-plan screen)", async () => {
    const el = document.createElement("div");
    const root = createRoot(el);
    await act(async () => root.render(<CrawlerHeader t={SITE_CRAWLER_COPY.en} locale="en" quota={null} />));
    expect(el.querySelector('[data-testid="guides-link"]')).not.toBeNull();
    act(() => root.unmount());
  });
});
