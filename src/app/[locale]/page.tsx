import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import { FAQ } from "./faq-data";
import {
  BRAND_TITLE,
  JsonLd,
  SITE_URL,
  buildMetadata,
  faqPage,
  normalizeLocale,
  organization,
  softwareApplication,
  webSite,
} from "@/lib/seo";

const baseOf = (locale: string): "en" | "fr" => (locale.startsWith("fr") ? "fr" : "en");

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  const l = normalizeLocale(locale);
  return buildMetadata({ locale: l, path: "", title: BRAND_TITLE[l] });
}

export default async function Page(
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const l = normalizeLocale(locale);
  // FAQ copy is en/fr only, matching the rest of HomeClient's catalogue.
  const faq = FAQ[baseOf(l)];

  return (
    <>
      <JsonLd
        graph={[
          organization(l),
          webSite(l),
          softwareApplication(l),
          // Built from the same array HomeClient renders, so the markup can
          // never describe questions the page doesn't display.
          faqPage(faq.items, `${SITE_URL}/${l}`),
        ]}
      />
      <HomeClient locale={locale} />
    </>
  );
}
