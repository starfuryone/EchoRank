// The guides index: /[locale]/learn/guides.
//
// Two sections, both rendered from LEARN_GUIDES: the crawler guides (group
// "nosy-bat"), anchored at #nosy-bat — the one place their four cards live;
// the mega menu, the public /site-crawler page and the crawler's own header
// all link here rather than repeating them — and the ultimate guides.
//
// LOCALE MODEL: en/fr chrome like the hub; card titles and blurbs use the
// guide's French where written. Canonical to en, like the hub: the page is a
// list of links, and its English and French twins list the same things.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import { buildMetadata } from "@/lib/seo";
import { JsonLd } from "@/lib/seo/JsonLd";
import { breadcrumbList, organization, webSite } from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/seo/constants";
import { LEARN_BASE, LEARN_GUIDES, guideCopy, type LearnGuide } from "@/lib/learn-content";
import { NOSY_BAT_GUIDES_ANCHOR } from "@/lib/learn-nosy-bat";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { PublicNav } from "../../PublicNav";
import { baseOf, type Base } from "../_shared/ArticleShell";
import s from "../../home2.module.css";
import c from "../_shared/learn.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

const NB = CRAWLER_BRAND.name;

const CHROME: Record<Base, {
  metaTitle: string;
  metaDescription: string;
  home: string;
  hub: string;
  kicker: string;
  h1: string;
  intro: string;
  nbLabel: string;
  nbH: string;
  nbSub: string;
  ultimateH: string;
  ultimateSub: string;
  minRead: (n: number) => string;
}> = {
  en: {
    metaTitle: "Guides — the Echorank Knowledge Hub",
    metaDescription: `Step-by-step guides: technical SEO with the ${NB} crawler — broken links, XML sitemaps, custom extraction, site migrations — and deep dives on reputation and AI visibility.`,
    home: "Home",
    hub: "Knowledge Hub",
    kicker: "GUIDES",
    h1: "Guides",
    intro: "Walkthroughs you can follow with the product open beside them.",
    nbLabel: "TECHNICAL SEO WITH A CRAWLER",
    nbH: `${NB} guides`,
    nbSub: "Four walkthroughs, each with its diagrams: find what's broken, list what should be indexed, collect your own data, and move a site without losing a page.",
    ultimateH: "Ultimate guides",
    ultimateSub: "Deep dives on the topics the course can only touch.",
    minRead: (n) => `${n} min read`,
  },
  fr: {
    metaTitle: "Guides — le centre de connaissances Echorank",
    metaDescription: `Des guides pas à pas : le SEO technique avec le robot ${NB} — liens brisés, plans de site XML, extraction personnalisée, migrations — et des guides approfondis sur la réputation et la visibilité IA.`,
    home: "Accueil",
    hub: "Centre de connaissances",
    kicker: "GUIDES",
    h1: "Guides",
    intro: "Des marches à suivre à garder ouvertes à côté du produit.",
    nbLabel: "SEO TECHNIQUE AVEC UN ROBOT D'EXPLORATION",
    nbH: `Les guides ${NB}`,
    nbSub: "Quatre marches à suivre, chacune avec ses schémas : trouver ce qui est brisé, lister ce qui doit être indexé, recueillir vos propres données et déménager un site sans perdre une page.",
    ultimateH: "Guides approfondis",
    ultimateSub: "Les sujets que le cours ne fait qu'effleurer, traités à fond.",
    minRead: (n) => `${n} min de lecture`,
  },
};

const GUIDES_INDEX_PATH = `${LEARN_BASE}/guides`;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const t = CHROME[baseOf(locale)];
  return buildMetadata({
    locale,
    path: GUIDES_INDEX_PATH,
    title: t.metaTitle,
    description: t.metaDescription,
    canonicalLocale: "en",
  });
}

function Card({ g, locale }: { g: LearnGuide; locale: string }) {
  const b = baseOf(locale);
  const copy = guideCopy(g, b);
  const blurb = (b === "fr" && g.fr?.blurb) || g.blurb;
  return (
    <Link className={c.card} href={`/${locale}${LEARN_BASE}/guides/${g.slug}`}>
      <span className={c.cardTag}>{g.tag}</span>
      <h3 className={c.cardH}>{copy.title}</h3>
      <p className={c.cardP}>{blurb}</p>
      <p className={c.cardMeta}>{CHROME[b].minRead(g.readingTime)}</p>
    </Link>
  );
}

export default async function GuidesIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const b = baseOf(locale);
  const t = CHROME[b];
  const foot = CONTENT[locale as Locale].footer;
  const L = (p: string) => `/${locale}${p.startsWith("/") ? p : `/${p}`}`;
  const crawler = LEARN_GUIDES.filter((g) => g.group === "nosy-bat");
  const ultimate = LEARN_GUIDES.filter((g) => !g.group);

  const graph = [
    organization(locale),
    webSite(locale),
    breadcrumbList([
      { name: t.home, url: `${SITE_URL}/en` },
      { name: t.hub, url: `${SITE_URL}/en${LEARN_BASE}` },
      { name: t.h1, url: `${SITE_URL}/en${GUIDES_INDEX_PATH}` },
    ]),
  ];

  return (
    <div className={s.page}>
      <JsonLd graph={graph} />
      <PublicNav locale={locale} current="learn" />

      <div className={`${s.container} ${c.hero}`}>
        <nav className={c.crumbs} aria-label="Breadcrumb">
          <Link href={L(LEARN_BASE)}>{t.hub}</Link>
          <span aria-hidden="true">/</span>
          <span>{t.h1}</span>
        </nav>
        <p className={s.label}>
          <b>{t.kicker}</b>
        </p>
        <h1 className={c.heroH1}>{t.h1}</h1>
        <p className={c.heroSub}>{t.intro}</p>
      </div>

      <section className={s.section} id={NOSY_BAT_GUIDES_ANCHOR} data-testid="nosy-bat-guides">
        <div className={s.container}>
          <p className={s.label}>
            <b>/ {t.nbLabel}</b>
          </p>
          <h2 className={s.h2}>{t.nbH}</h2>
          <p className={s.sub} style={{ marginBottom: 24 }}>
            {t.nbSub}
          </p>
          <div className={c.grid}>
            {crawler.map((g) => (
              <Card key={g.slug} g={g} locale={locale} />
            ))}
          </div>
        </div>
      </section>

      <section className={s.section} id="ultimate">
        <div className={s.container}>
          <h2 className={s.h2}>{t.ultimateH}</h2>
          <p className={s.sub} style={{ marginBottom: 24 }}>
            {t.ultimateSub}
          </p>
          <div className={c.grid}>
            {ultimate.map((g) => (
              <Card key={g.slug} g={g} locale={locale} />
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
