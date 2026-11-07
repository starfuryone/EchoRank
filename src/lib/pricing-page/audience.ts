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
export const ENTERPRISE_CARD: Record<PricingBase, { price: string; cta: string }> = {
  en: { price: "Custom", cta: "Talk to us" },
  fr: { price: "Sur mesure", cta: "Parlons-en" },
  de: { price: "Individuell", cta: "Kontakt aufnehmen" },
};
