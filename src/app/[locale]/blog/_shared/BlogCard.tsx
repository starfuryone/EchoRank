// Article cards. Two shapes, one file: the 3-up grid card and the wide featured
// card at the top of the index. They share the metadata line and the category
// chip, which is the part that would drift if they lived apart.

import Link from "next/link";
import type { BlogBase } from "@/lib/blog/constants";
import { blogArticlePath, formatBlogDate } from "@/lib/blog/constants";
import type { BlogArticle } from "@/lib/blog/loader";
import { BLOG_CHROME, categoryLabel } from "./copy";
import s from "./blog.module.css";

interface CardProps {
  article: BlogArticle;
  locale: string;
  base: BlogBase;
}

/**
 * Plain <img>, not next/image: these heroes are hand-drawn SVGs of a few KB,
 * and next/image passes SVGs through unoptimized anyway. The intrinsic 1400x600
 * is declared so the grid reserves the row's height before the file lands.
 */
function Hero({ article, className }: { article: BlogArticle; className: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={article.featuredImage}
      alt={article.featuredImageAlt}
      width={1400}
      height={600}
      loading="lazy"
      decoding="async"
    />
  );
}

function Meta({ article, base }: { article: BlogArticle; base: BlogBase }) {
  const t = BLOG_CHROME[base];
  return (
    <span className={s.cardMeta}>
      <time dateTime={article.publishedAt}>{formatBlogDate(article.publishedAt, base)}</time>
      <span aria-hidden="true">·</span>
      <span>{t.readingTime(article.readingTime)}</span>
    </span>
  );
}

export function BlogCard({ article, locale, base }: CardProps) {
  return (
    <Link className={s.card} href={`/${locale}${blogArticlePath(article.slug)}`}>
      <Hero article={article} className={s.cardImg} />
      <span className={s.cardBody}>
        <span className={s.chip}>{categoryLabel(article.category, base)}</span>
        <span className={s.cardTitle}>{article.title}</span>
        <span className={s.cardExcerpt}>{article.excerpt}</span>
        <Meta article={article} base={base} />
      </span>
    </Link>
  );
}

export function FeaturedCard({ article, locale, base }: CardProps) {
  return (
    <Link className={s.featured} href={`/${locale}${blogArticlePath(article.slug)}`}>
      <Hero article={article} className={s.featuredImg} />
      <span className={s.featuredBody}>
        <span className={s.chip}>{categoryLabel(article.category, base)}</span>
        <span className={s.featuredTitle}>{article.title}</span>
        <span className={s.featuredExcerpt}>{article.excerpt}</span>
        <Meta article={article} base={base} />
      </span>
    </Link>
  );
}
