// /[locale]/blog/category/[cat] — one page per taxonomy member.
//
// The tabs on the index link here rather than filtering in JavaScript: a
// category that only exists as client-side state is a category nothing can link
// to, cite or index.
//
// EVERY category renders, including one with nothing in it — it gets an empty
// state and a way back rather than a 404, because the taxonomy is fixed and a
// tab that 404s is worse than a tab that says "nothing here yet". Only NON-EMPTY
// categories are advertised in the sitemap; see src/app/sitemap.ts.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isSupportedLocale, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";
import { SITE_URL, buildMetadata, JsonLd, baseGraph, breadcrumbList } from "@/lib/seo";
import {
  BLOG_BASE,
  BLOG_CATEGORIES,
  blogBaseOf,
  categoryBySlug,
  categorySlug,
} from "@/lib/blog/constants";
import { getByCategory } from "@/lib/blog/loader";
import { PublicNav } from "../../../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { IndexView } from "../../_shared/IndexView";
import { BLOG_CHROME, categoryLabel } from "../../_shared/copy";
import s from "../../../home2.module.css";

export const dynamicParams = false;

/** 5 locales x 6 categories = 30 static pages. */
export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    BLOG_CATEGORIES.map((c) => ({ locale, cat: categorySlug(c) })),
  );
}

type Params = Promise<{ locale: string; cat: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, cat } = await params;
  const category = categoryBySlug(cat);
  if (!isSupportedLocale(locale) || !category) return {};
  const base = blogBaseOf(locale);
  const t = BLOG_CHROME[base];
  const label = categoryLabel(category, base);
  return buildMetadata({
    locale,
    path: `${BLOG_BASE}/category/${cat}`,
    title: t.categoryTitle(label),
    description: t.categoryDesc(label),
  });
}

export default async function Page({ params }: { params: Params }) {
  const { locale, cat } = await params;
  const category = categoryBySlug(cat);
  if (!isSupportedLocale(locale) || !category) notFound();
  const l = locale as Locale;
  const base = blogBaseOf(l);
  const t = BLOG_CHROME[base];
  const label = categoryLabel(category, base);
  const link = (p: string) => `${SITE_URL}/${l}${p}`;

  return (
    <div className={s.page}>
      <PublicNav locale={l} current="resources" />
      <JsonLd
        graph={[
          ...baseGraph(l),
          breadcrumbList([
            { name: t.home, url: `${SITE_URL}/${l}` },
            { name: t.blog, url: link(BLOG_BASE) },
            { name: label, url: link(`${BLOG_BASE}/category/${cat}`) },
          ]),
        ]}
      />
      <IndexView
        locale={l}
        base={base}
        eyebrow={t.hubEyebrow}
        h1={label}
        sub={t.categoryDesc(label)}
        activeCategory={category}
        articles={getByCategory(l, category)}
      />
      <PublicFooter locale={l} />
    </div>
  );
}
