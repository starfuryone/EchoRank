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

const SITE = "https://echorank360.com";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const a = ABOUT[locale];
  const url = `${SITE}/${locale}/about`;

  return {
    // `absolute` — the copy already carries the brand, so the root layout's
    // "%s | EchoRank 360" template would double it.
    title: { absolute: a.meta.title },
    description: a.meta.description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries([
        ...SUPPORTED_LOCALES.map((l) => [l, `${SITE}/${l}/about`]),
        ["x-default", `${SITE}/en/about`],
      ]),
    },
    openGraph: {
      title: a.meta.title,
      description: a.meta.description,
      url,
      siteName: "EchoRank 360",
      type: "website",
      locale: locale.replace("-", "_"),
      images: [{ url: `${SITE}/og-home.png`, width: 1200, height: 630, alt: a.meta.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: a.meta.title,
      description: a.meta.description,
      images: [`${SITE}/og-home.png`],
    },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();

  const a = ABOUT[locale];
  const nav = CONTENT[locale].nav;
  const foot = CONTENT[locale].footer;

  // Organization node, referencing the site-wide entity from the root layout by
  // @id. No sameAs — the codebase holds no verified social profile URLs, and
  // inventing them would be fabricated structured data.
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE}/#organization`,
        name: "EchoRank 360",
        legalName: "ChatLogic Insights Ltd",
        url: SITE,
        logo: `${SITE}/echorank-logo.svg`,
        // No `description` here: the root layout already publishes one under
        // this same @id, and two different values for one entity is ambiguous.
        email: a.contact.email,
      },
      {
        "@type": "AboutPage",
        "@id": `${SITE}/${locale}/about#page`,
        url: `${SITE}/${locale}/about`,
        name: a.meta.title,
        description: a.meta.description,
        about: { "@id": `${SITE}/#organization` },
        inLanguage: locale,
      },
    ],
  };

  return (
    <div className={lp.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
      />
      <div className={lp.wrap}>
        <div className={lp.top}>
          <Link href={`/${locale}`} aria-label="EchoRank 360, home">
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
