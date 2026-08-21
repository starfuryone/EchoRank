// src/lib/blog/constants.ts
//
// The blog's DEPENDENCY-FREE core: types, the category taxonomy, the author,
// reading time and the path builders.
//
// WHY THIS IS SPLIT OUT. src/lib/seo/registry.ts is imported by src/proxy.ts,
// which runs on the EDGE runtime, and the sitemap needs the blog's category
// paths. The loader next door reads the filesystem — `node:fs` in the
// middleware bundle is the client/server boundary failure CLAUDE.md describes,
// one layer over. So everything the edge, the sitemap and the browser need
// lives here, where there is nothing to drag in, and only the parts that
// genuinely need to read `content/blog/` live in loader.ts behind
// `import "server-only"`.
//
// The article slugs are deliberately NOT here: they come from the filesystem,
// so a hand-kept copy would be a second source of truth that drifts the first
// time someone adds a file. See the KNOWN_MARKETING_PREFIXES note in
// src/lib/seo/registry.ts for how the proxy reaches them without fs.

/** Path after the locale segment. "/en" + this = the index. */
export const BLOG_BASE = "/blog";

/**
 * Locale model: en/fr bodies, matching helpBaseOf() and solutionBase().
 *
 * fr* → fr, everything else (de-CH and en-CA included) → en. A third catalog
 * here would be unreachable code, exactly as CLAUDE.md warns for the dashboard.
 * de-CH bodies are explicitly out of scope; a de-CH reader gets the English
 * body under German chrome, the established pattern.
 */
export type BlogBase = "en" | "fr";
export const blogBaseOf = (locale: string): BlogBase =>
  locale.startsWith("fr") ? "fr" : "en";

/**
 * The category taxonomy. A typed union, not free text: the frontmatter schema
 * refines against it, so a typo in a .md file fails the build instead of
 * silently creating a seventh category page nothing links to.
 */
export const BLOG_CATEGORIES = [
  "GEO Guides",
  "Best Practices",
  "Use Cases",
  "AI Visibility",
  "Research",
  "Tools",
] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

/** Search intent, recorded per article. Editorial metadata, not rendered. */
export const SEARCH_INTENTS = ["informational", "commercial", "transactional", "navigational"] as const;
export type SearchIntent = (typeof SEARCH_INTENTS)[number];

/** Publication state. `draft` never reaches a list, the sitemap or the feed. */
export const BLOG_STATUSES = ["draft", "published"] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

/**
 * The contextual CTA target of an article.
 *
 * EVERY MEMBER IS A ROUTE THAT EXISTS. The brief this feature was built from
 * named four tool pages — /tools/geo-checker, /tools/llms-txt-generator,
 * /tools/ai-citation-gap-sentiment-analyzer, /tools/agentic-browsing-test —
 * and none of them are real. Neither is /free-tools/ai-search-grader, which was
 * retired on 2026-08-16 and now 301s (see RETIRED_LOCALIZED_PATHS). Keeping
 * this a closed union is what stops the next article inventing a fifth: the
 * frontmatter schema rejects anything not listed, and tests/blog-loader.test.ts
 * checks every member against LOCALIZED_ROUTES.
 */
export const BLOG_TOOLS = ["free-audit", "free-tools", "pricing", "ai-assistant"] as const;
export type BlogTool = (typeof BLOG_TOOLS)[number];

/** Locale-less path each tool CTA points at. */
export const BLOG_TOOL_HREF: Record<BlogTool, string> = {
  "free-audit": "/free-audit",
  "free-tools": "/free-tools",
  pricing: "/pricing",
  "ai-assistant": "/ai-assistant",
};

/**
 * Segments that can never be an article slug.
 *
 * /blog/page/2 and /blog/category/research are real routes; a file named
 * page.md or category.md would produce a URL the router resolves to the
 * pagination or the category index instead of the article, and the article
 * would simply never be reachable. The schema refines against this so the
 * collision is a build failure rather than a page nobody can find.
 */
export const RESERVED_BLOG_SLUGS: readonly string[] = ["page", "category", "rss.xml", "rss"];

