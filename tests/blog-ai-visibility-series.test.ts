// The six-post "AI Visibility" series (2026-11-11), published through the
// existing file-based blog: the files, the static params, the body features
// the series needed (figures, header-less tables, emphasis, list
// continuations), the links, the structured data, the sitemap and the nav.
//
// The copy is final, so what is checked about the bodies is structure (table
// counts, figures, links), never wording.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BLOG_BASE } from "@/lib/blog/constants";
import { getAllArticles, getArticle, getFeatured, getRelated, imageSize } from "@/lib/blog/loader";
import { MarkdownError, parseFrontmatter, parseMarkdown } from "@/lib/blog/markdown";
import { AGENT_META_DESCRIPTION_MAX, agentFrontmatterSchema, blogFrontmatterSchema } from "@/lib/blog/schema";
import { blogIndex, blogPosting, ORGANIZATION_ID } from "@/lib/seo/jsonld";
import { Blocks } from "@/app/[locale]/learn/_shared/Blocks";
import { plainText, resolveHref } from "@/app/[locale]/learn/_shared/inline";
import { PublicNav } from "@/app/[locale]/PublicNav";
import { runGate } from "@/lib/blog-agent/gate";
import sitemap from "@/app/sitemap";
import { generateStaticParams, default as ArticlePage } from "@/app/[locale]/blog/[slug]/page";
import type { LearnBlock } from "@/lib/learn-content";

const ROOT = process.cwd();
const PUBLIC = join(ROOT, "public");

/** Slug → the number of tables the post's markdown holds. */
const SERIES: Record<string, number> = {
  "where-does-chatgpt-get-its-information": 4,
  "how-to-optimize-for-ai-search": 4,
  "how-to-rank-on-chatgpt": 4,
  "monitor-brand-mentions-in-chatgpt": 6,
  "chatgpt-traffic-playbook": 5,
  "ai-visibility-audit": 9,
};
const SLUGS = Object.keys(SERIES);
const PILLAR = "where-does-chatgpt-get-its-information";

const series = () => getAllArticles("en").filter((a) => SLUGS.includes(a.slug));
const render = (body: LearnBlock[], locale = "en") =>
  renderToStaticMarkup(createElement(Blocks, { body, locale }));

