// Copy for the plan allowlist's upgrade screen and locked items
// (src/lib/plan-access.ts). en / fr / de-CH, the dashboard's three locales.
// The body and the back link name what the restricted plan HAS: the AI-only
// plan's AI visibility, or the crawler-only plan's crawler (2026-11-10).
import type { DashLocale } from "@/lib/i18n/dashboard";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";

const NB = CRAWLER_BRAND.name;

export interface PlanAccessCopy {
  title: string;
  body: string;
  cta: string;
  locked: string;
  back: string;
  /** The crawler-only plan's upgrade screen. */
  bodyCrawler: string;
  backCrawler: string;
  /** The one link the crawler-only plan's sidebar and tools hub show beyond what it has. */
  upgradeMore: string;
}

export const PLAN_ACCESS_COPY: Record<DashLocale, PlanAccessCopy> = {
  en: {
    title: "Available from Starter",
    body: "Your AI Visibility plan includes AI search visibility: monitoring, Custom Prompts, AI Trust Score, alerts, Brand Radar and AI Lens. This part of Echorank comes with the Starter plan and up.",
    cta: "See plans",
    locked: "From Starter",
    back: "Back to AI visibility",
    bodyCrawler: `Your ${NB} plan includes the ${NB} crawler: crawls, schedules, comparisons, reports and the Search Console, GA4 and PageSpeed data it joins. This part of Echorank comes with the Starter plan and up.`,
    backCrawler: `Back to ${NB}`,
    upgradeMore: "Upgrade for more tools",
  },
  fr: {
    title: "Disponible à partir de Starter",
    body: "Votre forfait AI Visibility comprend la visibilité dans la recherche IA : suivi, requêtes personnalisées, score de confiance IA, alertes, Brand Radar et AI Lens. Cette partie d'Echorank est incluse à partir du forfait Starter.",
    cta: "Voir les forfaits",
    locked: "À partir de Starter",
    back: "Retour à la visibilité IA",
    bodyCrawler: `Votre forfait ${NB} comprend le robot d'exploration ${NB} : explorations, planification, comparaisons, rapports et les données Search Console, GA4 et PageSpeed qu'il joint. Cette partie d'Echorank est incluse à partir du forfait Starter.`,
    backCrawler: `Retour à ${NB}`,
    upgradeMore: "Plus d'outils avec un forfait supérieur",
  },
  "de-CH": {
    title: "Ab Starter verfügbar",
    body: "Ihr AI-Visibility-Abo umfasst die KI-Suchsichtbarkeit: Monitoring, eigene Prompts, AI Trust Score, Benachrichtigungen, Brand Radar und AI Lens. Dieser Teil von Echorank ist ab dem Starter-Abo enthalten.",
    cta: "Abos ansehen",
    locked: "Ab Starter",
    back: "Zurück zur KI-Sichtbarkeit",
    bodyCrawler: `Ihr ${NB}-Abo umfasst den ${NB}-Crawler: Crawls, Zeitpläne, Vergleiche, Berichte und die Daten aus Search Console, GA4 und PageSpeed, die er verknüpft. Dieser Teil von Echorank ist ab dem Starter-Abo enthalten.`,
    backCrawler: `Zurück zu ${NB}`,
    upgradeMore: "Mehr Werkzeuge mit einem Upgrade",
  },
};
