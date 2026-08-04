// One ultimate guide: /[locale]/learn/guides/[slug].
//
// Same article shell as the course chapters; guides carry no prev/next because
// they are not a sequence.
//
// install-browser-extension AND /extension/download.html BOTH STAY LIVE. The
// prose here is a deliberate paraphrase of that page, not a copy: two URLs
// covering the same install, each canonical to itself, cross-linked so a
// visitor can move between them. Do not "sync" the wording — making them
// verbatim identical is what would turn two useful pages into a duplicate-
// content problem.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { JsonLd } from "@/lib/seo/JsonLd";
import {
  article,
  breadcrumbList,
  faqPage,
  organization,
  videoObject,
  webSite,
} from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/seo/constants";
import { LEARN_BASE, LEARN_GUIDES, guideBySlug } from "@/lib/learn-content";
import { ArticleShell, baseOf } from "../../_shared/ArticleShell";
import { plainText } from "../../_shared/inline";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    LEARN_GUIDES.map((g) => ({ locale, slug: g.slug })),
  );
}

const CRUMB = {
  en: { home: "Home", hub: "Knowledge Hub", eyebrow: "GUIDE" },
  fr: { home: "Accueil", hub: "Centre de connaissances", eyebrow: "GUIDE" },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) return {};
  const guide = guideBySlug(slug);
  if (!guide) return {};

  return buildMetadata({
    locale,
    path: `${LEARN_BASE}/guides/${guide.slug}`,
    title: guide.title,
    description: guide.description,
    ogType: "article",
    canonicalLocale: "en",
  });
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const guide = guideBySlug(slug);
  if (!guide) notFound();

  const b = baseOf(locale);
  const pageUrl = `${SITE_URL}/en${LEARN_BASE}/guides/${guide.slug}`;

  const graph = [
    organization(locale),
    webSite(locale),
    article({
      headline: guide.title,
      description: guide.description,
      pageUrl,
      readingTime: guide.readingTime,
      inLanguage: "en",
    }),
    breadcrumbList([
      { name: CRUMB[b].home, url: `${SITE_URL}/en` },
      { name: CRUMB[b].hub, url: `${SITE_URL}/en${LEARN_BASE}` },
      { name: guide.title, url: pageUrl },
    ]),
    ...(guide.video
      ? [
          videoObject({
            name: guide.video.title,
            description: guide.description,
            thumbnailUrl: guide.video.poster,
            contentUrl: guide.video.src,
            uploadDate: guide.video.uploadDate,
            pageUrl,
            inLanguage: "en",
          }),
        ]
      : []),
    // Built from the SAME array the page renders, with the inline markup
    // stripped — a FAQPage answer is plain text, and "**Load unpacked**" in a
    // rich result would publish the asterisks.
    ...(guide.faq
      ? [
          faqPage(
            guide.faq.map((f) => ({ q: plainText(f.q), a: plainText(f.a) })),
            pageUrl,
          ),
        ]
      : []),
  ];

  return (
    <>
      <JsonLd graph={graph} />
      <ArticleShell
        locale={locale}
        eyebrow={CRUMB[b].eyebrow}
        title={guide.title}
        description={guide.description}
        readingTime={guide.readingTime}
        body={guide.body}
        video={guide.video}
        faq={guide.faq}
        cta={guide.cta}
        related={guide.related}
      />
    </>
  );
}
