// The public Knowledge Hub index: /[locale]/learn.
//
// Everything on this page renders from src/lib/learn-content.ts — the chapter
// list, the guide cards, and the Course structured data all read the same
// array, so a chapter cannot appear in the markup and be missing from the
// JSON-LD (or the reverse).
//
// LOCALE MODEL: en/fr chrome, en-CA folds to en, fr-CA to fr, de-CH shows
// English — the same convention as /resources and the guides. The articles
// themselves are English in every locale this pass, which is why every locale
// canonicals to the en URL.
//
// METADATA COMES FROM buildMetadata() AND NOWHERE ELSE. The root layout carries
// only a title template, which title.absolute bypasses; there is no second
// canonical or title emitted for this route. (This is the bug /visibility had
// in July — two metadata sources on one route.)

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT, HOME_TOOLS } from "@/lib/i18n/content";
import { buildMetadata } from "@/lib/seo";
import { JsonLd } from "@/lib/seo/JsonLd";
import { course, organization, webSite, videoObject } from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/seo/constants";
import {
  ECHOPEDIA_SLUG,
  LEARN_BASE,
  LEARN_CHAPTERS,
  LEARN_GUIDES,
  LEARN_PDF,
} from "@/lib/learn-content";
import { PublicNav } from "../PublicNav";
import { HomeVideo } from "../HomeVideo";
import { baseOf, type Base } from "./_shared/ArticleShell";
import s from "../home2.module.css";
import c from "./_shared/learn.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

/** The install walkthrough, reused from the extension download page. */
const WATCH_VIDEO = LEARN_GUIDES.find((g) => g.slug === "install-browser-extension")?.video;

interface HubChrome {
  metaTitle: string;
  metaDescription: string;
  kicker: string;
  h1a: string;
  h1b: string;
  intro: string;
  startCta: string;
  pdfCta: string;
  courseLabel: string;
  courseName: string;
  courseBlurb: string;
  courseCta: string;
  guidesH: string;
  guidesSub: string;
  toolsH: string;
  toolsSub: string;
  watchH: string;
  watchSub: string;
  watchWritten: string;
  watchWrittenLink: string;
  pdfH: string;
  pdfP: string;
  minRead: (n: number) => string;
  rowLinks: { href: string; label: string; icon: string; internal?: boolean }[];
}

// Row-link targets, shared by both locales so a path is edited in one place.
// /free-tools from the brief does not exist in this branch; the free audit
// widget is the free tool, so the row points at the thing that is actually
// live rather than at a 404.
const ROW = {
  extension: `${LEARN_BASE}/guides/install-browser-extension`,
  reviewsIn: "/extension/getting-reviews-in.html",
  tools: "/visibility/tools",
  mcp: "/visibility/tools/mcp-server",
  echopedia: `${LEARN_BASE}/${ECHOPEDIA_SLUG}`,
  audit: "/free-audit",
} as const;

