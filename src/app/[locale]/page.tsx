import type { Metadata } from "next";
import HomeClient from "./HomeClient";

const SITE = "https://echorank360.com";
const LOCALES = ["en", "en-CA", "fr", "fr-CA", "de-CH"] as const;

const META: Record<string, { title: string; description: string }> = {
  en: {
    title: "EchoRank 360 — AI Visibility Management Platform",
    description:
      "When customers ask ChatGPT, Google AI or Perplexity who to hire, is your business the answer? Measure your AI Visibility Score, track recommendations daily, and get a prioritized roadmap to become the business AI recommends.",
  },
  fr: {
    title: "EchoRank 360 — Plateforme de gestion de visibilité IA",
    description:
      "Quand vos clients demandent à ChatGPT, Google AI ou Perplexity qui embaucher, votre entreprise est-elle la réponse? Mesurez votre score de visibilité IA, suivez les recommandations chaque jour et obtenez une feuille de route priorisée.",
  },
};

const metaFor = (locale: string) => META[locale.startsWith("fr") ? "fr" : "en"];

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  const m = metaFor(locale);
  const url = `${SITE}/${locale}`;

  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries([
        ...LOCALES.map((l) => [l, `${SITE}/${l}`]),
        ["x-default", `${SITE}/en`],
      ]),
    },
    verification: {
      // TODO: replace with the real GSC token (Search Console → Settings →
      // Ownership verification → HTML tag → content="...").
      google: "PASTE_CONTENT_VALUE_HERE",
    },
    openGraph: {
      title: m.title,
      description: m.description,
      url, // per-locale, no longer root
      siteName: "EchoRank 360",
      type: "website",
      locale: locale.replace("-", "_"),
    },
    twitter: {
      card: "summary_large_image",
      title: m.title,
      description: m.description,
    },
  };
}

export default async function Page(
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  return <HomeClient locale={locale} />;
}
