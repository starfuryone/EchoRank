import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import { FAQ } from "./faq-data";

const SITE = "https://echorank360.com";
const LOCALES = ["en", "en-CA", "fr", "fr-CA", "de-CH"] as const;
const OG_IMAGE = `${SITE}/og-home.png`;

// Google Search Console verification. Read from the environment so the
// placeholder token can never ship again — the meta tag is emitted ONLY when
// NEXT_PUBLIC_GSC_TOKEN is set at build time. (Note: public/google*.html
// already provides file-based verification, so this is belt-and-braces.)
const GSC_TOKEN = process.env.NEXT_PUBLIC_GSC_TOKEN?.trim() || undefined;

const META: Record<string, { title: string; description: string }> = {
  en: {
    title: "EchoRank 360 — AI Visibility Management Platform",
    description:
      "When customers ask ChatGPT, Google AI or Perplexity who to hire, is your business the answer? Measure your AI Visibility Score, track recommendations daily, and get a prioritized roadmap to become the business AI recommends.",
  },
  fr: {
    title: "EchoRank 360 — Plateforme de visibilité IA",
    description:
      "Quand vos clients demandent à ChatGPT, Google AI ou Perplexity qui embaucher, votre entreprise est-elle la réponse? Mesurez votre score de visibilité IA, suivez les recommandations chaque jour et obtenez une feuille de route priorisée.",
  },
};

const baseOf = (locale: string): "en" | "fr" => (locale.startsWith("fr") ? "fr" : "en");
const metaFor = (locale: string) => META[baseOf(locale)];

// Plan prices as shown in the pricing section of HomeClient. USD list price;
// the CAD/EUR/CHF presentations are display-only and not modelled here.
const PLANS: { name: string; price: string }[] = [
  { name: "Starter", price: "49" },
  { name: "Growth", price: "149" },
  { name: "Agency", price: "349" },
  { name: "Enterprise", price: "999" },
];

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  const m = metaFor(locale);
  const url = `${SITE}/${locale}`;

  return {
    // `absolute` bypasses the root layout's "%s | EchoRank 360" template. The
    // title already contains the brand, so the template appended it twice.
    title: { absolute: m.title },
    description: m.description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries([
        ...LOCALES.map((l) => [l, `${SITE}/${l}`]),
        ["x-default", `${SITE}/en`],
      ]),
    },
    ...(GSC_TOKEN ? { verification: { google: GSC_TOKEN } } : {}),
    openGraph: {
      title: m.title,
      description: m.description,
      url, // per-locale, no longer root
      siteName: "EchoRank 360",
      type: "website",
      locale: locale.replace("-", "_"),
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: m.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: m.title,
      description: m.description,
      images: [OG_IMAGE],
    },
  };
}

export default async function Page(
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const m = metaFor(locale);
  const faq = FAQ[baseOf(locale)];

  // Homepage-specific graph. Organization + WebSite are emitted once, site
  // wide, by the root layout; these nodes reference that Organization by @id
  // so consumers merge them into one entity graph.
  //
  // No aggregateRating / reviewCount: there are no real ratings to cite, and
  // inventing them would be fabricated structured data.
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE}/#software`,
        name: "EchoRank 360",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${SITE}/${locale}`,
        description: m.description,
        publisher: { "@id": `${SITE}/#organization` },
        offers: PLANS.map((p) => ({
          "@type": "Offer",
          name: p.name,
          price: p.price,
          priceCurrency: "USD",
          category: "subscription",
        })),
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE}/${locale}#faq`,
        // Built from faq-data.ts — the same array HomeClient renders, so the
        // markup never describes questions the page doesn't display.
        mainEntity: faq.items.map((it) => ({
          "@type": "Question",
          name: it.q,
          acceptedAnswer: { "@type": "Answer", text: it.a },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
      />
      <HomeClient locale={locale} />
    </>
  );
}
