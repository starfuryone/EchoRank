// /[locale]/blog/[slug] — the article template.
//
// The BODY renders through Blocks + inline, the same components the Knowledge
// Hub and the help articles use, so blog prose cannot drift into a second
// article design. The layout classes (.articleLayout, .article, .toc) come from
// learn.module.css for the same reason. Everything AROUND the prose — the
// breadcrumb, the TL;DR box, the tool CTA, the FAQ, the author card, the related
// strip — is blog-specific and lives in ./_shared.
//
// STRUCTURED DATA: BlogPosting + BreadcrumbList always, FAQPage only when the
// page actually renders an FAQ. The guard is one `article.faq &&` used for both
// the markup and the visible section, because markup describing questions that
// are not on screen is a structured-data violation.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Fragment } from "react";
import { isSupportedLocale, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";
import {
  SITE_URL,
  buildMetadata,
  JsonLd,
  baseGraph,
  blogPosting,
  breadcrumbList,
  faqPage,
} from "@/lib/seo";
import {
  BLOG_AUTHOR,
  BLOG_BASE,
  blogArticlePath,
  blogBaseOf,
  categorySlug,
  formatBlogDate,
  showsUpdated,
} from "@/lib/blog/constants";
import { getAllArticles, getArticle, getRelated } from "@/lib/blog/loader";
import { indexAfterHeading } from "@/lib/blog/markdown";
import { Blocks } from "../../learn/_shared/Blocks";
import { plainText } from "../../learn/_shared/inline";
import { PublicNav } from "../../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { BlogCard } from "../_shared/BlogCard";
import { BlogToolCta } from "../_shared/BlogToolCta";
import { AuthorCard } from "../_shared/AuthorCard";
import { BLOG_CHROME, categoryLabel } from "../_shared/copy";
import b from "../_shared/blog.module.css";
import l from "../../learn/_shared/learn.module.css";
import s from "../../home2.module.css";

export const dynamicParams = false;

/** Locale x published slug. Drafts are not on this list and so do not build. */
export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    getAllArticles(locale).map((a) => ({ locale, slug: a.slug })),
  );
}

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) return {};
  const article = getArticle(locale, slug);
  if (!article) return {};
  return buildMetadata({
    locale,
    path: blogArticlePath(slug),
    title: article.seoTitle,
    description: article.metaDescription,
    ogImage: article.featuredImage,
    ogType: "article",
    // NO canonicalLocale. Unlike the Knowledge Hub, whose English prose is
    // served under every locale, a blog article that has been translated is a
    // different document per locale — so each canonicals to itself. An
    // untranslated one still does: /fr/blog/x renders French chrome and a
    // notice, which is not the same page as /en/blog/x.
  });
}

