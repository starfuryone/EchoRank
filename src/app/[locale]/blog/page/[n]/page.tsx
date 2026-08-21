// /[locale]/blog/page/[n] — the paginated index, page 2 onward.
//
// A folder literally named "page" is fine: only the FILE page.tsx is special to
// the router, and a static segment always beats the sibling [slug], which is
// why "page" is in RESERVED_BLOG_SLUGS. An article named page.md would be
// unreachable rather than conflicting, and the schema refuses it for that reason.
//
// PAGE 1 IS NOT GENERATED HERE. It canonicalizes to /blog, and generating both
// would publish two URLs with identical content.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isSupportedLocale, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { BLOG_BASE, BLOG_PAGE_SIZE, blogBaseOf } from "@/lib/blog/constants";
import { getAllArticles, getFeatured, pageCount } from "@/lib/blog/loader";
import { PublicNav } from "../../../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { IndexView } from "../../_shared/IndexView";
import { BLOG_CHROME } from "../../_shared/copy";
import s from "../../../home2.module.css";

export const dynamicParams = false;

/** Locale x page, pages 2..N. Empty for a blog that fits on one page. */
export function generateStaticParams() {
  const total = pageCount(
    getAllArticles("en").filter((a) => a.slug !== getFeatured("en")?.slug).length,
    BLOG_PAGE_SIZE,
  );
  return SUPPORTED_LOCALES.flatMap((locale) =>
    Array.from({ length: Math.max(0, total - 1) }, (_, i) => ({ locale, n: String(i + 2) })),
  );
}

type Params = Promise<{ locale: string; n: string }>;

/** "2" -> 2. Anything else -> null, which 404s rather than rendering page NaN. */
function pageNumber(raw: string): number | null {
  return /^[2-9]\d*$/.test(raw) ? Number(raw) : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, n } = await params;
  const page = pageNumber(n);
  if (!isSupportedLocale(locale) || page === null) return {};
  const t = BLOG_CHROME[blogBaseOf(locale)];
  return buildMetadata({
    locale,
    path: `${BLOG_BASE}/page/${page}`,
    title: t.pageTitle(page),
    description: t.hubSub,
    // Deliberately self-canonical, not pointed at /blog: page 2 carries
    // different articles, and canonicalizing it away tells Google those
    // articles' only listing does not exist.
  });
}

export default async function Page({ params }: { params: Params }) {
  const { locale, n } = await params;
  const page = pageNumber(n);
  if (!isSupportedLocale(locale) || page === null) notFound();
  const l = locale as Locale;
  const base = blogBaseOf(l);
  const t = BLOG_CHROME[base];

  const rest = getAllArticles(l).filter((a) => a.slug !== getFeatured(l)?.slug);
  const total = pageCount(rest.length, BLOG_PAGE_SIZE);
  // Past the end is a 404, not an empty page: an out-of-range page number is a
  // stale link or a crawler guessing, and both should be told plainly.
  if (page > total) notFound();

  return (
    <div className={s.page}>
      <PublicNav locale={l} current="resources" />
      <IndexView
        locale={l}
        base={base}
        eyebrow={t.hubEyebrow}
        h1={t.hubH1}
        sub={t.pageOf(page, total)}
        articles={rest.slice((page - 1) * BLOG_PAGE_SIZE, page * BLOG_PAGE_SIZE)}
        pager={{ current: page, total }}
      />
      <PublicFooter locale={l} />
    </div>
  );
}
