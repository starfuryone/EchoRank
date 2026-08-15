// /[locale]/pricing — the standalone pricing page.
//
// THE FUNNEL'S ONE EXIT. Every marketing CTA on the site now points here, and
// this is the only marketing page that links into /register. That is the whole
// design: a visitor cannot reach registration without passing the prices, and
// there is exactly one page to change if that ever stops being true.
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
import Link from "next/link";
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
  creditsLink: string;
  signupHeading: string;
  signupSub: string;
  signupCta: string;
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
    creditsLink: "Prospect lookups sold as credit packs \u2192",
    signupHeading: "Not sure which plan yet?",
    signupSub: "Create your account first and pick a plan when you are ready.",
    signupCta: "Create account",
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
    creditsLink: "Recherches de prospects vendues en packs pr\u00e9pay\u00e9s \u2192",
    signupHeading: "Vous hésitez encore ?",
    signupSub: "Créez votre compte d'abord et choisissez un forfait quand vous serez prêt.",
    signupCta: "Créer un compte",
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

          {/* Prospect lookups. ONE LINE, NOT A FOURTH CARD, and the restraint
              is the decision: this page sells plans, and a credit pack is an
              add-on to one of them. A fourth column would invite the
              comparison — "$79 vs $99/mo" — that it would lose, and would
              imply lookups are an alternative to a subscription rather than
              something you spend inside the Agency plan. Same argument
              /watcher makes for not being a fifth column here. */}
          <p className={s.sub} style={{ marginTop: "1.5rem" }}>
            <Link href={`/${l}/credits`}>{c.creditsLink}</Link>
          </p>

          {/* The one /register link on the marketing site that is not a plan
              card's own checkout. Someone who wants an account before choosing
              a tier would otherwise have no route in at all, now that every
              other CTA leads here. No ?plan= — that is the point of it. */}
          <div className={s.closebtns} style={{ marginTop: "2.5rem" }}>
            <p className={s.sub}>
              <strong>{c.signupHeading}</strong> {c.signupSub}
            </p>
            <Link className={`${s.btn} ${s.btnGhost}`} href="/register">
              {c.signupCta}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
