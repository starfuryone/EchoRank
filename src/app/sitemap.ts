import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/seo/constants";
import { LOCALIZED_ROUTES, PLAIN_ROUTES, languagesFor } from "@/lib/seo/registry";

// The URL list lives in the SEO registry — a new page registers once, there.
// This file only maps the registry onto Next's sitemap shape.
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

  const plain = PLAIN_ROUTES.map(({ url, priority, changeFrequency }) => ({
    url,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  return [...localized, ...plain];
}
