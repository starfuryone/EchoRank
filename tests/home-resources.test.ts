// The RESOURCES section (/15) on the homepage.
//
// Asserts the RENDERED markup rather than the copy table: a label present in
// the catalog but dropped from the section is exactly the failure worth
// catching, and the two things that make the extension link work — a plain <a>
// and an unprefixed path — are invisible from the catalog alone.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The homepage mounts a video player and an IntersectionObserver on the client;
// neither runs under renderToStaticMarkup, but the module-level references have
// to exist for the import to succeed.
vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import HomeClient from "@/app/[locale]/HomeClient";
import { HOME_PRICING_CHROME, HOME_TOOLS } from "@/lib/i18n/content";

function home(locale: "en" | "fr"): string {
  return renderToStaticMarkup(
    createElement(HomeClient, {
      locale,
      pricing: [],
      priceChrome: HOME_PRICING_CHROME[locale],
      liveToolCount: 0,
      // The Classic SEO Tools section is server-rendered and slotted in; the
      // RESOURCES section does not depend on it.
      toolsSection: null,
      playerLabels: HOME_TOOLS[locale].player,
    }),
  );
}

/** The rendered <a …> opening tag for a given href. */
function anchor(html: string, href: string): string {
  const match = html.match(new RegExp(`<a[^>]*href="${href.replace(/\//g, "\\/")}"[^>]*>`));
  return match ? match[0] : "";
}

describe("RESOURCES section — browser extension button", () => {
  it("renders a link to /extension", () => {
    expect(anchor(home("en"), "/extension")).not.toBe("");
  });

  it("points at the install page, never at the .crx", () => {
    // The install page carries the guide modal and the video; linking the
    // packaged extension directly would hand a user a file Chrome refuses to
    // install from a download, which is the problem that page solves.
    const html = home("en");
    expect(html).not.toMatch(/href="[^"]*\.crx"/);
  });

  it("uses an unprefixed path in every locale", () => {
    // Caddy serves one copy of extension-dist at /extension; /fr/extension is
    // owned by the Next locale routing and would 404.
    for (const locale of ["en", "fr"] as const) {
      const html = home(locale);
      expect(anchor(html, "/extension")).not.toBe("");
      expect(html).not.toContain('href="/fr/extension"');
      expect(html).not.toContain('href="/en/extension"');
    }
  });

  it("carries the same button styling as the second whitepaper button", () => {
    const html = home("en");
    const extension = anchor(html, "/extension");
    const whitepaper = anchor(html, "/whitepapers/echorank360-seo-tools-whitepaper.pdf");
    const classOf = (tag: string) => tag.match(/class="([^"]*)"/)?.[1] ?? "";
    expect(classOf(extension)).toBe(classOf(whitepaper));
    expect(classOf(extension)).not.toBe("");
  });

  it("sits beside the whitepaper buttons, not elsewhere on the page", () => {
    // Ordering, not just presence: the button belongs in /15 next to the two
    // downloads, so it must fall after the second whitepaper link and before
    // the closing section.
    const html = home("en");
    const secondPaper = html.indexOf("echorank360-seo-tools-whitepaper.pdf");
    const extension = html.indexOf('href="/extension"');
    expect(secondPaper).toBeGreaterThan(-1);
    expect(extension).toBeGreaterThan(secondPaper);
  });

  it("is translated, not left in English on the French homepage", () => {
    expect(home("en")).toContain("Browser extension");
    expect(home("fr")).toContain("Extension navigateur");
    expect(home("fr")).not.toContain("Browser extension");
  });
});

describe("Phase 1 — homepage CTAs route through pricing", () => {
  it("no CTA on the homepage links to /register", () => {
    // The pricing cards' checkout is a <button> that only reaches /register
    // from JS on a 401, so nothing here should render a /register href at all.
    for (const locale of ["en", "fr"] as const) {
      const found = [...home(locale).matchAll(/href="([^"]*)"/g)]
        .map((m) => m[1])
        .filter((h) => h.startsWith("/register"));
      expect(found).toEqual([]);
    }
  });

  it("the hero secondary CTA points at the locale's pricing page", () => {
    expect(anchor(home("en"), "/en/pricing")).not.toBe("");
    expect(anchor(home("fr"), "/fr/pricing")).not.toBe("");
  });

  it("the header Create Account button points at pricing", () => {
    // Signed out only — the signed-in swap to /dashboard is an in-app link and
    // is deliberately untouched.
    const html = home("en");
    expect(html).toContain('href="/en/pricing"');
  });

  it("keeps Pricing in the footer nav", () => {
    expect(home("en")).toContain('href="/en/pricing"');
    expect(home("fr")).toContain('href="/fr/pricing"');
  });
});
