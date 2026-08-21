// src/lib/blog/loader.ts
//
// Reads content/blog/<base>/*.md and hands back validated, compiled articles.
//
// SERVER ONLY, and the marker matters more here than usual: this module is the
// blog's only `node:fs` caller, and the thing one import away from it is
// src/lib/seo/registry.ts, which src/proxy.ts pulls into the EDGE bundle. The
// guard turns "someone imported the loader from the registry" into a named
// compile error instead of a middleware that dies on `node:fs` in production.
// Everything the edge, the sitemap and the browser need lives in
// ./constants.ts, which imports nothing.
//
// Per CLAUDE.md's rule on `server-only`: the two runtimes outside Next that
// could reach this are vitest (aliased to server-only/empty.js in
// vitest.config.ts) and the tsx workers (NODE_OPTIONS=--conditions=react-server).
// No worker touches the blog, and the vitest alias is what lets
// tests/blog-loader.test.ts import this file at all.

import "server-only";

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  BLOG_BASE,
  blogArticlePath,
  blogBaseOf,
  readingTime,
  type BlogBase,
  type BlogCategory,
  type BlogSearchEntry,
} from "./constants";
import { blogFrontmatterSchema, type BlogFrontmatter } from "./schema";
import { parseFrontmatter, parseMarkdown, tocOf } from "./markdown";
import type { LearnBlock } from "@/lib/learn-content";

const CONTENT_ROOT = join(process.cwd(), "content", "blog");

export interface BlogArticle extends BlogFrontmatter {
  /** Compiled body, rendered by the shared Blocks component. */
  body: LearnBlock[];
  /** h2s only. See tocOf(). */
  toc: { id: string; text: string }[];
  /** Whole minutes, computed from the body. Never authored. */
  readingTime: number;
  /** Which language's FILE this is — "en" when a fr article falls back. */
  bodyBase: BlogBase;
  /** Path after the locale segment. */
  path: string;
}

/**
 * Parse one file. Throws with the filename attached — a zod error that says
 * "metaDescription: too small" and nothing else is a ten-minute hunt across
 * a content directory.
 */
function loadFile(dir: string, file: string, base: BlogBase): BlogArticle {
  const source = readFileSync(join(dir, file), "utf-8");
  let parsed;
  try {
    parsed = parseFrontmatter(source);
  } catch (err) {
    throw new Error(`content/blog/${base}/${file}: ${(err as Error).message}`);
  }

  const result = blogFrontmatterSchema.safeParse(parsed.frontmatter);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`content/blog/${base}/${file}: invalid frontmatter\n${issues}`);
  }
  const fm = result.data;

  // The filename IS the URL, so a file whose frontmatter slug disagrees with it
  // produces an article reachable at neither name. Cheap to check, impossible
  // to debug from the outside.
  const expected = `${fm.slug}.md`;
  if (file !== expected) {
    throw new Error(`content/blog/${base}/${file}: slug "${fm.slug}" wants the filename ${expected}`);
  }

  let body: LearnBlock[];
  try {
    body = parseMarkdown(parsed.body);
  } catch (err) {
    throw new Error(`content/blog/${base}/${file}: ${(err as Error).message}`);
  }
  if (!body.length) throw new Error(`content/blog/${base}/${file}: empty body`);

  return {
    ...fm,
    body,
    toc: tocOf(body),
    readingTime: readingTime(parsed.body),
    bodyBase: base,
    path: blogArticlePath(fm.slug),
  };
}

/**
 * Every article on disk for one language, newest first, drafts included.
 *
 * Memoized per base. `next build` renders the index, six category pages, the
 * pagination, the feed and every article in one process; re-reading and
 * re-parsing the directory for each would be the same work a few hundred times.
 * The cache is process-lifetime because the content is too: these routes are
 * fully static and nothing re-reads the directory after the build.
 */
const cache = new Map<BlogBase, BlogArticle[]>();

