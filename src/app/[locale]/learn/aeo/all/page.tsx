// /[locale]/learn/aeo/all — every lesson on one page, for printing and offline
// reading. Same blocks and graphics as the lesson pages; the knowledge checks
// are left out. noindex, canonical → the course hub (each lesson already has
// its own indexable page).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/seo/constants";
import { AEO_ALL, AEO_BASE, AEO_COPY, AEO_LESSONS, AEO_PLAN, aeoLessonPath, aeoModule } from "@/lib/aeo-course";
import { PublicNav } from "../../../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { AEO_CHROME, LessonBlocks, baseOf } from "@/components/aeo-course/LessonParts";
import home from "../../../home2.module.css";
import css from "@/components/aeo-course/aeo.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const m = buildMetadata({ locale, path: AEO_ALL, title: AEO_COPY.all.title, description: AEO_COPY.all.lead, noIndex: true });
  return { ...m, alternates: { canonical: `${SITE_URL}/en${AEO_BASE}` } };
}

export default async function AeoAllPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const L = (p: string) => `/${locale}${p}`;
  const t = AEO_CHROME[baseOf(locale)];
  return (
    <div className={`${home.page} ${css.root}`}>
      <PublicNav locale={locale} current="learn" />
      <main className={css.wrap} style={{ paddingTop: 32, paddingBottom: 64, maxWidth: 860 }}>
        <nav className={css.crumbs} aria-label="Breadcrumb">
          <Link href={L(AEO_BASE)}>{AEO_COPY.hubCrumb}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{AEO_COPY.all.title}</span>
        </nav>
        <h1 className={css.lessonH1}>{AEO_COPY.all.title}</h1>
        <p className={css.lead}>{AEO_COPY.all.lead}</p>
        {t.notice && <p className={css.notice}>{t.notice}</p>}
        {AEO_LESSONS.map((l, i) => {
          const section = AEO_PLAN.find((s) => s.section === l.practice.section)!;
          return (
            <section key={l.slug} className={css.section} aria-labelledby={`all-${l.slug}`}>
              <p className={css.eyebrow}>
                {AEO_COPY.moduleN(l.module)} · {aeoModule(l.module)?.title} · {AEO_COPY.lessonN(i + 1)}
              </p>
              <h2 id={`all-${l.slug}`} className={css.lessonH1} style={{ fontSize: 30 }}>
                <Link href={L(aeoLessonPath(l.slug))}>{l.title}</Link>
              </h2>
              <p className={css.lead}>{l.summary}</p>
              <LessonBlocks body={l.body} locale={locale} />
              <div className={css.closing}>
                <h3>{AEO_COPY.takeaways}</h3>
                <ul className={css.takeaways}>
                  {l.takeaways.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
                <h3>{AEO_COPY.practice}</h3>
                <div className={css.practice}>
                  <p>{AEO_COPY.practiceSection(section.title)}</p>
                  <ol>
                    {l.practice.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </section>
          );
        })}
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
