// One course chapter: /[locale]/learn/[chapter].
//
// Slugs come from the config, which came from the content pack's frontmatter.
// An unknown slug is a 404, not a blank article — and the route-table test in
// tests/learn-content.test.ts asserts the config and the routes agree.
//
// This segment sits beside the static /learn/guides and /learn/echopedia
// directories. Next matches the static segments first, so "guides" and
// "echopedia" never reach this file; the notFound() below covers them anyway.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { JsonLd } from "@/lib/seo/JsonLd";
import { article, breadcrumbList, organization, videoObject, webSite } from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/seo/constants";
import {
  LEARN_BASE,
  LEARN_CHAPTERS,
  chapterBySlug,
  chapterNeighbours,
} from "@/lib/learn-content";
import { ArticleShell, baseOf } from "../_shared/ArticleShell";

/** Every locale × every chapter — both segments are dynamic on this route. */
export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    LEARN_CHAPTERS.map((ch) => ({ locale, chapter: ch.slug })),
  );
}

const CRUMB = {
  en: { home: "Home", hub: "Knowledge Hub" },
  fr: { home: "Accueil", hub: "Centre de connaissances" },
} as const;

const NUMBER = {
  en: (n: number) => `CHAPTER ${String(n).padStart(2, "0")}`,
  fr: (n: number) => `CHAPITRE ${String(n).padStart(2, "0")}`,
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; chapter: string }>;
}): Promise<Metadata> {
  const { locale, chapter } = await params;
  if (!isSupportedLocale(locale)) return {};
  const ch = chapterBySlug(chapter);
  if (!ch) return {};

  return buildMetadata({
    locale,
    path: `${LEARN_BASE}/${ch.slug}`,
    title: ch.title,
    description: ch.description,
    ogType: "article",
    // The body is English under every locale — canonical to the en URL.
    canonicalLocale: "en",
  });
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ locale: string; chapter: string }>;
}) {
  const { locale, chapter } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const ch = chapterBySlug(chapter);
  if (!ch) notFound();

  const b = baseOf(locale);
  const { prev, next } = chapterNeighbours(ch.slug);
  const L = (p: string) => `/${locale}${p}`;
  const pageUrl = `${SITE_URL}/en${LEARN_BASE}/${ch.slug}`;

  const graph = [
    organization(locale),
    webSite(locale),
    article({
      headline: ch.title,
      description: ch.description,
      pageUrl,
      readingTime: ch.readingTime,
      inLanguage: "en",
    }),
    breadcrumbList([
      { name: CRUMB[b].home, url: `${SITE_URL}/en` },
      { name: CRUMB[b].hub, url: `${SITE_URL}/en${LEARN_BASE}` },
      { name: ch.title, url: pageUrl },
    ]),
    ...(ch.video
      ? [
          videoObject({
            name: ch.video.title,
            description: ch.description,
            thumbnailUrl: ch.video.poster,
            contentUrl: ch.video.src,
            uploadDate: ch.video.uploadDate,
            pageUrl,
            inLanguage: "en",
          }),
        ]
      : []),
  ];

  return (
    <>
      <JsonLd graph={graph} />
      <ArticleShell
        locale={locale}
        eyebrow={NUMBER[b](ch.order)}
        title={ch.title}
        description={ch.description}
        readingTime={ch.readingTime}
        body={ch.body}
        video={ch.video}
        cta={ch.cta}
        related={ch.related}
        prev={prev ? { href: L(`${LEARN_BASE}/${prev.slug}`), label: prev.title } : undefined}
        next={next ? { href: L(`${LEARN_BASE}/${next.slug}`), label: next.title } : undefined}
      />
    </>
  );
}
