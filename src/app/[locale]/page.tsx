import type { Metadata } from "next";
import HomeClient, { type HomePricingTier } from "./HomeClient";
import { pricingTiers } from "@/lib/pricing-tiers";
import { ClassicSeoTools } from "./ClassicSeoTools";
import { FAQ } from "./faq-data";
import { PLAN_CONFIGS, PLAN_ORDER } from "@/lib/plan-config";
import { HOME_PRICING_CHROME, HOME_TOOLS } from "@/lib/i18n/content";
import { SEO_TOOL_GROUPS } from "@/lib/seo-tools";
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

/**
 * Pricing rows for the /13 grid, read from PLAN_CONFIGS rather than retyped.
 *
 * The marketing page is allowed to hold price COPY, but the numbers and the
 * feature bullets are the plan config's job — they drive Stripe, entitlements
 * and the in-app upgrade paths, and a homepage that disagrees with them is a
 * billing dispute waiting to happen. Enterprise carries isCustomPricing, so its
 * "Contact us" label comes from the locale chrome instead of a price.
 */
export default async function Page(
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const l = normalizeLocale(locale);
  // FAQ copy is en/fr only, matching the rest of HomeClient's catalogue.
  const faq = FAQ[baseOf(l)];

  const liveToolCount = SEO_TOOL_GROUPS.flatMap((g) => g.tools).filter(
    (t) => !t.comingSoon,
  ).length;

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
      <HomeClient
        locale={locale}
        pricing={pricingTiers(locale)}
        priceChrome={HOME_PRICING_CHROME[l]}
        // Five-locale player chrome for the /05 video. Resolved here so
        // HomeClient, whose own copy table is en/fr only, does not have to
        // import the whole content catalog to render a mute button.
        playerLabels={HOME_TOOLS[l].player}
        liveToolCount={liveToolCount}
        // Passed in as a slot rather than imported by HomeClient: the grid is a
        // server component so the whole seo-tools config (and its lucide icon
        // set) stays out of the client bundle, and the marketing copy stays
        // derived from the same source the product hub uses.
        toolsSection={<ClassicSeoTools locale={l} sectionNumber="04" />}
      />
    </>
  );
}
