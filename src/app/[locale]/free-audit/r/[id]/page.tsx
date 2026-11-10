// /[locale]/free-audit/r/{id} — a free AI Readiness Audit result's permalink
// (ECHORANK-AI-VISIBILITY-PAGES.md Phase 2): the stored result, valid for
// FREE_AUDIT_RESULT_DAYS from the run, under an unguessable 24-character id
// (src/lib/free-audit/store.ts). Never indexed. After the 7 days, or for an
// unknown id, the page says the result expired and offers a new audit; it
// does not 404, so a shared link explains itself.

import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isSupportedLocale } from "@/lib/i18n/config";
import { isBlockedCountry } from "@/lib/geo/blocked-countries";
import { AUDIT_COPY, AUDIT_NAME, auditBaseOf } from "@/lib/free-audit/copy";
import { benchmarkFor } from "@/lib/free-audit/benchmark";
import { resultFacts } from "@/lib/free-audit/facts";
import { FREE_AUDIT_RESULT_DAYS } from "@/lib/free-audit/limits";
import { getResult } from "@/lib/free-audit/store";
import { scoreVersionOf } from "@/lib/visibility-score";
import { FreeAuditResult } from "@/components/free-audit/FreeAuditResult";
import { PublicNav } from "../../../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import s from "../../../home2.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const base = auditBaseOf(locale);
  return { title: AUDIT_NAME[base], robots: { index: false, follow: false } };
}

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const base = auditBaseOf(locale);
  const c = AUDIT_COPY[base];
  const stored = await getResult(id);

  let body: React.ReactNode;
  if (!stored) {
    body = (
      <div data-testid="audit-expired">
        <h1 className={s.h1}>{c.result.expired.title}</h1>
        <p className={s.sub}>{c.result.expired.body(FREE_AUDIT_RESULT_DAYS)}</p>
        <div className={s.ctarow} style={{ marginTop: 22 }}>
          <Link className={`${s.btn} ${s.btnPrimary}`} href={`/${locale}/free-audit`}>
            {c.result.expired.cta}
          </Link>
        </div>
      </div>
    );
  } else {
    const audit = stored.audit;
    const score = typeof audit.score === "number" ? Math.round(audit.score) : 0;
    const country = (await headers()).get("cf-ipcountry");
    body = (
      <>
        <p className={s.label}>
          <b>/ 01</b> — {AUDIT_NAME[base]}
        </p>
        <FreeAuditResult
          audit={audit}
          facts={resultFacts(locale)}
          extras={{
            resultId: stored.id,
            benchmark: await benchmarkFor(score, scoreVersionOf(audit)),
            emailAllowed: !isBlockedCountry(country),
          }}
        />
      </>
    );
  }

  return (
    <div className={s.page}>
      <PublicNav locale={locale} />
      <section className={s.hero}>
        <div className={s.container}>{body}</div>
      </section>
      <PublicFooter locale={locale} />
    </div>
  );
}