function readDir(base: BlogBase): BlogArticle[] {
  const cached = cache.get(base);
  if (cached) return cached;

  const dir = join(CONTENT_ROOT, base);
  const articles = !existsSync(dir)
    ? []
    : readdirSync(dir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => loadFile(dir, f, base))
        // Newest first, and by slug within a day so the order of two articles
        // published the same date is stable across machines — readdirSync is
        // not sorted, and an unstable order means the featured card and the
        // sitemap shuffle between builds.
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));

  cache.set(base, articles);
  return articles;
}

/** Test seam. The suites write fixtures and need a cold read between cases. */
export function clearBlogCache(): void {
  cache.clear();
}

/**
 * Published articles for a locale, newest first.
 *
 * FALLBACK, per the established pattern: a French reader gets the French file
 * when one exists and the English one when it does not, so a half-translated
 * blog shows every article under /fr rather than a shorter list. The merge is
 * by slug and the French file wins — which is also why `bodyBase` is carried
 * through to the page, so the shell can tell the reader which they are seeing.
 */
export function getAllArticles(locale: string): BlogArticle[] {
  const base = blogBaseOf(locale);
  const en = readDir("en").filter((a) => a.status === "published");
  if (base === "en") return en;

  const fr = readDir("fr").filter((a) => a.status === "published");
  const translated = new Map(fr.map((a) => [a.slug, a]));
  return en
    .map((a) => translated.get(a.slug) ?? a)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));
}

/** One published article, or undefined — which the page turns into a 404. */
export function getArticle(locale: string, slug: string): BlogArticle | undefined {
  return getAllArticles(locale).find((a) => a.slug === slug);
}

/**
 * The article the index leads with.
 *
 * The newest one flagged `featured`, falling back to the newest published
 * article: an index whose hero slot is empty because nobody set the flag is a
 * worse failure than one that features the most recent piece.
 */
export function getFeatured(locale: string): BlogArticle | undefined {
  const all = getAllArticles(locale);
  return all.find((a) => a.featured) ?? all[0];
}

export function getByCategory(locale: string, category: BlogCategory): BlogArticle[] {
  return getAllArticles(locale).filter((a) => a.category === category);
}

/**
 * Up to three related articles: the ones the author named, then same-category
 * fill, then newest-anything.
 *
 * The third tier is what stops a lone article in a young category rendering an
 * empty "Related" strip. Order is preserved through the tiers, and the article
 * itself is never in its own list.
 */
export function getRelated(locale: string, article: BlogArticle, limit = 3): BlogArticle[] {
  const all = getAllArticles(locale).filter((a) => a.slug !== article.slug);
  const bySlug = new Map(all.map((a) => [a.slug, a]));
  const out: BlogArticle[] = [];
  const take = (a: BlogArticle | undefined) => {
    if (a && out.length < limit && !out.some((o) => o.slug === a.slug)) out.push(a);
  };

  article.relatedSlugs.forEach((s) => take(bySlug.get(s)));
  all.filter((a) => a.category === article.category).forEach(take);
  all.forEach(take);
  return out;
}

/** Total index pages at BLOG_PAGE_SIZE per page. Always at least 1. */
export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}

/**
 * Every published article path, after the locale segment.
 *
 * Read by src/app/sitemap.ts — NOT by src/lib/seo/registry.ts, which the edge
 * middleware imports. See this file's header.
 */
export function blogArticleRoutes(): string[] {
  return readDir("en")
    .filter((a) => a.status === "published")
    .map((a) => `${BLOG_BASE}/${a.slug}`);
}

/**
 * The client-side search payload.
 *
 * Card fields ONLY — never the body. Full text would be a few hundred KB
 * shipped to every visitor of the index to power a filter that answers "which
 * of the twelve cards do I want", and the honest version of that feature is a
 * backend, which is out of scope for v1. BLOG_SEARCH_INDEX_MAX_BYTES is the
 * budget, and a test enforces it.
 */
export type { BlogSearchEntry };

export function searchIndex(locale: string): BlogSearchEntry[] {
  return getAllArticles(locale).map((a) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    category: a.category,
    tags: a.tags,
    image: a.featuredImage,
    imageAlt: a.featuredImageAlt,
  }));
}