describe("the series in the registry", () => {
  it("loads all six from content/blog/en, published, one file each", () => {
    const files = readdirSync(join(ROOT, "content", "blog", "en"));
    for (const slug of SLUGS) expect(files, slug).toContain(`${slug}.md`);
    expect(series().map((a) => a.slug).sort()).toEqual([...SLUGS].sort());
    for (const a of series()) {
      expect(a.status).toBe("published");
      expect(a.publishedAt).toBe("2026-11-11");
      expect(a.category).toBe("AI Visibility");
    }
  });

  it("builds a static page for every post in every locale", () => {
    const params = generateStaticParams();
    for (const slug of SLUGS) {
      for (const locale of ["en", "en-CA", "fr", "fr-CA", "de-CH"]) {
        expect(params, `${locale}/${slug}`).toContainEqual({ locale, slug });
      }
    }
  });

  it("404s an unknown slug", async () => {
    expect(getArticle("en", "nope")).toBeUndefined();
    await expect(
      ArticlePage({ params: Promise.resolve({ locale: "en", slug: "nope" }) }),
    ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });

  it("features the pillar, and only the pillar of the series", () => {
    expect(getFeatured("en")?.slug).toBe(PILLAR);
    expect(series().filter((a) => a.featured).map((a) => a.slug)).toEqual([PILLAR]);
  });

  it("names its five siblings, and the strip under the body shows all five", () => {
    for (const a of series()) {
      const siblings = SLUGS.filter((s) => s !== a.slug);
      expect([...a.relatedSlugs].sort(), a.slug).toEqual([...siblings].sort());
      const strip = getRelated("en", a, Math.max(3, a.relatedSlugs.length)).map((r) => r.slug);
      expect(strip, a.slug).toEqual(a.relatedSlugs);
    }
  });

  it("uses the bundled cover as hero and its PNG as the social image, sized from the file", () => {
    for (const a of series()) {
      expect(a.featuredImage).toBe(`/blog/${a.slug}/cover.svg`);
      expect(a.ogImage).toBe(`/blog/${a.slug}/cover.png`);
      expect(a.heroSize).toEqual({ width: 1200, height: 630 });
      expect(imageSize(a.ogImage!)).toEqual({ width: 1200, height: 630 });
    }
  });
});

describe("the bodies", () => {
  it("keeps every table: pillar 4, optimize 4, rank 4, monitor 6, traffic 5, audit 9", () => {
    for (const a of series()) {
      expect(a.body.filter((b) => b.k === "table").length, a.slug).toBe(SERIES[a.slug]);
    }
  });

  it("points every figure at a file under public/, with its alt and intrinsic size", () => {
    let figures = 0;
    for (const a of series()) {
      for (const b of a.body) {
        if (b.k !== "image") continue;
        figures++;
        expect(existsSync(join(PUBLIC, b.src)), b.src).toBe(true);
        expect(b.src.startsWith(`/blog/${a.slug}/`), b.src).toBe(true);
        expect(b.alt.length, b.src).toBeGreaterThan(5);
        expect(b.width).toBe(1200);
        expect(b.height).toBeGreaterThan(0);
      }
    }
    expect(figures).toBe(13); // 19 SVGs = 6 covers + 13 diagrams
  });

  it("cross-links only to posts that exist, and every CTA goes to /free-audit or /pricing", () => {
    const published = new Set(getAllArticles("en").map((a) => a.slug));
    for (const a of series()) {
      const text = JSON.stringify(a.body);
      const internal = [...text.matchAll(/\]\((\/[^)\s"]+)\)/g)].map((m) => m[1]);
      for (const href of internal.filter((h) => h.startsWith(`${BLOG_BASE}/`))) {
        expect(published.has(href.slice(BLOG_BASE.length + 1)), `${a.slug} -> ${href}`).toBe(true);
      }
      expect(internal, a.slug).toContain("/free-audit");
      expect(internal, a.slug).toContain("/pricing");
      expect(text).not.toContain("/register");
      expect(text).not.toMatch(/EchoRank|echoRank|Echo Rank/);
    }
  });

  it("locale-prefixes the CTA and cross-link hrefs", () => {
    expect(resolveHref("/free-audit", "fr")).toBe("/fr/free-audit");
    expect(resolveHref("/pricing", "en")).toBe("/en/pricing");
    expect(resolveHref(`/blog/${PILLAR}`, "fr")).toBe(`/fr/blog/${PILLAR}`);
    const html = render(getArticle("fr", "ai-visibility-audit")!.body, "fr");
    expect(html).toContain('href="/fr/free-audit"');
    expect(html).toContain('href="/fr/pricing"');
    expect(html).toContain(`href="/fr/blog/${PILLAR}"`);
    expect(html).not.toMatch(/href="\/(free-audit|pricing|blog)/);
  });

  it("renders figures lazily, Key takeaways without an empty header, and emphasis", () => {
    const html = render(getArticle("en", "ai-visibility-audit")!.body);
    expect(html).toContain('src="/blog/ai-visibility-audit/scorecard.svg"');
    expect(html).toMatch(/<img[^>]*alt="Sample AI visibility scorecard"[^>]*loading="lazy"/);
    expect(html).not.toContain('srcSet=""');
    // The Key takeaways table ("| | |") draws no <thead>; the others do.
    const tables = html.match(/<table[\s\S]*?<\/table>/g)!;
    expect(tables).toHaveLength(9);
    expect(tables.filter((t) => !t.includes("<thead>"))).toHaveLength(1);
    expect(html).toContain("<em>Editor: Frederic Desjardins - Echorank</em>");
    expect(html).not.toMatch(/>\*[A-Za-z]/);
  });

  it("keeps the GA4 regex inside its list item, so the numbering does not restart", () => {
    const body = getArticle("en", "chatgpt-traffic-playbook")!.body;
    const list = body.find((b) => b.k === "ol" && b.items.some((i) => i.includes("chatgpt\\.com|")));
    expect(list && list.k === "ol" ? list.items.length : 0).toBe(4);
  });
});

describe("the compiler additions", () => {
  it("accepts a /blog/ figure only with a resolver, and refuses a missing file", () => {
    const md = "![A diagram](/blog/x/y.svg)";
    expect(() => parseMarkdown(md)).toThrow(MarkdownError);
    expect(parseMarkdown(md, { images: () => ({ width: 10, height: 5 }) })).toEqual([
      { k: "image", src: "/blog/x/y.svg", srcset: [], sizes: "100vw", width: 10, height: 5, alt: "A diagram" },
    ]);
    expect(() => parseMarkdown(md, { images: () => null })).toThrow(/not found/);
    expect(() => parseMarkdown("![x](https://e.com/a.svg)", { images: () => ({ width: 1, height: 1 }) })).toThrow(
      MarkdownError,
    );
  });

  it("strips emphasis from plain text, and leaves a lone asterisk alone", () => {
    expect(plainText("an *outcome* here")).toBe("an outcome here");
    expect(render([{ k: "p", t: "5 * 3 and **bold** and *em*" }])).toContain(
      "5 * 3 and <strong>bold</strong> and <em>em</em>",
    );
  });
});

describe("the agent keeps its stricter rules", () => {
  const ok = {
    slug: "a-real-slug",
    title: "A title long enough to pass the minimum",
    seoTitle: "A search-friendly title",
    metaDescription: "x".repeat(AGENT_META_DESCRIPTION_MAX + 5),
    excerpt: "An excerpt with enough words in it to clear the sixty-character floor the schema sets.",
    category: "Research",
    tags: ["geo"],
    searchIntent: "informational",
    primaryKeyword: "geo",
    publishedAt: "2026-08-01",
    featuredImage: "/blog/a-real-slug/hero.svg",
    featuredImageAlt: "A described illustration",
    relatedTool: "free-audit",
    status: "draft",
  };

  it("lets a hand-written article run past 165 characters and skip the TL;DR", () => {
    expect(blogFrontmatterSchema.safeParse(ok).success).toBe(true);
  });

  it("holds the agent to 165 characters and a TL;DR", () => {
    const res = agentFrontmatterSchema.safeParse(ok);
    expect(res.success).toBe(false);
    const paths = res.error!.issues.map((i) => i.path.join("."));
    expect(paths).toContain("metaDescription");
    expect(paths).toContain("tldr");
  });

  it("still refuses an inline image in an agent draft", () => {
    const source = readFileSync(join(ROOT, "content", "blog", "en", `${PILLAR}.md`), "utf-8");
    const { body } = parseFrontmatter(source);
    const res = runGate({ raw: source, existingSlugs: new Set(SLUGS), researchUrls: new Set() });
    expect(body).toContain("![");
    expect(res.failures.join("\n")).toMatch(/markdown the blog cannot render: line \d+: inline images/);
  });
});

describe("structured data", () => {
  it("emits a BlogPosting with the PNG, the author and the publisher", () => {
    const a = getArticle("en", PILLAR)!;
    const url = `https://echorank360.com/en/blog/${PILLAR}`;
    const node = blogPosting({
      headline: a.title,
      description: a.metaDescription,
      pageUrl: url,
      image: a.ogImage ?? a.featuredImage,
      datePublished: a.publishedAt,
      authorName: "Frederic Desjardins",
    });
    expect(node["@type"]).toBe("BlogPosting");
    expect(node.image).toBe(`https://echorank360.com/blog/${PILLAR}/cover.png`);
    expect(node.datePublished).toBe("2026-11-11");
    expect(node.author).toEqual({ "@type": "Person", name: "Frederic Desjardins" });
    expect(node.publisher).toEqual({ "@id": ORGANIZATION_ID });
  });

  it("emits a Blog on the index listing its posts by @id", () => {
    const node = blogIndex({
      name: "Echorank Blog",
      description: "d",
      pageUrl: "https://echorank360.com/en/blog",
      posts: [{ headline: "h", url: "https://echorank360.com/en/blog/x", datePublished: "2026-11-11", image: "/blog/x/cover.png" }],
    });
    expect(node["@type"]).toBe("Blog");
    expect(node.publisher).toEqual({ "@id": ORGANIZATION_ID });
    expect(node.blogPost).toEqual([
      {
        "@type": "BlogPosting",
        "@id": "https://echorank360.com/en/blog/x#article",
        headline: "h",
        url: "https://echorank360.com/en/blog/x",
        datePublished: "2026-11-11",
        image: "https://echorank360.com/blog/x/cover.png",
      },
    ]);
  });
});

describe("sitemap and nav", () => {
  it("lists /blog and the six posts in every locale", () => {
    const urls = new Set(sitemap().map((e) => e.url));
    for (const locale of ["en", "fr"]) {
      const paths = [BLOG_BASE, ...SLUGS.map((s) => `${BLOG_BASE}/${s}`)];
      expect(paths).toHaveLength(7);
      for (const p of paths) expect(urls.has(`https://echorank360.com/${locale}${p}`), `${locale}${p}`).toBe(true);
    }
  });

  it("puts the blog first in Resources > Learn, en and fr", () => {
    for (const [locale, label] of [["en", "Echorank Blog"], ["fr", "Blogue Echorank"]] as const) {
      const html = renderToStaticMarkup(createElement(PublicNav, { locale, current: "resources" }));
      expect(html).toContain(`href="/${locale}/blog"`);
      expect(html).toContain(label);
    }
  });
});
