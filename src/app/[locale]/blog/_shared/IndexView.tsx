// The listing chrome, shared by /blog, /blog/page/[n] and /blog/category/[cat].
//
// One component rather than three near-identical pages: the three differ only
// in which articles they receive, whether the featured card and the search box
// belong there, and where the pager points. Everything else — hero, tabs, grid,
// empty state — is the same markup, and three copies of it is the shape that
// drifts when a card gains a field.

import Link from "next/link";
import {
  BLOG_BASE,
  BLOG_CATEGORIES,
  categorySlug,
  type BlogBase,
  type BlogCategory,
  type BlogSearchEntry,
} from "@/lib/blog/constants";
import type { BlogArticle } from "@/lib/blog/loader";
import { BlogCard, FeaturedCard } from "./BlogCard";
import { BlogSearch } from "./BlogSearch";
import { BLOG_CHROME, categoryLabel } from "./copy";
import s from "./blog.module.css";
import h from "@/app/[locale]/home2.module.css";

export interface IndexViewProps {
  locale: string;
  base: BlogBase;
  /** The page's own slice, already paginated by the caller. */
  articles: BlogArticle[];
  /** Rendered above the grid. Page 1 of the main index only. */
  featured?: BlogArticle;
  /** Present only where searching the whole corpus makes sense. */
  searchEntries?: BlogSearchEntry[];
  /** Highlighted tab, or undefined for "All". */
  activeCategory?: BlogCategory;
  /** Heading, so a category page does not shout the hub's H1 at the reader. */
  h1: string;
  sub: string;
  eyebrow: string;
  pager?: { current: number; total: number };
}

/**
 * Category tabs as real links.
 *
 * Deliberately anchors rather than client-side filter buttons: a category page
 * is a crawlable URL with its own metadata, and a filter that only exists in
 * JavaScript is a category nothing can link to or index.
 */
function Tabs({
  locale,
  base,
  active,
}: {
  locale: string;
  base: BlogBase;
  active?: BlogCategory;
}) {
  const t = BLOG_CHROME[base];
  return (
    <nav className={s.tabs} aria-label={t.blog}>
      <Link
        className={`${s.tab} ${active ? "" : s.tabOn}`}
        href={`/${locale}${BLOG_BASE}`}
        aria-current={active ? undefined : "page"}
      >
        {t.allCategories}
      </Link>
      {BLOG_CATEGORIES.map((c) => (
        <Link
          key={c}
          className={`${s.tab} ${active === c ? s.tabOn : ""}`}
          href={`/${locale}${BLOG_BASE}/category/${categorySlug(c)}`}
          aria-current={active === c ? "page" : undefined}
        >
          {categoryLabel(c, base)}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Numbered pager.
 *
 * Page 1's link is "/blog", never "/blog/page/1" — the paginated route
 * canonicalizes there, and linking at the canonical directly saves the reader
 * and the crawler a hop through a URL we are telling them not to use.
 */
function Pager({
  locale,
  base,
  current,
  total,
}: {
  locale: string;
  base: BlogBase;
  current: number;
  total: number;
}) {
  if (total <= 1) return null;
  const t = BLOG_CHROME[base];
  const href = (n: number) => `/${locale}${BLOG_BASE}${n === 1 ? "" : `/page/${n}`}`;
  return (
    <nav className={s.pager} aria-label={t.pageOf(current, total)}>
      {current > 1 && (
        <Link className={s.pageLink} href={href(current - 1)} rel="prev">
          {t.prevPage}
        </Link>
      )}
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <Link
          key={n}
          className={`${s.pageLink} ${n === current ? s.pageOn : ""}`}
          href={href(n)}
          aria-current={n === current ? "page" : undefined}
        >
          {n}
        </Link>
      ))}
      {current < total && (
        <Link className={s.pageLink} href={href(current + 1)} rel="next">
          {t.nextPage}
        </Link>
      )}
    </nav>
  );
}

export function IndexView({
  locale,
  base,
  articles,
  featured,
  searchEntries,
  activeCategory,
  h1,
  sub,
  eyebrow,
  pager,
}: IndexViewProps) {
  const t = BLOG_CHROME[base];

  const tabs = <Tabs locale={locale} base={base} active={activeCategory} />;

  const grid =
    articles.length === 0 ? (
      <p className={s.empty}>
        {t.emptyCategory}{" "}
        <Link href={`/${locale}${BLOG_BASE}`}>{t.browseAll}</Link>
      </p>
    ) : (
      <div className={s.grid}>
        {articles.map((a) => (
          <BlogCard key={a.slug} article={a} locale={locale} base={base} />
        ))}
      </div>
    );

  /* Featured card and grid together: this is the block a search replaces. */
  const listing = (
    <>
      {featured && (
        <>
          <p className={h.label} style={{ margin: "30px 0 16px" }}>
            <b>/ 02</b> — {t.featuredLabel}
          </p>
          <FeaturedCard article={featured} locale={locale} base={base} />
        </>
      )}
      <p className={h.label} style={{ marginTop: featured ? 0 : 30 }}>
        <b>/ {featured ? "03" : "02"}</b> — {t.latest}
      </p>
      {grid}
      {pager && <Pager locale={locale} base={base} {...pager} />}
    </>
  );

  return (
    <>
      <section className={s.hero}>
        <div className={h.container}>
          <p className={h.label}>
            <b>/ 01</b> — {eyebrow}
          </p>
          <h1 className={s.heroH1}>{h1}</h1>
          <p className={s.heroSub}>{sub}</p>
        </div>
      </section>

      <section className={h.section} style={{ paddingTop: 0, borderTop: "none" }}>
        <div className={h.container}>
          {searchEntries ? (
            <BlogSearch entries={searchEntries} locale={locale} base={base} tabs={tabs}>
              {listing}
            </BlogSearch>
          ) : (
            <>
              {tabs}
              {listing}
            </>
          )}
        </div>
      </section>
    </>
  );
}
