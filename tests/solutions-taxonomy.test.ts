// The Solutions taxonomy: config integrity, the dynamic route's params, and
// the nav columns derived from it.
//
// The config is the single source of truth for 25 pages, four category
// indexes, four nav columns and 29 sitemap entries. Nothing else asserts that
// a French translation exists or that a feature href is real, so a gap here
// ships as an "undefined" on a live page.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FEATURES,
  SOLUTION_CATEGORIES,
  SOLUTION_ITEMS,
  categoryBySlug,
  itemBySlug,
  solutionBase,
  solutionRoutes,
} from "@/lib/solutions-taxonomy";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";
import { PublicNav } from "@/app/[locale]/PublicNav";
import { generateStaticParams as itemParams } from "@/app/[locale]/solutions/[category]/[slug]/page";
import { generateStaticParams as catParams } from "@/app/[locale]/solutions/[category]/page";

describe("config integrity", () => {
  it("has four categories totalling 25 items", () => {
    expect(SOLUTION_CATEGORIES).toHaveLength(4);
    expect(SOLUTION_ITEMS).toHaveLength(25);
    expect(SOLUTION_CATEGORIES.map((c) => c.items.length)).toEqual([8, 6, 5, 6]);
  });

  it("has globally unique slugs", () => {
    // Unique across ALL categories, not just within one — the slug appears in
    // the URL under its category, but a duplicate makes the config ambiguous
    // to read and invites a copy-paste error.
    const slugs = SOLUTION_ITEMS.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every item both locales, fully populated", () => {
    for (const item of SOLUTION_ITEMS) {
      for (const base of ["en", "fr"] as const) {
        const c = item[base];
        for (const field of ["label", "desc", "h1", "intro"] as const) {
          expect(c[field], `${item.slug}.${base}.${field}`).toBeTruthy();
        }
        expect(c.features.length, `${item.slug}.${base} features`).toBeGreaterThanOrEqual(3);
        for (const f of c.features) expect(f.why, `${item.slug}.${base} why`).toBeTruthy();
      }
    }
  });

  it("does not leave English text sitting in the French copy", () => {
    // A missed translation is invisible until a French reader finds it.
    for (const item of SOLUTION_ITEMS) {
      expect(item.fr.h1, `${item.slug} h1 untranslated`).not.toBe(item.en.h1);
      expect(item.fr.intro, `${item.slug} intro untranslated`).not.toBe(item.en.intro);
    }
  });

  it("points every feature at a real, unauthenticated route", () => {
    const known = new Set(LOCALIZED_ROUTES.map((r) => r.path));
    for (const item of SOLUTION_ITEMS) {
      for (const f of item.en.features) {
        expect(FEATURES[f.href], `${f.href} has no display name`).toBeTruthy();
        if (f.href.startsWith("#")) continue; // homepage anchor
        expect(known.has(f.href), `${f.href} is not a registered route`).toBe(true);
        expect(f.href.startsWith("/visibility")).toBe(false);
      }
      // The two locales must agree on WHICH features, or the pages diverge.
      expect(item.fr.features.map((f) => f.href)).toEqual(item.en.features.map((f) => f.href));
    }
  });

  it("names every feature in both locales", () => {
    for (const [href, names] of Object.entries(FEATURES)) {
      expect(names.en, `${href}.en`).toBeTruthy();
      expect(names.fr, `${href}.fr`).toBeTruthy();
    }
  });

  it("folds locales to en/fr like the rest of marketing", () => {
    expect(solutionBase("en-CA")).toBe("en");
    expect(solutionBase("fr-CA")).toBe("fr");
    expect(solutionBase("de-CH")).toBe("en");
  });
});

describe("routing", () => {
  it("emits 25 item pages per locale", () => {
    const params = itemParams();
    expect(params).toHaveLength(25 * SUPPORTED_LOCALES.length);
    expect(new Set(params.map((p) => p.slug)).size).toBe(25);
  });

  it("emits one index per category per locale", () => {
    expect(catParams()).toHaveLength(4 * SUPPORTED_LOCALES.length);
  });

  it("resolves a known category and slug", () => {
    expect(itemBySlug("goals", "boost-search-rankings")).toBeTruthy();
    expect(categoryBySlug("industries")).toBeTruthy();
  });

  it("returns nothing for an unknown slug, category, or a real slug under the wrong category", () => {
    // The last case is the one worth stating: itemBySlug only looks inside the
    // category it was given, so /solutions/roles/healthcare 404s rather than
    // rendering an industries page under a roles URL.
    expect(itemBySlug("goals", "not-a-thing")).toBeUndefined();
    expect(itemBySlug("not-a-category", "boost-search-rankings")).toBeUndefined();
    expect(itemBySlug("roles", "healthcare")).toBeUndefined();
    expect(categoryBySlug("nope")).toBeUndefined();
  });

  it("registers 29 routes in the sitemap — 25 items plus 4 indexes", () => {
    expect(solutionRoutes()).toHaveLength(29);
    const registered = LOCALIZED_ROUTES.filter((r) => r.path.startsWith("/solutions"));
    expect(registered).toHaveLength(29);
  });
});

describe("nav integration", () => {
  const nav = (locale: string) =>
    renderToStaticMarkup(createElement(PublicNav, { locale }));

  it("builds four Solutions columns from the taxonomy", () => {
    const html = nav("en");
    for (const cat of SOLUTION_CATEGORIES) {
      expect(html).toContain(`>${cat.en.label}<`);
    }
  });

  it("links every taxonomy item from the menu", () => {
    const html = nav("en");
    for (const item of SOLUTION_ITEMS) {
      expect(html, item.slug).toContain(`href="/en/solutions/${item.category}/${item.slug}"`);
    }
  });

  it("translates the columns and keeps the locale in every href", () => {
    const html = nav("fr");
    expect(html).toContain(">Par objectif<");
    expect(html).toContain(">Par secteur<");
    expect(html).toContain('href="/fr/solutions/goals/boost-search-rankings"');
  });

  it("keeps the Use cases page reachable and untouched", () => {
    // The brief keeps /use-cases as its own page; it moved out of the
    // Solutions panel but must still be linked somewhere in the nav.
    expect(nav("en")).toContain('href="/en/use-cases"');
  });

  it("highlights the Solutions trigger for pages under /solutions", () => {
    const html = renderToStaticMarkup(
      createElement(PublicNav, { locale: "en", current: "solutions" }),
    );
    expect(html).toContain('aria-current="page"');
  });
});
