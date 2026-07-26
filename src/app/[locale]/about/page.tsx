// app/[locale]/about/page.tsx — company / platform overview.
//
// Copy lives in content.ts (ABOUT), all five locales, matching how the other
// marketing sub-pages source their strings. Layout reuses the legal prose
// stylesheet rather than introducing a near-duplicate module.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { ABOUT, CONTENT } from "@/lib/i18n/content";
import lp from "../legal/legal.module.css";
import {
  JsonLd,
  SITE_URL as SITE,
  buildMetadata,
  normalizeLocale,
  organization,
  webSite,
} from "@/lib/seo";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const a = ABOUT[locale];
  return buildMetadata({
    locale,
    path: "/about",
    title: a.meta.title,
    description: a.meta.description,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();

  const a = ABOUT[locale];
  const nav = CONTENT[locale].nav;
  const foot = CONTENT[locale].footer;

  const l = normalizeLocale(locale);

  return (
    <div className={lp.page}>
      <JsonLd
        graph={[
          { ...organization(l), email: a.contact.email },
          webSite(l),
          {
            "@type": "AboutPage",
            "@id": `${SITE}/${l}/about#page`,
            url: `${SITE}/${l}/about`,
            name: a.meta.title,
            description: a.meta.description,
            about: { "@id": `${SITE}/#organization` },
            inLanguage: l,
          },
        ]}
      />
      <div className={lp.wrap}>
        <div className={lp.top}>
          <Link href={`/${locale}`} aria-label="Echorank360, home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/echorank-logo-dark.svg" alt="ECHORANK 360" className={lp.logo} />
          </Link>
          <Link href="/register">{nav.cta}</Link>
        </div>

        <div className={lp.backRow}>
          <Link href={`/${locale}`} className={lp.backBtnSolid}>{a.backHome}</Link>
        </div>

        <h1 className={lp.h1}>{a.h1}</h1>
        <p className={lp.updated}>{a.lede}</p>

        {a.sections.map((s) => (
          <section key={s.h2}>
            <h2 className={lp.h2}>{s.h2}</h2>
            {s.body.map((p, i) => (<p key={i} className={lp.p}>{p}</p>))}
          </section>
        ))}

        <section>
          <h2 className={lp.h2}>{a.contact.h2}</h2>
          <p className={lp.p}>{a.contact.body}</p>
          <p className={lp.p}>
            <a href={`mailto:${a.contact.email}`}>{a.contact.email}</a>
          </p>
        </section>

        <div className={lp.backRowBottom}>
          <Link href={`/${locale}`} className={lp.backBtnSolid}>{a.backHome}</Link>
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
