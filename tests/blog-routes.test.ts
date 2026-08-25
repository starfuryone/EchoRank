// Route registration, the proxy's locale guard, the nav and footer entries, and
// the links inside the articles themselves.
//
// The registration story here differs from every other content surface in the
// repo, and that difference is the reason for most of these assertions:
// src/lib/seo/registry.ts is imported by src/proxy.ts, which runs on the EDGE,
// so the blog's fs-backed loader can never be reached from it. "/blog" is
// registered by hand, the categories come from the typed union, and the ARTICLE
// urls are added by src/app/sitemap.ts (Node, build time) instead. What holds
// the locale-less article URLs together is KNOWN_MARKETING_PREFIXES.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  KNOWN_MARKETING_PATHS,
  KNOWN_MARKETING_PREFIXES,
  LOCALIZED_ROUTES,
} from "@/lib/seo/registry";
import {
  BLOG_BASE,
  BLOG_CATEGORIES,
  blogArticlePath,
  blogCategoryRoutes,
  categorySlug,
} from "@/lib/blog/constants";
import { blogArticleRoutes, getAllArticles } from "@/lib/blog/loader";
import { PublicNav, navHrefs } from "@/app/[locale]/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { resolveHref } from "@/app/[locale]/learn/_shared/inline";
import type { LearnBlock } from "@/lib/learn-content";

const ROOT = process.cwd();
const APP = join(ROOT, "src", "app", "[locale]", "blog");
const nav = (locale: string) =>
  renderToStaticMarkup(createElement(PublicNav, { locale, current: "resources" }));
const footer = (locale: string) =>
  renderToStaticMarkup(createElement(PublicFooter, { locale }));

describe("route table", () => {
  it("registers the hub in the SEO registry", () => {
    expect(LOCALIZED_ROUTES.some((r) => r.path === BLOG_BASE)).toBe(true);
  });

  it("does NOT register article paths there", () => {
    // Deliberate. Listing them would mean reading content/blog/ from a module
    // the edge middleware imports, which is node:fs in the edge bundle.
    const registered = new Set(LOCALIZED_ROUTES.map((r) => r.path));
    for (const path of blogArticleRoutes()) {
      expect(registered.has(path), `${path} must not be in LOCALIZED_ROUTES`).toBe(false);
    }
  });

  it("has a page file behind every blog route shape", () => {
    for (const file of [
      ["page.tsx"],
      ["[slug]", "page.tsx"],
      ["category", "[cat]", "page.tsx"],
      ["page", "[n]", "page.tsx"],
    ]) {
      expect(existsSync(join(APP, ...file)), file.join("/")).toBe(true);
    }
    expect(existsSync(join(ROOT, "src", "app", "blog", "rss.xml", "route.ts"))).toBe(true);
  });

  it("ships a hero image for every article", () => {
    for (const a of getAllArticles("en")) {
      expect(existsSync(join(ROOT, "public", a.featuredImage)), a.featuredImage).toBe(true);
    }
  });
});

describe("the proxy's locale guard reaches every blog URL", () => {
  /** The predicate src/proxy.ts applies, restated over the exported lists. */
  const registered = (p: string) =>
    KNOWN_MARKETING_PATHS.includes(p) || KNOWN_MARKETING_PREFIXES.some((x) => p.startsWith(x));

  it("canonicalizes the hub", () => {
    expect(registered(BLOG_BASE)).toBe(true);
  });

  it("canonicalizes every article, category and pagination path", () => {
    // Without this a locale-less "/blog/<slug>" falls through to the auth gate
    // and 307s to /login — a public article behind a login wall.
    for (const path of blogArticleRoutes()) expect(registered(path), path).toBe(true);
    for (const path of blogCategoryRoutes()) expect(registered(path), path).toBe(true);
    expect(registered(`${BLOG_BASE}/page/2`)).toBe(true);
  });

  it("does not swallow a neighbouring path that merely starts with the word", () => {
    // The trailing slash in the prefix is what stops "/blogroll" being 308'd
    // into "/en/blogroll" and 404ing there.
    expect(registered("/blogroll")).toBe(false);
    expect(registered("/blog-archive")).toBe(false);
  });

  it("keeps the prefix list to namespaces that genuinely cannot be listed", () => {
    // A prefix redirects URLs that do not exist. Every addition needs the same
    // justification the blog has, so the list staying short is the guard.
    expect(KNOWN_MARKETING_PREFIXES).toEqual([`${BLOG_BASE}/`]);
  });

  it("needs no proxy entry for the feed, because its dot is not in the first segment", () => {
    // The matcher at the bottom of src/proxy.ts is what lets /blog/rss.xml reach
    // its handler unauthenticated, and this test used to assert the rule it did
    // that by: `.*\..*`, "skip any path containing a dot".
    //
    // THAT RULE WAS THE BUG. A dot in the FIRST segment is not an asset, it is
    // the [locale] slot, so the same exclusion also handed "/wp-login.php" and
    // "/en.php" to the marketing render with the junk as the locale, and the
    // page 500'd. The matcher now reads `.*/.*\..*` — skip a dot in a segment
    // AFTER the first — which is still true of the feed and no longer true of
    // the junk. The feed's exemption is unchanged; it still needs no entry.
    //
    // tests/proxy-static-paths.test.ts owns the matcher's behaviour in full,
    // this path included. What is asserted here is only that the blog's own
    // reason for not appearing in proxy.ts still holds.
    const proxy = readFileSync(join(ROOT, "src", "proxy.ts"), "utf-8");
    expect(proxy).toContain(String.raw`.*/.*\\..*`); // as written in the source string
    expect(proxy).not.toContain("/blog/rss.xml");
  });
});

