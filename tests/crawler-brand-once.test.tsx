// @vitest-environment jsdom
//
// tests/crawler-brand-once.test.tsx — /crawler renders the Nosy Bat brand once
// outside the sidebar: the top bar's mark, name and byline. The page header
// below starts with the description; no lockup, no second name. Each crawler
// view shares that header, so Start stands for all of them.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/crawler",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SiteCrawlerClient } from "@/components/seo-tools/site-crawler-client";
import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let el: HTMLElement;
let root: Root;
beforeEach(() => {
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string) => {
      if (u === "/api/seo/v1/crawl") return { ok: true, json: async () => ({ crawls: [], quota: null }) };
      return { ok: false, json: async () => null };
    }),
  );
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

/** Accessible name, as far as these elements need: alt, aria-label, else text. */
function accessibleName(e: Element): string {
  return (e.getAttribute("aria-label") ?? (e.tagName === "IMG" ? e.getAttribute("alt") : null) ?? e.textContent ?? "").trim();
}

/** Elements outside the sidebar whose accessible name mentions the brand (innermost only). */
function brandRenderings(): Element[] {
  const named = [...el.querySelectorAll("h1, h2, h3, h4, h5, h6, img, a, button, nav, [aria-label], [title]")].filter(
    (e) => !e.closest("aside") && (accessibleName(e).includes(CRAWLER_BRAND.name) || (e.getAttribute("title") ?? "").includes(CRAWLER_BRAND.name)),
  );
  return named.filter((e) => !named.some((o) => o !== e && e.contains(o)));
}

describe.each(["en", "fr", "de-CH"] as const)("/crawler (%s)", (l) => {
  it("names Nosy Bat exactly once outside the sidebar: the top bar", async () => {
    await act(async () =>
      root.render(
        <DashboardShell locale={l} paid assistantVisible={false} user={{ name: "A" }}>
          <SiteCrawlerClient locale={l} view="start" />
        </DashboardShell>,
      ),
    );
    await vi.waitFor(() => expect(el.querySelector('[data-testid="crawler-header"]')).not.toBeNull());
    const found = brandRenderings();
    expect(found.map((e) => e.outerHTML.slice(0, 160))).toHaveLength(1);
    const h1 = found[0]!;
    expect(h1.tagName).toBe("H1");
    expect(h1.closest("header")).not.toBeNull();
    expect(accessibleName(h1).startsWith(CRAWLER_BRAND.name)).toBe(true);
    expect(h1.textContent).toContain(SITE_CRAWLER_COPY[l].byline);
    // The 28 px mark sits before the title, decorative.
    const mark = el.querySelector<HTMLImageElement>('header [data-testid="topbar-mark"]')!;
    expect(mark.getAttribute("src")).toBe(CRAWLER_BRAND.mark);
    expect([mark.getAttribute("width"), mark.getAttribute("height"), mark.getAttribute("alt")]).toEqual(["28", "28", ""]);
    expect(mark.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // No lockup anywhere on the page; the page header opens with the description.
    for (const src of [CRAWLER_BRAND.logoOnLight, CRAWLER_BRAND.logoOnDark]) expect(el.querySelector(`img[src="${src}"]`)).toBeNull();
    const header = el.querySelector('[data-testid="crawler-header"]')!;
    expect(header.firstElementChild!.tagName).toBe("P");
    expect(header.firstElementChild!.textContent).toBe(SITE_CRAWLER_COPY[l].subtitle);
    expect(header.querySelector("button")!.textContent).toContain(SITE_CRAWLER_COPY[l].helpButton);
  });
});
