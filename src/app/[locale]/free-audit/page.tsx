// /[locale]/free-audit — the free AI Readiness Audit (ECHORANK-AI-VISIBILITY-
// PAGES.md Phase 2, 2026-11-10). The URL and the "AI readiness score" stay;
// the tool's name is "AI Readiness Audit" everywhere it is shown.
//
// What it says it does is what it does: it reads the site the way AI crawlers
// do (access, readable content, identity, discoverability) and asks no AI
// engine anything. The form and the result are Client Components
// (src/components/free-audit/): the runner posts to /api/av/audit, the result
// view is shared with the 7-day permalink page (./r/[id]).
//
// The page is en or fr (src/lib/free-audit/copy.ts); de-CH and en-CA read en,
// fr-CA reads fr. Every number comes from limits.ts or the plan config.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { JsonLd, SITE_URL, buildMetadata, faqPage, normalizeLocale, organization } from "@/lib/seo";
import { AUDIT_COPY, AUDIT_NAME, auditBaseOf } from "@/lib/free-audit/copy";
import { resultFacts } from "@/lib/free-audit/facts";
import { FREE_AUDIT_DAILY_LIMIT, FREE_AUDIT_WINDOW_HOURS } from "@/lib/free-audit/limits";
import { AuditRunner } from "@/components/free-audit/AuditRunner";
import { PublicNav } from "../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import s from "../home2.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const c = AUDIT_COPY[auditBaseOf(locale)];
  return buildMetadata({ locale, path: "/free-audit", title: c.metaTitle, description: c.metaDescription(FREE_AUDIT_DAILY_LIMIT) });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const base = auditBaseOf(locale);
  const c = AUDIT_COPY[base];
  const L = (p: string) => `/${locale}${p}`;
  const l = normalizeLocale(locale);
  const pageUrl = `${SITE_URL}/${l}/free-audit`;
  const faq = c.faq.items(FREE_AUDIT_DAILY_LIMIT, FREE_AUDIT_WINDOW_HOURS);

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
            description: c.metaDescription(FREE_AUDIT_DAILY_LIMIT),
            inLanguage: l,
            isPartOf: { "@id": `${SITE_URL}/#website` },
            publisher: { "@id": `${SITE_URL}/#organization` },
          },
          faqPage(faq, pageUrl),
        ]}
      />

      <PublicNav locale={locale} />

      <section className={s.hero}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 01</b> — {c.label} · {AUDIT_NAME[base]}
          </p>
          <h1 className={s.h1}>{c.h1}</h1>
          <p className={s.sub}>{c.heroSub(FREE_AUDIT_DAILY_LIMIT)}</p>
          <AuditRunner facts={resultFacts(locale)} />
          <p className={s.label} style={{ marginTop: 18 }} data-testid="audit-tool-line">
            {c.toolLine}
          </p>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 02</b> — {c.what.label}
          </p>
          <h2 className={s.h2}>{c.what.title}</h2>
          <div className={s.ucGrid} style={{ marginTop: 28 }}>
            {c.what.items.map((it) => (
              <div key={it.h} className={s.ucCard}>
                <span className={s.ucTitle}>{it.h}</span>
                <span className={s.ucBody}>{it.p}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 03</b> — {c.how.label}
          </p>
          <h2 className={s.h2}>{c.how.title}</h2>
          <div className={s.ucGrid} style={{ marginTop: 28 }}>
            {c.how.steps.map((step, i) => (
              <div key={step.h} className={s.ucCard}>
                <span className={s.label}>
                  <b>{String(i + 1).padStart(2, "0")}</b>
                </span>
                <span className={s.ucTitle}>{step.h}</span>
                <span className={s.ucBody}>{step.p}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <h2 className={s.h2}>{c.cta.title}</h2>
          <p className={s.sub}>{c.cta.p}</p>
          <div className={s.ctarow} style={{ marginTop: 22 }}>
            {/* House rule: the primary marketing CTA goes to pricing, never straight to /register. */}
            <Link className={`${s.btn} ${s.btnPrimary}`} href={L("/pricing?plan=ai_visibility&src=free-audit-page")}>
              {c.cta.button}
            </Link>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 04</b> — {c.faq.label}
          </p>
          <h2 className={s.h2}>{c.faq.title}</h2>
          <div className={s.faq}>
            {faq.map((it) => (
              <div className={s.faqItem} key={it.q}>
                <p className={s.faqQ}>{it.q}</p>
                <p className={s.faqA}>{it.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter locale={locale} />
    </div>
  );
}
