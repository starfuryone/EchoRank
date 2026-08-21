// The blog loader: frontmatter validation, the markdown subset, and the
// selection rules the pages depend on.
//
// The assertions run against the REAL content in content/blog/ wherever the
// behaviour is about selection (drafts, fallback, related fill), and against
// hand-built strings wherever it is about parsing. Fixture files on disk would
// either be published articles nobody wants, or a second content directory the
// loader would have to be taught about.

import { describe, expect, it } from "vitest";
import {
  BLOG_CATEGORIES,
  BLOG_SEARCH_INDEX_MAX_BYTES,
  BLOG_TOOLS,
  BLOG_TOOL_HREF,
  RESERVED_BLOG_SLUGS,
  blogBaseOf,
  blogCategoryRoutes,
  categoryBySlug,
  categorySlug,
  formatBlogDate,
  readingTime,
  showsUpdated,
} from "@/lib/blog/constants";
import { blogFrontmatterSchema } from "@/lib/blog/schema";
import {
  MarkdownError,
  indexAfterHeading,
  parseFrontmatter,
  parseMarkdown,
  tocOf,
} from "@/lib/blog/markdown";
import {
  blogArticleRoutes,
  getAllArticles,
  getArticle,
  getByCategory,
  getFeatured,
  getRelated,
  pageCount,
  searchIndex,
} from "@/lib/blog/loader";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";
import type { LearnBlock } from "@/lib/learn-content";

/** A frontmatter object that passes, for mutation into ones that must not. */
const VALID = {
  slug: "a-real-slug",
  title: "A title long enough to pass the minimum",
  seoTitle: "A search-friendly title",
  metaDescription:
    "A meta description that is comfortably longer than seventy characters so the schema accepts it.",
  excerpt:
    "An excerpt with enough words in it to clear the sixty-character floor the schema sets.",
  category: "Research",
  tags: ["geo"],
  searchIntent: "informational",
  primaryKeyword: "geo",
  secondaryKeywords: [],
  publishedAt: "2026-08-01",
  featuredImage: "/blog/a-real-slug/hero.svg",
  featuredImageAlt: "A described illustration",
  tldr: ["One bullet long enough to pass", "Two bullets long enough to pass", "Three bullets long enough"],
  relatedTool: "free-audit",
  relatedSlugs: [],
  status: "published",
  featured: false,
};

const parse = (patch: Record<string, unknown>) =>
  blogFrontmatterSchema.safeParse({ ...VALID, ...patch });

describe("frontmatter schema", () => {
  it("accepts the valid shape", () => {
    expect(parse({}).success).toBe(true);
  });

  it("rejects a category outside the union", () => {
    // A typo would otherwise create a seventh category page nothing links to.
    expect(parse({ category: "GEO Guide" }).success).toBe(false);
    for (const c of BLOG_CATEGORIES) expect(parse({ category: c }).success).toBe(true);
  });

  it("rejects every reserved slug", () => {
    // /blog/page/2 and /blog/category/x are routes. An article at one of those
    // slugs would be shadowed by the static segment and unreachable forever.
    for (const slug of RESERVED_BLOG_SLUGS) {
      expect(parse({ slug }).success, slug).toBe(false);
    }
  });

  it("rejects a slug that is not lowercase-hyphenated", () => {
    for (const bad of ["Not-Lower", "double--hyphen", "-leading", "trailing-", "under_score"]) {
      expect(parse({ slug: bad }).success, bad).toBe(false);
    }
  });

  it("rejects an unknown key rather than ignoring it", () => {
    // .strict() — a typo'd key is a MISSING field, and silently dropping it is
    // how an article ships with no excerpt.
    expect(parse({ readingTime: 6 }).success).toBe(false);
    expect(parse({ auther: "someone" }).success).toBe(false);
  });

  it("rejects a date that is not a real calendar day", () => {
    expect(parse({ publishedAt: "2026-02-31" }).success).toBe(false);
    expect(parse({ publishedAt: "2026-8-1" }).success).toBe(false);
    expect(parse({ publishedAt: "2026-02-28" }).success).toBe(true);
  });

  it("rejects updatedAt before publishedAt", () => {
    expect(parse({ updatedAt: "2026-07-31" }).success).toBe(false);
    expect(parse({ updatedAt: "2026-08-02" }).success).toBe(true);
  });

  it("rejects an article related to itself", () => {
    expect(parse({ relatedSlugs: [VALID.slug] }).success).toBe(false);
  });

  it("rejects a relatedTool that is not one of the real routes", () => {
    // The brief named four /tools/* pages that do not exist. A closed union is
    // what stops the fifth being invented.
    expect(parse({ relatedTool: "geo-checker" }).success).toBe(false);
    for (const t of BLOG_TOOLS) expect(parse({ relatedTool: t }).success).toBe(true);
  });

  it("requires alt text on the hero", () => {
    expect(parse({ featuredImageAlt: "" }).success).toBe(false);
  });

  it("bounds the TL;DR at three to five bullets", () => {
    const b = "A bullet long enough to pass";
    expect(parse({ tldr: [b, b] }).success).toBe(false);
    expect(parse({ tldr: [b, b, b, b, b, b] }).success).toBe(false);
    expect(parse({ tldr: [b, b, b, b, b] }).success).toBe(true);
  });
});

