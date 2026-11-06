// src/lib/pricing-page/copy.ts
//
// /pricing's page-level strings (hero, comparison table, FAQ heading, closing
// band) in en / fr / de. NO NUMBERS: every count, price, percentage and day
// figure is a {placeholder} filled by the page from config. de-CH writes ss,
// never ß.

import type { PricingBase } from "./format";

export interface PricingPageCopy {
  metaTitle: string;
  /** Contains {days}. */
  metaDescription: string;
  label: string;
  /** Contains {plans} (a number word from planCountWord). */
  h1: string;
  /** Contains {pct}. */
  sub: string;
  compareLabel: string;
  compareH2: string;
  compareSub: string;
  featureHead: string;
  freeHead: string;
  freeSub: string;
  yes: string;
  no: string;
  /** Hint under the table on narrow screens. */
  scrollHint: string;
  faqLabel: string;
  faqH2: string;
  /** Visible marker on an answer that still needs the owner's wording. */
  placeholderNote: string;
  closingH2: string;
  closingBody: string;
  closingCta: string;
}

export const PRICING_PAGE_COPY: Record<PricingBase, PricingPageCopy> = {
  en: {
    metaTitle: "Pricing",
    metaDescription:
      "Echorank plans and pricing. Every plan starts with a {days}-day free trial. Compare Starter, Growth and Agency, and what the free tools include.",
    label: "PRICING",
    h1: "{plans} plans. The same core toolkit in each.",
    sub: "Monthly billing, cancel any time. Pay yearly and save {pct}%.",
    compareLabel: "COMPARE",
    compareH2: "Free and paid, side by side",
    compareSub: "What the public free tools give you without an account, and what each plan adds.",
    featureHead: "Feature",
    freeHead: "Free",
    freeSub: "no account",
    yes: "Included",
    no: "Not included",
    scrollHint: "Scroll sideways to see every plan.",
    faqLabel: "FAQ",
    faqH2: "Straight answers",
    placeholderNote: "Answer pending confirmation",
    closingH2: "Pick a plan and start the trial",
    closingBody: "Every plan starts free, and you can cancel before the trial ends without being charged.",
    closingCta: "See the plans",
  },
  fr: {
    metaTitle: "Tarifs",
    metaDescription:
      "Forfaits et tarifs Echorank. Chaque forfait commence par un essai gratuit de {days} jours. Comparez Starter, Growth et Agency, et ce qu'offrent les outils gratuits.",
    label: "TARIFS",
    h1: "{plans} forfaits. Les mêmes outils essentiels dans chacun.",
    sub: "Facturation mensuelle, annulable à tout moment. Payez à l'année et économisez {pct} %.",
    compareLabel: "COMPARER",
    compareH2: "Gratuit et payant, côte à côte",
    compareSub: "Ce que les outils gratuits offrent sans compte, et ce que chaque forfait ajoute.",
    featureHead: "Fonction",
    freeHead: "Gratuit",
    freeSub: "sans compte",
    yes: "Inclus",
    no: "Non inclus",
    scrollHint: "Faites défiler horizontalement pour voir chaque forfait.",
    faqLabel: "FAQ",
    faqH2: "Réponses directes",
    placeholderNote: "Réponse en attente de confirmation",
    closingH2: "Choisissez un forfait et démarrez l'essai",
    closingBody: "Chaque forfait commence gratuitement, et vous pouvez annuler avant la fin de l'essai sans être facturé.",
    closingCta: "Voir les forfaits",
  },
  de: {
    metaTitle: "Preise",
    metaDescription:
      "Echorank-Abos und Preise. Jedes Abo beginnt mit einem {days}-tägigen Gratis-Test. Vergleichen Sie Starter, Growth und Agency und was die Gratis-Werkzeuge bieten.",
    label: "PREISE",
    h1: "{plans} Abos. Dieselben Kernwerkzeuge in jedem.",
    sub: "Monatliche Abrechnung, jederzeit kündbar. Jährlich zahlen und {pct}% sparen.",
    compareLabel: "VERGLEICH",
    compareH2: "Gratis und bezahlt im Vergleich",
    compareSub: "Was die öffentlichen Gratis-Werkzeuge ohne Konto bieten und was jedes Abo dazu bringt.",
    featureHead: "Funktion",
    freeHead: "Gratis",
    freeSub: "ohne Konto",
    yes: "Inbegriffen",
    no: "Nicht inbegriffen",
    scrollHint: "Seitlich scrollen, um alle Abos zu sehen.",
    faqLabel: "FAQ",
    faqH2: "Klare Antworten",
    placeholderNote: "Antwort noch zu bestätigen",
    closingH2: "Abo wählen und Test starten",
    closingBody: "Jedes Abo beginnt gratis, und Sie können vor Ende der Testphase kündigen, ohne belastet zu werden.",
    closingCta: "Zu den Abos",
  },
};

const NUMBER_WORDS: Record<PricingBase, Record<number, string>> = {
  en: { 2: "Two", 3: "Three", 4: "Four", 5: "Five" },
  fr: { 2: "Deux", 3: "Trois", 4: "Quatre", 5: "Cinq" },
  de: { 2: "Zwei", 3: "Drei", 4: "Vier", 5: "Fünf" },
};

/** "Three" for 3 card tiers; the numeral when there is no word for it. */
export function planCountWord(n: number, base: PricingBase): string {
  return NUMBER_WORDS[base][n] ?? String(n);
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}
