// The Solutions taxonomy: config integrity, the dynamic route's params, and
// the nav columns derived from it.
//
// The config is the single source of truth for 26 pages, four category
// indexes, four nav columns and 30 sitemap entries. Nothing else asserts that
// a French translation exists or that a feature href is real, so a gap here
// ships as an "undefined" on a live page.
//
// ONE literal count, in "config integrity" below. Everything downstream —
// route params, sitemap entries, nav hrefs — derives from SOLUTION_ITEMS
// rather than repeating the number. Adding the ninth goals item (google-reviews,
// 76ca8dd) left four hardcoded 25s and a 29 behind and the suite stayed red for
// 59 commits, because each one had to be found separately. Now a new item moves
// exactly one assertion, and that assertion is the canary it is supposed to be.
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
  it("has four categories totalling 26 items", () => {
    expect(SOLUTION_CATEGORIES).toHaveLength(4);
    expect(SOLUTION_ITEMS).toHaveLength(26);
    expect(SOLUTION_CATEGORIES.map((c) => c.items.length)).toEqual([9, 6, 5, 6]);
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
  it("emits one item page per item per locale", () => {
    const params = itemParams();
    expect(params).toHaveLength(SOLUTION_ITEMS.length * SUPPORTED_LOCALES.length);
    expect(new Set(params.map((p) => p.slug)).size).toBe(SOLUTION_ITEMS.length);
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

  it("registers every item plus the four indexes in the sitemap", () => {
    const expected = SOLUTION_ITEMS.length + SOLUTION_CATEGORIES.length;
    expect(solutionRoutes()).toHaveLength(expected);
    const registered = LOCALIZED_ROUTES.filter((r) => r.path.startsWith("/solutions"));
    expect(registered).toHaveLength(expected);
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

describe("optional long-form sections", () => {
  // Long-form lives only on goals pages, and every goals page has it EXCEPT the
  // ones named here. The exception list is deliberate: google-reviews (76ca8dd)
  // shipped without long-form prose, and that is a real content gap, not a
  // config error. Naming it keeps the invariant enforceable in both directions —
  // a tenth goals item added without prose fails, and writing the missing
  // google-reviews prose also fails, which is the reminder to empty this list.
  const GOALS_WITHOUT_LONGFORM = ["google-reviews"];

  it("covers every goals item except the known gaps, and nothing outside goals", async () => {
    const { longformSlugs } = await import("@/lib/solutions-longform");
    const slugs = [...longformSlugs()].sort();
    const goals = SOLUTION_CATEGORIES.find((c) => c.slug === "goals")!;
    const expected = goals.items
      .map((i) => i.slug)
      .filter((s) => !GOALS_WITHOUT_LONGFORM.includes(s))
      .sort();
    expect(slugs).toEqual(expected);
  });

  it("is optional — an item without it returns null, not an empty shell", async () => {
    // The template branches on null. An empty object would render a section
    // heading with no prose under it.
    const { longformFor } = await import("@/lib/solutions-longform");
    expect(longformFor("agencies", "en")).toBeNull();
    expect(longformFor("healthcare", "fr")).toBeNull();
    expect(longformFor("not-a-slug", "en")).toBeNull();
  });

  it("gives every covered item two sections in both locales", async () => {
    const { longformFor, longformSlugs } = await import("@/lib/solutions-longform");
    for (const slug of longformSlugs()) {
      for (const base of ["en", "fr"] as const) {
        const lf = longformFor(slug, base);
        expect(lf, `${slug}.${base}`).not.toBeNull();
        expect(lf!.sections).toHaveLength(2);
        for (const sec of lf!.sections) {
          expect(sec.h2, `${slug}.${base} h2`).toBeTruthy();
          expect(sec.paras.length, `${slug}.${base} paras`).toBeGreaterThanOrEqual(1);
          for (const p of sec.paras) expect(p.length).toBeGreaterThan(40);
        }
      }
    }
  });

  it("does not leave English prose in the French copy", async () => {
    const { longformFor, longformSlugs } = await import("@/lib/solutions-longform");
    for (const slug of longformSlugs()) {
      const en = longformFor(slug, "en")!;
      const fr = longformFor(slug, "fr")!;
      for (let i = 0; i < en.sections.length; i++) {
        expect(fr.sections[i].h2, `${slug} h2 ${i} untranslated`).not.toBe(en.sections[i].h2);
        expect(fr.sections[i].paras[0], `${slug} para untranslated`).not.toBe(en.sections[i].paras[0]);
      }
    }
  });

  it("renders the sections on a page that has them, numbered after the cards", async () => {
    const Page = (await import("@/app/[locale]/solutions/[category]/[slug]/page")).default;
    const html = renderToStaticMarkup(
      await Page({ params: Promise.resolve({ locale: "en", category: "goals", slug: "get-cited-by-ai" }) }),
    );
    expect(html).toContain("AI assistants are the new front page");
    expect(html).toContain("Measure it, then move it");
    // Cards are /02, so long-form starts at /03.
    expect(html).toContain("/ 03");
    expect(html).toContain("/ 04");
  });

  it("omits the block cleanly on a page without long-form", async () => {
    // NOT "/ 03 is absent" any more. Every item now carries solutions-detail
    // prose, which numbers itself from (longform.length + 3) — so on a page
    // with no long-form, detail legitimately OCCUPIES /03. The invariant that
    // still matters is that skipping the block leaves no hole and no empty
    // shell: numbering runs straight from the cards into detail, and none of
    // the long-form prose leaks onto a page that has none.
    const { longformFor } = await import("@/lib/solutions-longform");
    const { detailFor } = await import("@/lib/solutions-detail");
    const Page = (await import("@/app/[locale]/solutions/[category]/[slug]/page")).default;

    expect(longformFor("seo-professionals", "en")).toBeNull();
    const detail = detailFor("seo-professionals", "en")!;
    expect(detail.prose?.length ?? 0).toBeGreaterThan(0);

    const html = renderToStaticMarkup(
      await Page({ params: Promise.resolve({ locale: "en", category: "roles", slug: "seo-professionals" }) }),
    );
    // Detail's first prose section sits at /03 — the slot long-form would have
    // taken — so the sequence has no gap.
    expect(html).toContain("/ 03");
    expect(html).toContain(detail.prose![0].h2);
    // Nothing from any long-form entry appears on a page that has none.
    const { longformSlugs } = await import("@/lib/solutions-longform");
    for (const slug of longformSlugs()) {
      for (const sec of longformFor(slug, "en")!.sections) {
        expect(html, `${slug} long-form leaked`).not.toContain(sec.h2);
      }
    }
    expect(html).toContain("Not sure where to start?");
  });

  it("renders the French prose on a French page", async () => {
    const Page = (await import("@/app/[locale]/solutions/[category]/[slug]/page")).default;
    const html = renderToStaticMarkup(
      await Page({ params: Promise.resolve({ locale: "fr", category: "goals", slug: "win-local-customers" }) }),
    );
    expect(html).toContain("Les clients locaux décident");
  });
});
