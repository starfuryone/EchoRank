// Copy for the plan allowlist's upgrade screen and locked items
// (src/lib/plan-access.ts). en / fr / de-CH, the dashboard's three locales.
import type { DashLocale } from "@/lib/i18n/dashboard";

export const PLAN_ACCESS_COPY: Record<
  DashLocale,
  { title: string; body: string; cta: string; locked: string; back: string }
> = {
  en: {
    title: "Available from Starter",
    body: "Your AI Visibility plan includes AI search visibility: monitoring, Custom Prompts, AI Trust Score, alerts, Brand Radar and AI Lens. This part of Echorank comes with the Starter plan and up.",
    cta: "See plans",
    locked: "From Starter",
    back: "Back to AI visibility",
  },
  fr: {
    title: "Disponible à partir de Starter",
    body: "Votre forfait AI Visibility comprend la visibilité dans la recherche IA : suivi, requêtes personnalisées, score de confiance IA, alertes, Brand Radar et AI Lens. Cette partie d'Echorank est incluse à partir du forfait Starter.",
    cta: "Voir les forfaits",
    locked: "À partir de Starter",
    back: "Retour à la visibilité IA",
  },
  "de-CH": {
    title: "Ab Starter verfügbar",
    body: "Ihr AI-Visibility-Abo umfasst die KI-Suchsichtbarkeit: Monitoring, eigene Prompts, AI Trust Score, Benachrichtigungen, Brand Radar und AI Lens. Dieser Teil von Echorank ist ab dem Starter-Abo enthalten.",
    cta: "Abos ansehen",
    locked: "Ab Starter",
    back: "Zurück zur KI-Sichtbarkeit",
  },
};
