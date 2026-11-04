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
//
// THE NOSY BAT GUIDES (src/lib/learn-nosy-bat.ts) are localized: a guide with
// a French body canonicals each base to ITSELF (en-CA/de-CH → en, fr-CA → fr),
// declares that language in its Article node and adds HowTo when the guide
// asks for it — steps derived from its numbered headings, so the markup is
// always the walkthrough on screen. Their three CTAs and hero come from the
// guide's slug; every other guide renders exactly as before.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { JsonLd } from "@/lib/seo/JsonLd";
import {
  article,
  breadcrumbList,
  faqPage,
  howTo,
  organization,
  videoObject,
  webSite,
} from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/seo/constants";
import { LEARN_BASE, LEARN_GUIDES, guideBySlug, guideCopy, howToSteps } from "@/lib/learn-content";
import { flag } from "@/lib/flags";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { FREE_TOOLS_BASE } from "@/lib/free-tools";
import { CRAWL_PLANS, guideCtaCopy } from "@/lib/site-crawler/marketing-copy";
import { GuideCta, GuideCtaSession } from "@/components/learn/GuideCta";
import { NbHero } from "@/components/learn/nosy-bat-art";
import { ArticleShell, baseOf } from "../../_shared/ArticleShell";
import { plainText } from "../../_shared/inline";

const CRAWL_TIERS = Object.fromEntries(CRAWL_PLANS.map((id) => [id, PLAN_CONFIGS[id]])) as Record<
  (typeof CRAWL_PLANS)[number],
  (typeof PLAN_CONFIGS)[(typeof CRAWL_PLANS)[number]]
>;

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

  const b = baseOf(locale);
  const copy = guideCopy(guide, b);
  return buildMetadata({
    locale,
    path: `${LEARN_BASE}/guides/${guide.slug}`,
    title: copy.title,
    description: copy.description,
    ogType: "article",
    // A localized guide canonicals to its own base; an English-only one to en.
    canonicalLocale: copy.localized ? b : "en",
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
  const copy = guideCopy(guide, b);
  // Structured data names the canonical URL: the base's own for a localized
  // guide, the en one otherwise.
  const lang = copy.localized ? b : "en";
  const pageUrl = `${SITE_URL}/${lang}${LEARN_BASE}/guides/${guide.slug}`;
  const steps = guide.howTo
    ? howToSteps(copy.body).map((st) => ({ id: st.id, name: plainText(st.name), text: plainText(st.text) }))
    : [];

  const graph = [
    organization(locale),
    webSite(locale),
    article({
      headline: copy.localized ? copy.title : guide.title,
      description: copy.localized ? copy.description : guide.description,
      pageUrl,
      readingTime: guide.readingTime,
      inLanguage: lang,
    }),
    ...(steps.length > 0
      ? [
          howTo({
            name: copy.title,
            description: copy.description,
            pageUrl,
            steps,
            inLanguage: lang,
            readingTime: guide.readingTime,
          }),
        ]
      : []),
    breadcrumbList([
      { name: CRUMB[b].home, url: `${SITE_URL}/${lang}` },
      { name: CRUMB[b].hub, url: `${SITE_URL}/${lang}${LEARN_BASE}` },
      { name: copy.localized ? copy.title : guide.title, url: pageUrl },
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

  // The crawler guides' three CTAs, copy resolved here (server) and handed
  // to the client component; a guide without guideCtas gets none of this.
  const ctaCopy = guideCtaCopy(guide.slug, b, CRAWL_TIERS);
  const ctaLinks = {
    pricingHref: `/${locale}/pricing`,
    freeHref: flag("crawl.free") ? `/${locale}${FREE_TOOLS_BASE}/site-crawler` : null,
  };

  return (
    <>
      <JsonLd graph={graph} />
      <ArticleShell
        locale={locale}
        eyebrow={CRUMB[b].eyebrow}
        localizedBody={copy.localized}
        // A French title/description where one is written; the body too for
        // the localized guides.
        title={copy.title}
        description={copy.description}
        readingTime={guide.readingTime}
        body={copy.body}
        video={guide.video}
        faq={guide.faq}
        cta={guide.cta}
        related={copy.related}
        hero={guide.hero ? <NbHero id={guide.hero} /> : undefined}
        {...(ctaCopy
          ? {
              wrap: (node) => <GuideCtaSession>{node}</GuideCtaSession>,
              ctas: {
                inline: <GuideCta variant="inline" copy={ctaCopy} {...ctaLinks} />,
                nudge: <GuideCta variant="nudge" copy={ctaCopy} {...ctaLinks} />,
              },
              closing: <GuideCta variant="closing" copy={ctaCopy} {...ctaLinks} />,
            }
          : {})}
      />
    </>
  );
}
