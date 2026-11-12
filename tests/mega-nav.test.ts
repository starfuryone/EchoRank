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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NAV_RULE_COUNT_LABEL, PublicNav, navHrefs, nextOpenPanel } from "@/app/[locale]/PublicNav";
import { PricingSection } from "@/app/[locale]/PricingSection";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { SOLUTION_ITEMS } from "@/lib/solutions-taxonomy";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { NOSY_BAT_CARD_ANCHOR } from "@/lib/plan-launch";
import { pricingTiers } from "@/lib/pricing-tiers";
import { HOME_PRICING_CHROME, toolCountLine } from "@/lib/i18n/content";
import { seoToolCounts } from "@/lib/seo-tools";
import { moneyAmount, usd } from "@/lib/pricing-page/format";
import { ruleCountLabel } from "@/lib/site-crawler/rule-count";
import { FREE_CRAWL_URL_CAP } from "@/lib/site-crawler/free-limits";
import { NB_INTRO_ANCHOR, NB_INTRO_VIDEO } from "@/lib/site-crawler/intro-video";

const nav = (locale: string, current?: Parameters<typeof PublicNav>[0]["current"]) =>
  renderToStaticMarkup(createElement(PublicNav, { locale, current }));

describe("every menu destination exists", () => {
  it("resolves each href to a registered route or a homepage anchor", () => {
    // A nav is the one component where a dead link is certain to be found.
    const known = new Set(LOCALIZED_ROUTES.map((r) => r.path));
    for (const href of navHrefs()) {
      if (href.startsWith("#")) continue;
      // Another Echorank service (src/lib/other-services.ts) is the one absolute URL.
      if (href.startsWith("https://llmstxt.echorank360.com/")) continue;
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

  it("carries the Link Building Playbook in the Resources > Learn column, both locales", () => {
    // The page is a route handler, not a page.tsx, so nothing else in the
    // suite would notice if the nav entry were dropped or left en-only.
    expect(navHrefs()).toContain("/link-building-playbook");
    expect(nav("en")).toContain('href="/en/link-building-playbook"');
    expect(nav("en")).toContain("Link Building Playbook");
    expect(nav("fr")).toContain('href="/fr/link-building-playbook"');
    expect(nav("fr")).toContain("Playbook netlinking");
  });

  it("carries the AIDO guide in the Resources > Learn column, both locales", () => {
    // Same reasoning as the playbook above: a route handler, so nothing else
    // in the suite would notice the entry going missing or staying en-only.
    expect(navHrefs()).toContain("/ai-discovery-optimization");
    expect(nav("en")).toContain('href="/en/ai-discovery-optimization"');
    expect(nav("en")).toContain("AI Discovery Optimization");
    expect(nav("fr")).toContain('href="/fr/ai-discovery-optimization"');
    expect(nav("fr")).toContain("Optimisation de la découverte IA");
  });

  it("carries the AI Search tracking setup page in Product > AI visibility, both locales", () => {
    // Same reasoning as the two entries above: a route handler with en-only
    // copy, so nothing else in the suite would notice the entry going missing
    // or being left out of the French menu.
    expect(navHrefs()).toContain("/setup-ai-search-tracking");
    expect(nav("en")).toContain('href="/en/setup-ai-search-tracking"');
    expect(nav("en")).toContain("Set up AI Search tracking");
    expect(nav("fr")).toContain('href="/fr/setup-ai-search-tracking"');
    expect(nav("fr")).toContain("Configurer le suivi de recherche IA");
  });

  it("carries the crawler page in Solutions > By goal, both locales", () => {
    // Appended to the goals column, not configured in the taxonomy (it has no
    // solutions/<slug> page), so the taxonomy count below does not see it.
    expect(navHrefs()).toContain("/site-crawler");
    expect(nav("en")).toContain('href="/en/site-crawler"');
    expect(nav("en")).toContain(`Crawl your site (${CRAWLER_BRAND.name})`);
    expect(nav("fr")).toContain('href="/fr/site-crawler"');
    expect(nav("fr")).toContain(`Explorer votre site (${CRAWLER_BRAND.name})`);
  });

  it("carries every taxonomy item in the Solutions panel", () => {
    // Derived from the config, not a literal: the count lives in exactly one
    // assertion (solutions-taxonomy.test.ts, "config integrity"), so a new
    // taxonomy item does not leave a stale number stranded in the nav suite.
    const hrefs = navHrefs();
    expect(hrefs.filter((h) => h.startsWith("/solutions/"))).toHaveLength(SOLUTION_ITEMS.length);
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

  it("translates the promo card (the AI Readiness Audit since 2026-11-10)", () => {
    expect(nav("fr")).toContain("Audit de préparation IA gratuit");
    expect(nav("en")).toContain("Free AI Readiness Audit");
  });

  it("the Product panel lists both free AI tools, each with what it answers", () => {
    const html = nav("en");
    expect(html).toContain('href="/en/free-audit"><span class="');
    expect(html).toContain("AI Readiness Audit (free)");
    expect(html).toContain("Whether AI can read, trust and cite your site.");
    expect(html).toContain("AI Visibility Check (free)");
    expect(html).toContain("What AI engines say about your business.");
  });
});

describe("Product › the crawler's own column", () => {
  const NB = CRAWLER_BRAND;
  const price = PLAN_CONFIGS.NOSY_BAT.monthlyPrice;
  const minutes = Math.round(NB_INTRO_VIDEO.durationSeconds / 60);
  const HREFS = [
    "/site-crawler",
    "/free-tools/site-crawler",
    `/pricing#${NOSY_BAT_CARD_ANCHOR}`,
    "/seo-spider/issues",
    `/site-crawler#${NB_INTRO_ANCHOR}`,
  ];
  /** The Product panel's column titles, in order, as rendered. */
  const productTitles = (html: string) => {
    const panel = html.split('role="region"')[1]!.split('role="region"')[0]!;
    return [...panel.matchAll(/<p class="[^"]*">([^<]+)<\/p>/g)].map((m) => m[1]);
  };
  const known = new Set(LOCALIZED_ROUTES.map((r) => r.path));
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("sits fourth, after Tools & free tools and before the promo, in both locales", () => {
    expect(productTitles(nav("en"))).toEqual(["AI visibility", "Reputation", "Tools &amp; free tools", `${NB.nameTm} crawler`]);
    expect(productTitles(nav("fr"))).toEqual(["Visibilité IA", "Réputation", "Outils et outils gratuits", `Crawler ${NB.nameTm}`]);
    // The promo card still closes the panel.
    const en = nav("en").split('role="region"')[1]!;
    expect(en.indexOf("Watch the")).toBeLessThan(en.indexOf("Free AI Readiness Audit"));
  });

  it("links the five destinations, in order, en and fr", () => {
    for (const href of HREFS) expect(navHrefs()).toContain(href);
    for (const loc of ["en", "fr"]) {
      const html = nav(loc);
      const at = HREFS.map((h) => html.indexOf(`href="/${loc}${h}"`));
      expect(at.every((i) => i > 0), `${loc}: ${at}`).toBe(true);
    }
  });

  it("every new href is a registered route, and both anchors exist on their pages", () => {
    for (const href of HREFS) expect(known.has(href.split("#")[0]!), href).toBe(true);
    // #video: the intro section on /site-crawler.
    expect(read("src/app/[locale]/site-crawler/page.tsx")).toContain("<section id={NB_INTRO_ANCHOR}");
    // #nosy-bat: the plan's card on the pricing grid, once launched.
    const html = renderToStaticMarkup(
      createElement(PricingSection, {
        salesSrc: "pricing-enterprise",
        enterpriseBand: true,
        locale: "en",
        pricing: pricingTiers("en", undefined, { launched: new Set(["NOSY_BAT"] as const) }),
        priceChrome: HOME_PRICING_CHROME.en,
        toolCountLine: toolCountLine("en", seoToolCounts()),
        tax: "t",
        currency: "c",
        header: null,
      }),
    );
    const card = html.match(/<div[^>]*data-plan="NOSY_BAT"[^>]*>/)?.[0] ?? "";
    expect(card).toContain(`id="${NOSY_BAT_CARD_ANCHOR}"`);
    expect([...html.matchAll(new RegExp(`id="${NOSY_BAT_CARD_ANCHOR}"`, "g"))]).toHaveLength(1);
  });

  it("reads every number: the plan's price from PLAN_CONFIGS, the free cap, the rule count, the intro's length", () => {
    const en = nav("en");
    const fr = nav("fr");
    expect(en).toContain(`${NB.name} plan — ${usd(price, "en")}/mo`);
    expect(fr).toContain(`Forfait ${NB.name} — ${moneyAmount(price, "fr")} $/mois`);
    expect(en).toContain(`Free ${FREE_CRAWL_URL_CAP}-page crawl`);
    expect(fr).toContain(`Crawl gratuit de ${FREE_CRAWL_URL_CAP} pages`);
    expect(en).toContain(`Watch the ${minutes}-minute intro`);
    expect(fr).toContain(`Voir l&#x27;intro de ${minutes} minutes`);
    // The one typed number: the registry is server-only. It must match.
    expect(NAV_RULE_COUNT_LABEL).toBe(ruleCountLabel());
    expect(en).toContain(`Screaming Frog-style audits, ${ruleCountLabel()} checks, in your browser.`);
  });

  it("carries the ™ on the heading and the first item, and the brand's spelling", () => {
    const en = nav("en");
    expect(en).toContain(`${NB.nameTm} site crawler`);
    expect(nav("fr")).toContain(`>Crawler ${NB.nameTm}<`);
    for (const html of [en, nav("fr")]) {
      expect(html).not.toMatch(/Nozy|EchoRank/);
    }
    const src = read("src/app/[locale]/PublicNav.tsx");
    expect(src).not.toMatch(/EchoRank|Nozy/);
  });

  it("de-CH reads the English column", () => {
    expect(nav("de-CH")).toContain(`${NB.nameTm} crawler`);
    expect(nav("de-CH")).toContain(`href="/de-CH/pricing#${NOSY_BAT_CARD_ANCHOR}"`);
  });
});

describe("the crawler guides item (Resources › Learn)", () => {
  it("is one item opening the guides index at #nosy-bat, in both locales", () => {
    // One item, not four: the Learn column is already the panel's tallest.
    expect(navHrefs().filter((h) => h.startsWith("/learn/guides#"))).toEqual(["/learn/guides#nosy-bat"]);
    expect(navHrefs()).not.toContain("/learn/guides/how-to-find-broken-links");
    const en = nav("en");
    const fr = nav("fr");
    expect(en).toContain('href="/en/learn/guides#nosy-bat"');
    expect(en).toContain(`${CRAWLER_BRAND.name} guides`);
    expect(fr).toContain('href="/fr/learn/guides#nosy-bat"');
    expect(fr).toContain(`Les guides ${CRAWLER_BRAND.name}`);
  });
});
