// /[locale]/privacy/complaint — the public data-protection complaint form.
// Public (the locale branch of the proxy returns before the auth gate) and in
// LOCALIZED_ROUTES, so a locale-less /privacy/complaint 308s here.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { COMPLAINT_PAGE_COPY, complaintLocale } from "@/lib/privacy/complaint-copy";
import lp from "../../legal/legal.module.css";
import { ComplaintForm } from "./complaint-form";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const c = COMPLAINT_PAGE_COPY[complaintLocale(locale)];
  return buildMetadata({ locale, path: "/privacy/complaint", title: c.title, description: c.intro });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const c = COMPLAINT_PAGE_COPY[complaintLocale(locale)];
  return (
    <div className={lp.page}>
      <div className={lp.wrap}>
        <div className={lp.top}>
          <Link href={`/${locale}`} aria-label="Echorank360, home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/echorank-logo-dark.svg" alt="ECHORANK 360" className={lp.logo} />
          </Link>
        </div>
        <h1 className={lp.h1}>{c.title}</h1>
        <p className={lp.p}>{c.intro}</p>
        <ComplaintForm locale={locale} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
        <p className={lp.p}>{c.ico}</p>
      </div>
    </div>
  );
}
