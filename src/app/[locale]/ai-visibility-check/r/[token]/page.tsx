// /[locale]/ai-visibility-check/r/<token> — a shared check report. Public to
// whoever holds the link, never indexed, 30 days from the last email unlock.
// Server-rendered from the stored report: no client fetch, no run id.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isSupportedLocale } from "@/lib/i18n/config";
import { SNAPSHOT_COPY, snapshotBaseOf } from "@/lib/snapshot/copy";
import { getByShareToken } from "@/lib/snapshot/store";
import { ShareLink, SnapshotFullView, SnapshotUpsell } from "@/components/snapshot/SnapshotReportView";
import st from "@/components/snapshot/snapshot.module.css";
import { SITE_URL } from "@/lib/seo";
import { PublicNav } from "../../../PublicNav";
import { AiVisibilityLogo } from "@/components/brand/AiVisibilityLogo";
import { PublicFooter } from "@/components/PublicFooter";
import s from "../../../home2.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const c = SNAPSHOT_COPY[snapshotBaseOf(locale)];
  return { title: c.share.metaTitle, robots: { index: false, follow: false } };
}

export default async function Page({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const c = SNAPSHOT_COPY[snapshotBaseOf(locale)];
  const run = await getByShareToken(token);

  return (
    <div className={s.page}>
      <PublicNav locale={locale} />
      <section className={s.hero}>
        <div className={s.container}>
          <AiVisibilityLogo height={40} surface="themed" className={st.avLogo} testId="av-result-logo" />
          {run?.report ? (
            <>
              <p className={s.label}>
                <b>/ 01</b> — {c.eyebrow}
              </p>
              <h1 className={s.h2}>{c.share.title.replace("{brand}", run.report.brand)}</h1>
              <p className={s.sub}>{run.report.domain}</p>
              <div className={st.card}>
                <SnapshotFullView r={run.report} c={c} />
                <ShareLink
                  url={`${SITE_URL}/${locale}/ai-visibility-check/r/${token}`}
                  expiresAt={run.shareExpiresAt?.toISOString() ?? null}
                  c={c}
                  locale={locale}
                />
              </div>
              <SnapshotUpsell c={c} locale={locale} snapshotId={run.id} />
            </>
          ) : (
            <>
              <h1 className={s.h2}>{c.share.expired}</h1>
              <p className={s.sub}>{c.share.expiredBody}</p>
              <p style={{ marginTop: 22 }}>
                <Link className={`${s.btn} ${s.btnPrimary}`} href={`/${locale}/ai-visibility-check`}>
                  {c.share.runYours}
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
      <PublicFooter locale={locale} />
    </div>
  );
}
