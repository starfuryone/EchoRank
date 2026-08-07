// Cookie Policy — one of the four documents the checkout consent gate requires.
//
// Same typed-Doc + shared-chrome pattern as legal/terms and the Subscription
// Agreement. EN body only for this pass; fr and de-CH get localized chrome plus
// the "currently in English" banner.
//
// Route is /legal/cookies rather than /legal/cookie-policy, matching the
// one-word sibling routes (privacy, terms, disclaimer).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import { buildMetadata } from "@/lib/seo";
import BackButton from "../back-button";
import lp from "../legal.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

import { buildCookies } from "../_content/cookies";
import { LegalBody } from "../_content/types";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const d = buildCookies(locale);
  return buildMetadata({
    locale,
    path: "/legal/cookies",
    title: d.title,
    description: d.description,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const d = buildCookies(locale);
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
