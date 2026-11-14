// Copy for the plan allowlist's upgrade screen and locked items
// (src/lib/plan-access.ts). en / fr / de-CH, the dashboard's three locales.
// The body and the back link name what the restricted plan HAS: the AI-only
// plan's AI visibility, or the crawler-only plan's crawler (2026-11-10).
//
// EVERY PLAN NAME IS A PARAMETER (2026-11-14). The plan that includes a locked
// thing is computed per tool and per current plan by src/lib/upgrade-target.ts
// and passed in; no string here names a plan. Until then every one said
// "Starter", which was wrong for the tools Starter does not unlock.
import type { DashLocale } from "@/lib/i18n/dashboard";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";

const NB = CRAWLER_BRAND.name;

/** French "de" before a plan name, elided before a vowel (d'Agency, de Starter). */
const frDe = (plan: string) => (/^[aeiouy]/i.test(plan) ? `d'${plan}` : `de ${plan}`);

export interface PlanAccessCopy {
  title: (plan: string) => string;
  body: (plan: string) => string;
  cta: string;
  locked: (plan: string) => string;
  back: string;
  /** The crawler-only plan's upgrade screen. */
  bodyCrawler: (plan: string) => string;
  backCrawler: string;
  /** No plan includes it (cannot happen with today's configs; never a blank name). */
  titleNoPlan: string;
  /** The one link the crawler-only plan's sidebar and tools hub show beyond what it has. */
  upgradeMore: string;
  /** The API access and MCP Server pages below the plan with API access (src/lib/api-access.ts). */
  apiLockedTitle: (plan: string) => string;
  apiLockedBody: string;
}

export const PLAN_ACCESS_COPY: Record<DashLocale, PlanAccessCopy> = {
  en: {
    title: (plan) => `Available from ${plan}`,
    body: (plan) =>
      `Your AI Visibility plan includes AI search visibility: monitoring, Custom Prompts, AI Trust Score, alerts, Brand Radar and AI Lens. This part of Echorank comes with the ${plan} plan and up.`,
    cta: "See plans",
    locked: (plan) => `From ${plan}`,
    back: "Back to AI visibility",
    bodyCrawler: (plan) =>
      `Your ${NB} plan includes the ${NB} crawler: crawls, schedules, comparisons, reports and the Search Console, GA4 and PageSpeed data it joins. This part of Echorank comes with the ${plan} plan and up.`,
    backCrawler: `Back to ${NB}`,
    titleNoPlan: "Not included in your plan",
    upgradeMore: "Upgrade for more tools",
    apiLockedTitle: (plan) => `API access is included in ${plan}`,
    apiLockedBody:
      "API keys for the REST API and the MCP server, which connects Claude and other AI assistants to your data, come with this plan. Keys you created before are kept and work again after an upgrade.",
  },
  fr: {
    title: (plan) => `Disponible à partir ${frDe(plan)}`,
    body: (plan) =>
      `Votre forfait AI Visibility comprend la visibilité dans la recherche IA : suivi, requêtes personnalisées, score de confiance IA, alertes, Brand Radar et AI Lens. Cette partie d'Echorank est incluse à partir du forfait ${plan}.`,
    cta: "Voir les forfaits",
    locked: (plan) => `À partir ${frDe(plan)}`,
    back: "Retour à la visibilité IA",
    bodyCrawler: (plan) =>
      `Votre forfait ${NB} comprend le robot d'exploration ${NB} : explorations, planification, comparaisons, rapports et les données Search Console, GA4 et PageSpeed qu'il joint. Cette partie d'Echorank est incluse à partir du forfait ${plan}.`,
    backCrawler: `Retour à ${NB}`,
    titleNoPlan: "Non inclus dans votre forfait",
    upgradeMore: "Plus d'outils avec un forfait supérieur",
    apiLockedTitle: (plan) => `L'accès à l'API est inclus dans le forfait ${plan}`,
    apiLockedBody:
      "Les clés de l'API REST et le serveur MCP, qui relie Claude et d'autres assistants IA à vos données, sont inclus dans ce forfait. Les clés créées auparavant sont conservées et fonctionnent de nouveau après un changement de forfait.",
  },
  "de-CH": {
    title: (plan) => `Ab ${plan} verfügbar`,
    body: (plan) =>
      `Ihr AI-Visibility-Abo umfasst die KI-Suchsichtbarkeit: Monitoring, eigene Prompts, AI Trust Score, Benachrichtigungen, Brand Radar und AI Lens. Dieser Teil von Echorank ist ab dem ${plan}-Abo enthalten.`,
    cta: "Abos ansehen",
    locked: (plan) => `Ab ${plan}`,
    back: "Zurück zur KI-Sichtbarkeit",
    bodyCrawler: (plan) =>
      `Ihr ${NB}-Abo umfasst den ${NB}-Crawler: Crawls, Zeitpläne, Vergleiche, Berichte und die Daten aus Search Console, GA4 und PageSpeed, die er verknüpft. Dieser Teil von Echorank ist ab dem ${plan}-Abo enthalten.`,
    backCrawler: `Zurück zu ${NB}`,
    titleNoPlan: "Nicht in Ihrem Abo enthalten",
    upgradeMore: "Mehr Werkzeuge mit einem Upgrade",
    apiLockedTitle: (plan) => `API-Zugang ist im ${plan}-Abo enthalten`,
    apiLockedBody:
      "API-Schlüssel für die REST-API und der MCP-Server, der Claude und andere KI-Assistenten mit Ihren Daten verbindet, sind in diesem Abo enthalten. Bereits erstellte Schlüssel bleiben erhalten und funktionieren nach einem Upgrade wieder.",
  },
};
