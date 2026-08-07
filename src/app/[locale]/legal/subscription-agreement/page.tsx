// Subscription Agreement — the document the checkout consent gate keys off.
//
// Same shape as legal/terms: a typed Doc rendered through the shared legal
// chrome. Markdown was NOT introduced for it; the three existing legal pages are
// static TSX and a second rendering path for one document would be the harder
// thing to keep consistent.
//
// EN body only for this pass, per the brief. fr and de-CH get localized chrome
// plus the "currently in English" banner the other legal pages already use —
// an FR reader meeting an English body without notice is the worse outcome.
//
// §1.1's PRICE TABLE IS GENERATED FROM PLAN_CONFIGS, not typed out. A legal
// document that quotes a price the checkout does not charge is the one drift in
// here that actually matters, and this repo already guards the same numbers in
// the pricing grid and the JSON-LD offers. The yearly figure is annualPrice x 12
// because annualPrice is the per-month equivalent.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import { buildMetadata } from "@/lib/seo";
import { buildSubscriptionAgreement } from "../_content/subscription-agreement";
import { LegalBody } from "../_content/types";
import BackButton from "../back-button";
import lp from "../legal.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}


export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const d = buildSubscriptionAgreement(locale);
  return buildMetadata({
    locale,
    path: "/legal/subscription-agreement",
    title: d.title,
    description: d.description,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const d = buildSubscriptionAgreement(locale);
  const nav = CONTENT[locale as Locale].nav;
  const foot = CONTENT[locale as Locale].footer;
  const backLabel = locale.startsWith("fr") ? "← Retour" : locale === "de-CH" ? "← Zurück" : "← Back";
  const englishOnly = locale.startsWith("fr")
    ? "Cette page est actuellement disponible en anglais. Pour toute question : support@echorank360.com."
    : locale === "de-CH"
      ? "Diese Seite ist derzeit auf Englisch verfügbar. Bei Fragen: support@echorank360.com."
      : null;

  return (
    <div className={lp.page}>
      <div className={lp.wrap}>
        <div className={lp.top}>
          <Link href={`/${locale}`} aria-label="Echorank360, home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/echorank-logo-dark.svg" alt="ECHORANK 360" className={lp.logo} />
          </Link>
          {/* /pricing, not /register: marketing CTAs route through pricing now. */}
          <Link href={`/${locale}/pricing`}>{nav.cta}</Link>
        </div>
        <div className={lp.backRow}>
          <BackButton locale={locale} label={backLabel} className={lp.backBtnSolid} />
        </div>
        {englishOnly && <p className={lp.banner}>{englishOnly}</p>}
        <h1 className={lp.h1}>{d.title}</h1>
        <p className={lp.updated}>{d.updated}</p>
        <LegalBody doc={d} headingClassName={lp.h2} paragraphClassName={lp.p} />
        <div className={lp.backRowBottom}>
          <BackButton locale={locale} label={backLabel} className={lp.backBtnSolid} />
        </div>
        <footer className={lp.footer}>
          <span>{foot.copyright}</span>
          <span>
            {foot.links.map((l) => (
              <Link key={l.label} href={`/${locale}${l.href}`}>{l.label}</Link>
            ))}
          </span>
        </footer>
      </div>
    </div>
  );
}
