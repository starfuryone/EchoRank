// /[locale]/enterprise/contact — the sales contact form. Every "Talk to us" and
// Enterprise contact link points here with ?src= naming where it came from
// (salesContactHref, src/lib/sales/inquiry-options.ts). Submissions:
// /api/free/v1/sales-inquiry → src/lib/sales/inquiries.ts.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { SALES_COPY, salesLocale } from "@/lib/sales/inquiry-copy";
import { cleanSource } from "@/lib/sales/inquiry-options";
import { PublicNav } from "../../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import s from "../../home2.module.css";
import f from "./contact.module.css";
import { ContactForm } from "./contact-form";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const c = SALES_COPY[salesLocale(locale)];
  return buildMetadata({ locale, path: "/enterprise/contact", title: `${c.title} · Echorank`, description: c.intro });
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ src?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const raw = (await searchParams).src;
  const src = cleanSource(Array.isArray(raw) ? raw[0] : raw);
  const c = SALES_COPY[salesLocale(locale)];
  return (
    <div className={s.page}>
      <PublicNav locale={locale} />
      <section className={s.hero} id="contact">
        <div className={`${s.container} ${f.wrap}`}>
          <p className={s.label}>Enterprise</p>
          <h1 className={s.h1}>{c.title}</h1>
          <p className={s.sub}>{c.intro}</p>
          <ContactForm locale={locale} src={src} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
        </div>
      </section>
      <PublicFooter locale={locale} />
    </div>
  );
}
