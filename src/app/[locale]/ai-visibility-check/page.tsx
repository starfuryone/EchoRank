// /[locale]/ai-visibility-check — the free AI Visibility Check: ten real
// questions through ChatGPT and Gemini (src/lib/snapshot). The widget posts to
// /api/free/v1/snapshot, which is public, so the whole check runs without an
// account; the email gate unlocks the full report and the PDF.
//
// Same page shell as /free-audit: home2.module.css on a wrapping .page, where
// the palette tokens live.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { JsonLd, SITE_URL, buildMetadata, normalizeLocale, organization } from "@/lib/seo";
import { SNAPSHOT_COPY, snapshotBaseOf } from "@/lib/snapshot/copy";
import { SnapshotCheck } from "@/components/snapshot/SnapshotCheck";
import { SnapshotUpsell } from "@/components/snapshot/SnapshotReportView";
import st from "@/components/snapshot/snapshot.module.css";
import { PublicNav } from "../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import s from "../home2.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const c = SNAPSHOT_COPY[snapshotBaseOf(locale)];
  return buildMetadata({ locale, path: "/ai-visibility-check", title: c.metaTitle, description: c.metaDescription });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const c = SNAPSHOT_COPY[snapshotBaseOf(locale)];
  const l = normalizeLocale(locale);
  const pageUrl = `${SITE_URL}/${l}/ai-visibility-check`;

  return (
    <div className={s.page}>
      <JsonLd
        graph={[
          organization(l),
          {
            "@type": "WebPage",
            "@id": `${pageUrl}#webpage`,
            url: pageUrl,
            name: c.metaTitle,
            description: c.metaDescription,
            inLanguage: l,
            isPartOf: { "@id": `${SITE_URL}/#website` },
            publisher: { "@id": `${SITE_URL}/#organization` },
          },
        ]}
      />
      <PublicNav locale={locale} />

      <section className={s.hero}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 01</b> — {c.eyebrow}
          </p>
          <h1 className={s.h1}>{c.h1}</h1>
          <p className={s.sub}>{c.sub}</p>
          <ul className={st.pills}>
            {c.pills.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <SnapshotCheck c={c} locale={locale} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <SnapshotUpsell c={c} locale={locale} />
        </div>
      </section>

      <PublicFooter locale={locale} />
    </div>
  );
}
