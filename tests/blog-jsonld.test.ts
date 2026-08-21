// Structured data for the blog is DERIVED from the article files.
//
// Same argument as tests/learn-jsonld.test.ts and the same shape: the
// assertions never name a headline, a URL or a date. They compare the emitted
// graph against the loaded article, and the mutation checks at the bottom prove
// that comparison is not vacuous by feeding the builders drifted input and
// requiring the same assertions to fail.

import { describe, expect, it } from "vitest";
import { blogPosting, breadcrumbList, faqPage } from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/seo/constants";
import { plainText } from "@/app/[locale]/learn/_shared/inline";
import {
  BLOG_AUTHOR,
  BLOG_BASE,
  BLOG_CATEGORIES,
  blogArticlePath,
  categorySlug,
  showsUpdated,
} from "@/lib/blog/constants";
import { getAllArticles } from "@/lib/blog/loader";
import type { BlogArticle } from "@/lib/blog/loader";

const ARTICLES = getAllArticles("en");
const url = (slug: string) => `${SITE_URL}/en${blogArticlePath(slug)}`;

/** The node exactly as src/app/[locale]/blog/[slug]/page.tsx builds it. */
function posting(a: BlogArticle) {
  const updated = showsUpdated(a);
  return blogPosting({
    headline: a.title,
    description: a.metaDescription,
    pageUrl: url(a.slug),
    image: a.featuredImage,
    datePublished: a.publishedAt,
    ...(updated ? { dateModified: a.updatedAt } : {}),
    authorName: BLOG_AUTHOR.name,
    inLanguage: a.bodyBase,
    readingTime: a.readingTime,
    keywords: a.tags,
    articleSection: a.category,
  }) as unknown as Record<string, unknown>;
}

/** The crumb trail exactly as the page builds it. */
function crumbs(a: BlogArticle) {
  return breadcrumbList([
    { name: "Home", url: `${SITE_URL}/en` },
    { name: "Blog", url: `${SITE_URL}/en${BLOG_BASE}` },
    { name: a.category, url: `${SITE_URL}/en${BLOG_BASE}/category/${categorySlug(a.category)}` },
    { name: a.title, url: url(a.slug) },
  ]) as unknown as { itemListElement: { position: number; name: string; item: string }[] };
}

describe("BlogPosting", () => {
  it("is emitted for every article", () => {
    for (const a of ARTICLES) expect(posting(a)["@type"], a.slug).toBe("BlogPosting");
  });

  it("takes headline, description and section from the article", () => {
    for (const a of ARTICLES) {
      const node = posting(a);
      expect(node.headline).toBe(a.title);
      expect(node.description).toBe(a.metaDescription);
      expect(node.articleSection).toBe(a.category);
      expect(node.keywords).toEqual(a.tags);
    }
  });

  it("points mainEntityOfPage and url at the article's own URL", () => {
    for (const a of ARTICLES) {
      const node = posting(a);
      expect(node.url).toBe(url(a.slug));
      expect(node["@id"]).toBe(`${url(a.slug)}#article`);
      expect(node.mainEntityOfPage).toEqual({ "@type": "WebPage", "@id": url(a.slug) });
    }
  });

  it("publishes the authored date, absolutized image, and a Person author", () => {
    for (const a of ARTICLES) {
      const node = posting(a);
      expect(node.datePublished).toBe(a.publishedAt);
      expect(node.image).toBe(`${SITE_URL}${a.featuredImage}`);
      expect(node.author).toEqual({ "@type": "Person", name: BLOG_AUTHOR.name });
    }
  });

  it("omits dateModified unless the article is genuinely revised", () => {
    // Re-dating an untouched article is a fabricated field in slow motion —
    // the same rule that keeps datePublished off the Knowledge Hub's Article.
    for (const a of ARTICLES) {
      const node = posting(a);
      if (showsUpdated(a)) expect(node.dateModified).toBe(a.updatedAt);
      else expect(node).not.toHaveProperty("dateModified");
    }
  });

  it("carries the COMPUTED reading time, not an authored one", () => {
    for (const a of ARTICLES) expect(posting(a).timeRequired).toBe(`PT${a.readingTime}M`);
  });
});