const CHROME: Record<Base, HubChrome> = {
  en: {
    metaTitle: "Learn reputation & AI visibility — the Echorank Knowledge Hub",
    metaDescription:
      "A free ten-chapter course, five deep-dive guides and a glossary: audit your baseline, import your review history, generate and answer reviews, and get recommended by AI assistants.",
    kicker: "ECHORANK KNOWLEDGE HUB",
    h1a: "From beginner to trusted brand",
    h1b: "learn reputation & AI visibility step by step",
    intro:
      "Free, practical, and built from the field. Ten chapters, five deep-dive guides, and a glossary — everything in the complete Echorank guide, readable on the web.",
    startCta: "Start the course →",
    pdfCta: "Download the full guide (PDF)",
    courseLabel: "FLAGSHIP COURSE",
    courseName: "Learn Reputation & AI Visibility",
    courseBlurb:
      "The complete beginner-to-operator path: audit your baseline, import your review history, build the request habit, and turn what customers say into rankings and AI mentions. About an hour to read, 90 days to execute.",
    courseCta: "Start with Chapter 1 →",
    guidesH: "Ultimate guides",
    guidesSub: "Deep dives on the topics the course can only touch.",
    toolsH: "Tool guides & more",
    toolsSub: "Hands-on help for the Echorank toolset.",
    watchH: "Watch",
    watchSub: "The extension install, start to finish — two minutes.",
    watchWritten: "Written steps:",
    watchWrittenLink: "extension download page",
    pdfH: "Prefer it in one document?",
    pdfP:
      "The complete field guide — checklists, templates, case studies, and screenshots — as a PDF. No email required.",
    minRead: (n) => `${n} min read`,
    rowLinks: [
      { href: ROW.extension, label: "Extension install guide (with video)", icon: "🧩", internal: true },
      { href: ROW.reviewsIn, label: "Getting reviews in", icon: "📥" },
      { href: ROW.tools, label: "SEO Tools hub", icon: "🛠️" },
      { href: ROW.mcp, label: "Access API & MCP server", icon: "🤖" },
      { href: ROW.echopedia, label: "Echopedia — the glossary", icon: "📖", internal: true },
      { href: ROW.audit, label: "Free AI visibility audit", icon: "🆓", internal: true },
    ],
  },
  fr: {
    metaTitle: "Réputation et visibilité IA — le centre de connaissances Echorank",
    metaDescription:
      "Un cours gratuit en dix chapitres, cinq guides approfondis et un glossaire : faites votre état des lieux, importez vos avis, sollicitez et répondez, et faites-vous recommander par les assistants IA.",
    kicker: "CENTRE DE CONNAISSANCES ECHORANK",
    h1a: "Du point de départ à une marque de confiance",
    h1b: "la réputation et la visibilité IA, étape par étape",
    intro:
      "Gratuit, concret, et issu du terrain. Dix chapitres, cinq guides approfondis et un glossaire — tout le guide complet Echorank, lisible sur le web.",
    startCta: "Commencer le cours →",
    pdfCta: "Télécharger le guide complet (PDF)",
    courseLabel: "COURS PRINCIPAL",
    courseName: "Réputation et visibilité IA",
    courseBlurb:
      "Le parcours complet, du débutant à l'opérateur : mesurez votre point de départ, importez votre historique d'avis, installez l'habitude de solliciter, et transformez ce que disent vos clients en positions et en mentions par les IA. Environ une heure de lecture, 90 jours d'exécution.",
    courseCta: "Commencer par le chapitre 1 →",
    guidesH: "Guides approfondis",
    guidesSub: "Les sujets que le cours ne fait qu'effleurer, traités à fond.",
    toolsH: "Guides des outils",
    toolsSub: "L'aide pratique pour les outils Echorank.",
    watchH: "En vidéo",
    watchSub: "L'installation de l'extension, de bout en bout — deux minutes.",
    watchWritten: "Les étapes par écrit :",
    watchWrittenLink: "page de téléchargement de l'extension",
    pdfH: "Vous préférez un seul document ?",
    pdfP:
      "Le guide de terrain complet — listes de contrôle, modèles, études de cas et captures d'écran — en PDF. Sans adresse e-mail.",
    minRead: (n) => `${n} min de lecture`,
    rowLinks: [
      { href: ROW.extension, label: "Guide d'installation de l'extension (avec vidéo)", icon: "🧩", internal: true },
      { href: ROW.reviewsIn, label: "Importer vos avis", icon: "📥" },
      { href: ROW.tools, label: "Les outils SEO", icon: "🛠️" },
      { href: ROW.mcp, label: "API et serveur MCP", icon: "🤖" },
      { href: ROW.echopedia, label: "Echopedia — le glossaire", icon: "📖", internal: true },
      { href: ROW.audit, label: "Audit de visibilité IA gratuit", icon: "🆓", internal: true },
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const t = CHROME[baseOf(locale)];
  return buildMetadata({
    locale,
    path: LEARN_BASE,
    title: t.metaTitle,
    description: t.metaDescription,
    // English body under every locale — one canonical, not five duplicates.
    canonicalLocale: "en",
  });
}

export default async function LearnHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();

  const t = CHROME[baseOf(locale)];
  const foot = CONTENT[locale as Locale].footer;
  const player = HOME_TOOLS[locale as Locale].player;
  const L = (p: string) => `/${locale}${p.startsWith("/") ? p : `/${p}`}`;

  // Structured data is built from the same arrays the page renders, and always
  // against the en URLs — the locale variants canonical there.
  const hubUrl = `${SITE_URL}/en${LEARN_BASE}`;
  const graph = [
    organization(locale),
    webSite(locale),
    course({
      name: CHROME.en.courseName,
      description: CHROME.en.metaDescription,
      pageUrl: hubUrl,
      inLanguage: "en",
      parts: LEARN_CHAPTERS.map((ch) => ({
        headline: ch.title,
        description: ch.description,
        pageUrl: `${SITE_URL}/en${LEARN_BASE}/${ch.slug}`,
      })),
    }),
    ...(WATCH_VIDEO
      ? [
          videoObject({
            name: WATCH_VIDEO.title,
            description: t.watchSub,
            thumbnailUrl: WATCH_VIDEO.poster,
            contentUrl: WATCH_VIDEO.src,
            uploadDate: WATCH_VIDEO.uploadDate,
            pageUrl: hubUrl,
            inLanguage: "en",
          }),
        ]
      : []),
  ];

  const firstChapter = LEARN_CHAPTERS[0];

  return (
    <div className={s.page}>
      <JsonLd graph={graph} />
      <PublicNav locale={locale} current="learn" />

      <div className={`${s.container} ${c.hero}`}>
        <p className={s.label}>
          <b>{t.kicker}</b>
        </p>
        <h1 className={c.heroH1}>
          {t.h1a}
          <br />
          {t.h1b}
        </h1>
        <p className={c.heroSub}>{t.intro}</p>
        <div className={c.heroBtns}>
          <Link className={`${s.btn} ${s.btnPrimary}`} href={L(`${LEARN_BASE}/${firstChapter.slug}`)}>
            {t.startCta}
          </Link>
          <a className={`${s.btn} ${s.btnGhost}`} href="#pdf">
            {t.pdfCta}
          </a>
        </div>
      </div>

      {/* Flagship course */}
      <section className={s.section} id="course">
        <div className={s.container}>
          <div className={c.flag}>
            <div>
              <p className={s.label}>
                <b>/ {t.courseLabel}</b>
              </p>
              <h2 className={c.flagH}>{t.courseName}</h2>
              <p className={c.flagP}>{t.courseBlurb}</p>
              <Link className={`${s.btn} ${s.btnPrimary}`} href={L(`${LEARN_BASE}/${firstChapter.slug}`)}>
                {t.courseCta}
              </Link>
            </div>
            {/* Numbers are a CSS counter, so they cannot disagree with order. */}
            <div className={c.chapters}>
              {LEARN_CHAPTERS.map((ch) => (
                <Link key={ch.slug} href={L(`${LEARN_BASE}/${ch.slug}`)}>
                  {ch.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Ultimate guides */}
      <section className={s.section} id="guides">
        <div className={s.container}>
          <h2 className={s.h2}>{t.guidesH}</h2>
          <p className={s.sub} style={{ marginBottom: 24 }}>
            {t.guidesSub}
          </p>
          <div className={c.grid}>
            {LEARN_GUIDES.map((g) => (
              <Link key={g.slug} className={c.card} href={L(`${LEARN_BASE}/guides/${g.slug}`)}>
                <span className={c.cardTag}>{g.tag}</span>
                <h3 className={c.cardH}>{g.title}</h3>
                <p className={c.cardP}>{g.blurb}</p>
                <p className={c.cardMeta}>{t.minRead(g.readingTime)}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Tool guides & more */}
      <section className={s.section}>
        <div className={s.container}>
          <h2 className={s.h2}>{t.toolsH}</h2>
          <p className={s.sub} style={{ marginBottom: 24 }}>
            {t.toolsSub}
          </p>
          <div className={c.rowlinks}>
            {t.rowLinks.map((r) => {
              const body = (
                <>
                  <span aria-hidden="true">{r.icon}</span> {r.label}
                </>
              );
              return r.internal ? (
                <Link key={r.href} href={L(r.href)}>
                  {body}
                </Link>
              ) : (
                <a key={r.href} href={r.href}>
                  {body}
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* Watch — the same mp4 the extension download page uses, Caddy-served
          from outside this repo and referenced absolutely. */}
      {WATCH_VIDEO && (
        <section className={s.section}>
          <div className={s.container}>
            <h2 className={s.h2}>{t.watchH}</h2>
            <p className={s.sub} style={{ marginBottom: 24 }}>
              {t.watchSub}
            </p>
            <div className={c.watchBox}>
              <HomeVideo
                className={c.video}
                src={WATCH_VIDEO.src}
                poster={WATCH_VIDEO.poster}
                ariaLabel={WATCH_VIDEO.title}
                labels={player}
              />
              <p className={c.cardMeta}>
                {t.watchWritten}{" "}
                <a href="https://echorank360.com/extension/download.html">{t.watchWrittenLink}</a>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* PDF */}
      <section className={s.section} id="pdf">
        <div className={s.container}>
          <div className={c.pdfCta}>
            <h2 className={c.pdfCtaH}>{t.pdfH}</h2>
            <p className={c.pdfCtaP}>{t.pdfP}</p>
            <a className={`${s.btn} ${s.btnPrimary}`} href={LEARN_PDF} download target="_blank" rel="noopener">
              {t.pdfCta} ↓
            </a>
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
