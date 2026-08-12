// src/lib/watcher-pricing.ts
//
// What the Watcher costs and what it actually does, derived from the same
// constants the runner obeys.
//
// PURE, AND SEPARATE FROM THE PAGE ON PURPOSE. Every number on the marketing
// card is a claim about what will execute after someone pays, and the way that
// claim goes wrong is by being typed into JSX where nothing checks it — an
// earlier draft advertised "500 prompts / 7 LLMs / $15.60" for a product that
// runs 10 prompts, 3 repetitions, on one engine. Here they are computed from
// WATCHER_SOLO and WATCHER_PRICES_CENTS, so a copy/product mismatch is a test
// failure rather than a support ticket.

import {
  WATCHER_PRICES_CENTS,
  WATCHER_SOLO,
  WATCHER_SOLO_BRANDS,
  type CheckupFrequency,
} from "@/lib/plan-config";

export type PricingBase = "en" | "fr";

/** Dollars a monthly subscriber pays. */
export const WATCHER_MONTHLY_USD = WATCHER_PRICES_CENTS.monthly / 100;
/** Dollars a year, charged once. */
export const WATCHER_ANNUAL_USD = WATCHER_PRICES_CENTS.annual / 100;
/** The annual plan expressed per month — the figure the annual toggle shows. */
export const WATCHER_ANNUAL_PER_MONTH_USD = WATCHER_PRICES_CENTS.annual / 12 / 100;
/** Whole percent saved by paying annually. */
export const WATCHER_SAVE_PCT = Math.round(
  (1 - WATCHER_ANNUAL_PER_MONTH_USD / WATCHER_MONTHLY_USD) * 100,
);

/**
 * Cadence as a word.
 *
 * Keyed by the CheckupFrequency enum rather than hardcoded to "Weekly", so
 * changing WATCHER_SOLO.frequency changes the sentence instead of quietly
 * contradicting it. A missing key is a type error.
 */
const FREQUENCY_WORD: Record<PricingBase, Record<CheckupFrequency, string>> = {
  en: {
    none: "No scheduled checkups",
    weekly: "Weekly checkups",
    twice_weekly: "Twice-weekly checkups",
    daily: "Daily checkups",
    custom: "Scheduled checkups",
  },
  fr: {
    none: "Aucun contrôle planifié",
    weekly: "Contrôles hebdomadaires",
    twice_weekly: "Contrôles deux fois par semaine",
    daily: "Contrôles quotidiens",
    custom: "Contrôles planifiés",
  },
};

/**
 * The Watcher card's feature list.
 *
 * The engine line names Claude alone and is NOT derived from a provider list,
 * because the constraint is not "how many engines does the shape allow" but
 * "which engines have a live adapter AND a metering rate". An engine without a
 * rate is refused by the runner, so listing it would sell something that cannot
 * run. When a second adapter ships with a rate, this line changes with it.
 */
export function watcherFeatures(base: PricingBase): string[] {
  const f = WATCHER_SOLO;
  if (base === "fr") {
    return [
      `${WATCHER_SOLO_BRANDS} marque suivie`,
      `${f.prompts} requêtes suivies`,
      FREQUENCY_WORD.fr[f.frequency],
      `${f.repetitions} répétitions par requête`,
      "Suivi des concurrents et des citations",
      "Évolution du taux de mention",
      "Réponses mesurées sur Claude",
    ];
  }
  return [
    `${WATCHER_SOLO_BRANDS} brand tracked`,
    `${f.prompts} tracked prompts`,
    FREQUENCY_WORD.en[f.frequency],
    `${f.repetitions} repetitions per prompt`,
    "Competitor and citation tracking",
    "Mention-rate trend over time",
    "Answers measured on Claude",
  ];
}
