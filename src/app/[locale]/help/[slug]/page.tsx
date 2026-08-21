// One public help article: /[locale]/help/[slug].
//
// The SAME article shell as the Knowledge Hub — a help article is a Knowledge
// Hub article with a shorter reading time and a task instead of a topic, and
// giving it a second design would be a second design to maintain.
//
// TWO THINGS DIFFER FROM /learn/guides/[slug], both deliberate:
//
//  1. The body is LOCALIZED (see src/lib/help-articles.ts), so this page
//     canonicals to ITSELF in every locale rather than to the en URL, its
//     Article node declares the reader's language, and ArticleShell's
//     English-only notice is suppressed. Canonicalising a real French page to
//     its English twin would ask Google to drop the French one.
//  2. There is no public /[locale]/help index — "/help" is the auth-gated
//     in-app hub — so the breadcrumb parent is the Knowledge Hub, which is
//     where the article is cross-linked from.
//
// The locale-less "/help/cancel-subscription" reaches this page as a 308 from
// the proxy, because helpArticleRoutes() puts the path in the SEO registry and
// therefore in KNOWN_MARKETING_PATHS. Without that entry it would fall through
// to the auth gate and 307 to /login — see the locale guard in src/proxy.ts.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { JsonLd } from "@/lib/seo/JsonLd";
import { article, breadcrumbList, organization, webSite } from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/seo/constants";
import { LEARN_BASE } from "@/lib/learn-content";
import {
  HELP_ARTICLES,
  helpArticleBySlug,
  helpArticleCopy,
  helpArticlePath,
  helpBaseOf,
} from "@/lib/help-articles";
import { ArticleShell } from "../../learn/_shared/ArticleShell";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    HELP_ARTICLES.map((a) => ({ locale, slug: a.slug })),
  );
}

const CHROME = {
  en: { home: "Home", hub: "Knowledge Hub", eyebrow: "HELP" },
  fr: { home: "Accueil", hub: "Centre de connaissances", eyebrow: "AIDE" },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) return {};
  const found = helpArticleBySlug(slug);
  if (!found) return {};
  const copy = helpArticleCopy(found, locale);

  return buildMetadata({
    locale,
    path: helpArticlePath(found.slug),
    title: copy.title,
    description: copy.description,
    ogType: "article",
    // No canonicalLocale: the body is genuinely written in this locale, so the
    // page canonicals to itself.
  });
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const found = helpArticleBySlug(slug);
  if (!found) notFound();

  const b = helpBaseOf(locale);
  const t = CHROME[b];
  const copy = helpArticleCopy(found, locale);
  const pageUrl = `${SITE_URL}/${locale}${helpArticlePath(found.slug)}`;

  const graph = [
    organization(locale),
    webSite(locale),
    article({
      headline: copy.title,
      description: copy.description,
      pageUrl,
      readingTime: found.readingTime,
      inLanguage: b,
    }),
    breadcrumbList([
      { name: t.home, url: `${SITE_URL}/${locale}` },
      { name: t.hub, url: `${SITE_URL}/${locale}${LEARN_BASE}` },
      { name: copy.title, url: pageUrl },
    ]),
    // NO FAQPage NODE HERE. The article owns a short-form Q&A, but this page
    // renders the long form — the steps — not the pair. FAQPage markup must
    // describe questions the page actually shows (see jsonld.ts), so the pair
    // is marked up where it is visible: the homepage FAQ section.
  ];

  return (
    <>
      <JsonLd graph={graph} />
      <ArticleShell
        locale={locale}
        eyebrow={t.eyebrow}
        localizedBody
        title={copy.title}
        description={copy.description}
        readingTime={found.readingTime}
        body={copy.body}
        // NO CLOSING CTA. The article promises "no retention hoops"; ending it
        // with a Start-free-trial pitch would be one.
        related={copy.related}
      />
    </>
  );
}
