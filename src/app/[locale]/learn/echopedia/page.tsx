// Echopedia — the glossary: /[locale]/learn/echopedia.
//
// One anchor per term and an A–Z jump row. Both the anchors and the
// DefinedTermSet markup derive from ECHOPEDIA_TERMS, so a term cannot be
// defined in the markup and missing from the structured data.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import { buildMetadata } from "@/lib/seo";
import { JsonLd } from "@/lib/seo/JsonLd";
import { breadcrumbList, definedTermSet, organization, webSite } from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/seo/constants";
import {
  ECHOPEDIA_DESCRIPTION,
  ECHOPEDIA_SLUG,
  ECHOPEDIA_TERMS,
  ECHOPEDIA_TITLE,
  LEARN_BASE,
  headingId,
} from "@/lib/learn-content";
import { PublicNav } from "../../PublicNav";
import { baseOf } from "../_shared/ArticleShell";
import s from "../../home2.module.css";
import c from "../_shared/learn.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

const CHROME = {
  en: {
    title: "Echopedia — the reputation & AI visibility glossary",
    hub: "Knowledge Hub",
    home: "Home",
    eyebrow: "GLOSSARY",
    jump: "Jump to a letter",
    count: (n: number) => `${n} terms`,
  },
  fr: {
    title: "Echopedia — le glossaire de la réputation et de la visibilité IA",
    hub: "Centre de connaissances",
    home: "Accueil",
    eyebrow: "GLOSSAIRE",
    jump: "Aller à une lettre",
    count: (n: number) => `${n} termes`,
  },
} as const;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** First letter of a term, uppercased. Terms are English, so A–Z covers them. */
const letterOf = (term: string) => term.charAt(0).toUpperCase();

const anchorOf = (term: string) => headingId(term);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  return buildMetadata({
    locale,
    path: `${LEARN_BASE}/${ECHOPEDIA_SLUG}`,
    title: CHROME[baseOf(locale)].title,
    description: ECHOPEDIA_DESCRIPTION,
    canonicalLocale: "en",
  });
}

export default async function EchopediaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();

  const b = baseOf(locale);
  const t = CHROME[b];
  const foot = CONTENT[locale as Locale].footer;
  const L = (p: string) => `/${locale}${p.startsWith("/") ? p : `/${p}`}`;
  const pageUrl = `${SITE_URL}/en${LEARN_BASE}/${ECHOPEDIA_SLUG}`;

  // Group by initial, preserving the config's order inside each letter.
  const groups = ALPHABET.map((letter) => ({
    letter,
    terms: ECHOPEDIA_TERMS.filter((term) => letterOf(term.term) === letter),
  })).filter((g) => g.terms.length > 0);
  const present = new Set(groups.map((g) => g.letter));

  const graph = [
    organization(locale),
    webSite(locale),
    definedTermSet({
      name: ECHOPEDIA_TITLE,
      description: ECHOPEDIA_DESCRIPTION,
      pageUrl,
      inLanguage: "en",
      terms: ECHOPEDIA_TERMS.map((term) => ({
        name: term.term,
        description: term.definition,
        anchor: anchorOf(term.term),
      })),
    }),
    breadcrumbList([
      { name: t.home, url: `${SITE_URL}/en` },
      { name: t.hub, url: `${SITE_URL}/en${LEARN_BASE}` },
      { name: ECHOPEDIA_TITLE, url: pageUrl },
    ]),
  ];

  return (
    <div className={s.page}>
      <JsonLd graph={graph} />
      <PublicNav locale={locale} current="learn" />

      <section className={s.section}>
        <div className={s.container}>
          <nav className={c.crumbs} aria-label="Breadcrumb">
            <Link href={L(LEARN_BASE)}>{t.hub}</Link>
            <span aria-hidden="true">/</span>
            <span>Echopedia</span>
          </nav>

          <p className={s.label}>
            <b>/ {t.eyebrow}</b> — {t.count(ECHOPEDIA_TERMS.length)}
          </p>
          <h1 className={c.articleH1}>{ECHOPEDIA_TITLE}</h1>
          <p className={c.articleLede}>{ECHOPEDIA_DESCRIPTION}</p>

          <nav className={c.azRow} aria-label={t.jump}>
            {ALPHABET.map((letter) =>
              present.has(letter) ? (
                <a key={letter} className={c.azLink} href={`#letter-${letter}`}>
                  {letter}
                </a>
              ) : (
                <span key={letter} className={c.azOff} aria-hidden="true">
                  {letter}
                </span>
              ),
            )}
          </nav>

          <div className={c.article}>
            {groups.map((g) => (
              <section className={c.azGroup} key={g.letter}>
                <h2 className={c.azHead} id={`letter-${g.letter}`}>
                  {g.letter}
                </h2>
                <div className={c.terms}>
                  {g.terms.map((term) => (
                    <div className={c.term} key={term.term} id={anchorOf(term.term)}>
                      <h3 className={c.termName}>{term.term}</h3>
                      <p className={c.termDef}>{term.definition}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <div className={s.footin}>
            <span>{foot.copyright}</span>
            <span>
              {foot.links.map((l) => (
                <Link key={l.label} href={L(l.href)} style={{ marginLeft: 14 }}>
                  {l.label}
                </Link>
              ))}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