export default async function Page({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const article = getArticle(locale, slug);
  if (!article) notFound();

  const loc = locale as Locale;
  const base = blogBaseOf(loc);
  const t = BLOG_CHROME[base];
  const label = categoryLabel(article.category, base);
  const link = (p: string) => `/${loc}${p}`;
  const abs = (p: string) => `${SITE_URL}${link(p)}`;
  const pageUrl = abs(blogArticlePath(article.slug));
  const updated = showsUpdated(article);
  const related = getRelated(loc, article);

  // The mid-article CTA lands after the second H2's opening paragraph. Anchored
  // to STRUCTURE, not to any sentence, so editing the copy cannot move it.
  const ctaAt = indexAfterHeading(article.body, 2);
  const head = article.body.slice(0, ctaAt);
  const tail = article.body.slice(ctaAt);

  return (
    <div className={s.page}>
      <PublicNav locale={loc} current="resources" />

      <JsonLd
        graph={[
          ...baseGraph(loc),
          blogPosting({
            headline: article.title,
            description: article.metaDescription,
            pageUrl,
            image: article.featuredImage,
            datePublished: article.publishedAt,
            // Only when it is genuinely later — see showsUpdated(). The page and
            // the markup agree because they read the same predicate.
            ...(updated ? { dateModified: article.updatedAt } : {}),
            authorName: BLOG_AUTHOR.name,
            inLanguage: article.bodyBase,
            readingTime: article.readingTime,
            keywords: article.tags,
            articleSection: article.category,
          }),
          breadcrumbList([
            { name: t.home, url: `${SITE_URL}/${loc}` },
            { name: t.blog, url: abs(BLOG_BASE) },
            { name: label, url: abs(`${BLOG_BASE}/category/${categorySlug(article.category)}`) },
            { name: article.title, url: pageUrl },
          ]),
          // Emitted ONLY when the FAQ is on the page. plainText() strips the
          // inline markup so the answer does not publish its asterisks into a
          // search result.
          ...(article.faq
            ? [
                faqPage(
                  article.faq.map((f) => ({ q: f.q, a: plainText(f.a) })),
                  pageUrl,
                ),
              ]
            : []),
        ]}
      />

      <div className={s.container}>
        <nav className={b.crumbs} aria-label="Breadcrumb">
          <Link href={link("")}>{t.home}</Link>
          <span className={b.crumbSep} aria-hidden="true">/</span>
          <Link href={link(BLOG_BASE)}>{t.blog}</Link>
          <span className={b.crumbSep} aria-hidden="true">/</span>
          <Link href={link(`${BLOG_BASE}/category/${categorySlug(article.category)}`)}>{label}</Link>
          <span className={b.crumbSep} aria-hidden="true">/</span>
          <span>{article.title}</span>
        </nav>
      </div>

      <section className={s.section} style={{ paddingTop: 26, borderTop: "none" }}>
        <div className={s.container}>
          <span className={b.chip}>{label}</span>
          <h1 className={l.articleH1}>{article.title}</h1>
          <p className={l.articleLede}>{article.excerpt}</p>
          <p className={b.byline}>
            <span>
              {t.by} <span className={b.bylineName}>{BLOG_AUTHOR.name}</span>
            </span>
            <span className={b.bylineDot} aria-hidden="true">·</span>
            <time dateTime={article.publishedAt}>
              {formatBlogDate(article.publishedAt, base)}
            </time>
            {updated && (
              <>
                <span className={b.bylineDot} aria-hidden="true">·</span>
                <time dateTime={article.updatedAt}>
                  {t.updatedOn(formatBlogDate(article.updatedAt!, base))}
                </time>
              </>
            )}
            <span className={b.bylineDot} aria-hidden="true">·</span>
            <span>{t.readingTime(article.readingTime)}</span>
          </p>

          <figure className={b.heroFig}>
            {/* Plain <img>: hand-drawn SVG, which next/image passes through
                unoptimized anyway. The 1400x600 intrinsic size reserves the
                block's height before the file lands. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={b.heroImg}
              src={article.featuredImage}
              alt={article.featuredImageAlt}
              width={1400}
              height={600}
              // The hero is above the fold on every article; lazy-loading it
              // would defer the largest paint on the page.
              fetchPriority="high"
              decoding="async"
            />
          </figure>

          {/* A fr reader on an untranslated article gets French chrome and an
              English body. Saying so is the same courtesy ArticleShell extends
              on the Knowledge Hub. */}
          {base !== article.bodyBase && <p className={l.langNotice}>{t.englishBody}</p>}

          <div className={l.articleLayout} style={{ marginTop: 34 }}>
            <article className={l.article}>
              <aside className={b.tldr}>
                <p className={b.tldrH}>TL;DR</p>
                <ul className={b.tldrList}>
                  {article.tldr.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </aside>

              <Blocks body={head} locale={loc} />
              <BlogToolCta tool={article.relatedTool} locale={loc} base={base} />
              <Blocks body={tail} locale={loc} />

              {article.faq && (
                <section className={b.faq}>
                  <h2 className={b.faqH}>{t.faqH}</h2>
                  {article.faq.map((f, i) => (
                    <details key={i} className={b.faqItem}>
                      <summary className={b.faqQ}>{f.q}</summary>
                      <p className={b.faqA}>{f.a}</p>
                    </details>
                  ))}
                </section>
              )}

              <AuthorCard base={base} />
            </article>

            {article.toc.length > 1 && (
              <aside className={l.toc}>
                <p className={l.tocH}>{t.tocH}</p>
                <ul className={l.tocList}>
                  {article.toc.map((item) => (
                    <li key={item.id}>
                      <a href={`#${item.id}`}>{item.text}</a>
                    </li>
                  ))}
                </ul>
              </aside>
            )}
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className={s.section}>
          <div className={s.container}>
            <p className={b.relatedH}>{t.relatedH}</p>
            <div className={b.grid}>
              {related.map((r) => (
                <Fragment key={r.slug}>
                  <BlogCard article={r} locale={loc} base={base} />
                </Fragment>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={b.band}>
        <div className={s.container}>
          <h2 className={b.bandH}>{t.bandH}</h2>
          <p className={b.bandSub}>{t.bandSub}</p>
          <div className={s.ctarow} style={{ justifyContent: "center" }}>
            <Link className={`${s.btn} ${s.btnPrimary}`} href={link("/free-audit")}>
              {t.bandCta}
            </Link>
            <Link className={`${s.btn} ${s.btnGhost}`} href={link("/pricing")}>
              {t.bandGhost}
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter locale={loc} />
    </div>
  );
}
