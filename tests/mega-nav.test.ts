// The marketing mega-menu.
//
// NOTE ON COVERAGE. This repo's vitest runs in the `node` environment with no
// jsdom and no @testing-library/react, so click/hover/Esc cannot be dispatched
// here. Rather than add two dependencies to a box that serves production from
// its working tree, the open/close STATE MACHINE is extracted as a pure
// function and tested directly, and everything observable in the server HTML —
// aria wiring, hidden panels, flat links, hrefs, i18n — is asserted on the
// rendered markup. What is NOT covered: the DOM listeners themselves (outside
// click, Esc, focus-out, scroll lock) and the arrow-key roving focus.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicNav, navHrefs, nextOpenPanel } from "@/app/[locale]/PublicNav";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";

const nav = (locale: string, current?: Parameters<typeof PublicNav>[0]["current"]) =>
  renderToStaticMarkup(createElement(PublicNav, { locale, current }));

describe("every menu destination exists", () => {
  it("resolves each href to a registered route or a homepage anchor", () => {
    // A nav is the one component where a dead link is certain to be found.
    const known = new Set(LOCALIZED_ROUTES.map((r) => r.path));
    for (const href of navHrefs()) {
      if (href.startsWith("#")) continue;
      expect(known.has(href.split("#")[0]), `${href} is not a registered route`).toBe(true);
    }
  });

  it("never points at an authenticated route", () => {
    // /visibility/tools/* is plan-gated; an anonymous click bounces off it.
    for (const href of navHrefs()) {
      expect(href.startsWith("/visibility")).toBe(false);
      expect(href.startsWith("/dashboard")).toBe(false);
    }
  });

  it("keeps /use-cases as a flat top-level link, not a panel item", () => {
    // It moved out of the Solutions panel when that panel became the 25-item
    // taxonomy; the flat link is what keeps the page reachable.
    expect(navHrefs()).toContain("/use-cases");
    expect(nav("en")).toContain('href="/en/use-cases"');
  });

  it("carries every taxonomy item in the Solutions panel", () => {
    const hrefs = navHrefs();
    expect(hrefs.filter((h) => h.startsWith("/solutions/"))).toHaveLength(25);
  });
});

describe("single-panel invariant", () => {
  it("opens a closed panel", () => {
    expect(nextOpenPanel(null, "product")).toBe("product");
  });

  it("closes the panel that is already open", () => {
    expect(nextOpenPanel("product", "product")).toBeNull();
  });

  it("REPLACES rather than accumulates when another trigger is used", () => {
    // The state is one value, not a set — this is what makes two open panels
    // unrepresentable rather than merely unlikely.
    expect(nextOpenPanel("product", "resources")).toBe("resources");
    expect(nextOpenPanel("resources", "solutions")).toBe("solutions");
  });
});

describe("markup and aria", () => {
  it("renders a menu button per group, closed by default", () => {
    const html = nav("en");
    const expanded = [...html.matchAll(/aria-expanded="(true|false)"/g)].map((m) => m[1]);
    // Three triggers plus the mobile burger, all closed on the server.
    expect(expanded).toHaveLength(4);
    expect(expanded.every((v) => v === "false")).toBe(true);
    expect([...html.matchAll(/aria-haspopup="true"/g)]).toHaveLength(3);
  });

  it("renders every panel hidden rather than unmounted, so crawlers see it", () => {
    // A conditionally mounted panel would keep every link inside it out of the
    // server HTML — on a site whose sitemap and hreflang exist to index them.
    const html = nav("en");
    expect([...html.matchAll(/role="region"/g)]).toHaveLength(3);
    expect([...html.matchAll(/hidden=""/g)].length).toBeGreaterThanOrEqual(3);
    expect(html).toContain('href="/en/learn"');
    expect(html).toContain('href="/en/use-cases"');
  });

  it("keeps Pricing and Login as flat links with no panel", () => {
    const html = nav("en");
    expect(html).toContain('href="/en/pricing"');
    expect(html).toContain('href="/login"');
    // Neither renders a region of its own — only the three groups do.
    expect([...html.matchAll(/role="region"/g)]).toHaveLength(3);
  });

  it("points the promo at the standalone free-audit page", () => {
    // It pointed at /ai-visibility#audit until the audit got a page of its own.
    // The promo is rendered once and reused by all three panels, so this single
    // assertion covers Product, Solutions and Resources.
    expect(nav("en")).toContain('href="/en/free-audit"');
    expect(nav("en")).not.toContain("ai-visibility#audit");
  });

  it("keeps the right-hand side unchanged", () => {
    const html = nav("en");
    expect(html).toContain('href="/en"'); // EN toggle
    expect(html).toContain('href="/fr"'); // FR toggle
    expect(html).toContain("Join Now"); // auth-aware CTA, logged-out
    expect(html).toContain('href="/login"');
  });
});

describe("active state", () => {
  it("marks the group that contains the current page", () => {
    expect(nav("en", "learn")).toContain('aria-current="page"');
    expect(nav("en", "product")).toContain('aria-current="page"');
  });

  it("marks the flat Pricing link", () => {
    // Attribute order is React's, not ours — match the whole tag either way.
    const tag = nav("en", "pricing").match(/<a[^>]*href="\/en\/pricing"[^>]*>/)?.[0] ?? "";
    expect(tag).toContain('aria-current="page"');
  });

  it("marks nothing when no page claims it", () => {
    expect(nav("en")).not.toContain('aria-current="page"');
  });
});

describe("i18n", () => {
  it("labels the groups per locale base", () => {
    expect(nav("en")).toContain(">Product<");
    expect(nav("fr")).toContain(">Produit<");
    // de-CH shows English chrome, per the house fold.
    expect(nav("de-CH")).toContain(">Product<");
  });

  it("localizes every panel href but keeps the regional locale in the URL", () => {
    const html = nav("en-CA");
    expect(html).toContain('href="/en-CA/use-cases"');
    expect(html).toContain(">Product<");
  });

  it("translates the promo card", () => {
    expect(nav("fr")).toContain("Audit de visibilité IA gratuit");
  });
});