describe("frontmatter parsing", () => {
  it("reads scalars, inline arrays and block sequences", () => {
    const { frontmatter, body } = parseFrontmatter(
      [
        "---",
        "slug: x",
        "featured: true",
        "tags: [a, b, c]",
        "tldr:",
        "  - first",
        "  - second",
        "---",
        "",
        "Body text.",
      ].join("\n"),
    );
    expect(frontmatter.slug).toBe("x");
    expect(frontmatter.featured).toBe(true);
    expect(frontmatter.tags).toEqual(["a", "b", "c"]);
    expect(frontmatter.tldr).toEqual(["first", "second"]);
    expect(body).toBe("Body text.");
  });

  it("reads a two-line q/a map item", () => {
    const { frontmatter } = parseFrontmatter(
      ["---", "faq:", '  - q: "A question?"', '    a: "An answer."', "---", "x"].join("\n"),
    );
    expect(frontmatter.faq).toEqual([{ q: "A question?", a: "An answer." }]);
  });

  it("keeps a comma inside a quoted inline array item", () => {
    // "ai citations, tracked" is one keyword, not two.
    const { frontmatter } = parseFrontmatter(
      ["---", 'tags: ["one, still one", two]', "---", "x"].join("\n"),
    );
    expect(frontmatter.tags).toEqual(["one, still one", "two"]);
  });

  it("refuses a file with no frontmatter block", () => {
    expect(() => parseFrontmatter("# Just markdown")).toThrow(MarkdownError);
  });

  it("refuses an unterminated frontmatter block", () => {
    expect(() => parseFrontmatter("---\nslug: x\nbody")).toThrow(MarkdownError);
  });
});

