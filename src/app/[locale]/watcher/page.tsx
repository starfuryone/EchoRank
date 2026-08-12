// /[locale]/watcher — the standalone AI Search Watcher.
//
// Two cards: the free one-shot grader that already exists, and the $9 watcher
// that monitors continuously. They are the same question asked once and asked
// every week, which is why they belong on one page rather than as a fifth
// column on /pricing — the watcher is not a tier, and putting it beside
// Starter/Growth/Agency invites the comparison it would lose.
//
// EVERY CLAIM ON THIS PAGE IS DERIVED, NOT TYPED. The prices come from
// WATCHER_PRICES_CENTS and the limits from WATCHER_SOLO — the same constants
// resolveWatcherShape hands the runner. That is deliberate and load-bearing: an
// earlier draft of this page advertised "500 prompts / 7 LLMs / $15.60" for a
// product that runs 10 prompts, 3 repetitions, on one engine. Copy written by
// hand drifts from the product silently, because nothing fails when it does.
//
// The engine line names Claude alone, because Claude is the only engine with a
// live adapter AND a metering rate. An engine without a rate is fail-closed in
// the runner and would never execute, so naming it here would sell a checkbox
// that cannot run.

import type { Metadata } from "next";
import { PublicNav } from "../PublicNav";
import { WatcherPricing, type WatcherCopy } from "./WatcherPricing";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd, SITE_URL, baseGraph, breadcrumbList } from "@/lib/seo";
import { TRIAL_DAYS, WATCHER_SOLO } from "@/lib/plan-config";
import {
  WATCHER_ANNUAL_PER_MONTH_USD as ANNUAL_PER_MONTH,
  WATCHER_ANNUAL_USD as ANNUAL_TOTAL,
  WATCHER_MONTHLY_USD as MONTHLY,
  WATCHER_SAVE_PCT as SAVE_PCT,
  watcherFeatures,
} from "@/lib/watcher-pricing";
import s from "../home2.module.css";

type Base = "en" | "fr";
const baseOf = (locale: string): Base => (locale.startsWith("fr") ? "fr" : "en");

const COPY: Record<
  Base,
  {
    metaTitle: string;
    metaDescription: string;
    label: string;
    h1: string;
    sub: string;
  } & Omit<WatcherCopy, "freeFeatures" | "watcherFeatures">
> = {
  en: {
    metaTitle: "AI Search Watcher — $9/mo",
    metaDescription:
      `Track how AI assistants answer questions about your brand. ${WATCHER_SOLO.prompts} prompts, ` +
      `checked ${WATCHER_SOLO.repetitions} times a week on Claude, with competitor and citation tracking. $${MONTHLY}/mo.`,
    label: "AI SEARCH WATCHER",
    h1: "Know what AI says about you",
    sub: "Run the check once for free, or watch it every week.",
    freeName: "Free check",
    freePrice: "$0",
    freeSub: "one-off · no account",
    freeCta: "Run the free check",
    watcherName: "Watcher",
    watcherSub: "one brand, watched continuously",
    includedNote: "Included in your plan — manage it from your dashboard.",
    manageCta: "Manage subscription",
    // The trial is NOT decoration: /api/billing/checkout stamps every session
    // with trial_period_days, the watcher's included, so the card's "Start free
    // trial" label is accurate and the billing line has to say the same thing.
    // Derived from TRIAL_DAYS for the same reason the prices are derived.
    tax: `Try it free for ${TRIAL_DAYS} days, then $${MONTHLY}/mo or $${ANNUAL_TOTAL}/yr. Card required. Cancel anytime.`,
    currency:
      "All prices are in US dollars (USD). If you pay with a card in another currency, your bank converts the charge at its own exchange rate.",
  },
  fr: {
    metaTitle: `AI Search Watcher — $${MONTHLY}/mois`,
    metaDescription:
      `Suivez ce que les assistants IA répondent à propos de votre marque. ${WATCHER_SOLO.prompts} requêtes, ` +
      `vérifiées ${WATCHER_SOLO.repetitions} fois par semaine sur Claude, avec suivi des concurrents et des citations. $${MONTHLY}/mois.`,
    label: "AI SEARCH WATCHER",
    h1: "Sachez ce que l'IA dit de vous",
    sub: "Faites le test une fois gratuitement, ou surveillez-le chaque semaine.",
    freeName: "Test gratuit",
    // "$0", not "0 $". The site prefixes the symbol in every locale — the
    // French /pricing cards already read "$29 /mois" — so the local convention
    // here would make the two cards on THIS page disagree with each other.
    // Changing the site-wide convention is a separate decision, not one to make
    // on one page.
    freePrice: "$0",
    freeSub: "ponctuel · sans compte",
    freeCta: "Lancer le test gratuit",
    watcherName: "Watcher",
    watcherSub: "une marque, surveillée en continu",
    includedNote: "Inclus dans votre forfait — gérez-le depuis votre tableau de bord.",
    manageCta: "Gérer l'abonnement",
    tax: `Essayez gratuitement pendant ${TRIAL_DAYS} jours, puis $${MONTHLY}/mois ou $${ANNUAL_TOTAL}/an. Carte requise. Annulez à tout moment.`,
    currency:
      "Tous les prix sont en dollars américains (USD). Si vous payez avec une carte dans une autre devise, votre banque effectue la conversion à son propre taux de change.",
  },
};

const FREE_FEATURES: Record<Base, string[]> = {
  en: [
    "One brand, checked once",
    "A–F readiness grade",
    "What to fix, in order",
    "No card, no account",
  ],
  fr: [
    "Une marque, vérifiée une fois",
    "Note de A à F",
    "Quoi corriger, dans l'ordre",
    "Sans carte, sans compte",
  ],
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
    path: "/watcher",
    title: c.metaTitle,
    description: c.metaDescription,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = (isSupportedLocale(locale) ? locale : "en") as Locale;
  const base = baseOf(l);
  const c = COPY[base];

  return (
    <div className={s.page}>
      <PublicNav locale={l} />
      {/* No Offer/Product node. /pricing emits its offers from PLAN_CONFIGS via
          softwareApplication(), and the watcher is not in that catalogue — hand
          -writing a price into structured data here would be a second source
          for a number this page already derives, which is the drift
          tests/seo-jsonld.test.ts exists to catch. */}
      <JsonLd
        graph={[
          ...baseGraph(l),
          breadcrumbList([
            { name: "Echorank360", url: `${SITE_URL}/${l}` },
            { name: c.metaTitle, url: `${SITE_URL}/${l}/watcher` },
          ]),
        ]}
      />

      <section id="watcher" className={s.section}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 01</b> — {c.label}
          </p>
          <h1 className={s.h2}>{c.h1}</h1>
          <p className={s.sub}>{c.sub}</p>

          <WatcherPricing
            locale={l}
            chrome={HOME_PRICING_CHROME[l]}
            monthly={MONTHLY}
            annualPerMonth={ANNUAL_PER_MONTH}
            savePct={SAVE_PCT}
            copy={{
              ...c,
              freeFeatures: FREE_FEATURES[base],
              watcherFeatures: watcherFeatures(base),
            }}
          />
        </div>
      </section>
    </div>
  );
}
