// /[locale]/solutions/[category]/[slug] — the 25 Solutions landing pages.
//
// ONE ROUTE, NOT 25 FILES. Every page renders from src/lib/solutions-taxonomy.ts,
// so adding an item is a config edit that produces a page, a nav link, a
// category card and a sitemap entry at once. Twenty-five near-identical page
// files is the shape that drifts: one of them keeps an old CTA and nobody
// notices for a year.
//
// Same visual language as /use-cases — home2 module classes, the /01 /02
// section-label pattern, Binance tokens.
//
// Metadata comes from buildMetadata, which already emits the canonical and the
// full five-locale hreflang set, so nothing is hand-rolled here.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import {
  FEATURES,
  SOLUTION_CATEGORIES,
  categoryBySlug,
  itemBySlug,
  solutionBase,
} from "@/lib/solutions-taxonomy";
import { longformFor } from "@/lib/solutions-longform";
import { PublicNav } from "../../../PublicNav";
import s from "../../../home2.module.css";

/** locale x category x slug — 5 x 25 = 125 static pages. */
export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    SOLUTION_CATEGORIES.flatMap((c) =>
      c.items.map((i) => ({ locale, category: c.slug, slug: i.slug })),
    ),
  );
}

type Params = Promise<{ locale: string; category: string; slug: string }>;

const COPY = {
  en: { ctaTrial: "Start 7-day trial ↗", helps: "HOW ECHORANK360 HELPS", closeH2: "Not sure where to start?", closeSub: "Run the free AI visibility audit. No account needed, and it takes about a minute.", ctaAudit: "Run my free audit ↗" },
  fr: { ctaTrial: "Essai gratuit de 7 jours ↗", helps: "COMMENT ECHORANK360 VOUS AIDE", closeH2: "Vous ne savez pas par où commencer ?", closeSub: "Lancez l'audit de visibilité IA gratuit. Sans compte, en une minute environ.", ctaAudit: "Lancer mon audit gratuit ↗" },
} as const;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, category, slug } = await params;
  if (!isSupportedLocale(locale)) return {};
  const item = itemBySlug(category, slug);
  if (!item) return {};
  const c = item[solutionBase(locale)];
  return buildMetadata({
    locale,
    path: `/solutions/${category}/${slug}`,
    title: c.h1,
    description: c.desc,
  });
}

export default async function Page({ params }: { params: Params }) {
  const { locale, category, slug } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const cat = categoryBySlug(category);
  const item = itemBySlug(category, slug);
  // An unknown category, an unknown slug, or a real slug under the WRONG
  // category all 404 — itemBySlug only looks inside the category given.
  if (!cat || !item) notFound();

  const l = locale as Locale;
  const base = solutionBase(l);
  const c = item[base];
  const t = COPY[base];
  const link = (href: string) => `/${l}${href}`;
  // Optional. Items without it render exactly as they did before — the whole
  // block is skipped rather than emitting an empty section.
  const longform = longformFor(item.slug, base);

  return (
    <div className={s.page}>
      <PublicNav locale={l} current="solutions" />

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 01</b> — <Link href={link(`/solutions/${cat.slug}`)}>{cat[base].label}</Link>
          </p>
          <h1 className={s.h1}>{c.h1}</h1>
          <p className={s.sub}>{c.intro}</p>
          <div className={s.ctarow} style={{ marginTop: 24 }}>
            <Link className={`${s.btn} ${s.btnPrimary}`} href={link("/pricing")}>{t.ctaTrial}</Link>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 02</b> — {t.helps}</p>
          <div className={s.ucGrid}>
            {c.features.map((f) => (
              <Link key={f.href} href={link(f.href)} className={s.ucCard}>
                <span className={s.ucTitle}>{FEATURES[f.href][base]}</span>
                <span className={s.ucBody}>{f.why}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Section numbering continues from the cards: /03, /04, … */}
      {longform?.sections.map((sec, i) => (
        <section key={sec.h2} className={s.section}>
          <div className={s.container}>
            <p className={s.label}><b>/ {String(i + 3).padStart(2, "0")}</b></p>
            <h2 className={s.h2}>{sec.h2}</h2>
            {sec.paras.map((para, j) => (
              <p key={j} className={s.sub} style={{ maxWidth: 760, marginTop: j === 0 ? 10 : 14 }}>
                {para}
              </p>
            ))}
          </div>
        </section>
      ))}

      <section className={s.section}>
        <div className={s.container}>
          <h2 className={s.h2}>{t.closeH2}</h2>
          <p className={s.sub}>{t.closeSub}</p>
          <div className={s.ctarow} style={{ marginTop: 22 }}>
            <Link className={`${s.btn} ${s.btnPrimary}`} href={link("/ai-visibility#audit")}>{t.ctaAudit}</Link>
            <Link className={`${s.btn} ${s.btnGhost}`} href={link("/pricing")}>{t.ctaTrial}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
