import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/seo/constants";
import { LOCALIZED_ROUTES, PLAIN_ROUTES, languagesFor } from "@/lib/seo/registry";
import { BLOG_BASE, BLOG_CATEGORIES, categorySlug } from "@/lib/blog/constants";
import { blogArticleRoutes, getByCategory } from "@/lib/blog/loader";

// The URL list lives in the SEO registry — a new page registers once, there.
// This file only maps the registry onto Next's sitemap shape.
//
// THE BLOG IS THE ONE EXCEPTION, and it is a deliberate one. Its article slugs
// are filenames under content/blog/, so producing them means reading the disk —
// and src/lib/seo/registry.ts is imported by src/proxy.ts, which runs on the
// edge, where node:fs does not exist. This module does not have that problem:
// a sitemap is generated at build time in the Node runtime. So the registry
// carries "/blog" and the loader supplies what is under it, from the same
// source of truth the pages render from. No hand-kept list either way.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const localized = LOCALIZED_ROUTES.flatMap(({ path, priority, changeFrequency }) =>
    LOCALES.map((locale) => ({
      url: `https://echorank360.com/${locale}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
      alternates: { languages: languagesFor(path) },
    })),
  );

  // Published articles. Drafts are excluded by the loader, so a piece in
  // progress is never advertised.
  const articles = blogArticleRoutes().flatMap((path) =>
    LOCALES.map((locale) => ({
      url: `https://echorank360.com/${locale}${path}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
      alternates: { languages: languagesFor(path) },
    })),
  );

  // Categories that actually have an article. The taxonomy is fixed and all six
  // pages render — an empty one shows an empty state rather than a 404 — but
  // advertising a page with nothing on it is asking to be indexed as thin.
  const categories = BLOG_CATEGORIES.filter((c) => getByCategory("en", c).length > 0)
    .map((c) => `${BLOG_BASE}/category/${categorySlug(c)}`)
    .flatMap((path) =>
      LOCALES.map((locale) => ({
        url: `https://echorank360.com/${locale}${path}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.5,
        alternates: { languages: languagesFor(path) },
      })),
    );

  const plain = PLAIN_ROUTES.map(({ url, priority, changeFrequency }) => ({
    url,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  return [...localized, ...articles, ...categories, ...plain];
}
