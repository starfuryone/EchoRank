// /[locale]/solutions/[category] — index of one category's items.
//
// Renders from the same taxonomy config as the item pages and the nav, reusing
// the /use-cases card styling so the two goal-led surfaces look like one system.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { SOLUTION_CATEGORIES, categoryBySlug, solutionBase } from "@/lib/solutions-taxonomy";
import { PublicNav } from "../../PublicNav";
import s from "../../home2.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    SOLUTION_CATEGORIES.map((c) => ({ locale, category: c.slug })),
  );
}

type Params = Promise<{ locale: string; category: string }>;

const COPY = {
  en: { ctaTrial: "Start 7-day trial ↗" },
  fr: { ctaTrial: "Essai gratuit de 7 jours ↗" },
} as const;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, category } = await params;
  if (!isSupportedLocale(locale)) return {};
  const cat = categoryBySlug(category);
  if (!cat) return {};
  const c = cat[solutionBase(locale)];
  return buildMetadata({
    locale,
    path: `/solutions/${category}`,
    title: c.h1,
    description: c.intro,
  });
}

export default async function Page({ params }: { params: Params }) {
  const { locale, category } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const cat = categoryBySlug(category);
  if (!cat) notFound();

  const l = locale as Locale;
  const base = solutionBase(l);
  const c = cat[base];

  return (
    <div className={s.page}>
      <PublicNav locale={l} current="solutions" />
      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 01</b> — {c.label.toUpperCase()}</p>
          <h1 className={s.h1}>{c.h1}</h1>
          <p className={s.sub}>{c.intro}</p>
          <div className={s.ucGrid} style={{ marginTop: 28 }}>
            {cat.items.map((item) => (
              <Link
                key={item.slug}
                href={`/${l}/solutions/${cat.slug}/${item.slug}`}
                className={s.ucCard}
              >
                <span className={s.ucTitle}>{item[base].label}</span>
                <span className={s.ucBody}>{item[base].desc}</span>
              </Link>
            ))}
          </div>
          <div className={s.ctarow} style={{ marginTop: 28 }}>
            <Link className={`${s.btn} ${s.btnPrimary}`} href={`/${l}/pricing`}>{COPY[base].ctaTrial}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