describe("markdown subset", () => {
  const blocks = (md: string) => parseMarkdown(md);

  it("compiles headings, paragraphs and lists", () => {
    expect(blocks("## H\n\nText.\n\n- one\n- two")).toEqual([
      { k: "h2", t: "H" },
      { k: "p", t: "Text." },
      { k: "ul", items: ["one", "two"] },
    ] satisfies LearnBlock[]);
  });

  it("joins a wrapped paragraph into one block", () => {
    expect(blocks("one line\nand its continuation")).toEqual([
      { k: "p", t: "one line and its continuation" },
    ]);
  });

  it("compiles ordered lists, quotes, code fences and tables", () => {
    expect(blocks("1. a\n2. b")).toEqual([{ k: "ol", items: ["a", "b"] }]);
    expect(blocks("> quoted")).toEqual([{ k: "quote", paras: ["quoted"] }]);
    expect(blocks("```\nx = 1\n```")).toEqual([{ k: "code", t: "x = 1" }]);
    expect(blocks("| a | b |\n| --- | --- |\n| 1 | 2 |")).toEqual([
      { k: "table", head: ["a", "b"], rows: [["1", "2"]] },
    ]);
  });

  it("drops a horizontal rule rather than refusing it", () => {
    expect(blocks("a\n\n---\n\nb")).toEqual([{ k: "p", t: "a" }, { k: "p", t: "b" }]);
  });

  it("REFUSES what LearnBlock cannot express, rather than dropping it", () => {
    // The point of the subset is that unsupported syntax fails the BUILD. A
    // silently swallowed paragraph is an article missing a paragraph in prod.
    expect(() => blocks("# A second h1")).toThrow(MarkdownError);
    expect(() => blocks("#### too deep")).toThrow(MarkdownError);
    expect(() => blocks("![alt](/x.png)")).toThrow(MarkdownError);
    expect(() => blocks("- one\n  - nested")).toThrow(MarkdownError);
    expect(() => blocks("```\nnever closed")).toThrow(MarkdownError);
    expect(() => blocks("| a | b |\n| --- | --- |\n| 1 |")).toThrow(MarkdownError);
  });

  it("names the line it refused", () => {
    expect(() => blocks("ok\n\n#### bad")).toThrow(/line 3/);
  });

  it("indexes h2s only in the table of contents", () => {
    expect(tocOf(blocks("## One\n\n### Sub\n\n## Two"))).toEqual([
      { id: "one", text: "One" },
      { id: "two", text: "Two" },
    ]);
  });

  it("places the mid-article CTA after the second section's first paragraph", () => {
    // Anchored to structure: editing the prose must not move the CTA.
    const body = blocks("intro\n\n## One\n\na\n\n## Two\n\nb\n\nc");
    // [p intro, h2 One, p a, h2 Two, p b, p c] — the CTA lands after "b", the
    // second section's opening paragraph, and before "c".
    expect(indexAfterHeading(body, 2)).toBe(5);
    expect(body.slice(0, 5).at(-1)).toEqual({ k: "p", t: "b" });
  });

  it("falls back to the end when there is no such heading", () => {
    const body = blocks("just a paragraph");
    expect(indexAfterHeading(body, 2)).toBe(body.length);
  });
});

describe("computed fields", () => {
  it("computes reading time at 220 wpm with a one-minute floor", () => {
    expect(readingTime("word ".repeat(440))).toBe(2);
    expect(readingTime("one word")).toBe(1);
  });

  it("shows updatedAt only when it is genuinely later", () => {
    expect(showsUpdated({ publishedAt: "2026-08-01" })).toBe(false);
    expect(showsUpdated({ publishedAt: "2026-08-01", updatedAt: "2026-08-01" })).toBe(false);
    expect(showsUpdated({ publishedAt: "2026-08-01", updatedAt: "2026-08-02" })).toBe(true);
  });

  it("formats a date in UTC, so it does not slip a day westward", () => {
    expect(formatBlogDate("2026-08-14", "en")).toBe("August 14, 2026");
    expect(formatBlogDate("2026-08-14", "fr")).toContain("14");
  });
});

describe("category taxonomy", () => {
  it("round-trips every category through its slug", () => {
    for (const c of BLOG_CATEGORIES) expect(categoryBySlug(categorySlug(c))).toBe(c);
  });

  it("returns undefined for an unknown slug, which the page 404s", () => {
    expect(categoryBySlug("not-a-category")).toBeUndefined();
  });

  it("produces one route per category", () => {
    expect(blogCategoryRoutes()).toHaveLength(BLOG_CATEGORIES.length);
  });
});

describe("locale folding", () => {
  it("folds fr* to fr and everything else to en", () => {
    expect(blogBaseOf("fr")).toBe("fr");
    expect(blogBaseOf("fr-CA")).toBe("fr");
    expect(blogBaseOf("en-CA")).toBe("en");
    expect(blogBaseOf("de-CH")).toBe("en");
  });
});

