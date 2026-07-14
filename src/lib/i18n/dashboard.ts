/** Dashboard chrome i18n. fr* cookies → fr; everything else (incl. de-CH) → en for now. */
export type DashLocale = "en" | "fr";

export function dashboardLocale(cookieValue?: string | null): DashLocale {
  return cookieValue?.startsWith("fr") ? "fr" : "en";
}

export const dashNav: Record<DashLocale, Record<string, string>> = {
  en: {
    "/dashboard": "Dashboard",
    "/customers": "Customers",
    "/feedback": "Feedback",
    "/campaigns": "Campaigns",
    "/recovery": "Recovery",
    "/analytics": "Analytics",
    "/intelligence": "Intelligence",
    "/monitoring": "Monitoring",
    "/visibility": "AI Visibility",
    "/imports": "Data Sources",
    "/extension": "Extension",
    "/templates": "Templates",
    "/review-links": "Review Links",
    "/team": "Team",
    "/settings": "Settings",
    "/billing": "Billing",
  },
  fr: {
    "/dashboard": "Tableau de bord",
    "/customers": "Clients",
    "/feedback": "Rétroaction",
    "/campaigns": "Campagnes",
    "/recovery": "Récupération",
    "/analytics": "Analytique",
    "/intelligence": "Intelligence",
    "/monitoring": "Surveillance",
    "/visibility": "Visibilité IA",
    "/imports": "Sources de données",
    "/extension": "Extension",
    "/templates": "Modèles",
    "/review-links": "Liens d'avis",
    "/team": "Équipe",
    "/settings": "Paramètres",
    "/billing": "Facturation",
  },
};