describe("navigation", () => {
  it("carries the blog in the Resources > Learn column, both locales", () => {
    expect(navHrefs()).toContain(BLOG_BASE);
    expect(nav("en")).toContain(`href="/en${BLOG_BASE}"`);
    expect(nav("en")).toContain("Echorank Blog");
    expect(nav("fr")).toContain(`href="/fr${BLOG_BASE}"`);
    expect(nav("fr")).toContain("Blog Echorank");
  });

  it("carries a footer link, both locales", () => {
    expect(footer("en")).toContain(`href="/en${BLOG_BASE}"`);
    expect(footer("fr")).toContain(`href="/fr${BLOG_BASE}"`);
  });
});

describe("in-article links", () => {
  /** Every [label](href) an article's prose contains. */
  function bodyLinks(body: readonly LearnBlock[]): string[] {
    const strings = body.flatMap((b) => {
      switch (b.k) {
        case "p":
        case "h2":
        case "h3":
          return [b.t];
        // NOT "code": a fenced sample can legitimately contain markdown-looking
        // text — the llms.txt article's example is a list of markdown links —
        // and none of it is a link this page renders.
        case "ul":
        case "ol":
          return b.items;
        case "quote":
          return b.paras;
        case "table":
          return [...b.head, ...b.rows.flat()];
        case "steps":
          return b.items.map((s) => s.t);
        default:
          return [];
      }
    });
    return strings.flatMap((s) => [...s.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1]));
  }

  const articles = getAllArticles("en");
  const slugs = new Set(articles.map((a) => a.slug));
  const registered = new Set(LOCALIZED_ROUTES.map((r) => r.path));

  it("points every prose link at a page that exists", () => {
    for (const a of articles) {
      for (const href of bodyLinks(a.body)) {
        const path = href.split("#")[0];
        const ok = registered.has(path) || slugs.has(path.replace(`${BLOG_BASE}/`, ""));
        expect(ok, `${a.slug}: ${href}`).toBe(true);
      }
    }
  });

  it("points every relatedSlug at a published article", () => {
    for (const a of articles) {
      for (const slug of a.relatedSlugs) expect(slugs.has(slug), `${a.slug} -> ${slug}`).toBe(true);
    }
  });

  it("gives every article at least one tool link and two article cross-links", () => {
    // The cluster is only a cluster if the pieces reference each other. A lone
    // article with no outbound links is the shape this catches.
    for (const a of articles) {
      const links = bodyLinks(a.body).map((h) => h.split("#")[0]);
      const toBlog = links.filter((h) => h.startsWith(`${BLOG_BASE}/`));
      expect(new Set(toBlog).size, `${a.slug} article cross-links`).toBeGreaterThanOrEqual(2);
      expect(
        links.some((h) => registered.has(h) && !h.startsWith(BLOG_BASE)),
        `${a.slug} tool link`,
      ).toBe(true);
    }
  });

  it("never links to /register from prose", () => {
    // Standing rule: commercial CTAs go to /pricing, free-tool CTAs to the tool.
    for (const a of articles) {
      for (const href of bodyLinks(a.body)) expect(href.startsWith("/register")).toBe(false);
    }
  });

  it("locale-prefixes a blog link in prose", () => {
    // Without "/blog" in LOCALIZED_PREFIXES a French reader following an
    // in-article cross-link lands on the English article after a 308.
    expect(resolveHref(blogArticlePath("x"), "fr")).toBe(`/fr${BLOG_BASE}/x`);
    expect(resolveHref(BLOG_BASE, "de-CH")).toBe(`/de-CH${BLOG_BASE}`);
  });
});

describe("the taxonomy the pages render", () => {
  it("puts every category in the proxy guard, so a tab is never 307'd to /login", () => {
    for (const c of BLOG_CATEGORIES) {
      expect(KNOWN_MARKETING_PATHS.includes(`${BLOG_BASE}/category/${categorySlug(c)}`), c).toBe(
        true,
      );
    }
  });

  it("keeps category pages out of LOCALIZED_ROUTES, so empty ones are not advertised", () => {
    const registered = new Set(LOCALIZED_ROUTES.map((r) => r.path));
    for (const path of blogCategoryRoutes()) expect(registered.has(path), path).toBe(false);
  });
});