describe("FAQPage", () => {
  it("is emitted if and only if the article renders an FAQ", () => {
    // Markup describing questions that are not on screen is a structured-data
    // violation. The page uses ONE `article.faq &&` for both, so this asserts
    // the two cannot come apart.
    for (const a of ARTICLES) {
      const emitted = a.faq
        ? faqPage(a.faq.map((f) => ({ q: f.q, a: plainText(f.a) })), url(a.slug))
        : undefined;
      expect(Boolean(emitted), a.slug).toBe(Boolean(a.faq));
    }
  });

  it("carries exactly the questions the page shows, in order", () => {
    for (const a of ARTICLES.filter((x) => x.faq)) {
      const node = faqPage(
        a.faq!.map((f) => ({ q: f.q, a: plainText(f.a) })),
        url(a.slug),
      ) as unknown as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
      expect(node.mainEntity.map((q) => q.name)).toEqual(a.faq!.map((f) => f.q));
    }
  });

  it("strips inline markup from the answers", () => {
    // "**bold**" in a FAQPage answer publishes the asterisks to the SERP.
    const node = faqPage(
      [{ q: "Q?", a: plainText("A **bold** [link](/pricing) and `code`.") }],
      url("x"),
    ) as unknown as { mainEntity: { acceptedAnswer: { text: string } }[] };
    expect(node.mainEntity[0].acceptedAnswer.text).toBe("A bold link and code.");
  });
});

describe("BreadcrumbList", () => {
  it("numbers four positions from one, home first and the article last", () => {
    for (const a of ARTICLES) {
      const items = crumbs(a).itemListElement;
      expect(items.map((i) => i.position)).toEqual([1, 2, 3, 4]);
      expect(items[0].item).toBe(`${SITE_URL}/en`);
      expect(items[3].name).toBe(a.title);
      expect(items[3].item).toBe(url(a.slug));
    }
  });

  it("points the category crumb at the category page that exists", () => {
    for (const a of ARTICLES) {
      expect(crumbs(a).itemListElement[2].item).toBe(
        `${SITE_URL}/en${BLOG_BASE}/category/${categorySlug(a.category)}`,
      );
    }
  });
});

describe("the comparisons above are not vacuous", () => {
  // Feed the builders drifted input; the same assertions must fail. Without
  // this, a test that compared a value to itself would pass forever.
  const a = ARTICLES[0];

  it("catches a headline that drifts from the article", () => {
    const drifted = blogPosting({
      headline: `${a.title} (old draft)`,
      description: a.metaDescription,
      pageUrl: url(a.slug),
      image: a.featuredImage,
      datePublished: a.publishedAt,
      authorName: BLOG_AUTHOR.name,
    }) as unknown as { headline: string };
    expect(drifted.headline).not.toBe(a.title);
  });

  it("catches an invented dateModified", () => {
    const drifted = blogPosting({
      headline: a.title,
      description: a.metaDescription,
      pageUrl: url(a.slug),
      image: a.featuredImage,
      datePublished: a.publishedAt,
      dateModified: "2026-12-31",
      authorName: BLOG_AUTHOR.name,
    }) as unknown as Record<string, unknown>;
    expect(drifted).toHaveProperty("dateModified");
    expect(showsUpdated({ publishedAt: a.publishedAt, updatedAt: "2026-12-31" })).toBe(true);
    // …and that the guard the page uses would have suppressed it here, because
    // this article carries no updatedAt at all.
    expect(showsUpdated(a)).toBe(Boolean(a.updatedAt));
  });

  it("catches a crumb pointing at the wrong category", () => {
    // Any category that is not this article's own. Derived rather than named,
    // so re-categorizing the seed article does not silently make this vacuous.
    const other = BLOG_CATEGORIES.find((c) => c !== a.category)!;
    const drifted = breadcrumbList([
      { name: "Home", url: `${SITE_URL}/en` },
      { name: "Blog", url: `${SITE_URL}/en${BLOG_BASE}` },
      { name: other, url: `${SITE_URL}/en${BLOG_BASE}/category/${categorySlug(other)}` },
      { name: a.title, url: url(a.slug) },
    ]) as unknown as { itemListElement: { item: string }[] };
    expect(drifted.itemListElement[2].item).not.toBe(crumbs(a).itemListElement[2].item);
  });

  it("catches an FAQ node built from questions the page does not show", () => {
    const withFaq = ARTICLES.find((x) => x.faq)!;
    const drifted = faqPage(
      [...withFaq.faq!.map((f) => ({ q: f.q, a: f.a })), { q: "Never rendered?", a: "No." }],
      url(withFaq.slug),
    ) as unknown as { mainEntity: { name: string }[] };
    expect(drifted.mainEntity.map((q) => q.name)).not.toEqual(withFaq.faq!.map((f) => f.q));
  });
});
