// /[locale]/learn/aeo/worksheet — the learner's AEO plan, as an editable form.
// Saved in this browser only (localStorage, with an in-memory fallback), never
// sent anywhere. noindex: a personal form is not a search result; canonical →
// the course hub.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/seo/constants";
import { AEO_BASE, AEO_COPY, AEO_PLAN, AEO_WORKSHEET } from "@/lib/aeo-course";
import { LEARN_BASE } from "@/lib/learn-content";
import { PublicNav } from "../../../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { Worksheet } from "@/components/aeo-course/Worksheet";
import { AEO_CHROME, baseOf } from "@/components/aeo-course/LessonParts";
import home from "../../../home2.module.css";
import css from "@/components/aeo-course/aeo.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const m = buildMetadata({
    locale,
    path: AEO_WORKSHEET,
    title: `${AEO_COPY.worksheet.title} · AEO course`,
    description: AEO_COPY.worksheet.lead,
    noIndex: true,
  });
  return { ...m, alternates: { canonical: `${SITE_URL}/en${AEO_BASE}` } };
}

export default async function AeoWorksheetPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const L = (p: string) => `/${locale}${p}`;
  const t = AEO_CHROME[baseOf(locale)];
  const W = AEO_COPY.worksheet;
  return (
    <div className={`${home.page} ${css.root}`}>
      <PublicNav locale={locale} current="learn" />
      <main className={css.wrap} style={{ paddingTop: 32, paddingBottom: 64, maxWidth: 860 }}>
        <nav className={css.crumbs} aria-label="Breadcrumb">
          <Link href={L(LEARN_BASE)}>{t.learn}</Link>
          <span aria-hidden="true">/</span>
          <Link href={L(AEO_BASE)}>{AEO_COPY.hubCrumb}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{W.title}</span>
        </nav>
        <h1 className={css.lessonH1}>{W.title}</h1>
        <p className={css.lead}>{W.lead}</p>
        {t.notice && <p className={css.notice}>{t.notice}</p>}
        <Worksheet
          sections={AEO_PLAN.map((s) => ({
            section: s.section,
            title: s.title,
            label: s.module ? AEO_COPY.moduleN(s.module) : undefined,
            fields: s.fields,
          }))}
          copy={{ ...W, heading: `${W.title} (${AEO_COPY.hubCrumb})` }}
        />
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