describe("selection over the real content", () => {
  const all = getAllArticles("en");

  it("loads and validates every file in content/blog/en", () => {
    // Loading is validating: a malformed file throws out of getAllArticles.
    expect(all.length).toBeGreaterThan(0);
  });

  it("returns them newest first", () => {
    const dates = all.map((a) => a.publishedAt);
    expect([...dates].sort((x, y) => y.localeCompare(x))).toEqual(dates);
  });

  it("excludes drafts from lists, the feed source and the sitemap", () => {
    expect(all.every((a) => a.status === "published")).toBe(true);
    expect(blogArticleRoutes().every((p) => all.some((a) => p.endsWith(`/${a.slug}`)))).toBe(true);
  });

  it("serves the en body under fr when no translation exists", () => {
    const fr = getAllArticles("fr");
    expect(fr.map((a) => a.slug)).toEqual(all.map((a) => a.slug));
    for (const a of fr) {
      // bodyBase is what the page reads to decide whether to show the notice.
      expect(a.bodyBase).toBe("en");
    }
  });

  it("features a flagged article", () => {
    const featured = getFeatured("en");
    expect(featured).toBeDefined();
    expect(featured!.featured).toBe(true);
  });

  it("fills related to three and never includes the article itself", () => {
    for (const a of all) {
      const related = getRelated("en", a);
      expect(related, a.slug).toHaveLength(Math.min(3, all.length - 1));
      expect(related.some((r) => r.slug === a.slug)).toBe(false);
      expect(new Set(related.map((r) => r.slug)).size).toBe(related.length);
      // The author's own picks come first.
      expect(related.slice(0, a.relatedSlugs.length).map((r) => r.slug)).toEqual(a.relatedSlugs);
    }
  });

  it("puts every article in exactly one category listing", () => {
    const listed = BLOG_CATEGORIES.flatMap((c) => getByCategory("en", c)).map((a) => a.slug);
    expect(listed.sort()).toEqual(all.map((a) => a.slug).sort());
  });

  it("resolves an article by slug and nothing by an unknown one", () => {
    expect(getArticle("en", all[0].slug)?.slug).toBe(all[0].slug);
    expect(getArticle("en", "no-such-article")).toBeUndefined();
  });

  it("computes reading time rather than reading it from the file", () => {
    for (const a of all) expect(a.readingTime).toBeGreaterThan(0);
  });

  it("gives every article a table of contents", () => {
    for (const a of all) expect(a.toc.length, a.slug).toBeGreaterThan(1);
  });

  it("pages at least once, and never to zero pages", () => {
    expect(pageCount(0, 12)).toBe(1);
    expect(pageCount(12, 12)).toBe(1);
    expect(pageCount(13, 12)).toBe(2);
  });
});

describe("search index", () => {
  it("carries card fields and never the body", () => {
    const entry = searchIndex("en")[0];
    expect(Object.keys(entry).sort()).toEqual(
      ["category", "excerpt", "image", "imageAlt", "slug", "tags", "title"].sort(),
    );
  });

  it("stays inside the payload budget every visitor downloads", () => {
    // Outgrowing this is the signal that the blog needs a real search backend,
    // and it should be a red build rather than a slow page nobody attributes.
    const bytes = Buffer.byteLength(JSON.stringify(searchIndex("en")), "utf8");
    expect(bytes).toBeLessThanOrEqual(BLOG_SEARCH_INDEX_MAX_BYTES);
  });
});

describe("every CTA target is a route that exists", () => {
  it("maps each tool to a registered path", () => {
    const registered = new Set(LOCALIZED_ROUTES.map((r) => r.path));
    for (const tool of BLOG_TOOLS) {
      expect(registered.has(BLOG_TOOL_HREF[tool]), BLOG_TOOL_HREF[tool]).toBe(true);
    }
  });

  it("points no CTA at /register", () => {
    // Standing rule: commercial CTAs go to /pricing, free-tool CTAs to the tool.
    for (const tool of BLOG_TOOLS) expect(BLOG_TOOL_HREF[tool]).not.toBe("/register");
  });
});
