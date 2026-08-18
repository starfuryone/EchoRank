// /[locale]/pricing — the standalone pricing page.
//
// THE FUNNEL'S ONE EXIT, AND NOW ITS ONLY ENTRANCE. Every marketing CTA on the
// site points here, and nothing on the site links into /register any more —
// bare /register redirects BACK to this page. That is the checkout-first
// design: a card is entered at Stripe before an account exists, and the account
// is what the webhook builds out of the completed session. There is therefore
// no "create an account, choose a plan later" state to offer, which is why the
// plan-less Create-account button that used to sit under the grid is gone.
//
// NO NUMBERS LIVE HERE. The cards come from pricingTiers() over PLAN_CONFIGS,
// the same call the homepage makes, rendered by the same PricingSection
// component. The JSON-LD offers come from the same config through
// softwareApplication(). A price cannot differ between the two pages because
// neither page holds one.
//
// Body copy folds to en/fr through baseOf(), matching the homepage's own
// pricing section — those strings have never had five variants, and inventing
// three more here would put the same sentence in two places with different
// wording. Metadata is per-locale and canonical per-locale.

import type { Metadata } from "next";
import { PublicNav } from "../PublicNav";
import { PricingSection } from "../PricingSection";
import { pricingTiers } from "@/lib/pricing-tiers";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";
import { SEO_TOOL_GROUPS } from "@/lib/seo-tools";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd, SITE_URL, baseGraph, breadcrumbList, softwareApplication } from "@/lib/seo";
import s from "../home2.module.css";

type Base = "en" | "fr";
const baseOf = (locale: string): Base => (locale.startsWith("fr") ? "fr" : "en");

const COPY: Record<Base, {
  metaTitle: string;
  metaDescription: string;
  label: string;
  h1: string;
  sub: string;
  tax: string;
  currency: string;
  toolsAnchor: string;
}> = {
  en: {
    metaTitle: "Pricing",
    metaDescription:
      "Echorank plans and pricing. Every plan starts with a 7-day free trial. Compare AI Visibility, Starter, Growth and Agency.",
    label: "PRICING",
    h1: "Plans",
    sub: "Every plan starts with a 7-day free trial. Change or cancel at any time.",
    tax: "Try Echorank free for 7 days. Cancel anytime. Card required.",
    currency:
      "All prices are in US dollars (USD). If you pay with a card in another currency, your bank converts the charge at its own exchange rate.",
    toolsAnchor: "See the tools included",
  },
  fr: {
    metaTitle: "Tarifs",
    metaDescription:
      "Forfaits et tarifs Echorank. Chaque forfait commence par un essai gratuit de 7 jours. Comparez AI Visibility, Starter, Growth et Agency.",
    label: "TARIFS",
    h1: "Forfaits",
    sub: "Chaque forfait commence par un essai gratuit de 7 jours. Modifiez ou annulez à tout moment.",
    tax: "Essayez Echorank gratuitement pendant 7 jours. Annulez à tout moment. Carte requise.",
    currency:
      "Tous les prix sont en dollars américains (USD). Si vous payez avec une carte dans une autre devise, votre banque effectue la conversion à son propre taux de change.",
    toolsAnchor: "Voir les outils inclus",
  },
};

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const c = COPY[baseOf(locale)];
  return buildMetadata({
    locale,
    path: "/pricing",
    title: c.metaTitle,
    description: c.metaDescription,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = (isSupportedLocale(locale) ? locale : "en") as Locale;
  const c = COPY[baseOf(l)];
  const liveToolCount = SEO_TOOL_GROUPS.flatMap((g) => g.tools).length;

  return (
    <div className={s.page}>
      <PublicNav locale={l} />
      {/* Offers come from PLAN_CONFIGS via softwareApplication(), the same
          source the visible cards read — the structured data cannot advertise
          a price the page does not show. */}
      <JsonLd
        graph={[
          ...baseGraph(l),
          softwareApplication(l),
          breadcrumbList([
            { name: "Echorank360", url: `${SITE_URL}/${l}` },
            { name: c.metaTitle, url: `${SITE_URL}/${l}/pricing` },
          ]),
        ]}
      />

      <section id="pricing" className={s.section}>
        <div className={s.container}>
          <PricingSection
            locale={l}
            pricing={pricingTiers(l)}
            priceChrome={HOME_PRICING_CHROME[l]}
            liveToolCount={liveToolCount}
            tax={c.tax}
            currency={c.currency}
            // The "N tools" line points at the homepage's #tools section —
            // this page has none, and a bare "#tools" here would be a dead
            // anchor that silently scrolls nowhere.
            toolsHref={`/${l}#tools`}
            header={
              <>
                <p className={s.label}>
                  <b>/ 01</b> — {c.label}
                </p>
                <h1 className={s.h2}>{c.h1}</h1>
                <p className={s.sub}>{c.sub}</p>
              </>
            }
          />

          {/* The credits line that used to live here now renders inside
              PricingSection, so the homepage's grid carries it too — it had no
              route to /credits at all. Same argument /watcher makes for not
              being a fifth column here. */}

          {/* THE PLAN-LESS "Create account" BUTTON WAS HERE, AND IS GONE.
              Checkout-first: an account is what a completed checkout produces,
              so there is no longer an account to make before choosing a plan.
              /register redirects here now, which would have made this button a
              link back to the page it sits on. tests/pricing-route.test.ts
              asserts the absence. */}
        </div>
      </section>
    </div>
  );
}
