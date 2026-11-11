// Per-plan pricing copy with no numbers in it: who each plan is for (one line
// under the price), and the Enterprise card on /pricing. Dependency-free, so
// the pricing grid (a Client Component) imports it directly.
import type { PlanType } from "@/generated/prisma";
import type { PricingBase } from "./format";

/** One line under the price: who the plan is for. */
export const PLAN_AUDIENCE: Record<PlanType, Record<PricingBase, string>> = {
  AI_VISIBILITY: {
    en: "For marketers who only need AI search visibility",
    fr: "Pour les marketeurs qui n'ont besoin que de la visibilité dans la recherche IA",
    de: "Für Marketer, die nur KI-Suchsichtbarkeit brauchen",
  },
  // Owner's line (2026-11-10).
  NOSY_BAT: {
    en: "For marketers who only need the SEO crawler that checks every page and shows its evidence.",
    fr: "Pour les marketeurs qui n'ont besoin que du robot d'exploration SEO qui vérifie chaque page et montre ses preuves.",
    de: "Für Marketer, die nur den SEO-Crawler brauchen, der jede Seite prüft und die Belege zeigt.",
  },
  STARTER: {
    en: "For solo founders and single-location businesses",
    fr: "Pour les fondateurs solo et les entreprises à un seul établissement",
    de: "Für Solo-Gründer und Unternehmen mit einem Standort",
  },
  GROWTH: {
    en: "For growing businesses and small marketing teams",
    fr: "Pour les entreprises en croissance et les petites équipes marketing",
    de: "Für wachsende Unternehmen und kleine Marketingteams",
  },
  AGENCY: {
    en: "For agencies and multi-location brands",
    fr: "Pour les agences et les marques à plusieurs établissements",
    de: "Für Agenturen und Marken mit mehreren Standorten",
  },
  ENTERPRISE: {
    en: "For larger teams that need custom limits and terms",
    fr: "Pour les grandes équipes qui ont besoin de limites et de conditions sur mesure",
    de: "Für grössere Teams mit individuellen Limits und Konditionen",
  },
};

/** The Enterprise card on /pricing (custom priced, no checkout: the sales form). */
/**
 * /pricing's Enterprise band under the cards (owner, 2026-11-10; it replaced
 * the Enterprise card in the row). The button goes to the sales form with
 * src=pricing-enterprise-band.
 */
export const ENTERPRISE_BAND: Record<PricingBase, { name: string; line: string; cta: string }> = {
  en: { name: "Enterprise", line: "Custom limits and terms for larger teams", cta: "Talk to us" },
  fr: { name: "Enterprise", line: "Limites et conditions sur mesure pour les grandes équipes", cta: "Parlons-en" },
  de: { name: "Enterprise", line: "Individuelle Limits und Konditionen für grössere Teams", cta: "Kontakt aufnehmen" },
};

export const ENTERPRISE_CARD: Record<PricingBase, { price: string; cta: string }> = {
  en: { price: "Custom", cta: "Talk to us" },
  fr: { price: "Sur mesure", cta: "Parlons-en" },
  de: { price: "Individuell", cta: "Kontakt aufnehmen" },
};