/** Articles per index page. */
export const BLOG_PAGE_SIZE = 12;

/**
 * The byline. ONE constant, read by the article header, the AuthorCard and the
 * BlogPosting author node, so the three cannot disagree about who wrote the
 * site's articles.
 */
export const BLOG_AUTHOR = {
  name: "Frederic Desjardins",
  role: { en: "Editor, Echorank", fr: "Rédacteur en chef, Echorank" },
  email: "fredericd@echorank360.com",
  bio: {
    en: "Frederic runs Echorank and writes most of what appears here. Everything published is either something we measured on real sites or something we recommend and say so — the two are never blurred.",
    fr: "Frederic dirige Echorank et signe l'essentiel de ce qui paraît ici. Tout ce qui est publié est soit une mesure faite sur de vrais sites, soit une recommandation annoncée comme telle — les deux ne sont jamais confondues.",
  },
} as const;

/**
 * URL segment for a category. "GEO Guides" → "geo-guides".
 *
 * Same shape as headingId() in learn-content.ts and deliberately not imported
 * from it: that module is a 2,000-line content pack, and the edge bundle has no
 * business loading it to slugify six strings.
 */
export function categorySlug(category: string): string {
  return category
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Reverse lookup. Returns undefined for an unknown slug, which 404s. */
export function categoryBySlug(slug: string): BlogCategory | undefined {
  return BLOG_CATEGORIES.find((c) => categorySlug(c) === slug);
}

/** Every category path, after the locale segment. Feeds the SEO registry. */
export function blogCategoryRoutes(): string[] {
  return BLOG_CATEGORIES.map((c) => `${BLOG_BASE}/category/${categorySlug(c)}`);
}

/** Locale-less path of an article. */
export const blogArticlePath = (slug: string) => `${BLOG_BASE}/${slug}`;

/**
 * Reading time in whole minutes, COMPUTED — never authored.
 *
 * A hand-written figure in frontmatter is a number nobody updates when the
 * article is edited, which is why the schema has no field for it. 220 wpm is
 * the conventional silent-reading rate; a one-minute floor stops a short piece
 * claiming "0 min read".
 */
export function readingTime(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/**
 * Whether an article's revision is worth showing.
 *
 * Rendered ONLY when it is genuinely later than publication: an updatedAt equal
 * to (or, through an editing slip, before) publishedAt tells a reader nothing
 * and makes a freshly published piece look retouched.
 */
export function showsUpdated(a: { publishedAt: string; updatedAt?: string }): boolean {
  return !!a.updatedAt && a.updatedAt > a.publishedAt;
}

/** "2026-08-14" → "August 14, 2026" / "14 août 2026". No dependency on date-fns. */
export function formatBlogDate(iso: string, base: BlogBase): string {
  const [y, m, d] = iso.split("-").map(Number);
  // Constructed in UTC on purpose: `new Date("2026-08-14")` is midnight UTC,
  // and rendering it in a negative-offset timezone prints the 13th.
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(
    base === "fr" ? "fr-FR" : "en-US",
    { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" },
  );
}

/**
 * One row of the client-side search payload.
 *
 * Declared HERE rather than in the loader because the Client Component that
 * filters on it needs the type, and a Client Component that imports anything
 * from loader.ts — even a type today — is one careless edit away from dragging
 * `node:fs` into the browser bundle. See the client/server rules in CLAUDE.md.
 */
export interface BlogSearchEntry {
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategory;
  tags: string[];
  /** Hero + alt, so a filtered result looks like the card it replaces. */
  image: string;
  imageAlt: string;
}

/**
 * Ceiling for the serialized search index, in bytes.
 *
 * Every visitor to the index downloads this, so it is a budget rather than an
 * observation. tests/blog-loader.test.ts asserts against it: the day the
 * payload outgrows the cap is the day this feature needs a real search backend,
 * and that should be a red build rather than a slow page nobody attributes to
 * the blog.
 */
export const BLOG_SEARCH_INDEX_MAX_BYTES = 20_000;
