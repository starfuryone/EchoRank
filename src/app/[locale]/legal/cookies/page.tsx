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

type Doc = { title: string; updated: string; sections: { h: string; ps: string[] }[] };

const EN: Doc = {
  title: "Cookie Policy",
  updated: "Last updated: August 7, 2026",
  sections: [
    { h: "Overview", ps: [
      "This Cookie Policy explains how Echorank360 (\"Service\"), operated by ChatLogic Insights LTD (\"we,\" \"us,\" \"our\"), uses cookies and similar technologies on echorank360.com.",
    ]},
    { h: "1. What Cookies Are", ps: [
      "Cookies are small text files stored on your device by your browser when you visit a website. They allow the site to recognise your browser, keep you signed in, remember your preferences, and understand how the site is used. Similar technologies (such as local storage) are covered by this policy as well.",
    ]},
    { h: "2. Cookies We Use", ps: [
      "2.1 Strictly Necessary. These are required for the Service to function and cannot be switched off. Authentication and session cookies keep you signed in to your dashboard and secure your session (set by our authentication system). Security cookies protect against cross-site request forgery and abuse. Infrastructure cookies are set by Cloudflare, our content delivery and security provider, to distinguish legitimate visitors from automated traffic and maintain site performance.",
      "2.2 Preferences. A locale cookie remembers your selected language and region so pages display in the right locale on return visits.",
      "2.3 Analytics. We use Google Analytics to understand how visitors use the site (pages visited, approximate location, device type) so we can improve the Service. These cookies collect information in aggregate form. You can opt out using Google's browser add-on at https://tools.google.com/dlpage/gaoptout.",
      "2.4 Payments. Subscription payments are processed by Stripe on Stripe-hosted pages. When you proceed to checkout, Stripe sets its own cookies for fraud prevention and payment processing, governed by Stripe's privacy and cookie policies.",
    ]},
    { h: "3. Third-Party Cookies", ps: [
      "Some cookies described above are set by third parties (Cloudflare, Google, Stripe). We do not control these cookies. Please refer to those providers' own policies for details on how they process data.",
    ]},
    { h: "4. Managing Cookies", ps: [
      "You can control and delete cookies through your browser settings — most browsers let you block or delete cookies entirely, or block third-party cookies only. Blocking strictly necessary cookies will prevent you from signing in and using the dashboard. Blocking analytics cookies does not affect Service functionality.",
    ]},
    { h: "5. Changes to This Policy", ps: [
      "We may update this policy from time to time. The \"Last updated\" date above reflects the latest revision. Material changes will be communicated via the Service or by email.",
    ]},
    { h: "6. Contact", ps: [
      "Questions about this policy: support@echorank360.com — ChatLogic Insights LTD",
    ]},
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  return buildMetadata({
    locale,
    path: "/legal/cookies",
    title: EN.title,
    description: EN.sections[0]?.ps[0],
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const d = EN;
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
        {d.sections.map((s) => (
          <section key={s.h}>
            <h2 className={lp.h2}>{s.h}</h2>
            {s.ps.map((p, i) => (<p key={i} className={lp.p}>{p}</p>))}
          </section>
        ))}
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
