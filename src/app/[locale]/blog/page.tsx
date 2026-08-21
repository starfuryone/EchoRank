// /[locale]/blog — the index.
//
// Statically generated for all five marketing locales. The article set comes
// from content/blog/ through the server-only loader; nothing here reads a
// database, and there is no CMS.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isSupportedLocale, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";
import { buildMetadata, JsonLd, baseGraph } from "@/lib/seo";
import { BLOG_BASE, BLOG_PAGE_SIZE, blogBaseOf } from "@/lib/blog/constants";
import { getAllArticles, getFeatured, pageCount, searchIndex } from "@/lib/blog/loader";
import { PublicNav } from "../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { IndexView } from "./_shared/IndexView";
import { BLOG_CHROME } from "./_shared/copy";
import s from "../home2.module.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const t = BLOG_CHROME[blogBaseOf(locale)];
  return buildMetadata({ locale, path: BLOG_BASE, title: t.hubH1, description: t.hubSub });
}

export default async function Page({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const l = locale as Locale;
  const base = blogBaseOf(l);
  const t = BLOG_CHROME[base];

  const all = getAllArticles(l);
  const featured = getFeatured(l);
  // The featured article is pulled OUT of the grid rather than repeated in it.
  // Page 2 onward keeps the same slicing, so an article never appears twice and
  // never falls between two pages.
  const rest = all.filter((a) => a.slug !== featured?.slug);

  return (
    <div className={s.page}>
      <PublicNav locale={l} current="resources" />
      <JsonLd graph={baseGraph(l)} />
      <IndexView
        locale={l}
        base={base}
        eyebrow={t.hubEyebrow}
        h1={t.hubH1}
        sub={t.hubSub}
        featured={featured}
        articles={rest.slice(0, BLOG_PAGE_SIZE)}
        searchEntries={searchIndex(l)}
        pager={{ current: 1, total: pageCount(rest.length, BLOG_PAGE_SIZE) }}
      />
      <PublicFooter locale={l} />
    </div>
  );
}
