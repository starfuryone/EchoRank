/**
 * Dashboard i18n: chrome (nav/header) + per-page copy catalogs.
 * Cookie mapping: fr* → fr (Québec French, shared by fr and fr-CA),
 * de* → de-CH (Swiss German, "ss" never "ß"), everything else (incl. en-CA) → en.
 */
import type {
  SeoToolGroupId,
  SeoToolId,
  ScaffoldId,
} from "@/lib/seo-tools";
import type { SerpLanguageCode, SerpLocationCode } from "@/lib/serp/options";
export type DashLocale = "en" | "fr" | "de-CH";

export function dashboardLocale(cookieValue?: string | null): DashLocale {
  if (cookieValue?.startsWith("fr")) return "fr";
  if (cookieValue?.startsWith("de")) return "de-CH";
  return "en";
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
    "/settings/account": "Account",
    "/billing": "Billing",
    // SEO Tools hub surfaces (sidebar label + header titles)
    "/visibility/keywords": "Keywords Explorer",
    "/visibility/tools": "SEO Tools",
    "/visibility/tools/site-explorer": "Site Explorer",
    "/visibility/tools/rank-tracker": "Rank Tracker",
    "/visibility/tools/gsc-insights": "GSC Insights",
    "/visibility/tools/brand-radar": "Brand Radar",
    "/visibility/tools/web-analytics": "Web Analytics",
    "/visibility/tools/bot-analytics": "Bot Analytics",
    "/visibility/tools/content-explorer": "Content Explorer",
    "/visibility/tools/ai-content-helper": "AI Content Helper",
    "/visibility/tools/social-media-manager": "Social Media Manager",
    "/visibility/tools/portfolios": "Portfolios",
    "/visibility/tools/report-builder": "Report Builder",
    "/visibility/tools/gbp-monitor": "GBP Monitor",
    "/visibility/tools/api-access": "API access",
    "/visibility/tools/mcp-server": "MCP Server",
    "/visibility/tools/classic": "Classic SEO Tools",
    "/visibility/tools/serp-checker": "SERP Checker",
    "/visibility/tools/backlinks": "Backlinks",
    "/visibility/tools/lighthouse": "Lighthouse",
  },
  "de-CH": {
    "/dashboard": "Dashboard",
    "/customers": "Kunden",
    "/feedback": "Feedback",
    "/campaigns": "Kampagnen",
    "/recovery": "Rückgewinnung",
    "/analytics": "Analysen",
    "/intelligence": "Intelligence",
    "/monitoring": "Überwachung",
    "/visibility": "KI-Sichtbarkeit",
    "/imports": "Datenquellen",
    "/extension": "Erweiterung",
    "/templates": "Vorlagen",
    "/review-links": "Bewertungslinks",
    "/team": "Team",
    "/settings": "Einstellungen",
    "/settings/account": "Konto",
    "/billing": "Abrechnung",
    "/visibility/keywords": "Keywords Explorer",
    "/visibility/tools": "SEO-Tools",
    "/visibility/tools/site-explorer": "Site Explorer",
    "/visibility/tools/rank-tracker": "Rank Tracker",
    "/visibility/tools/gsc-insights": "GSC Insights",
    "/visibility/tools/brand-radar": "Brand Radar",
    "/visibility/tools/web-analytics": "Web-Analytics",
    "/visibility/tools/bot-analytics": "Bot-Analytics",
    "/visibility/tools/content-explorer": "Content Explorer",
    "/visibility/tools/ai-content-helper": "KI-Content-Assistent",
    "/visibility/tools/social-media-manager": "Social-Media-Manager",
    "/visibility/tools/portfolios": "Portfolios",
    "/visibility/tools/report-builder": "Report Builder",
    "/visibility/tools/gbp-monitor": "GBP-Monitor",
    "/visibility/tools/api-access": "API-Zugriff",
    "/visibility/tools/mcp-server": "MCP-Server",
    "/visibility/tools/classic": "Klassische SEO-Tools",
    "/visibility/tools/serp-checker": "SERP-Checker",
    "/visibility/tools/backlinks": "Backlinks",
    "/visibility/tools/lighthouse": "Lighthouse",
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
    "/settings/account": "Compte",
    "/billing": "Facturation",
    "/visibility/keywords": "Explorateur de mots-clés",
    "/visibility/tools": "Outils SEO",
    "/visibility/tools/site-explorer": "Explorateur de sites",
    "/visibility/tools/rank-tracker": "Suivi des positions",
    "/visibility/tools/gsc-insights": "Analyses GSC",
    "/visibility/tools/brand-radar": "Radar de marque",
    "/visibility/tools/web-analytics": "Analytique web",
    "/visibility/tools/bot-analytics": "Analytique des robots",
    "/visibility/tools/content-explorer": "Explorateur de contenu",
    "/visibility/tools/ai-content-helper": "Assistant de contenu IA",
    "/visibility/tools/social-media-manager": "Gestionnaire de médias sociaux",
    "/visibility/tools/portfolios": "Portefeuilles",
    "/visibility/tools/report-builder": "Générateur de rapports",
    "/visibility/tools/gbp-monitor": "Suivi GBP",
    "/visibility/tools/api-access": "Accès API",
    "/visibility/tools/mcp-server": "Serveur MCP",
    "/visibility/tools/classic": "Outils SEO classiques",
    "/visibility/tools/serp-checker": "Vérificateur SERP",
    "/visibility/tools/backlinks": "Liens retour",
    "/visibility/tools/lighthouse": "Lighthouse",
  },
};

// ─── Header chrome ──────────────────────────────────────────────────────────
export const dashChrome: Record<
  DashLocale,
  { toggleSidebar: string; notifications: string; signOut: string; user: string }
> = {
  en: {
    toggleSidebar: "Toggle sidebar",
    notifications: "Notifications",
    signOut: "Sign out",
    user: "User",
  },
  fr: {
    toggleSidebar: "Afficher ou masquer le menu",
    notifications: "Notifications",
    signOut: "Se déconnecter",
    user: "Utilisateur",
  },
  "de-CH": {
    toggleSidebar: "Seitenleiste umschalten",
    notifications: "Benachrichtigungen",
    signOut: "Abmelden",
    user: "Benutzer",
  },
};

// ─── /extension ─────────────────────────────────────────────────────────────
const extensionEn = {
  title: "Browser Extension",
  subtitle:
    "Import reviews from Google, Facebook, and Trustpilot pages directly into Echorank.",
  loadFailed: "Failed to load tokens",
  createFailed: "Failed to create token",
  actionFailed: "Action failed",
  revokeConfirm:
    "Revoke this token? The extension using it will stop working immediately.",
  copyOnce: "Copy your token now — it is shown only once.",
  copy: "Copy",
  pasteHint:
    "Paste it into the extension popup → Settings. Then visit a review page and click Scan.",
  done: "Done",
  createTitle: "Create an extension token",
  labelLabel: "Label",
  labelPlaceholder: "Chrome on work laptop",
  createButton: "Create token",
  yourTokens: "Your tokens",
  loading: "Loading…",
  emptyTitle: "No tokens yet",
  emptyDescription:
    "Create a token above, then paste it into the extension to start importing reviews.",
  statusActive: "Active",
  statusRevoked: "Revoked",
  statusExpired: "Expired",
  created: (date: string) => `created ${date}`,
  lastUsed: (date: string) => `last used ${date}`,
  neverUsed: "never used",
  rotate: "Rotate",
  revoke: "Revoke",
  finePrint:
    "Imported reviews appear under Monitoring and Data Sources, and are automatically analyzed for sentiment, themes, and reputation risk.",
};
export type ExtensionCopy = typeof extensionEn;

export const EXTENSION_COPY: Record<DashLocale, ExtensionCopy> = {
  en: extensionEn,
  fr: {
    title: "Extension de navigateur",
    subtitle:
      "Importez des avis depuis les pages Google, Facebook et Trustpilot directement dans Echorank.",
    loadFailed: "Échec du chargement des jetons",
    createFailed: "Échec de la création du jeton",
    actionFailed: "Échec de l'action",
    revokeConfirm:
      "Révoquer ce jeton? L'extension qui l'utilise cessera de fonctionner immédiatement.",
    copyOnce: "Copiez votre jeton maintenant — il n'est affiché qu'une seule fois.",
    copy: "Copier",
    pasteHint:
      "Collez-le dans la fenêtre de l'extension → Paramètres. Visitez ensuite une page d'avis et cliquez sur Scan.",
    done: "Terminé",
    createTitle: "Créer un jeton d'extension",
    labelLabel: "Étiquette",
    labelPlaceholder: "Chrome sur le portable du travail",
    createButton: "Créer un jeton",
    yourTokens: "Vos jetons",
    loading: "Chargement…",
    emptyTitle: "Aucun jeton pour l'instant",
    emptyDescription:
      "Créez un jeton ci-dessus, puis collez-le dans l'extension pour commencer à importer des avis.",
    statusActive: "Actif",
    statusRevoked: "Révoqué",
    statusExpired: "Expiré",
    created: (date: string) => `créé le ${date}`,
    lastUsed: (date: string) => `dernière utilisation le ${date}`,
    neverUsed: "jamais utilisé",
    rotate: "Renouveler",
    revoke: "Révoquer",
    finePrint:
      "Les avis importés apparaissent sous Surveillance et Sources de données, et sont automatiquement analysés pour le sentiment, les thèmes et le risque de réputation.",
  },
  "de-CH": {
    title: "Browser-Erweiterung",
    subtitle:
      "Importieren Sie Bewertungen von Google-, Facebook- und Trustpilot-Seiten direkt in Echorank.",
    loadFailed: "Tokens konnten nicht geladen werden",
    createFailed: "Token konnte nicht erstellt werden",
    actionFailed: "Aktion fehlgeschlagen",
    revokeConfirm:
      "Diesen Token widerrufen? Die Erweiterung, die ihn verwendet, funktioniert sofort nicht mehr.",
    copyOnce: "Kopieren Sie Ihren Token jetzt — er wird nur einmal angezeigt.",
    copy: "Kopieren",
    pasteHint:
      "Fügen Sie ihn im Erweiterungs-Popup unter → Einstellungen ein. Öffnen Sie dann eine Bewertungsseite und klicken Sie auf Scan.",
    done: "Fertig",
    createTitle: "Erweiterungs-Token erstellen",
    labelLabel: "Bezeichnung",
    labelPlaceholder: "Chrome auf dem Arbeitslaptop",
    createButton: "Token erstellen",
    yourTokens: "Ihre Tokens",
    loading: "Wird geladen…",
    emptyTitle: "Noch keine Tokens",
    emptyDescription:
      "Erstellen Sie oben einen Token und fügen Sie ihn in die Erweiterung ein, um Bewertungen zu importieren.",
    statusActive: "Aktiv",
    statusRevoked: "Widerrufen",
    statusExpired: "Abgelaufen",
    created: (date: string) => `erstellt am ${date}`,
    lastUsed: (date: string) => `zuletzt verwendet am ${date}`,
    neverUsed: "nie verwendet",
    rotate: "Erneuern",
    revoke: "Widerrufen",
    finePrint:
      "Importierte Bewertungen erscheinen unter Überwachung und Datenquellen und werden automatisch auf Stimmung, Themen und Reputationsrisiko analysiert.",
  },
};

// ─── /analytics ─────────────────────────────────────────────────────────────
const analyticsEn = {
  title: "Analytics",
  subtitle: "Track your reputation performance over time.",
  loadFailed: "Failed to load analytics",
  genericError: "Something went wrong",
  errorTitle: "Failed to load analytics",
  retry: "Retry",
  help: "Help",
  range7: "Last 7 days",
  range30: "Last 30 days",
  range90: "Last 90 days",
  range365: "Last 12 months",
  statSent: "Total Sent",
  statResponses: "Responses",
  responseRate: (pct: number) => `${pct}% response rate`,
  statAvgRating: "Avg Rating",
  statPositive: "Positive (4-5)",
  statNegative: "Negative (1-2)",
  statRecoveryOpen: "Recovery Open",
  ratingValue: (n: number) => n.toFixed(1),
  ratingDistribution: "Rating Distribution",
  noRatings: "No ratings data available yet.",
  ratingLabels: {
    5: "Excellent",
    4: "Good",
    3: "Neutral",
    2: "Poor",
    1: "Terrible",
  } as Record<number, string>,
  countPct: (count: number, pct: number) => `${count} (${pct}%)`,
  responseRateOverTime: "Response Rate Over Time",
  noResponses: "No response data available yet.",
  weekRatio: (responses: number, sent: number, rate: number) =>
    `${responses}/${sent} (${rate}%)`,
  legendSent: "Sent",
  legendResponses: "Responses",
  topLocations: "Top Performing Locations",
  noLocations: "No location data available yet.",
  responsesCount: (n: number) =>
    n === 1 ? "1 response" : `${n} responses`,
  satisfactionTrend: "Customer Satisfaction Trend",
  noTrend: "No trend data available yet.",
  scoreOutOf: (score: number) => `${score.toFixed(1)} / 5.0`,
  helpTitle: "Reading your analytics",
  helpIntro:
    "Everything here reflects the period chosen in the date selector (last 7, 30, 90 days, or 12 months). Change it to widen or narrow the view.",
  helpStatsTitle: "The numbers up top",
  helpStatsBody:
    "Sent and Responses show how many feedback requests went out and came back; Avg Rating is the mean score. Positive and Negative split those responses, and Recovery Open counts low-rating tickets still being worked.",
  helpDistTitle: "Rating distribution",
  helpDistBody:
    "How responses break down across 1 to 5 stars, so you can see whether scores cluster high or low.",
  helpWeekTitle: "Response rate by week",
  helpWeekBody:
    "Requests sent versus responses received each week — a read on how engaged your customers are over time.",
  helpLocTitle: "Top locations & satisfaction trend",
  helpLocBody:
    "Average rating per location helps you spot which sites need attention, while the satisfaction trend shows whether your overall score is moving up or down.",
  gotIt: "Got it",
};
export type AnalyticsCopy = typeof analyticsEn;

export const ANALYTICS_COPY: Record<DashLocale, AnalyticsCopy> = {
  en: analyticsEn,
  fr: {
    title: "Analytique",
    subtitle: "Suivez la performance de votre réputation au fil du temps.",
    loadFailed: "Échec du chargement de l'analytique",
    genericError: "Une erreur s'est produite",
    errorTitle: "Échec du chargement de l'analytique",
    retry: "Réessayer",
    help: "Aide",
    range7: "7 derniers jours",
    range30: "30 derniers jours",
    range90: "90 derniers jours",
    range365: "12 derniers mois",
    statSent: "Total envoyé",
    statResponses: "Réponses",
    responseRate: (pct: number) => `Taux de réponse de ${pct} %`,
    statAvgRating: "Note moyenne",
    statPositive: "Positifs (4-5)",
    statNegative: "Négatifs (1-2)",
    statRecoveryOpen: "Récupérations ouvertes",
    ratingValue: (n: number) =>
      n.toLocaleString("fr", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    ratingDistribution: "Répartition des notes",
    noRatings: "Aucune donnée de notes pour l'instant.",
    ratingLabels: {
      5: "Excellent",
      4: "Bon",
      3: "Neutre",
      2: "Mauvais",
      1: "Très mauvais",
    } as Record<number, string>,
    countPct: (count: number, pct: number) => `${count} (${pct} %)`,
    responseRateOverTime: "Taux de réponse au fil du temps",
    noResponses: "Aucune donnée de réponses pour l'instant.",
    weekRatio: (responses: number, sent: number, rate: number) =>
      `${responses}/${sent} (${rate} %)`,
    legendSent: "Envoyées",
    legendResponses: "Réponses",
    topLocations: "Emplacements les plus performants",
    noLocations: "Aucune donnée d'emplacement pour l'instant.",
    responsesCount: (n: number) =>
      n === 1 ? "1 réponse" : `${n} réponses`,
    satisfactionTrend: "Tendance de satisfaction client",
    noTrend: "Aucune donnée de tendance pour l'instant.",
    scoreOutOf: (score: number) =>
      `${score.toLocaleString("fr", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} / 5,0`,
    helpTitle: "Comprendre votre analytique",
    helpIntro:
      "Tout ce qui s'affiche ici reflète la période choisie dans le sélecteur de dates (7, 30 ou 90 derniers jours, ou 12 derniers mois). Modifiez-la pour élargir ou réduire la vue.",
    helpStatsTitle: "Les chiffres en haut",
    helpStatsBody:
      "Total envoyé et Réponses indiquent combien de demandes de rétroaction sont parties et sont revenues; Note moyenne est la moyenne des scores. Positifs et Négatifs répartissent ces réponses, et Récupérations ouvertes compte les billets à faible note encore en traitement.",
    helpDistTitle: "Répartition des notes",
    helpDistBody:
      "Comment les réponses se répartissent de 1 à 5 étoiles, pour voir si les scores se concentrent vers le haut ou vers le bas.",
    helpWeekTitle: "Taux de réponse par semaine",
    helpWeekBody:
      "Demandes envoyées par rapport aux réponses reçues chaque semaine — un indicateur de l'engagement de vos clients au fil du temps.",
    helpLocTitle: "Meilleurs emplacements et tendance de satisfaction",
    helpLocBody:
      "La note moyenne par emplacement vous aide à repérer les sites qui demandent votre attention, tandis que la tendance de satisfaction montre si votre score global monte ou descend.",
    gotIt: "Compris",
  },
  "de-CH": {
    title: "Analysen",
    subtitle: "Verfolgen Sie die Entwicklung Ihrer Reputation im Zeitverlauf.",
    loadFailed: "Analysen konnten nicht geladen werden",
    genericError: "Etwas ist schiefgelaufen",
    errorTitle: "Analysen konnten nicht geladen werden",
    retry: "Erneut versuchen",
    help: "Hilfe",
    range7: "Letzte 7 Tage",
    range30: "Letzte 30 Tage",
    range90: "Letzte 90 Tage",
    range365: "Letzte 12 Monate",
    statSent: "Gesamt gesendet",
    statResponses: "Antworten",
    responseRate: (pct: number) => `${pct} % Antwortquote`,
    statAvgRating: "Durchschnittsbewertung",
    statPositive: "Positiv (4-5)",
    statNegative: "Negativ (1-2)",
    statRecoveryOpen: "Offene Rückgewinnungen",
    ratingValue: (n: number) => n.toFixed(1),
    ratingDistribution: "Bewertungsverteilung",
    noRatings: "Noch keine Bewertungsdaten verfügbar.",
    ratingLabels: {
      5: "Ausgezeichnet",
      4: "Gut",
      3: "Neutral",
      2: "Schlecht",
      1: "Sehr schlecht",
    } as Record<number, string>,
    countPct: (count: number, pct: number) => `${count} (${pct} %)`,
    responseRateOverTime: "Antwortquote im Zeitverlauf",
    noResponses: "Noch keine Antwortdaten verfügbar.",
    weekRatio: (responses: number, sent: number, rate: number) =>
      `${responses}/${sent} (${rate} %)`,
    legendSent: "Gesendet",
    legendResponses: "Antworten",
    topLocations: "Leistungsstärkste Standorte",
    noLocations: "Noch keine Standortdaten verfügbar.",
    responsesCount: (n: number) =>
      n === 1 ? "1 Antwort" : `${n} Antworten`,
    satisfactionTrend: "Trend der Kundenzufriedenheit",
    noTrend: "Noch keine Trenddaten verfügbar.",
    scoreOutOf: (score: number) => `${score.toFixed(1)} / 5.0`,
    helpTitle: "Ihre Analysen verstehen",
    helpIntro:
      "Alles hier bezieht sich auf den im Datumswähler gewählten Zeitraum (letzte 7, 30, 90 Tage oder 12 Monate). Ändern Sie ihn, um die Ansicht zu erweitern oder einzugrenzen.",
    helpStatsTitle: "Die Zahlen oben",
    helpStatsBody:
      "Gesamt gesendet und Antworten zeigen, wie viele Feedback-Anfragen verschickt wurden und zurückkamen; Durchschnittsbewertung ist der Mittelwert. Positiv und Negativ teilen diese Antworten auf, und Offene Rückgewinnungen zählt Tickets mit tiefer Bewertung, die noch bearbeitet werden.",
    helpDistTitle: "Bewertungsverteilung",
    helpDistBody:
      "Wie sich die Antworten auf 1 bis 5 Sterne verteilen — so sehen Sie, ob sich die Bewertungen oben oder unten häufen.",
    helpWeekTitle: "Antwortquote pro Woche",
    helpWeekBody:
      "Gesendete Anfragen im Vergleich zu erhaltenen Antworten pro Woche — ein Hinweis darauf, wie engagiert Ihre Kunden im Zeitverlauf sind.",
    helpLocTitle: "Top-Standorte und Zufriedenheitstrend",
    helpLocBody:
      "Die Durchschnittsbewertung pro Standort hilft Ihnen zu erkennen, welche Standorte Aufmerksamkeit benötigen, während der Zufriedenheitstrend zeigt, ob sich Ihr Gesamtwert nach oben oder unten bewegt.",
    gotIt: "Verstanden",
  },
};

// ─── /billing ───────────────────────────────────────────────────────────────
const billingEn = {
  title: "Billing",
  subtitle: "Manage your subscription and view usage.",
  loadFailed: "Failed to load billing data",
  genericError: "Something went wrong",
  errorTitle: "Failed to load billing",
  retry: "Retry",
  // Plan names (Starter, Growth, Agency, AI Visibility) are product names —
  // they stay English in every locale; only the wording around them changes.
  planTitle: (plan: string) => `${plan} Plan`,
  statusLabels: {
    ACTIVE: "Active",
    TRIALING: "Trial",
    PAST_DUE: "Past due",
    CANCELED: "Canceled",
    CANCELLED: "Canceled",
    INACTIVE: "Inactive",
    PENDING: "Pending",
  } as Record<string, string>,
  perMonth: "/month",
  renews: (date: string) => `Renews ${date}`,
  cancelsAtPeriodEnd: "Cancels at period end",
  usageTitle: "Usage This Month",
  feedbackRequests: "Feedback Requests",
  usagePct: (pct: number) => `${pct}% of your monthly limit used`,
  plansTitle: "Plans",
  pricesInUsd: "All prices are in US dollars (USD). If you pay with a card in another currency, your bank converts the charge at its own exchange rate.",
  contactUs: "Contact us",
  popular: "Popular",
  currentPlan: "Current Plan",
  upgradeTo: (plan: string) => `Upgrade to ${plan}`,
  downgradeTo: (plan: string) => `Downgrade to ${plan}`,
  confirmChange: (isUpgrade: boolean, plan: string, price: number) =>
    `Are you sure you want to ${isUpgrade ? "upgrade" : "downgrade"} to the ${plan} plan ($${price}/mo)?`,
  changeFailed: "Failed to change plan. Please try again.",
  planFeatures: {
    AI_VISIBILITY: [
      "1 location",
      "AI answer tracking across 4 engines",
      "Prompt trends over time",
      "Lost-recommendation alerts",
      "AI Trust Score",
      "Email support",
    ],
    STARTER: [
      "1 location",
      "300 feedback requests/mo",
      "Email channel only",
      "Basic analytics",
      "Email support",
    ],
    GROWTH: [
      "3 locations",
      "2,000 feedback requests/mo",
      "Email + SMS channels",
      "Advanced analytics",
      "Priority support",
      "Custom templates",
      "Team management (5 seats)",
    ],
    AGENCY: [
      "20 locations",
      "10,000 feedback requests/mo",
      "Email + SMS channels",
      "Full analytics suite",
      "Dedicated support",
      "Custom templates",
      "Unlimited team seats",
      "White-label branding",
      "Custom domain",
      "API access",
    ],
  } as Record<string, string[]>,
};
export type BillingCopy = typeof billingEn;

export const BILLING_COPY: Record<DashLocale, BillingCopy> = {
  en: billingEn,
  fr: {
    title: "Facturation",
    subtitle: "Gérez votre abonnement et consultez votre utilisation.",
    loadFailed: "Échec du chargement des données de facturation",
    genericError: "Une erreur s'est produite",
    errorTitle: "Échec du chargement de la facturation",
    retry: "Réessayer",
    planTitle: (plan: string) => `Forfait ${plan}`,
    statusLabels: {
      ACTIVE: "Actif",
      TRIALING: "Essai",
      PAST_DUE: "En souffrance",
      CANCELED: "Annulé",
      CANCELLED: "Annulé",
      INACTIVE: "Inactif",
      PENDING: "En attente",
    } as Record<string, string>,
    perMonth: "/mois",
    renews: (date: string) => `Renouvellement le ${date}`,
    cancelsAtPeriodEnd: "S'annule à la fin de la période",
    usageTitle: "Utilisation ce mois-ci",
    feedbackRequests: "Demandes de rétroaction",
    usagePct: (pct: number) =>
      `${pct} % de votre limite mensuelle utilisée`,
    plansTitle: "Forfaits",
    pricesInUsd: "Tous les prix sont en dollars américains (USD). Si vous payez avec une carte dans une autre devise, votre banque effectue la conversion à son propre taux de change.",
    contactUs: "Contactez-nous",
    popular: "Populaire",
    currentPlan: "Forfait actuel",
    upgradeTo: (plan: string) => `Passer au forfait ${plan}`,
    downgradeTo: (plan: string) => `Rétrograder vers ${plan}`,
    confirmChange: (isUpgrade: boolean, plan: string, price: number) =>
      isUpgrade
        ? `Voulez-vous vraiment passer au forfait ${plan} (${price} $/mois)?`
        : `Voulez-vous vraiment rétrograder vers le forfait ${plan} (${price} $/mois)?`,
    changeFailed: "Échec du changement de forfait. Veuillez réessayer.",
    planFeatures: {
      AI_VISIBILITY: [
        "1 emplacement",
        "Suivi des réponses IA sur 4 moteurs",
        "Tendances des requêtes au fil du temps",
        "Alertes de recommandations perdues",
        "AI Trust Score",
        "Soutien par courriel",
      ],
      STARTER: [
        "1 emplacement",
        "300 demandes de rétroaction/mois",
        "Canal courriel seulement",
        "Analytique de base",
        "Soutien par courriel",
      ],
      GROWTH: [
        "3 emplacements",
        "2 000 demandes de rétroaction/mois",
        "Canaux courriel + SMS",
        "Analytique avancée",
        "Soutien prioritaire",
        "Modèles personnalisés",
        "Gestion d'équipe (5 sièges)",
      ],
      AGENCY: [
        "20 emplacements",
        "10 000 demandes de rétroaction/mois",
        "Canaux courriel + SMS",
        "Suite analytique complète",
        "Soutien dédié",
        "Modèles personnalisés",
        "Sièges d'équipe illimités",
        "Image de marque en marque blanche",
        "Domaine personnalisé",
        "Accès API",
      ],
    } as Record<string, string[]>,
  },
  "de-CH": {
    title: "Abrechnung",
    subtitle: "Verwalten Sie Ihr Abonnement und sehen Sie Ihre Nutzung ein.",
    loadFailed: "Abrechnungsdaten konnten nicht geladen werden",
    genericError: "Etwas ist schiefgelaufen",
    errorTitle: "Abrechnung konnte nicht geladen werden",
    retry: "Erneut versuchen",
    planTitle: (plan: string) => `${plan}-Plan`,
    statusLabels: {
      ACTIVE: "Aktiv",
      TRIALING: "Testphase",
      PAST_DUE: "Überfällig",
      CANCELED: "Gekündigt",
      CANCELLED: "Gekündigt",
      INACTIVE: "Inaktiv",
      PENDING: "Ausstehend",
    } as Record<string, string>,
    perMonth: "/Monat",
    renews: (date: string) => `Verlängert sich am ${date}`,
    cancelsAtPeriodEnd: "Wird am Ende der Laufzeit gekündigt",
    usageTitle: "Nutzung in diesem Monat",
    feedbackRequests: "Feedback-Anfragen",
    usagePct: (pct: number) =>
      `${pct} % Ihres monatlichen Limits verbraucht`,
    plansTitle: "Pläne",
    pricesInUsd: "Alle Preise in US-Dollar (USD). Bei Zahlung mit einer Karte in einer anderen Währung rechnet Ihre Bank den Betrag zu ihrem eigenen Wechselkurs um.",
    contactUs: "Kontaktieren Sie uns",
    popular: "Beliebt",
    currentPlan: "Aktueller Plan",
    upgradeTo: (plan: string) => `Upgrade auf ${plan}`,
    downgradeTo: (plan: string) => `Downgrade auf ${plan}`,
    confirmChange: (isUpgrade: boolean, plan: string, price: number) =>
      isUpgrade
        ? `Möchten Sie wirklich ein Upgrade auf den ${plan}-Plan durchführen ($${price}/Monat)?`
        : `Möchten Sie wirklich ein Downgrade auf den ${plan}-Plan durchführen ($${price}/Monat)?`,
    changeFailed:
      "Planwechsel fehlgeschlagen. Bitte versuchen Sie es erneut.",
    planFeatures: {
      AI_VISIBILITY: [
        "1 Standort",
        "KI-Antwort-Tracking über 4 Engines",
        "Prompt-Trends im Zeitverlauf",
        "Warnungen bei verlorenen Empfehlungen",
        "AI Trust Score",
        "E-Mail-Support",
      ],
      STARTER: [
        "1 Standort",
        "300 Feedback-Anfragen/Monat",
        "Nur E-Mail-Kanal",
        "Basis-Analysen",
        "E-Mail-Support",
      ],
      GROWTH: [
        "3 Standorte",
        "2'000 Feedback-Anfragen/Monat",
        "E-Mail- + SMS-Kanäle",
        "Erweiterte Analysen",
        "Prioritäts-Support",
        "Individuelle Vorlagen",
        "Teamverwaltung (5 Plätze)",
      ],
      AGENCY: [
        "20 Standorte",
        "10'000 Feedback-Anfragen/Monat",
        "E-Mail- + SMS-Kanäle",
        "Komplette Analyse-Suite",
        "Dedizierter Support",
        "Individuelle Vorlagen",
        "Unbegrenzte Teamplätze",
        "White-Label-Branding",
        "Eigene Domain",
        "API-Zugriff",
      ],
    } as Record<string, string[]>,
  },
};

// ─── /campaigns ─────────────────────────────────────────────────────────────
const campaignsEn = {
  // lifecycle banner
  bannerTitle: "How a campaign works",
  bannerTagline: "Send feedback requests to many customers at once",
  svgAria:
    "Campaign lifecycle: Draft, then Active which sends requests to many customers, then responses come in as reviews and recovery, then Completed.",
  svgDraft: "Draft",
  svgActive: "Active",
  svgSendsToMany: "sends to many",
  svgResponses: "Responses come in",
  svgReviewsRecovery: "reviews + recovery",
  svgCompleted: "Completed",
  p1a: "A campaign sends feedback requests to many customers at once over email or SMS. Start it as a ",
  p1strong1: "Draft",
  p1b: ", set it ",
  p1strong2: "Active",
  p1c: " to send, and responses flow back as public review invites — with recovery follow-ups for anyone who needs attention.",
  // errors
  loadFailed: "Failed to load campaigns",
  genericError: "Something went wrong",
  createFailed: "Failed to create campaign",
  createFailedAlert: "Failed to create campaign. Please try again.",
  retry: "Retry",
  // actions
  createCampaign: "Create Campaign",
  cancel: "Cancel",
  // table
  colName: "Name",
  colStatus: "Status",
  colChannel: "Channel",
  colSent: "Sent",
  colResponses: "Responses",
  colLocation: "Location",
  colCreated: "Created",
  statusLabels: {
    DRAFT: "Draft",
    ACTIVE: "Active",
    PAUSED: "Paused",
    COMPLETED: "Completed",
  } as Record<string, string>,
  channelLabels: {
    EMAIL: "Email",
    SMS: "SMS",
  } as Record<string, string>,
  // empty state
  emptyTitle: "No campaigns yet",
  emptyDescription:
    "Reach many customers at once instead of sending requests one by one.",
  // create modal — inline help
  helpTitle: "What is a campaign?",
  helpBody:
    "A campaign sends feedback requests to many customers at once. Give it a name, pick a channel, and it starts as a Draft you can review before sending. Every customer who responds is invited to leave a public review; low ratings also open a recovery follow-up.",
  helpChannelStrong: "Channel",
  helpChannelBody:
    "— how requests are sent: Email reaches anyone with an email on file; SMS reaches those with a phone number.",
  helpLocationStrong: "Location",
  helpLocationBody:
    "— optional; use it to target one of your business locations.",
  // create modal — form
  nameLabel: "Campaign Name",
  namePlaceholder: "Q1 Feedback Campaign",
  descriptionLabel: "Description",
  descriptionPlaceholder: "Describe the purpose of this campaign...",
  channelLabel: "Channel",
  locationLabel: "Location (optional)",
  locationPlaceholder: "New York, NY",
};
export type CampaignsCopy = typeof campaignsEn;

export const CAMPAIGNS_COPY: Record<DashLocale, CampaignsCopy> = {
  en: campaignsEn,
  fr: {
    bannerTitle: "Comment fonctionne une campagne",
    bannerTagline: "Envoyez des demandes de rétroaction à plusieurs clients à la fois",
    svgAria:
      "Cycle de vie d'une campagne : Brouillon, puis Active qui envoie des demandes à plusieurs clients, puis les réponses arrivent sous forme d'avis et de récupération, puis Terminée.",
    svgDraft: "Brouillon",
    svgActive: "Active",
    svgSendsToMany: "envoie à plusieurs",
    svgResponses: "Les réponses arrivent",
    svgReviewsRecovery: "avis + récupération",
    svgCompleted: "Terminée",
    p1a: "Une campagne envoie des demandes de rétroaction à plusieurs clients à la fois par courriel ou SMS. Commencez-la comme ",
    p1strong1: "Brouillon",
    p1b: ", passez-la à ",
    p1strong2: "Active",
    p1c: " pour l'envoyer, et les réponses reviennent sous forme d'invitations à laisser un avis public — avec des suivis de récupération pour quiconque a besoin d'attention.",
    loadFailed: "Échec du chargement des campagnes",
    genericError: "Une erreur est survenue",
    createFailed: "Échec de la création de la campagne",
    createFailedAlert: "Échec de la création de la campagne. Veuillez réessayer.",
    retry: "Réessayer",
    createCampaign: "Créer une campagne",
    cancel: "Annuler",
    colName: "Nom",
    colStatus: "Statut",
    colChannel: "Canal",
    colSent: "Envois",
    colResponses: "Réponses",
    colLocation: "Emplacement",
    colCreated: "Création",
    statusLabels: {
      DRAFT: "Brouillon",
      ACTIVE: "Active",
      PAUSED: "En pause",
      COMPLETED: "Terminée",
    } as Record<string, string>,
    channelLabels: {
      EMAIL: "Courriel",
      SMS: "SMS",
    } as Record<string, string>,
    emptyTitle: "Aucune campagne pour l'instant",
    emptyDescription:
      "Rejoignez plusieurs clients à la fois au lieu d'envoyer des demandes une par une.",
    helpTitle: "Qu'est-ce qu'une campagne?",
    helpBody:
      "Une campagne envoie des demandes de rétroaction à plusieurs clients à la fois. Donnez-lui un nom, choisissez un canal, et elle commence comme brouillon que vous pouvez réviser avant l'envoi. Chaque client qui répond est invité à laisser un avis public; les notes faibles ouvrent aussi un suivi de récupération.",
    helpChannelStrong: "Canal",
    helpChannelBody:
      "— comment les demandes sont envoyées : le courriel rejoint quiconque a un courriel au dossier; le SMS rejoint ceux qui ont un numéro de téléphone.",
    helpLocationStrong: "Emplacement",
    helpLocationBody:
      "— optionnel; utilisez-le pour cibler un de vos emplacements d'affaires.",
    nameLabel: "Nom de la campagne",
    namePlaceholder: "Campagne de rétroaction T1",
    descriptionLabel: "Description",
    descriptionPlaceholder: "Décrivez l'objectif de cette campagne...",
    channelLabel: "Canal",
    locationLabel: "Emplacement (optionnel)",
    locationPlaceholder: "Montréal, QC",
  },
  "de-CH": {
    bannerTitle: "So funktioniert eine Kampagne",
    bannerTagline: "Senden Sie Feedback-Anfragen an viele Kunden gleichzeitig",
    svgAria:
      "Kampagnen-Lebenszyklus: Entwurf, dann Aktiv mit Versand an viele Kunden, dann treffen Antworten als Bewertungen und Rückgewinnung ein, dann Abgeschlossen.",
    svgDraft: "Entwurf",
    svgActive: "Aktiv",
    svgSendsToMany: "sendet an viele",
    svgResponses: "Antworten treffen ein",
    svgReviewsRecovery: "Bewertungen + Rückgewinnung",
    svgCompleted: "Abgeschlossen",
    p1a: "Eine Kampagne sendet Feedback-Anfragen per E-Mail oder SMS an viele Kunden gleichzeitig. Beginnen Sie mit einem ",
    p1strong1: "Entwurf",
    p1b: ", stellen Sie ihn auf ",
    p1strong2: "Aktiv",
    p1c: ", um zu senden — die Antworten kommen als Einladungen zu öffentlichen Bewertungen zurück, mit Rückgewinnungs-Nachfassaktionen für alle, die Aufmerksamkeit brauchen.",
    loadFailed: "Kampagnen konnten nicht geladen werden",
    genericError: "Etwas ist schiefgelaufen",
    createFailed: "Kampagne konnte nicht erstellt werden",
    createFailedAlert:
      "Kampagne konnte nicht erstellt werden. Bitte versuchen Sie es erneut.",
    retry: "Erneut versuchen",
    createCampaign: "Kampagne erstellen",
    cancel: "Abbrechen",
    colName: "Name",
    colStatus: "Status",
    colChannel: "Kanal",
    colSent: "Gesendet",
    colResponses: "Antworten",
    colLocation: "Standort",
    colCreated: "Erstellt",
    statusLabels: {
      DRAFT: "Entwurf",
      ACTIVE: "Aktiv",
      PAUSED: "Pausiert",
      COMPLETED: "Abgeschlossen",
    } as Record<string, string>,
    channelLabels: {
      EMAIL: "E-Mail",
      SMS: "SMS",
    } as Record<string, string>,
    emptyTitle: "Noch keine Kampagnen",
    emptyDescription:
      "Erreichen Sie viele Kunden gleichzeitig, statt Anfragen einzeln zu versenden.",
    helpTitle: "Was ist eine Kampagne?",
    helpBody:
      "Eine Kampagne sendet Feedback-Anfragen an viele Kunden gleichzeitig. Geben Sie ihr einen Namen, wählen Sie einen Kanal, und sie beginnt als Entwurf, den Sie vor dem Versand prüfen können. Jeder Kunde, der antwortet, wird eingeladen, eine öffentliche Bewertung zu hinterlassen; niedrige Bewertungen öffnen zusätzlich eine Rückgewinnungs-Nachfassaktion.",
    helpChannelStrong: "Kanal",
    helpChannelBody:
      "— wie Anfragen gesendet werden: E-Mail erreicht alle mit hinterlegter E-Mail-Adresse; SMS erreicht alle mit Telefonnummer.",
    helpLocationStrong: "Standort",
    helpLocationBody:
      "— optional; nutzen Sie ihn, um einen Ihrer Geschäftsstandorte gezielt anzusprechen.",
    nameLabel: "Kampagnenname",
    namePlaceholder: "Feedback-Kampagne Q1",
    descriptionLabel: "Beschreibung",
    descriptionPlaceholder: "Beschreiben Sie den Zweck dieser Kampagne...",
    channelLabel: "Kanal",
    locationLabel: "Standort (optional)",
    locationPlaceholder: "Zürich",
  },
};

// ─── /customers ─────────────────────────────────────────────────────────────
const customersEn = {
  statusLabels: {
    NEW: "New",
    CONTACTED: "Contacted",
    SATISFIED: "Satisfied",
    NEEDS_FOLLOWUP: "Needs Follow-up",
    RECOVERED: "Recovered",
    LOST: "Lost",
  } as Record<string, string>,
  lifecycle: {
    title: "Customer lifecycle",
    subtitle: "Status is set automatically from feedback",
    ariaLabel:
      "Lifecycle: New, then Contacted, then Satisfied or Needs follow-up, then Recovered. Status is set automatically from feedback and never limits a customer's ability to leave a public review.",
    nodeNew: "New",
    nodeContacted: "Contacted",
    nodeSatisfied: "Satisfied",
    nodeNeedsFollowUp: "Needs follow-up",
    nodeRecovered1: "Recov-",
    nodeRecovered2: "ered",
    p1a: "A high rating marks a customer ",
    p1strong1: "Satisfied",
    p1b: "; a low rating marks them ",
    p1strong2: "Needs follow-up",
    p1c: " and opens a recovery ticket. Status only tells your team who to follow up with — every customer can always leave a public review.",
  },
  loadFailed: "Failed to load customers",
  somethingWrong: "Something went wrong",
  createFailed: "Failed to create customer",
  createAlert: "Failed to create customer. Please try again.",
  retry: "Retry",
  fields: {
    name: "Name",
    email: "Email",
    phone: "Phone",
    status: "Status",
    location: "Location",
    created: "Created",
  },
  searchPlaceholder: "Search customers...",
  searchButton: "Search",
  addCustomer: "Add Customer",
  emptyTitle: "No customers found",
  emptyFilteredDescription: "Try adjusting your search terms.",
  emptyDescription:
    "Add customers to start collecting feedback and turning happy ones into public reviews.",
  pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
  previous: "Previous",
  next: "Next",
  namePlaceholder: "John Doe",
  emailPlaceholder: "john@example.com",
  phonePlaceholder: "+1 (555) 123-4567",
  locationPlaceholder: "New York, NY",
  cancel: "Cancel",
};
export type CustomersCopy = typeof customersEn;

export const CUSTOMERS_COPY: Record<DashLocale, CustomersCopy> = {
  en: customersEn,
  fr: {
    statusLabels: {
      NEW: "Nouveau",
      CONTACTED: "Contacté",
      SATISFIED: "Satisfait",
      NEEDS_FOLLOWUP: "Suivi requis",
      RECOVERED: "Récupéré",
      LOST: "Perdu",
    } as Record<string, string>,
    lifecycle: {
      title: "Cycle de vie du client",
      subtitle: "Le statut est défini automatiquement à partir de la rétroaction",
      ariaLabel:
        "Cycle de vie : Nouveau, puis Contacté, puis Satisfait ou Suivi requis, puis Récupéré. Le statut est défini automatiquement à partir de la rétroaction et ne limite jamais la capacité d'un client à laisser un avis public.",
      nodeNew: "Nouveau",
      nodeContacted: "Contacté",
      nodeSatisfied: "Satisfait",
      nodeNeedsFollowUp: "Suivi requis",
      nodeRecovered1: "Récu-",
      nodeRecovered2: "péré",
      p1a: "Une note élevée donne au client le statut ",
      p1strong1: "Satisfait",
      p1b: "; une note faible lui donne le statut ",
      p1strong2: "Suivi requis",
      p1c: " et ouvre un billet de récupération. Le statut indique seulement à votre équipe qui relancer — chaque client peut toujours laisser un avis public.",
    },
    loadFailed: "Échec du chargement des clients",
    somethingWrong: "Une erreur est survenue",
    createFailed: "Échec de la création du client",
    createAlert: "Échec de la création du client. Veuillez réessayer.",
    retry: "Réessayer",
    fields: {
      name: "Nom",
      email: "Courriel",
      phone: "Téléphone",
      status: "Statut",
      location: "Emplacement",
      created: "Créé le",
    },
    searchPlaceholder: "Rechercher des clients...",
    searchButton: "Rechercher",
    addCustomer: "Ajouter un client",
    emptyTitle: "Aucun client trouvé",
    emptyFilteredDescription: "Essayez d'ajuster vos termes de recherche.",
    emptyDescription:
      "Ajoutez des clients pour commencer à recueillir de la rétroaction et transformer les clients satisfaits en avis publics.",
    pageOf: (page: number, total: number) => `Page ${page} de ${total}`,
    previous: "Précédent",
    next: "Suivant",
    namePlaceholder: "Jean Tremblay",
    emailPlaceholder: "john@example.com",
    phonePlaceholder: "+1 (555) 123-4567",
    locationPlaceholder: "Montréal, QC",
    cancel: "Annuler",
  },
  "de-CH": {
    statusLabels: {
      NEW: "Neu",
      CONTACTED: "Kontaktiert",
      SATISFIED: "Zufrieden",
      NEEDS_FOLLOWUP: "Nachfassen nötig",
      RECOVERED: "Zurückgewonnen",
      LOST: "Verloren",
    } as Record<string, string>,
    lifecycle: {
      title: "Kundenlebenszyklus",
      subtitle: "Der Status wird automatisch aus dem Feedback gesetzt",
      ariaLabel:
        "Lebenszyklus: Neu, dann Kontaktiert, dann Zufrieden oder Nachfassen nötig, dann Zurückgewonnen. Der Status wird automatisch aus dem Feedback gesetzt und schränkt die Möglichkeit eines Kunden, eine öffentliche Bewertung zu hinterlassen, nie ein.",
      nodeNew: "Neu",
      nodeContacted: "Kontaktiert",
      nodeSatisfied: "Zufrieden",
      nodeNeedsFollowUp: "Nachfassen nötig",
      nodeRecovered1: "Zurück-",
      nodeRecovered2: "gewonnen",
      p1a: "Eine hohe Bewertung markiert einen Kunden als ",
      p1strong1: "Zufrieden",
      p1b: "; eine tiefe Bewertung markiert ihn als ",
      p1strong2: "Nachfassen nötig",
      p1c: " und öffnet ein Rückgewinnungsticket. Der Status zeigt Ihrem Team nur, bei wem nachzufassen ist — jeder Kunde kann jederzeit eine öffentliche Bewertung hinterlassen.",
    },
    loadFailed: "Kunden konnten nicht geladen werden",
    somethingWrong: "Etwas ist schiefgelaufen",
    createFailed: "Kunde konnte nicht erstellt werden",
    createAlert: "Kunde konnte nicht erstellt werden. Bitte versuchen Sie es erneut.",
    retry: "Erneut versuchen",
    fields: {
      name: "Name",
      email: "E-Mail",
      phone: "Telefon",
      status: "Status",
      location: "Standort",
      created: "Erstellt",
    },
    searchPlaceholder: "Kunden suchen...",
    searchButton: "Suchen",
    addCustomer: "Kunde hinzufügen",
    emptyTitle: "Keine Kunden gefunden",
    emptyFilteredDescription: "Passen Sie Ihre Suchbegriffe an.",
    emptyDescription:
      "Fügen Sie Kunden hinzu, um Feedback zu sammeln und zufriedene Kunden in öffentliche Bewertungen zu verwandeln.",
    pageOf: (page: number, total: number) => `Seite ${page} von ${total}`,
    previous: "Zurück",
    next: "Weiter",
    namePlaceholder: "Hans Muster",
    emailPlaceholder: "john@example.com",
    phonePlaceholder: "+1 (555) 123-4567",
    locationPlaceholder: "Zürich",
    cancel: "Abbrechen",
  },
};

// ─── /dashboard ─────────────────────────────────────────────────────────────
const dashboardEn = {
  // Help modal
  helpTitle: "Understanding your dashboard",
  diagramAria:
    "Metrics funnel: sent requests to responses to positive or negative feedback, with negative opening a recovery ticket",
  svgSent: "Sent",
  svgRequests: "requests",
  svgResponses: "Responses",
  svgPositive: "Positive (4-5)",
  svgNegative: "Negative (1-2)",
  svgRecovery1: "Recovery",
  svgRecovery2: "ticket",
  help: {
    p1a: "The cards at the top track your feedback funnel.",
    p1strong1: " Total Sent",
    p1b: " is how many feedback requests went out;",
    p1strong2: " Responses",
    p1c: " is how many customers replied;",
    p1strong3: " Avg Rating",
    p1d: " is the mean score across responses.",
    p2a: "Responses split into ",
    p2positive: "Positive (4–5)",
    p2b: " and",
    p2negative: " Negative (1–2)",
    p2c: ". A negative response opens a ",
    p2ticket: "recovery ticket",
    p2d: " so your team can follow up — that count is ",
    p2strong: "Recovery Open",
    p2e: ".",
    p3strong1: "Recent Feedback",
    p3a: " lists the latest responses; use",
    p3strong2: " Quick Actions",
    p3b: " to send a request, review recovery tickets, or manage customers.",
  },
  gotIt: "Got it",
  // Load / error states
  loadAnalyticsFailed: "Failed to load analytics",
  genericError: "Something went wrong",
  loadDashboardFailed: "Failed to load dashboard",
  retry: "Retry",
  // Header
  overview: "Overview",
  helpButton: "Help",
  // Stat cards
  statTotalSent: "Total Sent",
  statResponses: "Responses",
  statAvgRating: "Avg Rating",
  statPositive: "Positive (4-5)",
  statNegative: "Negative (1-2)",
  statRecoveryOpen: "Recovery Open",
  responseRate: (pct: number) => `${pct}% response rate`,
  // Recent feedback
  recentFeedback: "Recent Feedback",
  viewAll: "View all",
  noFeedback: "No feedback yet. Send your first feedback request to get started.",
  statusLabels: {
    PENDING: "Pending",
    SUBMITTED: "Submitted",
    EXPIRED: "Expired",
  } as Record<string, string>,
  // Quick actions
  quickActions: "Quick Actions",
  sendFeedbackRequest: "Send Feedback Request",
  viewRecoveryTickets: "View Recovery Tickets",
  manageCustomers: "Manage Customers",
  createCampaign: "Create Campaign",
};
export type DashboardCopy = typeof dashboardEn;

export const DASHBOARD_COPY: Record<DashLocale, DashboardCopy> = {
  en: dashboardEn,
  fr: {
    helpTitle: "Comprendre votre tableau de bord",
    diagramAria:
      "Entonnoir des indicateurs : demandes envoyées vers réponses, vers rétroaction positive ou négative, la négative ouvrant un billet de récupération",
    svgSent: "Demandes",
    svgRequests: "envoyées",
    svgResponses: "Réponses",
    svgPositive: "Positives (4-5)",
    svgNegative: "Négatives (1-2)",
    svgRecovery1: "Billet de",
    svgRecovery2: "récupération",
    help: {
      p1a: "Les cartes en haut suivent votre entonnoir de rétroaction.",
      p1strong1: " Total envoyé",
      p1b: " est le nombre de demandes de rétroaction envoyées;",
      p1strong2: " Réponses",
      p1c: " est le nombre de clients qui ont répondu;",
      p1strong3: " Note moyenne",
      p1d: " est la note moyenne de l'ensemble des réponses.",
      p2a: "Les réponses se répartissent en ",
      p2positive: "Positives (4–5)",
      p2b: " et",
      p2negative: " Négatives (1–2)",
      p2c: ". Une réponse négative ouvre un ",
      p2ticket: "billet de récupération",
      p2d: " pour que votre équipe fasse un suivi — ce nombre correspond à ",
      p2strong: "Récupérations ouvertes",
      p2e: ".",
      p3strong1: "Rétroaction récente",
      p3a: " liste les dernières réponses; utilisez",
      p3strong2: " Actions rapides",
      p3b: " pour envoyer une demande, consulter les billets de récupération ou gérer les clients.",
    },
    gotIt: "Compris",
    loadAnalyticsFailed: "Échec du chargement de l'analytique",
    genericError: "Une erreur est survenue",
    loadDashboardFailed: "Échec du chargement du tableau de bord",
    retry: "Réessayer",
    overview: "Vue d'ensemble",
    helpButton: "Aide",
    statTotalSent: "Total envoyé",
    statResponses: "Réponses",
    statAvgRating: "Note moyenne",
    statPositive: "Positives (4-5)",
    statNegative: "Négatives (1-2)",
    statRecoveryOpen: "Récupérations ouvertes",
    responseRate: (pct: number) => `${pct} % de taux de réponse`,
    recentFeedback: "Rétroaction récente",
    viewAll: "Voir tout",
    noFeedback:
      "Aucune rétroaction pour l'instant. Envoyez votre première demande de rétroaction pour commencer.",
    statusLabels: {
      PENDING: "En attente",
      SUBMITTED: "Soumis",
      EXPIRED: "Expiré",
    } as Record<string, string>,
    quickActions: "Actions rapides",
    sendFeedbackRequest: "Envoyer une demande de rétroaction",
    viewRecoveryTickets: "Voir les billets de récupération",
    manageCustomers: "Gérer les clients",
    createCampaign: "Créer une campagne",
  },
  "de-CH": {
    helpTitle: "Ihr Dashboard verstehen",
    diagramAria:
      "Kennzahlen-Trichter: gesendete Anfragen zu Antworten, zu positivem oder negativem Feedback; negatives Feedback öffnet ein Rückgewinnungsticket",
    svgSent: "Gesendete",
    svgRequests: "Anfragen",
    svgResponses: "Antworten",
    svgPositive: "Positiv (4-5)",
    svgNegative: "Negativ (1-2)",
    svgRecovery1: "Rückgewinnungs-",
    svgRecovery2: "ticket",
    help: {
      p1a: "Die Karten oben zeigen Ihren Feedback-Trichter.",
      p1strong1: " Gesamt gesendet",
      p1b: " ist die Anzahl der versendeten Feedback-Anfragen;",
      p1strong2: " Antworten",
      p1c: " ist die Anzahl der Kunden, die geantwortet haben;",
      p1strong3: " Durchschnittsbewertung",
      p1d: " ist die mittlere Bewertung über alle Antworten.",
      p2a: "Die Antworten teilen sich auf in ",
      p2positive: "Positiv (4–5)",
      p2b: " und",
      p2negative: " Negativ (1–2)",
      p2c: ". Eine negative Antwort öffnet ein ",
      p2ticket: "Rückgewinnungsticket",
      p2d: ", damit Ihr Team nachfassen kann — diese Anzahl ist ",
      p2strong: "Offene Rückgewinnungen",
      p2e: ".",
      p3strong1: "Aktuelles Feedback",
      p3a: " zeigt die neuesten Antworten; nutzen Sie",
      p3strong2: " Schnellaktionen",
      p3b: ", um eine Anfrage zu senden, Rückgewinnungstickets zu prüfen oder Kunden zu verwalten.",
    },
    gotIt: "Verstanden",
    loadAnalyticsFailed: "Analysen konnten nicht geladen werden",
    genericError: "Etwas ist schiefgelaufen",
    loadDashboardFailed: "Dashboard konnte nicht geladen werden",
    retry: "Erneut versuchen",
    overview: "Übersicht",
    helpButton: "Hilfe",
    statTotalSent: "Gesamt gesendet",
    statResponses: "Antworten",
    statAvgRating: "Durchschnittsbewertung",
    statPositive: "Positiv (4-5)",
    statNegative: "Negativ (1-2)",
    statRecoveryOpen: "Offene Rückgewinnungen",
    responseRate: (pct: number) => `${pct}% Antwortquote`,
    recentFeedback: "Aktuelles Feedback",
    viewAll: "Alle anzeigen",
    noFeedback:
      "Noch kein Feedback. Senden Sie Ihre erste Feedback-Anfrage, um zu starten.",
    statusLabels: {
      PENDING: "Ausstehend",
      SUBMITTED: "Übermittelt",
      EXPIRED: "Abgelaufen",
    } as Record<string, string>,
    quickActions: "Schnellaktionen",
    sendFeedbackRequest: "Feedback-Anfrage senden",
    viewRecoveryTickets: "Rückgewinnungstickets anzeigen",
    manageCustomers: "Kunden verwalten",
    createCampaign: "Kampagne erstellen",
  },
};

// ─── GettingStarted (shared onboarding component) ───────────────────────────
const gettingStartedEn = {
  welcomeTitle: "Welcome to Echorank360",
  welcomeP1:
    "Echorank helps you collect customer feedback, turn happy customers into public reviews, and catch unhappy ones before they post — plus see how visible your business is to AI answer engines.",
  welcomeStartStrong: "Start here:",
  welcomeStartRest:
    " add a customer, then send your first feedback request. The checklist on your dashboard walks you through the rest — it checks itself off as you go.",
  exploreButton: "Explore on my own",
  addFirstCustomer: "Add my first customer",
  cardTitle: "Get started with Echorank",
  progress: (done: number, total: number) =>
    `${done} of ${total} done — finish setup to start collecting reviews.`,
  dismissAria: "Dismiss getting started",
  optional: "(optional)",
};
export type GettingStartedCopy = typeof gettingStartedEn;

export const GETTING_STARTED_COPY: Record<DashLocale, GettingStartedCopy> = {
  en: gettingStartedEn,
  fr: {
    welcomeTitle: "Bienvenue dans Echorank360",
    welcomeP1:
      "Echorank vous aide à recueillir la rétroaction de vos clients, à transformer les clients satisfaits en avis publics et à intercepter les clients insatisfaits avant qu'ils publient — en plus de voir la visibilité de votre entreprise auprès des moteurs de réponse IA.",
    welcomeStartStrong: "Commencez ici :",
    welcomeStartRest:
      " ajoutez un client, puis envoyez votre première demande de rétroaction. La liste de vérification de votre tableau de bord vous guide pour la suite — elle se coche au fur et à mesure.",
    exploreButton: "Explorer par moi-même",
    addFirstCustomer: "Ajouter mon premier client",
    cardTitle: "Premiers pas avec Echorank",
    progress: (done: number, total: number) =>
      `${done} sur ${total} terminées — terminez la configuration pour commencer à recueillir des avis.`,
    dismissAria: "Masquer les premiers pas",
    optional: "(facultatif)",
  },
  "de-CH": {
    welcomeTitle: "Willkommen bei Echorank360",
    welcomeP1:
      "Echorank hilft Ihnen, Kundenfeedback zu sammeln, zufriedene Kunden in öffentliche Bewertungen zu verwandeln und unzufriedene abzufangen, bevor sie etwas veröffentlichen — und zu sehen, wie sichtbar Ihr Unternehmen für KI-Antwortmaschinen ist.",
    welcomeStartStrong: "Starten Sie hier:",
    welcomeStartRest:
      " Fügen Sie einen Kunden hinzu und senden Sie dann Ihre erste Feedback-Anfrage. Die Checkliste auf Ihrem Dashboard führt Sie durch den Rest — sie hakt sich von selbst ab.",
    exploreButton: "Selbst erkunden",
    addFirstCustomer: "Meinen ersten Kunden hinzufügen",
    cardTitle: "Erste Schritte mit Echorank",
    progress: (done: number, total: number) =>
      `${done} von ${total} erledigt — schliessen Sie die Einrichtung ab, um Bewertungen zu sammeln.`,
    dismissAria: "Erste Schritte ausblenden",
    optional: "(optional)",
  },
};

// ─── ExtensionHelpButton (shared help component) ────────────────────────────
const extensionHelpEn = {
  label: "How to use it",
  modalTitle: "How to import your reviews",
  intro:
    "The Review Importer is a small add-on for your browser. When you're looking at your reviews on Google, Facebook, or Trustpilot, it copies them into Echorank with one click. You don't type anything in — it does the work for you.",
  setupHeading: "First-time setup (you only do this once)",
  step1Title: "Install the importer",
  step1Body:
    "Add it to Microsoft Edge, Brave, Opera, or Vivaldi. You'll then see a small Echorank button near the top-right of your browser, by the address bar. If it's hidden, click the puzzle-piece icon up there and pin it.",
  step2Title: "Create your connection key",
  step2a:
    "On this Extension page, give a key a name you'll recognise (like “My laptop”) and create it. A code starting with ",
  step2b:
    " appears. Copy it right away — for your security it's shown only once. Lost it? Just make a new one.",
  step3Title: "Paste the key into the importer",
  step3a: "Click the Echorank button in your browser, then ",
  step3strongSettings: "Settings",
  step3b: ". Paste your key, leave the web address as it is, and click ",
  step3strongSave: "Save",
  step3c: ". The top should now show a green dot and the word ",
  step3strongConnected: "Connected",
  step3d: ".",
  useHeading: "Bringing in reviews (any time)",
  step4Title: "Open your business's review page",
  step4a: "Go to the real page where your reviews live. For Google, open ",
  step4b:
    ", search your business by name, and click it so the full listing with reviews opens.",
  step5Title: "Click Scan & Import Reviews",
  step5a: "Open the Echorank button again. On the right kind of page, the ",
  step5strong: "Scan & Import Reviews",
  step5b:
    " button comes to life — click it. The Found / Imported counters will move, and you're done.",
  step6Title: "See them here",
  step6a: "Your imported reviews appear under ",
  step6strong: "Monitoring",
  step6b: ", sorted and ready to track.",
  lightsHeading: "The two status lights tell you everything",
  lightsIntro:
    "When you open the importer, both lines at the top must be green before the Scan button will work.",
  light1Strong: "Connected",
  light1Text: " — your account is linked. If this is red, redo step 3.",
  light2Strong: "Open a Google, Facebook, or Trustpilot review page",
  light2Text:
    " — you're not on a review page it recognises yet. A regular search results page won't work, even if it shows reviews. Go to your business's actual page and this turns green.",
  reassurance:
    "Your login is safe — the importer never sees your Google, Facebook, or Trustpilot password. It only reads the reviews already shown on the page, and sends them to your own Echorank account. Scanning the same page again later brings in new reviews and skips ones you already have.",
  installHeading: "Installing the extension (developer mode)",
  installLeadA: "The extension installs as an unpacked extension. Download the zip from the ",
  installLeadLink: "Download page",
  installLeadB: ", unzip it to a folder you'll keep (the browser loads it from there — don't delete it), then follow your browser's steps:",
  instGoTo: "Go to ",
  instAfterUrl: ", turn on ",
  instDevMode: "Developer mode",
  instThenClick: ", click ",
  instLoadUnpacked: "Load unpacked",
  hintTopRightToggle: "(top-right toggle)",
  hintTopRight: "(top-right)",
  hintEdgeSidebar: "(toggle in the left sidebar)",
  tailFull: ", and select the unzipped folder.",
  tailShort: ", select the folder.",
  installNote: "Your browser may show a \u2018Disable developer mode extensions\u2019 notice when it starts. That\u2019s normal for unpacked extensions — dismiss it and the extension keeps working. Firefox and Safari aren\u2019t supported.",
  installClosing: "Once installed, pin the extension from the puzzle-piece menu, open its settings, and paste the access token from this page.",
  gotIt: "Got it",
};
export type ExtensionHelpCopy = typeof extensionHelpEn;

export const EXTENSION_HELP_COPY: Record<DashLocale, ExtensionHelpCopy> = {
  en: extensionHelpEn,
  fr: {
    label: "Comment l'utiliser",
    modalTitle: "Comment importer vos avis",
    intro:
      "L'importateur d'avis est un petit module complémentaire pour votre navigateur. Quand vous consultez vos avis sur Google, Facebook ou Trustpilot, il les copie dans Echorank en un clic. Vous n'avez rien à saisir — il fait le travail pour vous.",
    setupHeading: "Configuration initiale (à faire une seule fois)",
    step1Title: "Installer l'importateur",
    step1Body:
      "Ajoutez-le à Microsoft Edge, Brave, Opera ou Vivaldi. Vous verrez ensuite un petit bouton Echorank en haut à droite de votre navigateur, près de la barre d'adresse. S'il est masqué, cliquez sur l'icône de pièce de casse-tête et épinglez-le.",
    step2Title: "Créer votre clé de connexion",
    step2a:
      "Sur cette page Extension, donnez à une clé un nom que vous reconnaîtrez (comme Mon portable) et créez-la. Un code commençant par ",
    step2b:
      " apparaît. Copiez-le tout de suite — pour votre sécurité, il n'est affiché qu'une seule fois. Vous l'avez perdue? Créez-en simplement une nouvelle.",
    step3Title: "Coller la clé dans l'importateur",
    step3a: "Cliquez sur le bouton Echorank dans votre navigateur, puis sur ",
    step3strongSettings: "Paramètres",
    step3b:
      ". Collez votre clé, laissez l'adresse Web telle quelle, puis cliquez sur ",
    step3strongSave: "Enregistrer",
    step3c: ". Le haut devrait maintenant afficher un point vert et le mot ",
    step3strongConnected: "Connecté",
    step3d: ".",
    useHeading: "Importer des avis (en tout temps)",
    step4Title: "Ouvrir la page d'avis de votre entreprise",
    step4a:
      "Rendez-vous sur la vraie page où se trouvent vos avis. Pour Google, ouvrez ",
    step4b:
      ", recherchez votre entreprise par son nom et cliquez dessus pour ouvrir la fiche complète avec les avis.",
    step5Title: "Cliquer sur Scan & Import Reviews",
    step5a:
      "Ouvrez de nouveau le bouton Echorank. Sur le bon type de page, le bouton ",
    step5strong: "Scan & Import Reviews",
    step5b:
      " s'active — cliquez dessus. Les compteurs Found / Imported avanceront, et c'est terminé.",
    step6Title: "Les retrouver ici",
    step6a: "Vos avis importés apparaissent sous ",
    step6strong: "Surveillance",
    step6b: ", triés et prêts à être suivis.",
    lightsHeading: "Les deux voyants d'état vous disent tout",
    lightsIntro:
      "Quand vous ouvrez l'importateur, les deux lignes du haut doivent être vertes pour que le bouton Scan fonctionne.",
    light1Strong: "Connecté",
    light1Text:
      " — votre compte est lié. Si ce voyant est rouge, refaites l'étape 3.",
    light2Strong: "Ouvrez une page d'avis Google, Facebook ou Trustpilot",
    light2Text:
      " — vous n'êtes pas encore sur une page d'avis reconnue. Une page de résultats de recherche ne fonctionnera pas, même si elle affiche des avis. Allez sur la vraie page de votre entreprise et ce voyant deviendra vert.",
    reassurance:
      "Vos identifiants sont en sécurité — l'importateur ne voit jamais votre mot de passe Google, Facebook ou Trustpilot. Il lit seulement les avis déjà affichés sur la page et les envoie dans votre propre compte Echorank. Scanner la même page plus tard importe les nouveaux avis et ignore ceux que vous avez déjà.",
    installHeading: "Installer l'extension (mode développeur)",
    installLeadA: "L'extension s'installe comme extension non empaquetée. Téléchargez le fichier zip depuis la ",
    installLeadLink: "page de téléchargement",
    installLeadB: ", décompressez-le dans un dossier que vous conserverez (le navigateur le charge depuis cet emplacement — ne le supprimez pas), puis suivez les étapes de votre navigateur :",
    instGoTo: "Allez à ",
    instAfterUrl: ", activez le ",
    instDevMode: "mode développeur",
    instThenClick: ", cliquez sur ",
    instLoadUnpacked: "Charger l'extension non empaquetée",
    hintTopRightToggle: "(interrupteur en haut à droite)",
    hintTopRight: "(en haut à droite)",
    hintEdgeSidebar: "(interrupteur dans la barre latérale de gauche)",
    tailFull: ", puis sélectionnez le dossier décompressé.",
    tailShort: ", sélectionnez le dossier.",
    installNote: "Votre navigateur peut afficher un avis « Désactiver les extensions en mode développeur » au démarrage. C'est normal pour les extensions non empaquetées — ignorez-le et l'extension continue de fonctionner. Firefox et Safari ne sont pas pris en charge.",
    installClosing: "Une fois l'installation terminée, épinglez l'extension depuis le menu en forme de pièce de casse-tête, ouvrez ses paramètres et collez le jeton d'accès de cette page.",
    gotIt: "Compris",
  },
  "de-CH": {
    label: "So funktioniert es",
    modalTitle: "So importieren Sie Ihre Bewertungen",
    intro:
      "Der Review Importer ist ein kleines Add-on für Ihren Browser. Wenn Sie Ihre Bewertungen auf Google, Facebook oder Trustpilot ansehen, kopiert er sie mit einem Klick in Echorank. Sie müssen nichts eintippen — er erledigt die Arbeit für Sie.",
    setupHeading: "Erstmalige Einrichtung (nur einmal nötig)",
    step1Title: "Importer installieren",
    step1Body:
      "Fügen Sie ihn zu Microsoft Edge, Brave, Opera oder Vivaldi hinzu. Danach sehen Sie oben rechts in Ihrem Browser, neben der Adressleiste, eine kleine Echorank-Schaltfläche. Ist sie ausgeblendet, klicken Sie dort auf das Puzzleteil-Symbol und heften Sie sie an.",
    step2Title: "Ihren Verbindungsschlüssel erstellen",
    step2a:
      "Geben Sie auf dieser Erweiterungsseite einem Schlüssel einen Namen, den Sie wiedererkennen (z. B. «Mein Laptop»), und erstellen Sie ihn. Ein Code, der mit ",
    step2b:
      " beginnt, wird angezeigt. Kopieren Sie ihn sofort — aus Sicherheitsgründen wird er nur einmal angezeigt. Verloren? Erstellen Sie einfach einen neuen.",
    step3Title: "Schlüssel in den Importer einfügen",
    step3a:
      "Klicken Sie auf die Echorank-Schaltfläche in Ihrem Browser und dann auf ",
    step3strongSettings: "Einstellungen",
    step3b:
      ". Fügen Sie Ihren Schlüssel ein, lassen Sie die Webadresse unverändert und klicken Sie auf ",
    step3strongSave: "Speichern",
    step3c: ". Oben sollten nun ein grüner Punkt und das Wort ",
    step3strongConnected: "Verbunden",
    step3d: " angezeigt werden.",
    useHeading: "Bewertungen importieren (jederzeit)",
    step4Title: "Die Bewertungsseite Ihres Unternehmens öffnen",
    step4a:
      "Gehen Sie auf die echte Seite, auf der Ihre Bewertungen stehen. Für Google öffnen Sie ",
    step4b:
      ", suchen Sie Ihr Unternehmen nach Namen und klicken Sie darauf, damit der vollständige Eintrag mit den Bewertungen erscheint.",
    step5Title: "Auf Scan & Import Reviews klicken",
    step5a:
      "Öffnen Sie die Echorank-Schaltfläche erneut. Auf der richtigen Seite wird die Schaltfläche ",
    step5strong: "Scan & Import Reviews",
    step5b:
      " aktiv — klicken Sie darauf. Die Zähler Found / Imported bewegen sich, und Sie sind fertig.",
    step6Title: "Hier ansehen",
    step6a: "Ihre importierten Bewertungen erscheinen unter ",
    step6strong: "Überwachung",
    step6b: ", sortiert und bereit zur Nachverfolgung.",
    lightsHeading: "Die zwei Statusleuchten sagen Ihnen alles",
    lightsIntro:
      "Wenn Sie den Importer öffnen, müssen beide Zeilen oben grün sein, bevor die Scan-Schaltfläche funktioniert.",
    light1Strong: "Verbunden",
    light1Text:
      " — Ihr Konto ist verknüpft. Ist diese Anzeige rot, wiederholen Sie Schritt 3.",
    light2Strong:
      "Öffnen Sie eine Google-, Facebook- oder Trustpilot-Bewertungsseite",
    light2Text:
      " — Sie befinden sich noch nicht auf einer erkannten Bewertungsseite. Eine normale Suchergebnisseite funktioniert nicht, auch wenn sie Bewertungen anzeigt. Gehen Sie auf die eigentliche Seite Ihres Unternehmens, dann wird diese Anzeige grün.",
    reassurance:
      "Ihre Anmeldedaten sind sicher — der Importer sieht Ihr Google-, Facebook- oder Trustpilot-Passwort nie. Er liest nur die Bewertungen, die bereits auf der Seite angezeigt werden, und sendet sie an Ihr eigenes Echorank-Konto. Wenn Sie dieselbe Seite später erneut scannen, werden neue Bewertungen importiert und bereits vorhandene übersprungen.",
    installHeading: "Erweiterung installieren (Entwicklermodus)",
    installLeadA: "Die Erweiterung wird als entpackte Erweiterung installiert. Laden Sie die ZIP-Datei von der ",
    installLeadLink: "Download-Seite",
    installLeadB: " herunter, entpacken Sie sie in einen Ordner, den Sie behalten (der Browser lädt sie von dort — löschen Sie ihn nicht), und folgen Sie dann den Schritten Ihres Browsers:",
    instGoTo: "Gehen Sie zu ",
    instAfterUrl: ", aktivieren Sie den ",
    instDevMode: "Entwicklermodus",
    instThenClick: ", klicken Sie auf ",
    instLoadUnpacked: "Entpackte Erweiterung laden",
    hintTopRightToggle: "(Schalter oben rechts)",
    hintTopRight: "(oben rechts)",
    hintEdgeSidebar: "(Schalter in der linken Seitenleiste)",
    tailFull: " und wählen Sie den entpackten Ordner aus.",
    tailShort: " und wählen Sie den Ordner aus.",
    installNote: "Ihr Browser zeigt beim Start möglicherweise den Hinweis «Erweiterungen im Entwicklermodus deaktivieren». Das ist bei entpackten Erweiterungen normal — schliessen Sie den Hinweis, die Erweiterung funktioniert weiter. Firefox und Safari werden nicht unterstützt.",
    installClosing: "Nach der Installation pinnen Sie die Erweiterung über das Puzzleteil-Menü an, öffnen deren Einstellungen und fügen den Zugriffstoken von dieser Seite ein.",
    gotIt: "Verstanden",
  },
};

// ─── /feedback ──────────────────────────────────────────────────────────────
const feedbackEn = {
  statusLabels: {
    PENDING: "Pending",
    SUBMITTED: "Submitted",
    EXPIRED: "Expired",
  } as Record<string, string>,
  noRating: "No rating",
  ratingAria: (rating: number) => `${rating} out of 5`,
  pipeline: {
    title: "/ Feedback pipeline",
    currentView: "Current view",
    requestsSent: "Requests sent",
    awaitingReply: "Awaiting reply",
    responded: "Responded",
    promoters: "Promoters (4–5★)",
    needsRecovery: "Needs recovery",
    note: "Every response is sorted as it lands. A 4 or 5 marks a promoter you can invite to post a public review; a 2 or below opens a recovery task so your team reaches the customer first.",
  },
  loadFailed: "Failed to load feedback",
  somethingWrong: "Something went wrong",
  sendFailed: "Failed to send request",
  sendAlert: "Failed to send feedback request. Please try again.",
  unknownCustomer: "Unknown",
  retry: "Retry",
  eyebrow: "/ Intelligence · Feedback",
  subtitle: "Responses across every request, sorted as they arrive.",
  avgRating: "Avg rating",
  responseRate: "Response rate",
  searchLabel: "Search",
  searchPlaceholder: "Name, email, or comment",
  statusFilterLabel: "Status",
  ratingFilterLabel: "Rating",
  allStatuses: "All Statuses",
  allRatings: "All Ratings",
  starsOption: (n: number) => (n === 1 ? "1 Star" : `${n} Stars`),
  sendRequestButton: "Send Feedback Request",
  nothingMatches: "Nothing matches",
  widenFilters: "Widen the status, rating, or search to see more responses.",
  emptyTitle: "No feedback found",
  emptyDescription:
    "Send your first request — happy customers become public reviews, and unhappy ones get caught before they post.",
  atRisk: "At risk",
  detailTitle: "Feedback Details",
  detailCustomer: "Customer",
  detailRating: "Rating",
  detailStatus: "Status",
  detailComment: "Comment",
  noComment: "No comment provided",
  detailCreated: "Created",
  detailSubmitted: "Submitted",
  searchCustomersLabel: "Search customers",
  customerSearchPlaceholder: "Search by name or email...",
  noCustomersFound: "No customers found",
  cancel: "Cancel",
  sendRequest: "Send Request",
};
export type FeedbackCopy = typeof feedbackEn;

export const FEEDBACK_COPY: Record<DashLocale, FeedbackCopy> = {
  en: feedbackEn,
  fr: {
    statusLabels: {
      PENDING: "En attente",
      SUBMITTED: "Soumis",
      EXPIRED: "Expiré",
    } as Record<string, string>,
    noRating: "Aucune note",
    ratingAria: (rating: number) => `${rating} sur 5`,
    pipeline: {
      title: "/ Pipeline de rétroaction",
      currentView: "Vue actuelle",
      requestsSent: "Demandes envoyées",
      awaitingReply: "En attente de réponse",
      responded: "Ont répondu",
      promoters: "Promoteurs (4–5★)",
      needsRecovery: "Récupération requise",
      note: "Chaque réponse est triée dès sa réception. Une note de 4 ou 5 marque un promoteur que vous pouvez inviter à publier un avis public; une note de 2 ou moins ouvre une tâche de récupération pour que votre équipe joigne le client en premier.",
    },
    loadFailed: "Échec du chargement de la rétroaction",
    somethingWrong: "Une erreur est survenue",
    sendFailed: "Échec de l'envoi de la demande",
    sendAlert: "Échec de l'envoi de la demande de rétroaction. Veuillez réessayer.",
    unknownCustomer: "Inconnu",
    retry: "Réessayer",
    eyebrow: "/ Intelligence · Rétroaction",
    subtitle: "Les réponses à toutes vos demandes, triées à mesure qu'elles arrivent.",
    avgRating: "Note moyenne",
    responseRate: "Taux de réponse",
    searchLabel: "Rechercher",
    searchPlaceholder: "Nom, courriel ou commentaire",
    statusFilterLabel: "Statut",
    ratingFilterLabel: "Note",
    allStatuses: "Tous les statuts",
    allRatings: "Toutes les notes",
    starsOption: (n: number) => (n === 1 ? "1 étoile" : `${n} étoiles`),
    sendRequestButton: "Envoyer une demande de rétroaction",
    nothingMatches: "Aucun résultat",
    widenFilters: "Élargissez le statut, la note ou la recherche pour voir plus de réponses.",
    emptyTitle: "Aucune rétroaction trouvée",
    emptyDescription:
      "Envoyez votre première demande — les clients satisfaits deviennent des avis publics, et les clients insatisfaits sont interceptés avant de publier.",
    atRisk: "À risque",
    detailTitle: "Détails de la rétroaction",
    detailCustomer: "Client",
    detailRating: "Note",
    detailStatus: "Statut",
    detailComment: "Commentaire",
    noComment: "Aucun commentaire fourni",
    detailCreated: "Créé le",
    detailSubmitted: "Soumis le",
    searchCustomersLabel: "Rechercher des clients",
    customerSearchPlaceholder: "Rechercher par nom ou courriel...",
    noCustomersFound: "Aucun client trouvé",
    cancel: "Annuler",
    sendRequest: "Envoyer la demande",
  },
  "de-CH": {
    statusLabels: {
      PENDING: "Ausstehend",
      SUBMITTED: "Übermittelt",
      EXPIRED: "Abgelaufen",
    } as Record<string, string>,
    noRating: "Keine Bewertung",
    ratingAria: (rating: number) => `${rating} von 5`,
    pipeline: {
      title: "/ Feedback-Pipeline",
      currentView: "Aktuelle Ansicht",
      requestsSent: "Anfragen gesendet",
      awaitingReply: "Antwort ausstehend",
      responded: "Geantwortet",
      promoters: "Promotoren (4–5★)",
      needsRecovery: "Rückgewinnung nötig",
      note: "Jede Antwort wird bei Eingang einsortiert. Eine 4 oder 5 markiert einen Promotor, den Sie einladen können, eine öffentliche Bewertung zu veröffentlichen; eine 2 oder tiefer öffnet eine Rückgewinnungsaufgabe, damit Ihr Team den Kunden zuerst erreicht.",
    },
    loadFailed: "Feedback konnte nicht geladen werden",
    somethingWrong: "Etwas ist schiefgelaufen",
    sendFailed: "Anfrage konnte nicht gesendet werden",
    sendAlert: "Feedback-Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
    unknownCustomer: "Unbekannt",
    retry: "Erneut versuchen",
    eyebrow: "/ Intelligence · Feedback",
    subtitle: "Antworten auf alle Anfragen, sortiert bei Eingang.",
    avgRating: "Durchschnittsbewertung",
    responseRate: "Antwortquote",
    searchLabel: "Suchen",
    searchPlaceholder: "Name, E-Mail oder Kommentar",
    statusFilterLabel: "Status",
    ratingFilterLabel: "Bewertung",
    allStatuses: "Alle Status",
    allRatings: "Alle Bewertungen",
    starsOption: (n: number) => (n === 1 ? "1 Stern" : `${n} Sterne`),
    sendRequestButton: "Feedback-Anfrage senden",
    nothingMatches: "Keine Treffer",
    widenFilters: "Erweitern Sie Status, Bewertung oder Suche, um mehr Antworten zu sehen.",
    emptyTitle: "Kein Feedback gefunden",
    emptyDescription:
      "Senden Sie Ihre erste Anfrage — zufriedene Kunden werden zu öffentlichen Bewertungen, und unzufriedene werden abgefangen, bevor sie posten.",
    atRisk: "Gefährdet",
    detailTitle: "Feedback-Details",
    detailCustomer: "Kunde",
    detailRating: "Bewertung",
    detailStatus: "Status",
    detailComment: "Kommentar",
    noComment: "Kein Kommentar vorhanden",
    detailCreated: "Erstellt",
    detailSubmitted: "Übermittelt",
    searchCustomersLabel: "Kunden suchen",
    customerSearchPlaceholder: "Nach Name oder E-Mail suchen...",
    noCustomersFound: "Keine Kunden gefunden",
    cancel: "Abbrechen",
    sendRequest: "Anfrage senden",
  },
};

// ─── /imports ───────────────────────────────────────────────────────────────
const importsEn = {
  title: "Data Sources",
  subtitle:
    "Import reviews from CSV files. Every imported review runs through the same sentiment, risk, and reputation analysis as monitored reviews.",
  uploadFailed: "Upload failed",
  commitFailed: "Could not start import",
  gatedTitle: "CSV import isn't on your plan",
  gatedDescription:
    "Importing reviews from CSV is available on Growth and above. Upgrade to feed your own review history into the analysis engine.",
  uploadTitle: "Upload a CSV",
  uploadSubtitle:
    "Export reviews from Google, Facebook, Trustpilot, or any tool, and drop the file here. We'll detect the columns and let you map them before importing.",
  dropHint: "CSV files up to 5MB",
  chooseFile: "Choose file",
  headerRow: "First row is a header",
  mapTitle: (filename: string) => `Map columns — ${filename}`,
  rowsDetected: (n: number) =>
    `${n.toLocaleString("en")} ${n === 1 ? "row" : "rows"} detected. Match each field to a column in your file. Map at least the review text or rating.`,
  cancel: "Cancel",
  platformLabel: "Source platform",
  ignoreOption: "— ignore —",
  fieldLabels: {
    content: "Review text",
    rating: "Rating",
    author: "Reviewer name",
    publishedAt: "Date",
    url: "Review URL",
    authorUrl: "Reviewer URL",
    externalId: "Native review ID",
    language: "Language",
  } as Record<string, string>,
  platformLabels: {
    GOOGLE: "Google",
    FACEBOOK: "Facebook",
    TRUSTPILOT: "Trustpilot",
    YELP: "Yelp",
    APP_STORE: "App Store",
    CUSTOM: "Custom / Other",
  } as Record<string, string>,
  mapHint: "Map a review text or rating column to continue",
  importButton: (n: number) =>
    `Import ${n.toLocaleString("en")} ${n === 1 ? "row" : "rows"}`,
  historyTitle: "Import history",
  loading: "Loading…",
  emptyTitle: "No imports yet",
  emptyDescription:
    "Uploaded files will appear here with their sync status and record counts.",
  colFile: "File",
  colPlatform: "Platform",
  colStatus: "Status",
  colImported: "Imported",
  colDuplicates: "Duplicates",
  colFailed: "Failed",
  colWhen: "When",
  statusLabels: {
    PENDING_MAPPING: "pending mapping",
    QUEUED: "queued",
    PROCESSING: "processing",
    COMPLETED: "completed",
    PARTIAL: "partial",
    FAILED: "failed",
    CANCELLED: "cancelled",
  } as Record<string, string>,
};
export type ImportsCopy = typeof importsEn;

export const IMPORTS_COPY: Record<DashLocale, ImportsCopy> = {
  en: importsEn,
  fr: {
    title: "Sources de données",
    subtitle:
      "Importez des avis à partir de fichiers CSV. Chaque avis importé passe par la même analyse de sentiment, de risque et de réputation que les avis surveillés.",
    uploadFailed: "Échec du téléversement",
    commitFailed: "Impossible de démarrer l'importation",
    gatedTitle: "L'importation CSV n'est pas incluse dans votre forfait",
    gatedDescription:
      "L'importation d'avis à partir de fichiers CSV est offerte avec le forfait Growth et les forfaits supérieurs. Passez au forfait supérieur pour alimenter le moteur d'analyse avec votre propre historique d'avis.",
    uploadTitle: "Téléverser un fichier CSV",
    uploadSubtitle:
      "Exportez vos avis depuis Google, Facebook, Trustpilot ou tout autre outil, puis déposez le fichier ici. Nous détecterons les colonnes et vous pourrez les associer avant l'importation.",
    dropHint: "Fichiers CSV jusqu'à 5 Mo",
    chooseFile: "Choisir un fichier",
    headerRow: "La première ligne est un en-tête",
    mapTitle: (filename: string) => `Associer les colonnes — ${filename}`,
    rowsDetected: (n: number) =>
      `${n.toLocaleString("fr")} ${n === 1 ? "ligne détectée" : "lignes détectées"}. Associez chaque champ à une colonne de votre fichier. Associez au moins le texte de l'avis ou la note.`,
    cancel: "Annuler",
    platformLabel: "Plateforme source",
    ignoreOption: "— ignorer —",
    fieldLabels: {
      content: "Texte de l'avis",
      rating: "Note",
      author: "Nom de l'auteur",
      publishedAt: "Date",
      url: "URL de l'avis",
      authorUrl: "URL de l'auteur",
      externalId: "Identifiant natif de l'avis",
      language: "Langue",
    } as Record<string, string>,
    platformLabels: {
      GOOGLE: "Google",
      FACEBOOK: "Facebook",
      TRUSTPILOT: "Trustpilot",
      YELP: "Yelp",
      APP_STORE: "App Store",
      CUSTOM: "Personnalisé / Autre",
    } as Record<string, string>,
    mapHint: "Associez une colonne de texte d'avis ou de note pour continuer",
    importButton: (n: number) =>
      `Importer ${n.toLocaleString("fr")} ${n === 1 ? "ligne" : "lignes"}`,
    historyTitle: "Historique des importations",
    loading: "Chargement…",
    emptyTitle: "Aucune importation pour l'instant",
    emptyDescription:
      "Les fichiers téléversés apparaîtront ici avec leur statut de synchronisation et le nombre d'enregistrements.",
    colFile: "Fichier",
    colPlatform: "Plateforme",
    colStatus: "Statut",
    colImported: "Importés",
    colDuplicates: "Doublons",
    colFailed: "Échecs",
    colWhen: "Quand",
    statusLabels: {
      PENDING_MAPPING: "association en attente",
      QUEUED: "en file d'attente",
      PROCESSING: "en traitement",
      COMPLETED: "terminée",
      PARTIAL: "partielle",
      FAILED: "échouée",
      CANCELLED: "annulée",
    } as Record<string, string>,
  },
  "de-CH": {
    title: "Datenquellen",
    subtitle:
      "Importieren Sie Bewertungen aus CSV-Dateien. Jede importierte Bewertung durchläuft dieselbe Stimmungs-, Risiko- und Reputationsanalyse wie überwachte Bewertungen.",
    uploadFailed: "Hochladen fehlgeschlagen",
    commitFailed: "Import konnte nicht gestartet werden",
    gatedTitle: "CSV-Import ist in Ihrem Plan nicht enthalten",
    gatedDescription:
      "Der Import von Bewertungen aus CSV-Dateien ist ab dem Growth-Plan verfügbar. Führen Sie ein Upgrade durch, um Ihren eigenen Bewertungsverlauf in die Analyse-Engine einzuspeisen.",
    uploadTitle: "CSV-Datei hochladen",
    uploadSubtitle:
      "Exportieren Sie Bewertungen aus Google, Facebook, Trustpilot oder einem anderen Tool und legen Sie die Datei hier ab. Wir erkennen die Spalten und Sie können sie vor dem Import zuordnen.",
    dropHint: "CSV-Dateien bis 5 MB",
    chooseFile: "Datei auswählen",
    headerRow: "Erste Zeile ist eine Kopfzeile",
    mapTitle: (filename: string) => `Spalten zuordnen — ${filename}`,
    rowsDetected: (n: number) =>
      `${n.toLocaleString("de-CH")} ${n === 1 ? "Zeile erkannt" : "Zeilen erkannt"}. Ordnen Sie jedes Feld einer Spalte in Ihrer Datei zu. Ordnen Sie mindestens den Bewertungstext oder die Bewertung zu.`,
    cancel: "Abbrechen",
    platformLabel: "Quellplattform",
    ignoreOption: "— ignorieren —",
    fieldLabels: {
      content: "Bewertungstext",
      rating: "Bewertung",
      author: "Name des Bewerters",
      publishedAt: "Datum",
      url: "Bewertungs-URL",
      authorUrl: "Bewerter-URL",
      externalId: "Native Bewertungs-ID",
      language: "Sprache",
    } as Record<string, string>,
    platformLabels: {
      GOOGLE: "Google",
      FACEBOOK: "Facebook",
      TRUSTPILOT: "Trustpilot",
      YELP: "Yelp",
      APP_STORE: "App Store",
      CUSTOM: "Benutzerdefiniert / Andere",
    } as Record<string, string>,
    mapHint:
      "Ordnen Sie eine Spalte mit Bewertungstext oder Bewertung zu, um fortzufahren",
    importButton: (n: number) =>
      `${n.toLocaleString("de-CH")} ${n === 1 ? "Zeile" : "Zeilen"} importieren`,
    historyTitle: "Importverlauf",
    loading: "Wird geladen…",
    emptyTitle: "Noch keine Importe",
    emptyDescription:
      "Hochgeladene Dateien erscheinen hier mit ihrem Synchronisierungsstatus und der Anzahl der Datensätze.",
    colFile: "Datei",
    colPlatform: "Plattform",
    colStatus: "Status",
    colImported: "Importiert",
    colDuplicates: "Duplikate",
    colFailed: "Fehlgeschlagen",
    colWhen: "Wann",
    statusLabels: {
      PENDING_MAPPING: "Zuordnung ausstehend",
      QUEUED: "In Warteschlange",
      PROCESSING: "In Bearbeitung",
      COMPLETED: "Abgeschlossen",
      PARTIAL: "Teilweise",
      FAILED: "Fehlgeschlagen",
      CANCELLED: "Abgebrochen",
    } as Record<string, string>,
  },
};

// ─── ImportsHelpButton (shared component, /imports) ─────────────────────────
const importsHelpEn = {
  fullGuide: "Full guide",
  howItWorks: "How it works",
  modalTitle: "How to import your reviews",
  iframeTitle: "How to import reviews — guide",
  openFullPage: "Open as a full page →",
};
export type ImportsHelpCopy = typeof importsHelpEn;

export const IMPORTS_HELP_COPY: Record<DashLocale, ImportsHelpCopy> = {
  en: importsHelpEn,
  fr: {
    fullGuide: "Guide complet",
    howItWorks: "Comment ça fonctionne",
    modalTitle: "Comment importer vos avis",
    iframeTitle: "Comment importer des avis — guide",
    openFullPage: "Ouvrir en pleine page →",
  },
  "de-CH": {
    fullGuide: "Vollständige Anleitung",
    howItWorks: "So funktioniert es",
    modalTitle: "So importieren Sie Ihre Bewertungen",
    iframeTitle: "Bewertungen importieren — Anleitung",
    openFullPage: "Als eigene Seite öffnen →",
  },
};

// ─── /intelligence/competitors (server page header) ─────────────────────────
const competitorsPageEn = {
  back: "← Back to Intelligence",
  eyebrow: "Intelligence",
  title: "Competitors",
  subtitle:
    "Daily rating and review-count snapshots. Momentum alerts fire when a competitor clearly outpaces your own review velocity.",
  // <head> metadata — bare title, the root layout template appends "| Echorank360".
  metaTitle: "Competitor Intelligence",
  metaDescription:
    "Track competitor ratings, review velocity, and momentum alerts for your market.",
};
export type CompetitorsPageCopy = typeof competitorsPageEn;

export const COMPETITORS_PAGE_COPY: Record<DashLocale, CompetitorsPageCopy> = {
  en: competitorsPageEn,
  fr: {
    back: "← Retour à l'intelligence",
    eyebrow: "Intelligence",
    title: "Concurrents",
    subtitle:
      "Instantanés quotidiens des notes et du nombre d'avis. Des alertes de momentum se déclenchent lorsqu'un concurrent dépasse clairement votre propre rythme d'avis.",
    metaTitle: "Intelligence concurrentielle",
    metaDescription:
      "Suivez les notes des concurrents, le rythme des avis et les alertes de momentum pour votre marché.",
  },
  "de-CH": {
    back: "← Zurück zu Intelligence",
    eyebrow: "Intelligence",
    title: "Mitbewerber",
    subtitle:
      "Tägliche Momentaufnahmen von Note und Bewertungsanzahl. Momentum-Alarme werden ausgelöst, wenn ein Mitbewerber Ihr eigenes Bewertungstempo deutlich übertrifft.",
    metaTitle: "Mitbewerber-Intelligence",
    metaDescription:
      "Verfolgen Sie Mitbewerber-Bewertungen, das Bewertungstempo und Momentum-Alarme für Ihren Markt.",
  },
};

// ─── Competitors help modal (src/components/help/CompetitorsHelp.tsx) ──────
const competitorsHelpEn = {
  button: "Help",
  buttonAria: "Open help: how this page works",
  modalTitle: "Competitor tracking, explained",
  close: "Close help",
  labels: {
    meaning: "What it means",
    why: "Why it matters",
    action: "What to do",
  },
  s1Heading: "What this page does",
  s1Text:
    "It keeps a daily eye on your competitors' Google ratings and review counts, so you can spot who is gaining ground without visiting their listings yourself.",
  s2Heading: "Adding a competitor",
  s2Text:
    "Search for the business name plus its city — for example “Super C Boucherville” — then pick the right listing from the results. The address under each result helps you tell apart branches of the same chain.",
  s2Note:
    "Added by name only? That's a manual entry: it has no Google listing attached, so it can't update itself. Use “Link to Places” on its row to connect the real listing — its history is kept.",
  s3Heading: "The numbers, decoded",
  metrics: [
    {
      title: "Star rating",
      meaning:
        "The competitor's average Google score out of 5. The small number under it is the change over the last 30 days.",
      why: "It's the first thing potential customers compare when they choose between you.",
      action:
        "If a rival's rating climbs while yours stands still, read their newest reviews to see what customers are praising.",
    },
    {
      title: "Review count",
      meaning:
        "How many Google reviews they have in total, plus how many they gained in the last 7 and 30 days.",
      why: "A fast-growing count shows they are actively asking for reviews — and Google notices that activity too.",
      action: "Keep pace by inviting your own recent, happy customers to leave a review.",
    },
    {
      title: "Your review pace (7d)",
      meaning:
        "How many new reviews your own business collected in the last 7 days (“7d” just means the last seven days).",
      why: "It's the yardstick everything else is measured against — the momentum bar compares each competitor to this number.",
      action:
        "If it shows 0, connect your review sources on the Data Sources page so Echorank360 can count them.",
    },
    {
      title: "Momentum bar",
      meaning: "It fills up as a competitor gains reviews faster than you do.",
      why: "A full bar means they are clearly pulling ahead — we send you an alert when that happens.",
      action:
        "Treat the alert as a friendly nudge: ask your happy customers for reviews before the gap grows.",
    },
  ],
  s4Heading: "What to expect",
  s4Bullets: [
    "New competitors picked from search show their rating and review count right away.",
    "Every day at 06:30 UTC we save a snapshot — a dated copy of each competitor's numbers.",
    "Trends, sparklines and the momentum bar need a few days of snapshots before they have a story to tell.",
  ],
};
export type CompetitorsHelpCopy = typeof competitorsHelpEn;

export const COMPETITORS_HELP_COPY: Record<DashLocale, CompetitorsHelpCopy> = {
  en: competitorsHelpEn,
  fr: {
    button: "Aide",
    buttonAria: "Ouvrir l'aide : comment fonctionne cette page",
    modalTitle: "Le suivi des concurrents, expliqué",
    close: "Fermer l'aide",
    labels: {
      meaning: "Ce que ça veut dire",
      why: "Pourquoi c'est important",
      action: "Quoi faire",
    },
    s1Heading: "À quoi sert cette page",
    s1Text:
      "Elle surveille chaque jour les notes Google et le nombre d'avis de vos concurrents, pour que vous voyiez qui gagne du terrain sans devoir visiter leurs fiches vous-même.",
    s2Heading: "Ajouter un concurrent",
    s2Text:
      "Cherchez le nom de l'entreprise suivi de sa ville — par exemple « Super C Boucherville » — puis choisissez la bonne fiche dans les résultats. L'adresse sous chaque résultat aide à distinguer les succursales d'une même chaîne.",
    s2Note:
      "Ajouté seulement par son nom? C'est une entrée manuelle : aucune fiche Google n'y est rattachée, elle ne peut donc pas se mettre à jour toute seule. Utilisez « Lier à Places » sur sa ligne pour rattacher la vraie fiche — l'historique est conservé.",
    s3Heading: "Les chiffres, décodés",
    metrics: [
      {
        title: "Note en étoiles",
        meaning:
          "La note Google moyenne du concurrent, sur 5. Le petit chiffre en dessous indique le changement des 30 derniers jours.",
        why: "C'est la première chose que les clients potentiels comparent avant de choisir.",
        action:
          "Si la note d'un rival grimpe pendant que la vôtre stagne, lisez ses avis récents pour voir ce que les clients apprécient.",
      },
      {
        title: "Nombre d'avis",
        meaning:
          "Le total d'avis Google, plus le nombre gagné dans les 7 et 30 derniers jours.",
        why: "Un total qui grimpe vite montre qu'ils sollicitent activement des avis — et Google le remarque aussi.",
        action: "Gardez le rythme en invitant vos clients récents et satisfaits à laisser un avis.",
      },
      {
        title: "Votre rythme d'avis (7 j)",
        meaning:
          "Le nombre de nouveaux avis que votre entreprise a reçus dans les 7 derniers jours (« 7 j » veut simplement dire les sept derniers jours).",
        why: "C'est l'étalon de mesure : la barre de momentum compare chaque concurrent à ce chiffre.",
        action:
          "S'il affiche 0, connectez vos sources d'avis sur la page Sources de données pour qu'Echorank360 puisse les compter.",
      },
      {
        title: "Barre de momentum",
        meaning: "Elle se remplit quand un concurrent gagne des avis plus vite que vous.",
        why: "Une barre pleine signifie qu'il prend clairement les devants — nous vous envoyons une alerte à ce moment-là.",
        action:
          "Voyez l'alerte comme un rappel amical : demandez des avis à vos clients satisfaits avant que l'écart se creuse.",
      },
    ],
    s4Heading: "À quoi s'attendre",
    s4Bullets: [
      "Les concurrents choisis dans la recherche affichent leur note et leur nombre d'avis immédiatement.",
      "Chaque jour à 6 h 30 UTC, nous enregistrons un instantané — une copie datée des chiffres de chaque concurrent.",
      "Les tendances, les mini-graphiques et la barre de momentum ont besoin de quelques jours d'instantanés avant de raconter quelque chose.",
    ],
  },
  "de-CH": {
    button: "Hilfe",
    buttonAria: "Hilfe öffnen: So funktioniert diese Seite",
    modalTitle: "Mitbewerber-Tracking, einfach erklärt",
    close: "Hilfe schliessen",
    labels: {
      meaning: "Was es bedeutet",
      why: "Warum es wichtig ist",
      action: "Was Sie tun können",
    },
    s1Heading: "Was diese Seite macht",
    s1Text:
      "Sie behält täglich die Google-Noten und Bewertungszahlen Ihrer Mitbewerber im Blick — so sehen Sie, wer aufholt, ohne deren Einträge selbst besuchen zu müssen.",
    s2Heading: "Einen Mitbewerber hinzufügen",
    s2Text:
      "Suchen Sie nach dem Firmennamen plus Stadt — zum Beispiel «Super C Boucherville» — und wählen Sie den passenden Eintrag aus den Resultaten. Die Adresse unter jedem Resultat hilft, Filialen derselben Kette auseinanderzuhalten.",
    s2Note:
      "Nur mit dem Namen hinzugefügt? Das ist ein manueller Eintrag: Ohne verknüpften Google-Eintrag kann er sich nicht selbst aktualisieren. Nutzen Sie «Mit Places verknüpfen» in seiner Zeile — der Verlauf bleibt erhalten.",
    s3Heading: "Die Zahlen, entschlüsselt",
    metrics: [
      {
        title: "Sterne-Note",
        meaning:
          "Die durchschnittliche Google-Note des Mitbewerbers (von 5). Die kleine Zahl darunter zeigt die Veränderung der letzten 30 Tage.",
        why: "Sie ist das Erste, was potenzielle Kundinnen und Kunden vergleichen.",
        action:
          "Steigt die Note eines Rivalen, während Ihre stehen bleibt, lesen Sie seine neusten Bewertungen — was loben die Leute?",
      },
      {
        title: "Bewertungsanzahl",
        meaning:
          "Wie viele Google-Bewertungen insgesamt vorliegen, plus der Zuwachs der letzten 7 und 30 Tage.",
        why: "Eine schnell wachsende Zahl zeigt: Dort wird aktiv um Bewertungen gebeten — und auch Google registriert diese Aktivität.",
        action:
          "Halten Sie mit, indem Sie Ihre zufriedenen Kundinnen und Kunden um eine Bewertung bitten.",
      },
      {
        title: "Ihr Bewertungstempo (7 T)",
        meaning:
          "Wie viele neue Bewertungen Ihr eigenes Geschäft in den letzten 7 Tagen erhalten hat («7 T» heisst: die letzten sieben Tage).",
        why: "Das ist der Massstab: Die Momentum-Leiste vergleicht jeden Mitbewerber mit dieser Zahl.",
        action:
          "Steht hier 0, verbinden Sie Ihre Bewertungsquellen auf der Seite Datenquellen, damit Echorank360 sie zählen kann.",
      },
      {
        title: "Momentum-Leiste",
        meaning: "Sie füllt sich, wenn ein Mitbewerber schneller Bewertungen gewinnt als Sie.",
        why: "Eine volle Leiste heisst: Er zieht klar davon — genau dann alarmieren wir Sie.",
        action:
          "Nehmen Sie den Alarm als freundlichen Anstoss: Bitten Sie Ihre zufriedene Kundschaft um Bewertungen, bevor der Abstand wächst.",
      },
    ],
    s4Heading: "Was Sie erwarten können",
    s4Bullets: [
      "Aus der Suche gewählte Mitbewerber zeigen Note und Bewertungsanzahl sofort an.",
      "Jeden Tag um 06:30 UTC speichern wir eine Momentaufnahme — eine datierte Kopie der Zahlen jedes Mitbewerbers.",
      "Trends, Mini-Diagramme und die Momentum-Leiste brauchen ein paar Tage Momentaufnahmen, bevor sie etwas erzählen können.",
    ],
  },
};

// ─── /intelligence/risk (server page header) ────────────────────────────────
const riskPageEn = {
  back: "← Back to Intelligence",
  eyebrow: "Intelligence",
  title: "Reputation risk",
  subtitle:
    "Unified score across reviews, private feedback and AI visibility — recomputed hourly.",
};
export type RiskPageCopy = typeof riskPageEn;

export const RISK_PAGE_COPY: Record<DashLocale, RiskPageCopy> = {
  en: riskPageEn,
  fr: {
    back: "← Retour à l'intelligence",
    eyebrow: "Intelligence",
    title: "Risque de réputation",
    subtitle:
      "Score unifié combinant les avis, la rétroaction privée et la visibilité IA — recalculé toutes les heures.",
  },
  "de-CH": {
    back: "← Zurück zu Intelligence",
    eyebrow: "Intelligence",
    title: "Reputationsrisiko",
    subtitle:
      "Einheitlicher Score über Bewertungen, privates Feedback und KI-Sichtbarkeit — stündlich neu berechnet.",
  },
};

// ─── CompetitorsPanel (src/components/intelligence/CompetitorsPanel.tsx) ────
const competitorsPanelEn = {
  // errors / confirms
  placesUnavailable: "Places search unavailable — add manually below.",
  searchFailed: "Search failed.",
  httpError: (status: number) => `HTTP ${status}`,
  removeConfirm: (name: string) => `Remove ${name} and its snapshot history?`,
  loadFailed: "Competitor data didn't load.",
  retry: "Retry",
  alreadyTracked: "This competitor is already tracked.",
  alreadyTrackedManual:
    "Already tracked as a manual entry — use “Link to Places” on that row instead.",
  limitReached: (n: number) => `Limit of ${n} competitors reached.`,
  // add section
  trackTitle: "Track a competitor",
  ownPace: "your review pace (7d):",
  paceHint: "No review data in the last 7 days —",
  paceHintLink: "connect your review sources",
  searchPlaceholderPlaces: "Business name + city (Places search)",
  searchPlaceholderManual: "Competitor name (manual — no Places key set)",
  searching: "Searching…",
  search: "Search",
  add: "Add",
  noMatches: "No matches.",
  reviewsCount: (n: number) => `${n} review${n === 1 ? "" : "s"}`,
  track: "Track",
  linkAction: "Link",
  linkingNotice: (name: string) => `Linking “${name}” — search and pick its Google listing.`,
  cancel: "Cancel",
  // table section
  tableTitle: "Competitors — daily snapshots",
  refreshing: "Refreshing…",
  refreshNow: "Refresh now",
  refreshFailed: "Refresh failed.",
  refreshSummary: (ok: number, failed: number) =>
    failed > 0 ? `Updated ${ok}, failed ${failed}.` : `Updated ${ok} competitor${ok === 1 ? "" : "s"}.`,
  updatedTag: "updated ✓",
  placesErrorTag: (code: string) => `Places error (${code})`,
  emptyTable:
    "No competitors tracked yet. Add one above — snapshots run daily at 06:30 UTC.",
  placesAuto: "places · auto",
  manualSnapshots: "manual — not auto-updated",
  linkToPlaces: "Link to Places",
  mapsLinkTitle: "Open the Google Maps listing",
  sparkRatingLabel: "rating trend",
  sparkReviewsLabel: "review-count trend",
  lastDay: (day: string) => `last ${day}`,
  noDataYet: "no data yet",
  suffix7d: " 7d",
  suffix30d: " 30d",
  revAbbrev: "rev",
  momentumTitle: (n: number) =>
    `Momentum vs your pace — alert at +${n} reviews/7d`,
  momentum: "momentum",
  pause: "Pause",
  resume: "Resume",
  remove: "Remove",
};
export type CompetitorsPanelCopy = typeof competitorsPanelEn;

export const COMPETITORS_PANEL_COPY: Record<DashLocale, CompetitorsPanelCopy> = {
  en: competitorsPanelEn,
  fr: {
    placesUnavailable: "Recherche Places indisponible — ajoutez manuellement ci-dessous.",
    searchFailed: "Échec de la recherche.",
    httpError: (status: number) => `HTTP ${status}`,
    removeConfirm: (name: string) =>
      `Retirer ${name} et son historique d'instantanés?`,
    loadFailed: "Les données des concurrents n'ont pas pu être chargées.",
    retry: "Réessayer",
    alreadyTracked: "Ce concurrent est déjà suivi.",
    alreadyTrackedManual:
      "Déjà suivi comme entrée manuelle — utilisez plutôt « Lier à Places » sur cette ligne.",
    limitReached: (n: number) => `Limite de ${n} concurrents atteinte.`,
    trackTitle: "Suivre un concurrent",
    ownPace: "votre rythme d'avis (7 j) :",
    paceHint: "Aucune donnée d'avis dans les 7 derniers jours —",
    paceHintLink: "connectez vos sources d'avis",
    searchPlaceholderPlaces: "Nom de l'entreprise + ville (recherche Places)",
    searchPlaceholderManual: "Nom du concurrent (manuel — aucune clé Places configurée)",
    searching: "Recherche…",
    search: "Rechercher",
    add: "Ajouter",
    noMatches: "Aucun résultat.",
    reviewsCount: (n: number) => `${n} avis`,
    track: "Suivre",
    linkAction: "Lier",
    linkingNotice: (name: string) =>
      `Liaison de « ${name} » — recherchez et choisissez sa fiche Google.`,
    cancel: "Annuler",
    tableTitle: "Concurrents — instantanés quotidiens",
    refreshing: "Actualisation…",
    refreshNow: "Actualiser maintenant",
    refreshFailed: "Échec de l'actualisation.",
    refreshSummary: (ok: number, failed: number) =>
      failed > 0 ? `${ok} mis à jour, ${failed} en échec.` : `${ok} concurrent${ok === 1 ? "" : "s"} mis à jour.`,
    updatedTag: "mis à jour ✓",
    placesErrorTag: (code: string) => `Erreur Places (${code})`,
    emptyTable:
      "Aucun concurrent suivi pour le moment. Ajoutez-en un ci-dessus — les instantanés sont pris chaque jour à 06:30 UTC.",
    placesAuto: "places · auto",
    manualSnapshots: "manuel — sans mise à jour auto",
    linkToPlaces: "Lier à Places",
    mapsLinkTitle: "Ouvrir la fiche Google Maps",
    sparkRatingLabel: "tendance de la note",
    sparkReviewsLabel: "tendance du nombre d'avis",
    lastDay: (day: string) => `dernier ${day}`,
    noDataYet: "aucune donnée pour le moment",
    suffix7d: " 7 j",
    suffix30d: " 30 j",
    revAbbrev: "avis",
    momentumTitle: (n: number) =>
      `Momentum par rapport à votre rythme — alerte à +${n} avis/7 j`,
    momentum: "momentum",
    pause: "Suspendre",
    resume: "Reprendre",
    remove: "Retirer",
  },
  "de-CH": {
    placesUnavailable: "Places-Suche nicht verfügbar — fügen Sie unten manuell hinzu.",
    searchFailed: "Suche fehlgeschlagen.",
    httpError: (status: number) => `HTTP ${status}`,
    removeConfirm: (name: string) =>
      `${name} und den zugehörigen Verlauf der Momentaufnahmen entfernen?`,
    loadFailed: "Mitbewerberdaten konnten nicht geladen werden.",
    retry: "Erneut versuchen",
    alreadyTracked: "Dieser Mitbewerber wird bereits verfolgt.",
    alreadyTrackedManual:
      "Bereits als manueller Eintrag erfasst — nutzen Sie stattdessen «Mit Places verknüpfen» in dieser Zeile.",
    limitReached: (n: number) => `Limite von ${n} Mitbewerbern erreicht.`,
    trackTitle: "Einen Mitbewerber verfolgen",
    ownPace: "Ihr Bewertungstempo (7 T):",
    paceHint: "Keine Bewertungsdaten in den letzten 7 Tagen —",
    paceHintLink: "verbinden Sie Ihre Bewertungsquellen",
    searchPlaceholderPlaces: "Firmenname + Stadt (Places-Suche)",
    searchPlaceholderManual: "Name des Mitbewerbers (manuell — kein Places-Schlüssel hinterlegt)",
    searching: "Suche läuft…",
    search: "Suchen",
    add: "Hinzufügen",
    noMatches: "Keine Treffer.",
    reviewsCount: (n: number) => `${n} Bewertung${n === 1 ? "" : "en"}`,
    track: "Verfolgen",
    linkAction: "Verknüpfen",
    linkingNotice: (name: string) =>
      `«${name}» wird verknüpft — suchen Sie den passenden Google-Eintrag aus.`,
    cancel: "Abbrechen",
    tableTitle: "Mitbewerber — tägliche Momentaufnahmen",
    refreshing: "Wird aktualisiert…",
    refreshNow: "Jetzt aktualisieren",
    refreshFailed: "Aktualisierung fehlgeschlagen.",
    refreshSummary: (ok: number, failed: number) =>
      failed > 0
        ? `${ok} aktualisiert, ${failed} fehlgeschlagen.`
        : `${ok} Mitbewerber aktualisiert.`,
    updatedTag: "aktualisiert ✓",
    placesErrorTag: (code: string) => `Places-Fehler (${code})`,
    emptyTable:
      "Noch keine Mitbewerber erfasst. Fügen Sie oben einen hinzu — Momentaufnahmen laufen täglich um 06:30 UTC.",
    placesAuto: "places · auto",
    manualSnapshots: "manuell — keine automatische Aktualisierung",
    linkToPlaces: "Mit Places verknüpfen",
    mapsLinkTitle: "Google-Maps-Eintrag öffnen",
    sparkRatingLabel: "Trend der Note",
    sparkReviewsLabel: "Trend der Bewertungsanzahl",
    lastDay: (day: string) => `zuletzt ${day}`,
    noDataYet: "noch keine Daten",
    suffix7d: " 7 T",
    suffix30d: " 30 T",
    revAbbrev: "Bew.",
    momentumTitle: (n: number) =>
      `Momentum im Vergleich zu Ihrem Tempo — Alarm bei +${n} Bewertungen/7 T`,
    momentum: "Momentum",
    pause: "Pausieren",
    resume: "Fortsetzen",
    remove: "Entfernen",
  },
};

// ─── RiskDashboard (src/components/intelligence/RiskDashboard.tsx) ──────────
const riskDashboardEn = {
  // gauge
  gaugeAria: (score: number, grade: string) =>
    `Reputation risk ${score} out of 100, grade ${grade}`,
  gradeLabel: (grade: string) => `GRADE ${grade}`,
  gaugeCaption: "REPUTATION RISK · 0–100",
  // sparkline
  historyEmpty: "History builds as daily snapshots accumulate.",
  sparklineAria: "90-day risk trend",
  // deltas
  delta7: "7-day",
  delta30: "30-day",
  // config panel
  httpError: (status: number) => `HTTP ${status}`,
  revenueLabel: "Monthly revenue (for exposure estimate)",
  revenuePlaceholder: "e.g. 50000",
  emailsLabel: "Alert emails (comma-separated)",
  alertsEnabled: "Email alerts enabled",
  saving: "Saving…",
  saveConfig: "Save configuration",
  // load / empty states
  loadFailed: "Risk data didn't load.",
  retry: "Retry",
  emptyTitle: "No signals ingested yet.",
  emptyHint:
    "Run the backfill script to fold existing reviews, feedback and audits into the spine.",
  recomputing: "Recomputing…",
  recomputeNow: "Recompute now",
  // components card
  componentsTitle: "Risk components",
  componentLabels: {
    negativePressure: {
      label: "Negative pressure",
      hint: "Time-decayed weight of negative signals",
    },
    velocity: { label: "Velocity", hint: "This week vs 4-week baseline" },
    criticalRecent: {
      label: "Criticals",
      hint: "High-severity signals, last 30 days",
    },
    visibility: { label: "AI visibility", hint: "Inverse of latest audit score" },
    stagnation: {
      label: "Signal coverage",
      hint: "Data drought is a blind spot",
    },
  },
  noData: "no data",
  trendTitle: "90-day trend",
  // drivers card
  driversTitle: "Top risk drivers",
  driversEmpty: "No negative contributors in the window. Quiet is good.",
  pctOfPressure: (pct: number) => `${pct}% of pressure`,
  sev: (s: string) => `sev ${s}`,
  // revenue card
  revenueAtRiskTitle: "Revenue at risk",
  close: "Close",
  configure: "Configure",
  formulaTitle: (elasticity: number) =>
    `monthlyRevenue × ${elasticity} × max(0, score − 20) / 100`,
  perMonthAbbrev: "/mo",
  exposureSummary: (score: number, money: string) =>
    `Estimated exposure at risk ${score} on ${money} monthly revenue.`,
  revenueUnset: "Set monthly revenue to quantify what the current risk level costs.",
  // alerts card
  alertsTitle: "Alerts — last 30 days",
  alertsEmpty:
    "No alerts fired. Thresholds: score crossing 60/80, 7-day jump ≥ 15, new critical signals.",
  // footer
  signalsInWindow: (n: number) => `${n} signal${n === 1 ? "" : "s"} in window`,
  computedAtTime: (time: string) => `computed ${time}`,
};
export type RiskDashboardCopy = typeof riskDashboardEn;

export const RISK_DASHBOARD_COPY: Record<DashLocale, RiskDashboardCopy> = {
  en: riskDashboardEn,
  fr: {
    gaugeAria: (score: number, grade: string) =>
      `Risque de réputation ${score} sur 100, cote ${grade}`,
    gradeLabel: (grade: string) => `COTE ${grade}`,
    gaugeCaption: "RISQUE DE RÉPUTATION · 0–100",
    historyEmpty:
      "L'historique se construit à mesure que les instantanés quotidiens s'accumulent.",
    sparklineAria: "Tendance du risque sur 90 jours",
    delta7: "7 jours",
    delta30: "30 jours",
    httpError: (status: number) => `HTTP ${status}`,
    revenueLabel: "Revenu mensuel (pour l'estimation de l'exposition)",
    revenuePlaceholder: "p. ex. 50000",
    emailsLabel: "Courriels d'alerte (séparés par des virgules)",
    alertsEnabled: "Alertes par courriel activées",
    saving: "Enregistrement…",
    saveConfig: "Enregistrer la configuration",
    loadFailed: "Les données de risque n'ont pas pu être chargées.",
    retry: "Réessayer",
    emptyTitle: "Aucun signal ingéré pour le moment.",
    emptyHint:
      "Exécutez le script de rattrapage pour intégrer les avis, la rétroaction et les audits existants.",
    recomputing: "Recalcul…",
    recomputeNow: "Recalculer maintenant",
    componentsTitle: "Composantes du risque",
    componentLabels: {
      negativePressure: {
        label: "Pression négative",
        hint: "Poids des signaux négatifs, pondéré selon le temps écoulé",
      },
      velocity: {
        label: "Vélocité",
        hint: "Cette semaine par rapport à la référence de 4 semaines",
      },
      criticalRecent: {
        label: "Signaux critiques",
        hint: "Signaux de gravité élevée, 30 derniers jours",
      },
      visibility: {
        label: "Visibilité IA",
        hint: "Inverse du dernier score d'audit",
      },
      stagnation: {
        label: "Couverture des signaux",
        hint: "Un manque de données est un angle mort",
      },
    },
    noData: "aucune donnée",
    trendTitle: "Tendance sur 90 jours",
    driversTitle: "Principaux facteurs de risque",
    driversEmpty:
      "Aucun contributeur négatif dans la fenêtre. Le calme est bon signe.",
    pctOfPressure: (pct: number) => `${pct} % de la pression`,
    sev: (s: string) => `grav. ${s}`,
    revenueAtRiskTitle: "Revenu à risque",
    close: "Fermer",
    configure: "Configurer",
    formulaTitle: (elasticity: number) =>
      `monthlyRevenue × ${elasticity} × max(0, score − 20) / 100`,
    perMonthAbbrev: "/mois",
    exposureSummary: (score: number, money: string) =>
      `Exposition estimée au niveau de risque ${score} sur un revenu mensuel de ${money}.`,
    revenueUnset:
      "Définissez le revenu mensuel pour quantifier ce que coûte le niveau de risque actuel.",
    alertsTitle: "Alertes — 30 derniers jours",
    alertsEmpty:
      "Aucune alerte déclenchée. Seuils : score franchissant 60/80, hausse de ≥ 15 sur 7 jours, nouveaux signaux critiques.",
    signalsInWindow: (n: number) =>
      `${n} ${n === 1 ? "signal" : "signaux"} dans la fenêtre`,
    computedAtTime: (time: string) => `calculé à ${time}`,
  },
  "de-CH": {
    gaugeAria: (score: number, grade: string) =>
      `Reputationsrisiko ${score} von 100, Note ${grade}`,
    gradeLabel: (grade: string) => `NOTE ${grade}`,
    gaugeCaption: "REPUTATIONSRISIKO · 0–100",
    historyEmpty:
      "Der Verlauf baut sich auf, während sich tägliche Momentaufnahmen ansammeln.",
    sparklineAria: "Risikotrend über 90 Tage",
    delta7: "7 Tage",
    delta30: "30 Tage",
    httpError: (status: number) => `HTTP ${status}`,
    revenueLabel: "Monatlicher Umsatz (für die Schätzung der Exponierung)",
    revenuePlaceholder: "z. B. 50000",
    emailsLabel: "Alarm-E-Mails (durch Kommas getrennt)",
    alertsEnabled: "E-Mail-Alarme aktiviert",
    saving: "Wird gespeichert…",
    saveConfig: "Konfiguration speichern",
    loadFailed: "Risikodaten konnten nicht geladen werden.",
    retry: "Erneut versuchen",
    emptyTitle: "Noch keine Signale erfasst.",
    emptyHint:
      "Führen Sie das Backfill-Skript aus, um bestehende Bewertungen, Feedback und Audits einzuspeisen.",
    recomputing: "Wird neu berechnet…",
    recomputeNow: "Jetzt neu berechnen",
    componentsTitle: "Risikokomponenten",
    componentLabels: {
      negativePressure: {
        label: "Negativer Druck",
        hint: "Zeitlich abklingende Gewichtung negativer Signale",
      },
      velocity: {
        label: "Geschwindigkeit",
        hint: "Diese Woche im Vergleich zur 4-Wochen-Basis",
      },
      criticalRecent: {
        label: "Kritische Signale",
        hint: "Signale mit hohem Schweregrad, letzte 30 Tage",
      },
      visibility: {
        label: "KI-Sichtbarkeit",
        hint: "Kehrwert des letzten Audit-Scores",
      },
      stagnation: {
        label: "Signalabdeckung",
        hint: "Datenmangel ist ein blinder Fleck",
      },
    },
    noData: "keine Daten",
    trendTitle: "90-Tage-Trend",
    driversTitle: "Wichtigste Risikotreiber",
    driversEmpty:
      "Keine negativen Beiträge im Zeitfenster. Ruhe ist ein gutes Zeichen.",
    pctOfPressure: (pct: number) => `${pct} % des Drucks`,
    sev: (s: string) => `Schwere ${s}`,
    revenueAtRiskTitle: "Gefährdeter Umsatz",
    close: "Schliessen",
    configure: "Konfigurieren",
    formulaTitle: (elasticity: number) =>
      `monthlyRevenue × ${elasticity} × max(0, score − 20) / 100`,
    perMonthAbbrev: "/Mt.",
    exposureSummary: (score: number, money: string) =>
      `Geschätzte Exponierung bei Risikostufe ${score} auf ${money} Monatsumsatz.`,
    revenueUnset:
      "Legen Sie den Monatsumsatz fest, um zu beziffern, was das aktuelle Risikoniveau kostet.",
    alertsTitle: "Alarme — letzte 30 Tage",
    alertsEmpty:
      "Keine Alarme ausgelöst. Schwellenwerte: Score überschreitet 60/80, 7-Tage-Anstieg ≥ 15, neue kritische Signale.",
    signalsInWindow: (n: number) => `${n} Signal${n === 1 ? "" : "e"} im Fenster`,
    computedAtTime: (time: string) => `berechnet um ${time}`,
  },
};

// ─── /intelligence ──────────────────────────────────────────────────────────
const intelligenceEn = {
  title: "Reputation Intelligence",
  subtitle:
    "AI-powered insights into your brand reputation and customer risk signals.",
  last7Days: "Last 7 days",
  last30Days: "Last 30 days",
  last90Days: "Last 90 days",
  loadFailed: "Failed to load intelligence data",
  genericError: "Something went wrong",
  errorTitle: "Failed to load intelligence data",
  retry: "Retry",
  // Score ring
  outOf100: "/ 100",
  riskBadge: (level: string) => `${level} RISK`,
  riskLabels: {
    LOW: "LOW",
    MODERATE: "MODERATE",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL",
  } as Record<string, string>,
  trendLabels: {
    improving: "Improving",
    declining: "Declining",
    stable: "Stable",
  } as Record<string, string>,
  basedOn: (n: number, pct: string) =>
    `Based on ${n} data point${n === 1 ? "" : "s"} (${pct}% confidence)`,
  // Stat cards
  sentimentScoreTitle: "Sentiment Score",
  healthy: "Healthy",
  needsAttention: "Needs attention",
  atRisk: "At risk",
  responseRateTitle: "Response Rate",
  goodEngagement: "Good engagement",
  lowEngagement: "Low engagement",
  recoveryScoreTitle: "Recovery Score",
  effectiveRecovery: "Effective recovery",
  improveFollowUp: "Improve follow-up",
  reviewVelocityTitle: "Review Velocity",
  steadyFlow: "Steady flow",
  needsBoost: "Needs boost",
  // Volatility / alert summary / sample size row
  volatilityIndex: "Volatility Index",
  highVariability: "High variability",
  moderateVariability: "Moderate variability",
  stableVariability: "Stable",
  activeAlerts: "Active Alerts",
  nCritical: (n: number) => `${n} critical`,
  nHighPriority: (n: number) => `${n} high priority`,
  noUrgentAlerts: "No urgent alerts",
  sampleSizeTitle: "Sample Size",
  highConfidence: "High confidence",
  moderateConfidence: "Moderate confidence",
  lowConfidence: "Low confidence",
  // Escalation alerts
  escalationAlerts: "Escalation Alerts",
  nActive: (n: number) => `${n} active`,
  allClear: "All clear",
  noActiveAlerts: "No active escalation alerts",
  acknowledge: "Acknowledge",
  resolve: "Resolve",
  // Score breakdown
  scoreBreakdown: "Score Breakdown",
  breakdownSentiment: "Sentiment",
  breakdownResponseRate: "Response Rate",
  breakdownRecovery: "Recovery",
  breakdownReviewVelocity: "Review Velocity",
  breakdownStability: "Stability",
  // Location comparison
  locationComparison: "Location Comparison",
  colLocation: "Location",
  colOverallScore: "Overall Score",
  colSentiment: "Sentiment",
  colRiskLevel: "Risk Level",
  colTrend: "Trend",
  colSamples: "Samples",
  // History
  scoreHistory: "Reputation Score History",
};
export type IntelligenceCopy = typeof intelligenceEn;

export const INTELLIGENCE_COPY: Record<DashLocale, IntelligenceCopy> = {
  en: intelligenceEn,
  fr: {
    title: "Intelligence de réputation",
    subtitle:
      "Des analyses propulsées par l'IA sur la réputation de votre marque et les signaux de risque liés à vos clients.",
    last7Days: "7 derniers jours",
    last30Days: "30 derniers jours",
    last90Days: "90 derniers jours",
    loadFailed: "Échec du chargement des données d'intelligence",
    genericError: "Une erreur est survenue",
    errorTitle: "Échec du chargement des données d'intelligence",
    retry: "Réessayer",
    outOf100: "/ 100",
    riskBadge: (level: string) => `RISQUE ${level}`,
    riskLabels: {
      LOW: "FAIBLE",
      MODERATE: "MODÉRÉ",
      HIGH: "ÉLEVÉ",
      CRITICAL: "CRITIQUE",
    } as Record<string, string>,
    trendLabels: {
      improving: "En amélioration",
      declining: "En déclin",
      stable: "Stable",
    } as Record<string, string>,
    basedOn: (n: number, pct: string) =>
      `Basé sur ${n} point${n === 1 ? "" : "s"} de données (${pct} % de confiance)`,
    sentimentScoreTitle: "Score de sentiment",
    healthy: "Sain",
    needsAttention: "Attention requise",
    atRisk: "À risque",
    responseRateTitle: "Taux de réponse",
    goodEngagement: "Bon engagement",
    lowEngagement: "Faible engagement",
    recoveryScoreTitle: "Score de récupération",
    effectiveRecovery: "Récupération efficace",
    improveFollowUp: "Améliorer le suivi",
    reviewVelocityTitle: "Vélocité des avis",
    steadyFlow: "Flux régulier",
    needsBoost: "À stimuler",
    volatilityIndex: "Indice de volatilité",
    highVariability: "Variabilité élevée",
    moderateVariability: "Variabilité modérée",
    stableVariability: "Stable",
    activeAlerts: "Alertes actives",
    nCritical: (n: number) => (n === 1 ? "1 critique" : `${n} critiques`),
    nHighPriority: (n: number) =>
      n === 1 ? "1 de priorité élevée" : `${n} de priorité élevée`,
    noUrgentAlerts: "Aucune alerte urgente",
    sampleSizeTitle: "Taille de l'échantillon",
    highConfidence: "Confiance élevée",
    moderateConfidence: "Confiance modérée",
    lowConfidence: "Confiance faible",
    escalationAlerts: "Alertes d'escalade",
    nActive: (n: number) => (n === 1 ? "1 active" : `${n} actives`),
    allClear: "Tout est en ordre",
    noActiveAlerts: "Aucune alerte d'escalade active",
    acknowledge: "Accuser réception",
    resolve: "Résoudre",
    scoreBreakdown: "Répartition du score",
    breakdownSentiment: "Sentiment",
    breakdownResponseRate: "Taux de réponse",
    breakdownRecovery: "Récupération",
    breakdownReviewVelocity: "Vélocité des avis",
    breakdownStability: "Stabilité",
    locationComparison: "Comparaison des emplacements",
    colLocation: "Emplacement",
    colOverallScore: "Score global",
    colSentiment: "Sentiment",
    colRiskLevel: "Niveau de risque",
    colTrend: "Tendance",
    colSamples: "Échantillons",
    scoreHistory: "Historique du score de réputation",
  },
  "de-CH": {
    title: "Reputations-Intelligence",
    subtitle:
      "KI-gestützte Einblicke in die Reputation Ihrer Marke und die Risikosignale Ihrer Kunden.",
    last7Days: "Letzte 7 Tage",
    last30Days: "Letzte 30 Tage",
    last90Days: "Letzte 90 Tage",
    loadFailed: "Intelligence-Daten konnten nicht geladen werden",
    genericError: "Etwas ist schiefgelaufen",
    errorTitle: "Intelligence-Daten konnten nicht geladen werden",
    retry: "Erneut versuchen",
    outOf100: "/ 100",
    riskBadge: (level: string) => `RISIKO: ${level}`,
    riskLabels: {
      LOW: "NIEDRIG",
      MODERATE: "MODERAT",
      HIGH: "HOCH",
      CRITICAL: "KRITISCH",
    } as Record<string, string>,
    trendLabels: {
      improving: "Verbessert sich",
      declining: "Verschlechtert sich",
      stable: "Stabil",
    } as Record<string, string>,
    basedOn: (n: number, pct: string) =>
      `Basierend auf ${n} ${n === 1 ? "Datenpunkt" : "Datenpunkten"} (${pct}% Konfidenz)`,
    sentimentScoreTitle: "Stimmungswert",
    healthy: "Gesund",
    needsAttention: "Braucht Aufmerksamkeit",
    atRisk: "Gefährdet",
    responseRateTitle: "Antwortquote",
    goodEngagement: "Gutes Engagement",
    lowEngagement: "Geringes Engagement",
    recoveryScoreTitle: "Rückgewinnungswert",
    effectiveRecovery: "Wirksame Rückgewinnung",
    improveFollowUp: "Nachfassen verbessern",
    reviewVelocityTitle: "Bewertungsfrequenz",
    steadyFlow: "Stetiger Zufluss",
    needsBoost: "Braucht Schub",
    volatilityIndex: "Volatilitätsindex",
    highVariability: "Hohe Schwankung",
    moderateVariability: "Mässige Schwankung",
    stableVariability: "Stabil",
    activeAlerts: "Aktive Warnungen",
    nCritical: (n: number) => `${n} kritisch`,
    nHighPriority: (n: number) => `${n} mit hoher Priorität`,
    noUrgentAlerts: "Keine dringenden Warnungen",
    sampleSizeTitle: "Stichprobengrösse",
    highConfidence: "Hohe Konfidenz",
    moderateConfidence: "Mittlere Konfidenz",
    lowConfidence: "Geringe Konfidenz",
    escalationAlerts: "Eskalationswarnungen",
    nActive: (n: number) => `${n} aktiv`,
    allClear: "Alles in Ordnung",
    noActiveAlerts: "Keine aktiven Eskalationswarnungen",
    acknowledge: "Bestätigen",
    resolve: "Beheben",
    scoreBreakdown: "Score-Aufschlüsselung",
    breakdownSentiment: "Stimmung",
    breakdownResponseRate: "Antwortquote",
    breakdownRecovery: "Rückgewinnung",
    breakdownReviewVelocity: "Bewertungsfrequenz",
    breakdownStability: "Stabilität",
    locationComparison: "Standortvergleich",
    colLocation: "Standort",
    colOverallScore: "Gesamtscore",
    colSentiment: "Stimmung",
    colRiskLevel: "Risikostufe",
    colTrend: "Trend",
    colSamples: "Stichproben",
    scoreHistory: "Verlauf des Reputationsscores",
  },
};

// ─── /monitoring ────────────────────────────────────────────────────────────
const monitoringEn = {
  title: "Reputation Monitoring",
  subtitle: "Track your brand across review platforms and social media",
  refresh: "Refresh",
  addSource: "Add Source",
  sourcesHeading: "Monitoring Sources",
  sourcesEmptyTitle: "No monitoring sources",
  sourcesEmptyDescription:
    "Add your first monitoring source to start tracking reviews and mentions across platforms.",
  active: "Active",
  inactive: "Inactive",
  reviewCount: (n: number) => (n === 1 ? "1 review" : `${n} reviews`),
  lastChecked: "Last checked:",
  // Relative time
  never: "Never",
  justNow: "Just now",
  minutesAgo: (n: number) => `${n}m ago`,
  hoursAgo: (n: number) => `${n}h ago`,
  daysAgo: (n: number) => `${n}d ago`,
  // Charts
  reviewsByPlatform: "Reviews by Platform",
  riskDistribution: "Risk Level Distribution",
  noReviewData: "No review data yet",
  // Reviews feed
  recentReviews: "Recent Reviews & Mentions",
  allPlatforms: "All Platforms",
  allRiskLevels: "All Risk Levels",
  riskLabels: {
    LOW: "Low",
    MODERATE: "Moderate",
    HIGH: "High",
    CRITICAL: "Critical",
  } as Record<string, string>,
  sentimentLabels: {
    positive: "positive",
    neutral: "neutral",
    negative: "negative",
  } as Record<string, string>,
  reviewsEmptyTitle: "No reviews found",
  reviewsEmptyDescription:
    "Reviews will appear here once your monitoring sources start collecting data.",
  // Add source modal
  addModalTitle: "Add Monitoring Source",
  platformFieldLabel: "Platform",
  selectPlatform: "Select platform...",
  platformCustom: "Custom",
  sourceNameLabel: "Source Name",
  sourceNamePlaceholder: "e.g., Main Location Google Reviews",
  externalIdLabel: "External ID / Place ID",
  externalIdPlaceholder: "Platform-specific identifier",
  urlLabel: "URL (optional)",
  cancel: "Cancel",
  createSourceFailedShort: "Failed to create source",
  createSourceFailed: "Failed to create monitoring source",
};
export type MonitoringCopy = typeof monitoringEn;

export const MONITORING_COPY: Record<DashLocale, MonitoringCopy> = {
  en: monitoringEn,
  fr: {
    title: "Surveillance de la réputation",
    subtitle: "Suivez votre marque sur les plateformes d'avis et les médias sociaux",
    refresh: "Actualiser",
    addSource: "Ajouter une source",
    sourcesHeading: "Sources de surveillance",
    sourcesEmptyTitle: "Aucune source de surveillance",
    sourcesEmptyDescription:
      "Ajoutez votre première source de surveillance pour commencer à suivre les avis et les mentions sur l'ensemble des plateformes.",
    active: "Actif",
    inactive: "Inactif",
    reviewCount: (n: number) => (n === 1 ? "1 avis" : `${n} avis`),
    lastChecked: "Dernière vérification :",
    // Relative time
    never: "Jamais",
    justNow: "À l'instant",
    minutesAgo: (n: number) => `il y a ${n} min`,
    hoursAgo: (n: number) => `il y a ${n} h`,
    daysAgo: (n: number) => (n === 1 ? "il y a 1 jour" : `il y a ${n} jours`),
    // Charts
    reviewsByPlatform: "Avis par plateforme",
    riskDistribution: "Répartition des niveaux de risque",
    noReviewData: "Aucune donnée d'avis pour l'instant",
    // Reviews feed
    recentReviews: "Avis et mentions récents",
    allPlatforms: "Toutes les plateformes",
    allRiskLevels: "Tous les niveaux de risque",
    riskLabels: {
      LOW: "Faible",
      MODERATE: "Modéré",
      HIGH: "Élevé",
      CRITICAL: "Critique",
    } as Record<string, string>,
    sentimentLabels: {
      positive: "positif",
      neutral: "neutre",
      negative: "négatif",
    } as Record<string, string>,
    reviewsEmptyTitle: "Aucun avis trouvé",
    reviewsEmptyDescription:
      "Les avis apparaîtront ici dès que vos sources de surveillance commenceront à recueillir des données.",
    // Add source modal
    addModalTitle: "Ajouter une source de surveillance",
    platformFieldLabel: "Plateforme",
    selectPlatform: "Sélectionner une plateforme...",
    platformCustom: "Personnalisée",
    sourceNameLabel: "Nom de la source",
    sourceNamePlaceholder: "p. ex. Avis Google de l'emplacement principal",
    externalIdLabel: "ID externe / ID de lieu",
    externalIdPlaceholder: "Identifiant propre à la plateforme",
    urlLabel: "URL (facultative)",
    cancel: "Annuler",
    createSourceFailedShort: "Échec de la création de la source",
    createSourceFailed: "Échec de la création de la source de surveillance",
  },
  "de-CH": {
    title: "Reputationsüberwachung",
    subtitle: "Verfolgen Sie Ihre Marke über Bewertungsplattformen und soziale Medien hinweg",
    refresh: "Aktualisieren",
    addSource: "Quelle hinzufügen",
    sourcesHeading: "Überwachungsquellen",
    sourcesEmptyTitle: "Keine Überwachungsquellen",
    sourcesEmptyDescription:
      "Fügen Sie Ihre erste Überwachungsquelle hinzu, um Bewertungen und Erwähnungen plattformübergreifend zu verfolgen.",
    active: "Aktiv",
    inactive: "Inaktiv",
    reviewCount: (n: number) => (n === 1 ? "1 Bewertung" : `${n} Bewertungen`),
    lastChecked: "Zuletzt geprüft:",
    // Relative time
    never: "Nie",
    justNow: "Gerade eben",
    minutesAgo: (n: number) => `vor ${n} Min.`,
    hoursAgo: (n: number) => `vor ${n} Std.`,
    daysAgo: (n: number) => (n === 1 ? "vor 1 Tag" : `vor ${n} Tagen`),
    // Charts
    reviewsByPlatform: "Bewertungen nach Plattform",
    riskDistribution: "Verteilung der Risikostufen",
    noReviewData: "Noch keine Bewertungsdaten",
    // Reviews feed
    recentReviews: "Aktuelle Bewertungen und Erwähnungen",
    allPlatforms: "Alle Plattformen",
    allRiskLevels: "Alle Risikostufen",
    riskLabels: {
      LOW: "Niedrig",
      MODERATE: "Moderat",
      HIGH: "Hoch",
      CRITICAL: "Kritisch",
    } as Record<string, string>,
    sentimentLabels: {
      positive: "positiv",
      neutral: "neutral",
      negative: "negativ",
    } as Record<string, string>,
    reviewsEmptyTitle: "Keine Bewertungen gefunden",
    reviewsEmptyDescription:
      "Bewertungen erscheinen hier, sobald Ihre Überwachungsquellen Daten sammeln.",
    // Add source modal
    addModalTitle: "Überwachungsquelle hinzufügen",
    platformFieldLabel: "Plattform",
    selectPlatform: "Plattform auswählen...",
    platformCustom: "Benutzerdefiniert",
    sourceNameLabel: "Name der Quelle",
    sourceNamePlaceholder: "z. B. Google-Bewertungen Hauptstandort",
    externalIdLabel: "Externe ID / Place ID",
    externalIdPlaceholder: "Plattformspezifische Kennung",
    urlLabel: "URL (optional)",
    cancel: "Abbrechen",
    createSourceFailedShort: "Quelle konnte nicht erstellt werden",
    createSourceFailed: "Überwachungsquelle konnte nicht erstellt werden",
  },
};

// ─── /recovery ──────────────────────────────────────────────────────────────
const recoveryEn = {
  // lifecycle banner
  bannerTitle: "How a recovery ticket works",
  bannerTagline: "Opened automatically when a customer leaves a low rating",
  svgAria:
    "Recovery ticket lifecycle: a low rating opens a ticket, which moves from Open to In progress to Resolved to Closed.",
  svgLowRating: "Low rating",
  svgStars: "(1-3 stars)",
  svgOpen: "Open",
  svgInProgress: "In progress",
  svgResolved: "Resolved",
  svgClosed: "Closed",
  p1a: "When a customer leaves a low rating, a recovery ticket opens automatically so your team can follow up. Work it from ",
  p1open: "Open",
  p1b: " through ",
  p1inProgress: "In progress",
  p1c: " to ",
  p1resolved: "Resolved",
  p1d: ", then ",
  p1closed: "Closed",
  p1e: ". Use the Priority filter to tackle the most urgent first.",
  // errors
  loadFailed: "Failed to load recovery tickets",
  genericError: "Something went wrong",
  updateFailed: "Failed to update ticket",
  updateFailedAlert: "Failed to update ticket. Please try again.",
  retry: "Retry",
  unknownCustomer: "Unknown",
  // filters
  statusLabel: "Status",
  priorityLabel: "Priority",
  allStatuses: "All Statuses",
  allPriorities: "All Priorities",
  statusLabels: {
    OPEN: "Open",
    IN_PROGRESS: "In Progress",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
  } as Record<string, string>,
  priorityLabels: {
    URGENT: "Urgent",
    HIGH: "High",
    MEDIUM: "Medium",
    LOW: "Low",
  } as Record<string, string>,
  openTickets: (n: number) => (n === 1 ? "1 open ticket" : `${n} open tickets`),
  // table
  colCustomer: "Customer",
  colRating: "Rating",
  colPriority: "Priority",
  colStatus: "Status",
  colAssignedTo: "Assigned To",
  colCreated: "Created",
  unassigned: "Unassigned",
  // empty state
  emptyTitle: "You're all caught up",
  emptyDescription:
    "No unhappy customers to reach right now. When someone leaves a low rating, they'll appear here so you can respond before it goes public.",
  // detail modal
  modalTitle: "Recovery Ticket",
  customerLabel: "Customer",
  ratingLabel: "Rating",
  createdLabel: "Created",
  commentLabel: "Customer Comment",
  notesLabel: "Notes",
  notesPlaceholder: "Add notes about the recovery effort...",
  cancel: "Cancel",
  updateTicket: "Update Ticket",
};
export type RecoveryCopy = typeof recoveryEn;

export const RECOVERY_COPY: Record<DashLocale, RecoveryCopy> = {
  en: recoveryEn,
  fr: {
    bannerTitle: "Comment fonctionne un billet de récupération",
    bannerTagline:
      "Ouvert automatiquement lorsqu'un client laisse une note faible",
    svgAria:
      "Cycle de vie d'un billet de récupération : une note faible ouvre un billet, qui passe d'Ouvert à En cours, puis à Résolu et à Fermé.",
    svgLowRating: "Note faible",
    svgStars: "(1-3 étoiles)",
    svgOpen: "Ouvert",
    svgInProgress: "En cours",
    svgResolved: "Résolu",
    svgClosed: "Fermé",
    p1a: "Lorsqu'un client laisse une note faible, un billet de récupération s'ouvre automatiquement pour que votre équipe puisse faire un suivi. Faites-le passer d'",
    p1open: "Ouvert",
    p1b: " à ",
    p1inProgress: "En cours",
    p1c: ", puis à ",
    p1resolved: "Résolu",
    p1d: " et enfin ",
    p1closed: "Fermé",
    p1e: ". Utilisez le filtre Priorité pour traiter d'abord les plus urgents.",
    loadFailed: "Échec du chargement des billets de récupération",
    genericError: "Une erreur est survenue",
    updateFailed: "Échec de la mise à jour du billet",
    updateFailedAlert: "Échec de la mise à jour du billet. Veuillez réessayer.",
    retry: "Réessayer",
    unknownCustomer: "Inconnu",
    statusLabel: "Statut",
    priorityLabel: "Priorité",
    allStatuses: "Tous les statuts",
    allPriorities: "Toutes les priorités",
    statusLabels: {
      OPEN: "Ouvert",
      IN_PROGRESS: "En cours",
      RESOLVED: "Résolu",
      CLOSED: "Fermé",
    } as Record<string, string>,
    priorityLabels: {
      URGENT: "Urgente",
      HIGH: "Élevée",
      MEDIUM: "Moyenne",
      LOW: "Faible",
    } as Record<string, string>,
    openTickets: (n: number) =>
      n === 1 ? "1 billet ouvert" : `${n} billets ouverts`,
    colCustomer: "Client",
    colRating: "Note",
    colPriority: "Priorité",
    colStatus: "Statut",
    colAssignedTo: "Assigné à",
    colCreated: "Création",
    unassigned: "Non assigné",
    emptyTitle: "Vous êtes à jour",
    emptyDescription:
      "Aucun client insatisfait à joindre pour le moment. Lorsqu'une personne laisse une note faible, elle apparaîtra ici pour que vous puissiez répondre avant que ça devienne public.",
    modalTitle: "Billet de récupération",
    customerLabel: "Client",
    ratingLabel: "Note",
    createdLabel: "Création",
    commentLabel: "Commentaire du client",
    notesLabel: "Notes",
    notesPlaceholder: "Ajoutez des notes sur l'effort de récupération...",
    cancel: "Annuler",
    updateTicket: "Mettre à jour le billet",
  },
  "de-CH": {
    bannerTitle: "So funktioniert ein Rückgewinnungsticket",
    bannerTagline:
      "Wird automatisch geöffnet, wenn ein Kunde eine niedrige Bewertung hinterlässt",
    svgAria:
      "Lebenszyklus eines Rückgewinnungstickets: Eine niedrige Bewertung öffnet ein Ticket, das von Offen über In Bearbeitung zu Gelöst und Geschlossen wechselt.",
    svgLowRating: "Niedrige Bewertung",
    svgStars: "(1-3 Sterne)",
    svgOpen: "Offen",
    svgInProgress: "In Bearbeitung",
    svgResolved: "Gelöst",
    svgClosed: "Geschlossen",
    p1a: "Wenn ein Kunde eine niedrige Bewertung hinterlässt, wird automatisch ein Rückgewinnungsticket geöffnet, damit Ihr Team nachfassen kann. Bearbeiten Sie es von ",
    p1open: "Offen",
    p1b: " über ",
    p1inProgress: "In Bearbeitung",
    p1c: " zu ",
    p1resolved: "Gelöst",
    p1d: ", dann ",
    p1closed: "Geschlossen",
    p1e: ". Nutzen Sie den Prioritätsfilter, um die dringendsten zuerst anzugehen.",
    loadFailed: "Rückgewinnungstickets konnten nicht geladen werden",
    genericError: "Etwas ist schiefgelaufen",
    updateFailed: "Ticket konnte nicht aktualisiert werden",
    updateFailedAlert:
      "Ticket konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.",
    retry: "Erneut versuchen",
    unknownCustomer: "Unbekannt",
    statusLabel: "Status",
    priorityLabel: "Priorität",
    allStatuses: "Alle Status",
    allPriorities: "Alle Prioritäten",
    statusLabels: {
      OPEN: "Offen",
      IN_PROGRESS: "In Bearbeitung",
      RESOLVED: "Gelöst",
      CLOSED: "Geschlossen",
    } as Record<string, string>,
    priorityLabels: {
      URGENT: "Dringend",
      HIGH: "Hoch",
      MEDIUM: "Mittel",
      LOW: "Niedrig",
    } as Record<string, string>,
    openTickets: (n: number) =>
      n === 1 ? "1 offenes Ticket" : `${n} offene Tickets`,
    colCustomer: "Kunde",
    colRating: "Bewertung",
    colPriority: "Priorität",
    colStatus: "Status",
    colAssignedTo: "Zugewiesen an",
    colCreated: "Erstellt",
    unassigned: "Nicht zugewiesen",
    emptyTitle: "Alles erledigt",
    emptyDescription:
      "Derzeit keine unzufriedenen Kunden zu kontaktieren. Wenn jemand eine niedrige Bewertung hinterlässt, erscheint sie hier, damit Sie antworten können, bevor sie öffentlich wird.",
    modalTitle: "Rückgewinnungsticket",
    customerLabel: "Kunde",
    ratingLabel: "Bewertung",
    createdLabel: "Erstellt",
    commentLabel: "Kundenkommentar",
    notesLabel: "Notizen",
    notesPlaceholder: "Fügen Sie Notizen zur Rückgewinnung hinzu...",
    cancel: "Abbrechen",
    updateTicket: "Ticket aktualisieren",
  },
};

// ─── /review-links ──────────────────────────────────────────────────────────
const reviewLinksEn = {
  title: "Review Links",
  subtitle: "Manage links where customers can leave public reviews.",
  helpButton: "Help",
  addLink: "Add Review Link",
  // errors / feedback
  loadFailed: "Failed to load review links",
  genericError: "Something went wrong",
  saveFailed: "Failed to save review link. Please try again.",
  updateFailed: "Failed to update review link.",
  deleteConfirm: "Are you sure you want to delete this review link?",
  deleteFailed: "Failed to delete review link.",
  retry: "Retry",
  // table
  colPlatform: "Platform",
  colUrl: "URL",
  colLabel: "Label",
  colLocation: "Location",
  colClicks: "Clicks",
  colDefault: "Default",
  platformLabels: { Other: "Other" } as Record<string, string>,
  setDefault: "Set as default",
  removeDefault: "Remove as default",
  tableEmpty: "No review links found",
  // empty state
  emptyTitle: "No review links yet",
  emptyDescription:
    "Share one link that routes happy customers straight to Google or Facebook to leave a review.",
  // add/edit modal
  modalEditTitle: "Edit Review Link",
  modalAddTitle: "Add Review Link",
  formPlatform: "Platform",
  formUrl: "URL",
  formUrlPlaceholder: "https://g.page/r/your-business/review",
  formLabel: "Label (optional)",
  formLabelPlaceholder: "e.g. Main Location Google",
  formLocation: "Location (optional)",
  formLocationPlaceholder: "e.g. Downtown Office",
  setAsDefaultCheckbox: "Set as default review link",
  cancel: "Cancel",
  saveChanges: "Save Changes",
  addLinkSubmit: "Add Link",
  // help modal (in-file ReviewLinksHelpModal)
  helpModal: {
    title: "Getting your Google review links",
    intro: "Two link formats, both keyed off the Google Place ID:",
    writeLabel: "Write-a-review link",
    viewLabel: "View-reviews link",
    placeIdTitle: "Finding the Place ID",
    finderStrong: "Place ID Finder (manual):",
    finderLink: "Google's Place ID Finder",
    finderAfter: " — Search the business name and city (e.g. \u201cAvril Laval\u201d), then copy the ID — it starts with ",
    ownStrong: "If it's your own business:",
    ownTextA: " In Google Business Profile, \u201cAsk for reviews\u201d gives you a short ",
    ownTextB: " link directly — no Place ID needed.",
    importTitle: "Importing existing reviews",
    importIntro: "To pull your current Google, Facebook, or Trustpilot reviews into Echorank360, use our browser extension. Download it and follow the install steps here:",
    guideLabel: "Step-by-step import guide:",
    guideLink: "How to import reviews",
    extensionInApp: "or open the Extension page in the sidebar",
    close: "Close",
  },
  // sibling file: share-tools.tsx (ShareToolsCard)
  share: {
    headline: "Get more reviews with one link",
    bullet1: "Share via SMS, email, or social in one click",
    bullet2: "Customers land on the platform you choose",
    bullet3: "Every click is tracked automatically",
    copyLink: "Copy Link",
    copied: "Copied!",
    email: "Email",
    sms: "SMS",
    whatsapp: "WhatsApp",
    shareBtn: "Share",
    mailSubject: "How was your experience?",
    shareText: (url: string) =>
      `We'd love your feedback! Leave us a review here: ${url}`,
    previewHeading: "What your customers see",
    previewQuestion: "How was your experience?",
    previewLeaveOn: "Leave a review on:",
  },
};
export type ReviewLinksCopy = typeof reviewLinksEn;

export const REVIEW_LINKS_COPY: Record<DashLocale, ReviewLinksCopy> = {
  en: reviewLinksEn,
  fr: {
    title: "Liens d'avis",
    subtitle: "Gérez les liens où vos clients peuvent laisser des avis publics.",
    helpButton: "Aide",
    addLink: "Ajouter un lien d'avis",
    loadFailed: "Échec du chargement des liens d'avis",
    genericError: "Une erreur est survenue",
    saveFailed: "Échec de l'enregistrement du lien d'avis. Veuillez réessayer.",
    updateFailed: "Échec de la mise à jour du lien d'avis.",
    deleteConfirm: "Voulez-vous vraiment supprimer ce lien d'avis?",
    deleteFailed: "Échec de la suppression du lien d'avis.",
    retry: "Réessayer",
    colPlatform: "Plateforme",
    colUrl: "URL",
    colLabel: "Étiquette",
    colLocation: "Emplacement",
    colClicks: "Clics",
    colDefault: "Par défaut",
    platformLabels: { Other: "Autre" } as Record<string, string>,
    setDefault: "Définir par défaut",
    removeDefault: "Retirer le statut par défaut",
    tableEmpty: "Aucun lien d'avis trouvé",
    emptyTitle: "Aucun lien d'avis pour l'instant",
    emptyDescription:
      "Partagez un seul lien qui dirige vos clients satisfaits directement vers Google ou Facebook pour laisser un avis.",
    modalEditTitle: "Modifier le lien d'avis",
    modalAddTitle: "Ajouter un lien d'avis",
    formPlatform: "Plateforme",
    formUrl: "URL",
    formUrlPlaceholder: "https://g.page/r/your-business/review",
    formLabel: "Étiquette (facultatif)",
    formLabelPlaceholder: "p. ex. Google — emplacement principal",
    formLocation: "Emplacement (facultatif)",
    formLocationPlaceholder: "p. ex. Bureau du centre-ville",
    setAsDefaultCheckbox: "Définir comme lien d'avis par défaut",
    cancel: "Annuler",
    saveChanges: "Enregistrer les modifications",
    addLinkSubmit: "Ajouter le lien",
    helpModal: {
      title: "Obtenir vos liens d'avis Google",
      intro: "Deux formats de lien, tous deux basés sur l'identifiant de lieu Google (Place ID) :",
      writeLabel: "Lien pour rédiger un avis",
      viewLabel: "Lien pour consulter les avis",
      placeIdTitle: "Trouver le Place ID",
      finderStrong: "Outil Place ID Finder (manuel) :",
      finderLink: "l'outil Place ID Finder de Google",
      finderAfter: " — Cherchez le nom de l'entreprise et la ville (p. ex. « Avril Laval »), puis copiez l'identifiant — il commence par ",
      ownStrong: "S'il s'agit de votre propre entreprise :",
      ownTextA: " Dans votre Profil d'entreprise Google, « Demander des avis » vous donne directement un lien court ",
      ownTextB: " — aucun Place ID requis.",
      importTitle: "Importer vos avis existants",
      importIntro: "Pour importer vos avis Google, Facebook ou Trustpilot dans Echorank360, utilisez notre extension de navigateur. Téléchargez-la et suivez les étapes d'installation ici :",
      guideLabel: "Guide d'importation étape par étape :",
      guideLink: "Comment importer des avis",
      extensionInApp: "ou ouvrez la page Extension dans la barre latérale",
      close: "Fermer",
    },
    share: {
      headline: "Obtenez plus d'avis avec un seul lien",
      bullet1: "Partagez par SMS, courriel ou médias sociaux en un clic",
      bullet2: "Les clients arrivent sur la plateforme de votre choix",
      bullet3: "Chaque clic est suivi automatiquement",
      copyLink: "Copier le lien",
      copied: "Copié!",
      email: "Courriel",
      sms: "SMS",
      whatsapp: "WhatsApp",
      shareBtn: "Partager",
      mailSubject: "Comment s'est passée votre expérience?",
      shareText: (url: string) =>
        `Votre avis compte pour nous! Laissez-nous un avis ici : ${url}`,
      previewHeading: "Ce que vos clients voient",
      previewQuestion: "Comment s'est passée votre expérience?",
      previewLeaveOn: "Laissez un avis sur :",
    },
  },
  "de-CH": {
    title: "Bewertungslinks",
    subtitle:
      "Verwalten Sie die Links, über die Kunden öffentliche Bewertungen hinterlassen können.",
    helpButton: "Hilfe",
    addLink: "Bewertungslink hinzufügen",
    loadFailed: "Bewertungslinks konnten nicht geladen werden",
    genericError: "Etwas ist schiefgelaufen",
    saveFailed:
      "Bewertungslink konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
    updateFailed: "Bewertungslink konnte nicht aktualisiert werden.",
    deleteConfirm: "Möchten Sie diesen Bewertungslink wirklich löschen?",
    deleteFailed: "Bewertungslink konnte nicht gelöscht werden.",
    retry: "Erneut versuchen",
    colPlatform: "Plattform",
    colUrl: "URL",
    colLabel: "Bezeichnung",
    colLocation: "Standort",
    colClicks: "Klicks",
    colDefault: "Standard",
    platformLabels: { Other: "Andere" } as Record<string, string>,
    setDefault: "Als Standard festlegen",
    removeDefault: "Als Standard entfernen",
    tableEmpty: "Keine Bewertungslinks gefunden",
    emptyTitle: "Noch keine Bewertungslinks",
    emptyDescription:
      "Teilen Sie einen einzigen Link, der zufriedene Kunden direkt zu Google oder Facebook führt, um eine Bewertung zu hinterlassen.",
    modalEditTitle: "Bewertungslink bearbeiten",
    modalAddTitle: "Bewertungslink hinzufügen",
    formPlatform: "Plattform",
    formUrl: "URL",
    formUrlPlaceholder: "https://g.page/r/your-business/review",
    formLabel: "Bezeichnung (optional)",
    formLabelPlaceholder: "z. B. Google Hauptstandort",
    formLocation: "Standort (optional)",
    formLocationPlaceholder: "z. B. Büro Stadtzentrum",
    setAsDefaultCheckbox: "Als Standard-Bewertungslink festlegen",
    cancel: "Abbrechen",
    saveChanges: "Änderungen speichern",
    addLinkSubmit: "Link hinzufügen",
    helpModal: {
      title: "Ihre Google-Bewertungslinks erhalten",
      intro: "Zwei Linkformate, beide basierend auf der Google Place ID:",
      writeLabel: "Link zum Schreiben einer Bewertung",
      viewLabel: "Link zum Ansehen der Bewertungen",
      placeIdTitle: "Die Place ID finden",
      finderStrong: "Place ID Finder (manuell):",
      finderLink: "Googles Place ID Finder",
      finderAfter: " — Suchen Sie den Firmennamen und die Stadt (z. B. «Avril Laval») und kopieren Sie die ID — sie beginnt mit ",
      ownStrong: "Wenn es Ihr eigenes Unternehmen ist:",
      ownTextA: " In Ihrem Google Business Profile erhalten Sie über «Bewertungen anfordern» direkt einen kurzen ",
      ownTextB: "-Link — ganz ohne Place ID.",
      importTitle: "Bestehende Bewertungen importieren",
      importIntro: "Um Ihre aktuellen Google-, Facebook- oder Trustpilot-Bewertungen in Echorank360 zu übernehmen, verwenden Sie unsere Browser-Erweiterung. Laden Sie sie herunter und folgen Sie den Installationsschritten hier:",
      guideLabel: "Schritt-für-Schritt-Anleitung zum Import:",
      guideLink: "So importieren Sie Bewertungen",
      extensionInApp: "oder öffnen Sie die Seite «Extension» in der Seitenleiste",
      close: "Schliessen",
    },
    share: {
      headline: "Mehr Bewertungen mit einem einzigen Link",
      bullet1: "Per SMS, E-Mail oder Social Media mit einem Klick teilen",
      bullet2: "Kunden landen auf der Plattform Ihrer Wahl",
      bullet3: "Jeder Klick wird automatisch erfasst",
      copyLink: "Link kopieren",
      copied: "Kopiert!",
      email: "E-Mail",
      sms: "SMS",
      whatsapp: "WhatsApp",
      shareBtn: "Teilen",
      mailSubject: "Wie war Ihre Erfahrung?",
      shareText: (url: string) =>
        `Wir würden uns über Ihr Feedback freuen! Hinterlassen Sie uns hier eine Bewertung: ${url}`,
      previewHeading: "Das sehen Ihre Kunden",
      previewQuestion: "Wie war Ihre Erfahrung?",
      previewLeaveOn: "Bewertung hinterlassen auf:",
    },
  },
};

// ─── /settings ──────────────────────────────────────────────────────────────
const settingsEn = {
  title: "Settings",
  subtitle: "Manage your business settings and brand configuration.",
  helpButton: "Help",
  loadFailed: "Failed to load settings",
  genericError: "Something went wrong",
  errorTitle: "Failed to load settings",
  retry: "Retry",
  saveFailed: "Failed to save settings. Please try again.",
  savedSuccess: "Settings saved successfully!",
  saveButton: "Save Settings",
  businessInfoTitle: "Business Information",
  businessNameLabel: "Business Name",
  businessNamePlaceholder: "Your Business Name",
  logoUrlLabel: "Logo URL",
  supportEmailLabel: "Support Email",
  brandColorsTitle: "Brand Colors",
  primaryColorLabel: "Primary Color",
  secondaryColorLabel: "Secondary Color",
  reviewLinksTitle: "Review Platform Links",
  googleLinkLabel: "Google Review Link",
  facebookLinkLabel: "Facebook Review Link",
  trustpilotLinkLabel: "Trustpilot Link",
  localizationTitle: "Localization",
  timezoneLabel: "Timezone",
  languageLabel: "Default Language",
  timezones: {
    "America/New_York": "Eastern Time (ET)",
    "America/Chicago": "Central Time (CT)",
    "America/Denver": "Mountain Time (MT)",
    "America/Los_Angeles": "Pacific Time (PT)",
    "America/Anchorage": "Alaska Time (AKT)",
    "Pacific/Honolulu": "Hawaii Time (HT)",
    "Europe/London": "London (GMT)",
    "Europe/Paris": "Paris (CET)",
    "Europe/Berlin": "Berlin (CET)",
    "Asia/Tokyo": "Tokyo (JST)",
    "Asia/Shanghai": "Shanghai (CST)",
    "Australia/Sydney": "Sydney (AEST)",
    UTC: "UTC",
  } as Record<string, string>,
  languages: {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    pt: "Portuguese",
    it: "Italian",
    nl: "Dutch",
    ja: "Japanese",
    zh: "Chinese",
  } as Record<string, string>,
  whitelabelTitle: "White-label",
  agencyRequired: "Agency Plan Required",
  customDomainLabel: "Custom Domain",
  whitelabelCheckbox: "Enable white-label branding (removes Echorank branding)",
  helpModal: {
    title: "Settings help",
    businessBody:
      "Your business name, logo and support email appear on the feedback pages customers see and on outgoing emails. Use a publicly hosted image URL for the logo (PNG or SVG works best).",
    brandBody:
      "The primary color is used for buttons and accents on your customer feedback pages. Enter a hex value (for example #2563eb) or pick one with the color swatch.",
    reviewBody:
      "These are where satisfied customers are sent to leave a public review. For Google, use your “write a review” link (https://g.page/r/…/review or a Place ID review URL). Set at least the Google link — it is the default destination when no specific platform is configured.",
    localizationBody:
      "Timezone affects when scheduled requests are sent and how times are displayed. Default language sets the language of customer-facing emails and pages for new requests.",
    whitelabelBody:
      "On the Agency plan you can serve feedback pages from your own custom domain and remove Echorank branding. These options are disabled on other plans.",
    gotIt: "Got it",
  },
};
export type SettingsCopy = typeof settingsEn;

export const SETTINGS_COPY: Record<DashLocale, SettingsCopy> = {
  en: settingsEn,
  fr: {
    title: "Paramètres",
    subtitle: "Gérez les paramètres de votre entreprise et la configuration de votre marque.",
    helpButton: "Aide",
    loadFailed: "Échec du chargement des paramètres",
    genericError: "Une erreur s'est produite",
    errorTitle: "Échec du chargement des paramètres",
    retry: "Réessayer",
    saveFailed: "Échec de l'enregistrement des paramètres. Veuillez réessayer.",
    savedSuccess: "Paramètres enregistrés avec succès!",
    saveButton: "Enregistrer les paramètres",
    businessInfoTitle: "Renseignements sur l'entreprise",
    businessNameLabel: "Nom de l'entreprise",
    businessNamePlaceholder: "Nom de votre entreprise",
    logoUrlLabel: "URL du logo",
    supportEmailLabel: "Courriel de soutien",
    brandColorsTitle: "Couleurs de la marque",
    primaryColorLabel: "Couleur principale",
    secondaryColorLabel: "Couleur secondaire",
    reviewLinksTitle: "Liens des plateformes d'avis",
    googleLinkLabel: "Lien d'avis Google",
    facebookLinkLabel: "Lien d'avis Facebook",
    trustpilotLinkLabel: "Lien Trustpilot",
    localizationTitle: "Localisation",
    timezoneLabel: "Fuseau horaire",
    languageLabel: "Langue par défaut",
    timezones: {
      "America/New_York": "Heure de l'Est (HE)",
      "America/Chicago": "Heure du Centre (HC)",
      "America/Denver": "Heure des Rocheuses (HR)",
      "America/Los_Angeles": "Heure du Pacifique (HP)",
      "America/Anchorage": "Heure de l'Alaska (HAK)",
      "Pacific/Honolulu": "Heure d'Hawaï (HH)",
      "Europe/London": "Londres (GMT)",
      "Europe/Paris": "Paris (CET)",
      "Europe/Berlin": "Berlin (CET)",
      "Asia/Tokyo": "Tokyo (JST)",
      "Asia/Shanghai": "Shanghai (CST)",
      "Australia/Sydney": "Sydney (AEST)",
      UTC: "UTC",
    } as Record<string, string>,
    languages: {
      en: "Anglais",
      es: "Espagnol",
      fr: "Français",
      de: "Allemand",
      pt: "Portugais",
      it: "Italien",
      nl: "Néerlandais",
      ja: "Japonais",
      zh: "Chinois",
    } as Record<string, string>,
    whitelabelTitle: "Marque blanche",
    agencyRequired: "Forfait Agency requis",
    customDomainLabel: "Domaine personnalisé",
    whitelabelCheckbox:
      "Activer la marque blanche (retire l'image de marque Echorank)",
    helpModal: {
      title: "Aide sur les paramètres",
      businessBody:
        "Le nom de votre entreprise, votre logo et votre courriel de soutien apparaissent sur les pages de rétroaction que voient vos clients et sur les courriels sortants. Utilisez une URL d'image hébergée publiquement pour le logo (PNG ou SVG de préférence).",
      brandBody:
        "La couleur principale est utilisée pour les boutons et les accents sur les pages de rétroaction de vos clients. Saisissez une valeur hexadécimale (par exemple #2563eb) ou choisissez-en une avec le sélecteur de couleur.",
      reviewBody:
        "C'est là que les clients satisfaits sont dirigés pour laisser un avis public. Pour Google, utilisez votre lien «Rédiger un avis» (https://g.page/r/…/review ou une URL d'avis avec identifiant de lieu). Configurez au moins le lien Google — c'est la destination par défaut lorsqu'aucune plateforme précise n'est configurée.",
      localizationBody:
        "Le fuseau horaire détermine le moment de l'envoi des demandes planifiées et l'affichage des heures. La langue par défaut définit la langue des courriels et des pages destinés aux clients pour les nouvelles demandes.",
      whitelabelBody:
        "Avec le forfait Agency, vous pouvez servir les pages de rétroaction depuis votre propre domaine personnalisé et retirer l'image de marque Echorank. Ces options sont désactivées avec les autres forfaits.",
      gotIt: "Compris",
    },
  },
  "de-CH": {
    title: "Einstellungen",
    subtitle: "Verwalten Sie Ihre Unternehmenseinstellungen und Ihre Markenkonfiguration.",
    helpButton: "Hilfe",
    loadFailed: "Einstellungen konnten nicht geladen werden",
    genericError: "Etwas ist schiefgelaufen",
    errorTitle: "Einstellungen konnten nicht geladen werden",
    retry: "Erneut versuchen",
    saveFailed: "Einstellungen konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.",
    savedSuccess: "Einstellungen erfolgreich gespeichert!",
    saveButton: "Einstellungen speichern",
    businessInfoTitle: "Unternehmensinformationen",
    businessNameLabel: "Firmenname",
    businessNamePlaceholder: "Name Ihres Unternehmens",
    logoUrlLabel: "Logo-URL",
    supportEmailLabel: "Support-E-Mail",
    brandColorsTitle: "Markenfarben",
    primaryColorLabel: "Primärfarbe",
    secondaryColorLabel: "Sekundärfarbe",
    reviewLinksTitle: "Links zu Bewertungsplattformen",
    googleLinkLabel: "Google-Bewertungslink",
    facebookLinkLabel: "Facebook-Bewertungslink",
    trustpilotLinkLabel: "Trustpilot-Link",
    localizationTitle: "Lokalisierung",
    timezoneLabel: "Zeitzone",
    languageLabel: "Standardsprache",
    timezones: {
      "America/New_York": "Ostküstenzeit (ET)",
      "America/Chicago": "Zentralzeit (CT)",
      "America/Denver": "Rocky-Mountain-Zeit (MT)",
      "America/Los_Angeles": "Pazifikzeit (PT)",
      "America/Anchorage": "Alaska-Zeit (AKT)",
      "Pacific/Honolulu": "Hawaii-Zeit (HT)",
      "Europe/London": "London (GMT)",
      "Europe/Paris": "Paris (MEZ)",
      "Europe/Berlin": "Berlin (MEZ)",
      "Asia/Tokyo": "Tokio (JST)",
      "Asia/Shanghai": "Shanghai (CST)",
      "Australia/Sydney": "Sydney (AEST)",
      UTC: "UTC",
    } as Record<string, string>,
    languages: {
      en: "Englisch",
      es: "Spanisch",
      fr: "Französisch",
      de: "Deutsch",
      pt: "Portugiesisch",
      it: "Italienisch",
      nl: "Niederländisch",
      ja: "Japanisch",
      zh: "Chinesisch",
    } as Record<string, string>,
    whitelabelTitle: "White-Label",
    agencyRequired: "Agency-Plan erforderlich",
    customDomainLabel: "Eigene Domain",
    whitelabelCheckbox:
      "White-Label-Branding aktivieren (entfernt das Echorank-Branding)",
    helpModal: {
      title: "Hilfe zu den Einstellungen",
      businessBody:
        "Ihr Firmenname, Ihr Logo und Ihre Support-E-Mail erscheinen auf den Feedback-Seiten, die Ihre Kunden sehen, sowie in ausgehenden E-Mails. Verwenden Sie für das Logo eine öffentlich gehostete Bild-URL (PNG oder SVG funktioniert am besten).",
      brandBody:
        "Die Primärfarbe wird für Schaltflächen und Akzente auf Ihren Kunden-Feedback-Seiten verwendet. Geben Sie einen Hex-Wert ein (zum Beispiel #2563eb) oder wählen Sie eine Farbe mit dem Farbfeld.",
      reviewBody:
        "Hierhin werden zufriedene Kunden geleitet, um eine öffentliche Bewertung zu hinterlassen. Verwenden Sie für Google Ihren «Rezension schreiben»-Link (https://g.page/r/…/review oder eine Bewertungs-URL mit Place ID). Hinterlegen Sie mindestens den Google-Link — er ist das Standardziel, wenn keine bestimmte Plattform konfiguriert ist.",
      localizationBody:
        "Die Zeitzone beeinflusst, wann geplante Anfragen gesendet werden und wie Zeiten angezeigt werden. Die Standardsprache legt die Sprache der kundenseitigen E-Mails und Seiten für neue Anfragen fest.",
      whitelabelBody:
        "Mit dem Agency-Plan können Sie Feedback-Seiten über Ihre eigene Domain bereitstellen und das Echorank-Branding entfernen. Bei anderen Plänen sind diese Optionen deaktiviert.",
      gotIt: "Verstanden",
    },
  },
};

// ─── /team ──────────────────────────────────────────────────────────────────
const teamEn = {
  title: "Team",
  subtitle: "Manage your team members and their roles.",
  inviteMember: "Invite Member",
  // Errors / alerts
  loadFailed: "Failed to load team members",
  somethingWrong: "Something went wrong",
  retry: "Retry",
  unknown: "Unknown",
  inviteFailed: "Failed to send invite",
  inviteFailedRetry: "Failed to send invite. Please try again.",
  updateRoleFailed: "Failed to update role",
  updateRoleFailedRetry: "Failed to update role. Please try again.",
  cannotRemoveOwner: "Cannot remove the account owner.",
  removeConfirm: (name: string) =>
    `Are you sure you want to remove ${name} from the team?`,
  removeFailed: "Failed to remove member",
  removeFailedAlert: "Failed to remove team member.",
  // Empty state
  emptyTitle: "No team members",
  emptyDescription: "Invite team members to help manage your reputation.",
  // Table
  colMember: "Member",
  colRole: "Role",
  colJoined: "Joined",
  roleLabels: {
    OWNER: "Owner",
    ADMIN: "Admin",
    MEMBER: "Member",
  } as Record<string, string>,
  changeRoleTooltip: "Change role",
  removeMemberTooltip: "Remove member",
  // Invite modal
  inviteModalTitle: "Invite Team Member",
  emailLabel: "Email Address",
  roleLabel: "Role",
  rolePermsHeading: "Role permissions:",
  memberPerms: "View data, manage customers, respond to feedback",
  adminPerms: "All member permissions + manage team, settings, and billing",
  cancel: "Cancel",
  sendInvite: "Send Invite",
  // Change role modal
  changeRoleTitle: "Change Role",
  memberLabel: "Member",
  newRoleLabel: "New Role",
  updateRole: "Update Role",
};
export type TeamCopy = typeof teamEn;

export const TEAM_COPY: Record<DashLocale, TeamCopy> = {
  en: teamEn,
  fr: {
    title: "Équipe",
    subtitle: "Gérez les membres de votre équipe et leurs rôles.",
    inviteMember: "Inviter un membre",
    // Errors / alerts
    loadFailed: "Échec du chargement des membres de l'équipe",
    somethingWrong: "Une erreur est survenue",
    retry: "Réessayer",
    unknown: "Inconnu",
    inviteFailed: "Échec de l'envoi de l'invitation",
    inviteFailedRetry: "Échec de l'envoi de l'invitation. Veuillez réessayer.",
    updateRoleFailed: "Échec de la mise à jour du rôle",
    updateRoleFailedRetry: "Échec de la mise à jour du rôle. Veuillez réessayer.",
    cannotRemoveOwner: "Impossible de retirer le propriétaire du compte.",
    removeConfirm: (name: string) =>
      `Voulez-vous vraiment retirer ${name} de l'équipe?`,
    removeFailed: "Échec du retrait du membre",
    removeFailedAlert: "Échec du retrait du membre de l'équipe.",
    // Empty state
    emptyTitle: "Aucun membre dans l'équipe",
    emptyDescription:
      "Invitez des membres d'équipe pour vous aider à gérer votre réputation.",
    // Table
    colMember: "Membre",
    colRole: "Rôle",
    colJoined: "Date d'adhésion",
    roleLabels: {
      OWNER: "Propriétaire",
      ADMIN: "Administrateur",
      MEMBER: "Membre",
    } as Record<string, string>,
    changeRoleTooltip: "Changer le rôle",
    removeMemberTooltip: "Retirer le membre",
    // Invite modal
    inviteModalTitle: "Inviter un membre de l'équipe",
    emailLabel: "Adresse courriel",
    roleLabel: "Rôle",
    rolePermsHeading: "Permissions des rôles :",
    memberPerms: "Consulter les données, gérer les clients, répondre à la rétroaction",
    adminPerms:
      "Toutes les permissions des membres + gestion de l'équipe, des paramètres et de la facturation",
    cancel: "Annuler",
    sendInvite: "Envoyer l'invitation",
    // Change role modal
    changeRoleTitle: "Changer le rôle",
    memberLabel: "Membre",
    newRoleLabel: "Nouveau rôle",
    updateRole: "Mettre à jour le rôle",
  },
  "de-CH": {
    title: "Team",
    subtitle: "Verwalten Sie Ihre Teammitglieder und deren Rollen.",
    inviteMember: "Mitglied einladen",
    // Errors / alerts
    loadFailed: "Teammitglieder konnten nicht geladen werden",
    somethingWrong: "Etwas ist schiefgelaufen",
    retry: "Erneut versuchen",
    unknown: "Unbekannt",
    inviteFailed: "Einladung konnte nicht gesendet werden",
    inviteFailedRetry:
      "Einladung konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
    updateRoleFailed: "Rolle konnte nicht aktualisiert werden",
    updateRoleFailedRetry:
      "Rolle konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.",
    cannotRemoveOwner: "Der Kontoinhaber kann nicht entfernt werden.",
    removeConfirm: (name: string) =>
      `Möchten Sie ${name} wirklich aus dem Team entfernen?`,
    removeFailed: "Mitglied konnte nicht entfernt werden",
    removeFailedAlert: "Teammitglied konnte nicht entfernt werden.",
    // Empty state
    emptyTitle: "Keine Teammitglieder",
    emptyDescription:
      "Laden Sie Teammitglieder ein, um Ihre Reputation gemeinsam zu verwalten.",
    // Table
    colMember: "Mitglied",
    colRole: "Rolle",
    colJoined: "Beigetreten",
    roleLabels: {
      OWNER: "Inhaber",
      ADMIN: "Administrator",
      MEMBER: "Mitglied",
    } as Record<string, string>,
    changeRoleTooltip: "Rolle ändern",
    removeMemberTooltip: "Mitglied entfernen",
    // Invite modal
    inviteModalTitle: "Teammitglied einladen",
    emailLabel: "E-Mail-Adresse",
    roleLabel: "Rolle",
    rolePermsHeading: "Rollenberechtigungen:",
    memberPerms: "Daten einsehen, Kunden verwalten, auf Feedback antworten",
    adminPerms:
      "Alle Mitgliederberechtigungen + Verwaltung von Team, Einstellungen und Abrechnung",
    cancel: "Abbrechen",
    sendInvite: "Einladung senden",
    // Change role modal
    changeRoleTitle: "Rolle ändern",
    memberLabel: "Mitglied",
    newRoleLabel: "Neue Rolle",
    updateRole: "Rolle aktualisieren",
  },
};

// ─── /templates ─────────────────────────────────────────────────────────────
const templatesEn = {
  title: "Templates",
  subtitle: "Manage your email and SMS templates for feedback and review requests.",
  helpButton: "Help",
  createTemplate: "Create Template",
  loadFailed: "Failed to load templates",
  genericError: "Something went wrong",
  errorTitle: "Failed to load templates",
  retry: "Retry",
  tabEmail: "Email Templates",
  tabSms: "SMS Templates",
  emptyTitle: (channel: string): string =>
    channel === "SMS" ? "No sms templates" : "No email templates",
  emptyDescription:
    "Customize the emails and texts your customers receive when you request feedback.",
  typeLabels: {
    feedback_request: "Feedback Request",
    review_request: "Review Request",
    recovery: "Recovery",
  } as Record<string, string>,
  channelLabels: {
    EMAIL: "Email",
    SMS: "SMS",
  } as Record<string, string>,
  subjectLine: (subject: string) => `Subject: ${subject}`,
  lastModified: (date: string) => `Last modified: ${date}`,
  modalEditTitle: "Edit Template",
  modalCreateTitle: "Create Template",
  nameLabel: "Template Name",
  namePlaceholder: "e.g. Post-Purchase Feedback",
  typeLabel: "Type",
  channelLabel: "Channel",
  subjectLabel: "Subject",
  subjectPlaceholder: "We'd love your feedback, {{customer_name}}!",
  bodyLabel: "Body",
  bodyPlaceholder: "Hi {{customer_name}}, thank you for choosing {{business_name}}...",
  placeholdersTitle: "Available placeholders:",
  cancel: "Cancel",
  saveChanges: "Save Changes",
  saveFailed: "Failed to save template. Please try again.",
  deleteConfirm: "Are you sure you want to delete this template?",
  deleteFailed: "Failed to delete template. Please try again.",
  help: {
    title: "How templates work",
    intro:
      "Templates are reusable messages sent to your customers through campaigns. Your account includes ready-made defaults covering the full review journey — edit them freely or create your own.",
    includedTitle: "Your included templates",
    sent: (when: string) => `Sent: ${when}`,
    templates: [
      {
        name: "Private Pulse Check",
        channel: "EMAIL",
        typeKey: "feedback_request",
        when: "~24h after the visit",
        what: "A quiet check-in asking how things went. Catches problems early so you can fix them before asking for a public review.",
      },
      {
        name: "Initial Review Request",
        channel: "EMAIL",
        typeKey: "review_request",
        when: "~72h after the visit",
        what: "The main ask. Invites the customer to leave a Google review, with the private feedback link offered as a secondary option.",
      },
      {
        name: "Friendly Reminder",
        channel: "EMAIL",
        typeKey: "review_request",
        when: "5 days later, only if no click",
        what: "A single, gentle nudge. It tells the customer it is the only reminder they will receive — and it is.",
      },
      {
        name: "Thank You - Review Received",
        channel: "EMAIL",
        typeKey: "review_request",
        when: "After a review is detected",
        what: "Closes the loop with genuine thanks. Small touch, big retention effect.",
      },
      {
        name: "Service Recovery Follow-Up",
        channel: "EMAIL",
        typeKey: "recovery",
        when: "After you resolve a reported issue",
        what: "Confirms the fix, invites a reply if anything is still wrong, and mentions — without pressure — that a public review is welcome.",
      },
      {
        name: "Initial Review Request (SMS)",
        channel: "SMS",
        typeKey: "review_request",
        when: "~72h after the visit",
        what: "Short-form version of the main ask. One line, one link, STOP opt-out.",
      },
      {
        name: "Reminder (SMS)",
        channel: "SMS",
        typeKey: "review_request",
        when: "5 days later, only if no click",
        what: "One-time nudge, clearly labelled as the only reminder.",
      },
      {
        name: "Thank You (SMS)",
        channel: "SMS",
        typeKey: "review_request",
        when: "After a review is detected",
        what: "Two-sentence thank-you to the customer.",
      },
    ] as Array<{
      name: string;
      channel: "EMAIL" | "SMS";
      typeKey: string;
      when: string;
      what: string;
    }>,
    variablesTitle: "Variables",
    variablesIntro:
      "Variables are replaced with real values when each message is sent. Type them anywhere in a subject or body:",
    colVariable: "Variable",
    colBecomes: "What it becomes",
    colExample: "Example",
    placeholders: [
      { tag: "{{customer_name}}", desc: "Customer's first name", example: "Marie" },
      { tag: "{{business_name}}", desc: "Your business name", example: "ABC Dental" },
      {
        tag: "{{location_name}}",
        desc: "Location the customer visited",
        example: "ABC Dental - Downtown",
      },
      {
        tag: "{{review_link}}",
        desc: "Public Google review link (same link for every customer)",
        example: "g.page/r/...",
      },
      {
        tag: "{{feedback_link}}",
        desc: "Private feedback form, goes only to your team",
        example: "echorank360.com/f/...",
      },
      {
        tag: "{{unsubscribe_link}}",
        desc: "Required opt-out link in every email",
        example: "echorank360.com/u/...",
      },
    ] as Array<{ tag: string; desc: string; example: string }>,
    bestPracticesTitle: "Best practices",
    bestPractices: [
      "Give every customer the same public review link — never filter who gets asked based on how happy they seem.",
      "Offer the private feedback link as an extra option, not a replacement.",
      "Send one reminder at most, and say so in the message.",
      "Never offer incentives in exchange for reviews.",
      "SMS: stay under ~160 characters before the link and always include “Reply STOP to opt out”.",
    ] as string[],
  },
};
export type TemplatesCopy = typeof templatesEn;

export const TEMPLATES_COPY: Record<DashLocale, TemplatesCopy> = {
  en: templatesEn,
  fr: {
    title: "Modèles",
    subtitle:
      "Gérez vos modèles de courriel et de SMS pour les demandes de rétroaction et d'avis.",
    helpButton: "Aide",
    createTemplate: "Créer un modèle",
    loadFailed: "Échec du chargement des modèles",
    genericError: "Une erreur s'est produite",
    errorTitle: "Échec du chargement des modèles",
    retry: "Réessayer",
    tabEmail: "Modèles courriel",
    tabSms: "Modèles SMS",
    emptyTitle: (channel: string) =>
      channel === "SMS" ? "Aucun modèle SMS" : "Aucun modèle courriel",
    emptyDescription:
      "Personnalisez les courriels et les textos que vos clients reçoivent lorsque vous demandez une rétroaction.",
    typeLabels: {
      feedback_request: "Demande de rétroaction",
      review_request: "Demande d'avis",
      recovery: "Récupération",
    } as Record<string, string>,
    channelLabels: {
      EMAIL: "Courriel",
      SMS: "SMS",
    } as Record<string, string>,
    subjectLine: (subject: string) => `Objet : ${subject}`,
    lastModified: (date: string) => `Dernière modification : ${date}`,
    modalEditTitle: "Modifier le modèle",
    modalCreateTitle: "Créer un modèle",
    nameLabel: "Nom du modèle",
    namePlaceholder: "p. ex. Rétroaction après achat",
    typeLabel: "Type",
    channelLabel: "Canal",
    subjectLabel: "Objet",
    subjectPlaceholder: "Nous aimerions avoir votre rétroaction, {{customer_name}}!",
    bodyLabel: "Corps du message",
    bodyPlaceholder: "Bonjour {{customer_name}}, merci d'avoir choisi {{business_name}}...",
    placeholdersTitle: "Variables disponibles :",
    cancel: "Annuler",
    saveChanges: "Enregistrer les modifications",
    saveFailed: "Échec de l'enregistrement du modèle. Veuillez réessayer.",
    deleteConfirm: "Voulez-vous vraiment supprimer ce modèle?",
    deleteFailed: "Échec de la suppression du modèle. Veuillez réessayer.",
    help: {
      title: "Comment fonctionnent les modèles",
      intro:
        "Les modèles sont des messages réutilisables envoyés à vos clients par l'entremise des campagnes. Votre compte comprend des modèles par défaut prêts à l'emploi qui couvrent tout le parcours d'avis — modifiez-les librement ou créez les vôtres.",
      includedTitle: "Vos modèles inclus",
      sent: (when: string) => `Envoi : ${when}`,
      templates: [
        {
          name: "Prise de pouls privée",
          channel: "EMAIL",
          typeKey: "feedback_request",
          when: "~24 h après la visite",
          what: "Un suivi discret pour savoir comment ça s'est passé. Détecte les problèmes tôt afin que vous puissiez les corriger avant de demander un avis public.",
        },
        {
          name: "Demande d'avis initiale",
          channel: "EMAIL",
          typeKey: "review_request",
          when: "~72 h après la visite",
          what: "La demande principale. Invite le client à laisser un avis Google, avec le lien de rétroaction privé offert comme option secondaire.",
        },
        {
          name: "Rappel amical",
          channel: "EMAIL",
          typeKey: "review_request",
          when: "5 jours plus tard, seulement s'il n'y a pas eu de clic",
          what: "Un seul rappel, tout en douceur. Il indique au client que c'est le seul rappel qu'il recevra — et c'est le cas.",
        },
        {
          name: "Merci - Avis reçu",
          channel: "EMAIL",
          typeKey: "review_request",
          when: "Après la détection d'un avis",
          what: "Boucle la boucle avec des remerciements sincères. Petit geste, grand effet sur la fidélisation.",
        },
        {
          name: "Suivi de récupération de service",
          channel: "EMAIL",
          typeKey: "recovery",
          when: "Après la résolution d'un problème signalé",
          what: "Confirme la correction, invite à répondre si quelque chose ne va toujours pas et mentionne — sans pression — qu'un avis public est bienvenu.",
        },
        {
          name: "Demande d'avis initiale (SMS)",
          channel: "SMS",
          typeKey: "review_request",
          when: "~72 h après la visite",
          what: "Version courte de la demande principale. Une ligne, un lien, désinscription par STOP.",
        },
        {
          name: "Rappel (SMS)",
          channel: "SMS",
          typeKey: "review_request",
          when: "5 jours plus tard, seulement s'il n'y a pas eu de clic",
          what: "Rappel unique, clairement présenté comme le seul rappel.",
        },
        {
          name: "Merci (SMS)",
          channel: "SMS",
          typeKey: "review_request",
          when: "Après la détection d'un avis",
          what: "Un merci en deux phrases adressé au client.",
        },
      ] as Array<{
        name: string;
        channel: "EMAIL" | "SMS";
        typeKey: string;
        when: string;
        what: string;
      }>,
      variablesTitle: "Variables",
      variablesIntro:
        "Les variables sont remplacées par des valeurs réelles au moment de l'envoi de chaque message. Saisissez-les n'importe où dans un objet ou un corps de message :",
      colVariable: "Variable",
      colBecomes: "Ce qu'elle devient",
      colExample: "Exemple",
      placeholders: [
        { tag: "{{customer_name}}", desc: "Prénom du client", example: "Marie" },
        { tag: "{{business_name}}", desc: "Le nom de votre entreprise", example: "ABC Dental" },
        {
          tag: "{{location_name}}",
          desc: "L'emplacement visité par le client",
          example: "ABC Dental - Centre-ville",
        },
        {
          tag: "{{review_link}}",
          desc: "Lien public d'avis Google (le même lien pour chaque client)",
          example: "g.page/r/...",
        },
        {
          tag: "{{feedback_link}}",
          desc: "Formulaire de rétroaction privé, transmis uniquement à votre équipe",
          example: "echorank360.com/f/...",
        },
        {
          tag: "{{unsubscribe_link}}",
          desc: "Lien de désabonnement obligatoire dans chaque courriel",
          example: "echorank360.com/u/...",
        },
      ] as Array<{ tag: string; desc: string; example: string }>,
      bestPracticesTitle: "Bonnes pratiques",
      bestPractices: [
        "Donnez à chaque client le même lien d'avis public — ne filtrez jamais qui reçoit la demande selon son niveau de satisfaction apparent.",
        "Offrez le lien de rétroaction privé comme option supplémentaire, pas comme remplacement.",
        "Envoyez au plus un rappel, et dites-le dans le message.",
        "N'offrez jamais d'incitatifs en échange d'avis.",
        "SMS : restez sous ~160 caractères avant le lien et incluez toujours «Répondez STOP pour vous désabonner».",
      ] as string[],
    },
  },
  "de-CH": {
    title: "Vorlagen",
    subtitle:
      "Verwalten Sie Ihre E-Mail- und SMS-Vorlagen für Feedback- und Bewertungsanfragen.",
    helpButton: "Hilfe",
    createTemplate: "Vorlage erstellen",
    loadFailed: "Vorlagen konnten nicht geladen werden",
    genericError: "Etwas ist schiefgelaufen",
    errorTitle: "Vorlagen konnten nicht geladen werden",
    retry: "Erneut versuchen",
    tabEmail: "E-Mail-Vorlagen",
    tabSms: "SMS-Vorlagen",
    emptyTitle: (channel: string) =>
      channel === "SMS" ? "Keine SMS-Vorlagen" : "Keine E-Mail-Vorlagen",
    emptyDescription:
      "Passen Sie die E-Mails und SMS an, die Ihre Kunden erhalten, wenn Sie um Feedback bitten.",
    typeLabels: {
      feedback_request: "Feedback-Anfrage",
      review_request: "Bewertungsanfrage",
      recovery: "Rückgewinnung",
    } as Record<string, string>,
    channelLabels: {
      EMAIL: "E-Mail",
      SMS: "SMS",
    } as Record<string, string>,
    subjectLine: (subject: string) => `Betreff: ${subject}`,
    lastModified: (date: string) => `Zuletzt geändert: ${date}`,
    modalEditTitle: "Vorlage bearbeiten",
    modalCreateTitle: "Vorlage erstellen",
    nameLabel: "Vorlagenname",
    namePlaceholder: "z. B. Feedback nach dem Kauf",
    typeLabel: "Typ",
    channelLabel: "Kanal",
    subjectLabel: "Betreff",
    subjectPlaceholder: "Wir würden uns über Ihr Feedback freuen, {{customer_name}}!",
    bodyLabel: "Nachrichtentext",
    bodyPlaceholder:
      "Hallo {{customer_name}}, vielen Dank, dass Sie sich für {{business_name}} entschieden haben...",
    placeholdersTitle: "Verfügbare Variablen:",
    cancel: "Abbrechen",
    saveChanges: "Änderungen speichern",
    saveFailed: "Vorlage konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
    deleteConfirm: "Möchten Sie diese Vorlage wirklich löschen?",
    deleteFailed: "Vorlage konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.",
    help: {
      title: "So funktionieren Vorlagen",
      intro:
        "Vorlagen sind wiederverwendbare Nachrichten, die über Kampagnen an Ihre Kunden gesendet werden. Ihr Konto enthält fertige Standardvorlagen, die den gesamten Bewertungsprozess abdecken — bearbeiten Sie sie frei oder erstellen Sie eigene.",
      includedTitle: "Ihre enthaltenen Vorlagen",
      sent: (when: string) => `Versand: ${when}`,
      templates: [
        {
          name: "Privater Puls-Check",
          channel: "EMAIL",
          typeKey: "feedback_request",
          when: "~24 Std. nach dem Besuch",
          what: "Eine diskrete Nachfrage, wie es gelaufen ist. Erkennt Probleme früh, damit Sie sie beheben können, bevor Sie um eine öffentliche Bewertung bitten.",
        },
        {
          name: "Erste Bewertungsanfrage",
          channel: "EMAIL",
          typeKey: "review_request",
          when: "~72 Std. nach dem Besuch",
          what: "Die Hauptanfrage. Lädt den Kunden ein, eine Google-Bewertung zu hinterlassen, mit dem privaten Feedback-Link als sekundärer Option.",
        },
        {
          name: "Freundliche Erinnerung",
          channel: "EMAIL",
          typeKey: "review_request",
          when: "5 Tage später, nur wenn kein Klick erfolgt ist",
          what: "Ein einziger, sanfter Anstoss. Er teilt dem Kunden mit, dass dies die einzige Erinnerung ist, die er erhält — und das stimmt.",
        },
        {
          name: "Danke - Bewertung erhalten",
          channel: "EMAIL",
          typeKey: "review_request",
          when: "Nachdem eine Bewertung erkannt wurde",
          what: "Schliesst den Kreis mit einem aufrichtigen Dankeschön. Kleine Geste, grosse Wirkung auf die Kundenbindung.",
        },
        {
          name: "Nachfassen zur Service-Rückgewinnung",
          channel: "EMAIL",
          typeKey: "recovery",
          when: "Nachdem Sie ein gemeldetes Problem gelöst haben",
          what: "Bestätigt die Behebung, lädt zu einer Antwort ein, falls noch etwas nicht stimmt, und erwähnt — ohne Druck —, dass eine öffentliche Bewertung willkommen ist.",
        },
        {
          name: "Erste Bewertungsanfrage (SMS)",
          channel: "SMS",
          typeKey: "review_request",
          when: "~72 Std. nach dem Besuch",
          what: "Kurzversion der Hauptanfrage. Eine Zeile, ein Link, Abmeldung per STOP.",
        },
        {
          name: "Erinnerung (SMS)",
          channel: "SMS",
          typeKey: "review_request",
          when: "5 Tage später, nur wenn kein Klick erfolgt ist",
          what: "Einmaliger Anstoss, klar als einzige Erinnerung gekennzeichnet.",
        },
        {
          name: "Danke (SMS)",
          channel: "SMS",
          typeKey: "review_request",
          when: "Nachdem eine Bewertung erkannt wurde",
          what: "Ein Dankeschön in zwei Sätzen an den Kunden.",
        },
      ] as Array<{
        name: string;
        channel: "EMAIL" | "SMS";
        typeKey: string;
        when: string;
        what: string;
      }>,
      variablesTitle: "Variablen",
      variablesIntro:
        "Variablen werden beim Versand jeder Nachricht durch echte Werte ersetzt. Geben Sie sie an beliebiger Stelle in Betreff oder Text ein:",
      colVariable: "Variable",
      colBecomes: "Wozu sie wird",
      colExample: "Beispiel",
      placeholders: [
        { tag: "{{customer_name}}", desc: "Vorname des Kunden", example: "Marie" },
        { tag: "{{business_name}}", desc: "Name Ihres Unternehmens", example: "ABC Dental" },
        {
          tag: "{{location_name}}",
          desc: "Der vom Kunden besuchte Standort",
          example: "ABC Dental - Innenstadt",
        },
        {
          tag: "{{review_link}}",
          desc: "Öffentlicher Google-Bewertungslink (derselbe Link für jeden Kunden)",
          example: "g.page/r/...",
        },
        {
          tag: "{{feedback_link}}",
          desc: "Privates Feedback-Formular, geht nur an Ihr Team",
          example: "echorank360.com/f/...",
        },
        {
          tag: "{{unsubscribe_link}}",
          desc: "Obligatorischer Abmeldelink in jeder E-Mail",
          example: "echorank360.com/u/...",
        },
      ] as Array<{ tag: string; desc: string; example: string }>,
      bestPracticesTitle: "Bewährte Praktiken",
      bestPractices: [
        "Geben Sie jedem Kunden denselben öffentlichen Bewertungslink — filtern Sie nie danach, wer gefragt wird, je nachdem, wie zufrieden jemand wirkt.",
        "Bieten Sie den privaten Feedback-Link als zusätzliche Option an, nicht als Ersatz.",
        "Senden Sie höchstens eine Erinnerung, und sagen Sie das in der Nachricht.",
        "Bieten Sie nie Anreize im Austausch für Bewertungen an.",
        "SMS: Bleiben Sie unter ~160 Zeichen vor dem Link und fügen Sie immer «Antworten Sie STOP, um sich abzumelden» hinzu.",
      ] as string[],
    },
  },
};

// ─── visibility cards: MonitorCard ──────────────────────────────────────────
const monitorCardEn = {
  title: "Scheduled monitoring",
  lockedDescription:
    "Weekly re-audits with instant alerts when your score drops or an AI crawler gets blocked. Part of the Growth plan and up.",
  upgrade: "Upgrade",
  empty:
    "No sites monitored yet. Run an audit, then add the site here — Echorank will re-audit it on schedule and email you if the score drops or a crawler gets blocked.",
  lastScore: (score: number, grade: string) => `last score ${score} (${grade})`,
  nextRun: (date: string) => `next run ${date}`,
  sparklineHint: "history builds after 2 runs",
  weekly: "Weekly",
  daily: "Daily (Agency)",
  pause: "Pause",
  resume: "Resume",
  deleteMonitor: "Delete monitor",
  monitorPromptBefore: "Monitor ",
  monitorPromptAfter: "",
  saving: "Saving…",
  startMonitoring: "Start monitoring",
  requestFailed: (status: number) => `Request failed (${status})`,
  loadFailed: "Could not load monitors",
  saveFailed: "Could not save monitor",
  updateFailed: "Update failed",
  dailyRequiresAgency: "Daily cadence requires the Agency plan.",
};
export type MonitorCardCopy = typeof monitorCardEn;

export const MONITOR_CARD_COPY: Record<DashLocale, MonitorCardCopy> = {
  en: monitorCardEn,
  fr: {
    title: "Surveillance planifiée",
    lockedDescription:
      "Réaudits hebdomadaires avec alertes instantanées lorsque votre score baisse ou qu'un robot d'IA est bloqué. Inclus dans le forfait Growth et les forfaits supérieurs.",
    upgrade: "Passer au forfait supérieur",
    empty:
      "Aucun site surveillé pour l'instant. Lancez un audit, puis ajoutez le site ici — Echorank le réauditera selon l'horaire et vous enverra un courriel si le score baisse ou si un robot d'exploration est bloqué.",
    lastScore: (score: number, grade: string) => `dernier score ${score} (${grade})`,
    nextRun: (date: string) => `prochaine exécution ${date}`,
    sparklineHint: "l'historique apparaît après 2 exécutions",
    weekly: "Hebdomadaire",
    daily: "Quotidien (Agency)",
    pause: "Suspendre",
    resume: "Reprendre",
    deleteMonitor: "Supprimer la surveillance",
    monitorPromptBefore: "Surveiller ",
    monitorPromptAfter: "",
    saving: "Enregistrement…",
    startMonitoring: "Démarrer la surveillance",
    requestFailed: (status: number) => `Échec de la requête (${status})`,
    loadFailed: "Impossible de charger les surveillances",
    saveFailed: "Impossible d'enregistrer la surveillance",
    updateFailed: "Échec de la mise à jour",
    dailyRequiresAgency: "La cadence quotidienne nécessite le forfait Agency.",
  },
  "de-CH": {
    title: "Geplante Überwachung",
    lockedDescription:
      "Wöchentliche erneute Audits mit sofortigen Benachrichtigungen, wenn Ihr Score sinkt oder ein KI-Crawler blockiert wird. Teil des Growth-Plans und höher.",
    upgrade: "Upgrade durchführen",
    empty:
      "Noch keine überwachten Websites. Führen Sie ein Audit durch und fügen Sie die Website hier hinzu — Echorank auditiert sie nach Zeitplan erneut und benachrichtigt Sie per E-Mail, wenn der Score sinkt oder ein Crawler blockiert wird.",
    lastScore: (score: number, grade: string) => `letzter Score ${score} (${grade})`,
    nextRun: (date: string) => `nächster Lauf ${date}`,
    sparklineHint: "Verlauf erscheint nach 2 Läufen",
    weekly: "Wöchentlich",
    daily: "Täglich (Agency)",
    pause: "Pausieren",
    resume: "Fortsetzen",
    deleteMonitor: "Überwachung löschen",
    monitorPromptBefore: "",
    monitorPromptAfter: " überwachen",
    saving: "Wird gespeichert…",
    startMonitoring: "Überwachung starten",
    requestFailed: (status: number) => `Anfrage fehlgeschlagen (${status})`,
    loadFailed: "Überwachungen konnten nicht geladen werden",
    saveFailed: "Überwachung konnte nicht gespeichert werden",
    updateFailed: "Aktualisierung fehlgeschlagen",
    dailyRequiresAgency: "Tägliche Ausführung erfordert den Agency-Plan.",
  },
};

// ─── visibility cards: BenchmarkCard ────────────────────────────────────────
const benchmarkCardEn = {
  title: "Competitor benchmark",
  lockedDescription:
    "See how your AI visibility stacks up against competitors, side by side. Part of the Growth plan and up.",
  upgrade: "Upgrade",
  competitorsToday: (used: number, limit: number) =>
    `${used} / ${limit} competitor${limit === 1 ? "" : "s"} today`,
  colSite: "Site",
  colScore: "Score",
  colBlocked: "Crawlers blocked",
  youBadge: "(you)",
  placeholder: "competitor.com",
  auditing: "Auditing…",
  compare: "Compare",
  growthLimitBefore: "Growth includes 1 competitor per day — ",
  growthLimitLink: "Agency includes 5",
  growthLimitAfter: ".",
  requestFailed: (status: number) => `Request failed (${status})`,
  comparisonFailed: "Comparison failed",
};
export type BenchmarkCardCopy = typeof benchmarkCardEn;

export const BENCHMARK_CARD_COPY: Record<DashLocale, BenchmarkCardCopy> = {
  en: benchmarkCardEn,
  fr: {
    title: "Analyse comparative des concurrents",
    lockedDescription:
      "Voyez comment votre visibilité IA se compare à celle de vos concurrents, côte à côte. Inclus dans le forfait Growth et les forfaits supérieurs.",
    upgrade: "Passer au forfait supérieur",
    competitorsToday: (used: number, limit: number) =>
      `${used} / ${limit} concurrent${limit === 1 ? "" : "s"} aujourd'hui`,
    colSite: "Site",
    colScore: "Score",
    colBlocked: "Robots bloqués",
    youBadge: "(vous)",
    placeholder: "competitor.com",
    auditing: "Audit en cours…",
    compare: "Comparer",
    growthLimitBefore: "Growth inclut 1 concurrent par jour — ",
    growthLimitLink: "Agency en inclut 5",
    growthLimitAfter: ".",
    requestFailed: (status: number) => `Échec de la requête (${status})`,
    comparisonFailed: "Échec de la comparaison",
  },
  "de-CH": {
    title: "Wettbewerber-Benchmark",
    lockedDescription:
      "Sehen Sie im direkten Vergleich, wie Ihre KI-Sichtbarkeit gegenüber Wettbewerbern abschneidet. Teil des Growth-Plans und höher.",
    upgrade: "Upgrade durchführen",
    competitorsToday: (used: number, limit: number) =>
      `${used} / ${limit} Wettbewerber heute`,
    colSite: "Website",
    colScore: "Score",
    colBlocked: "Blockierte Crawler",
    youBadge: "(Sie)",
    placeholder: "competitor.com",
    auditing: "Audit läuft…",
    compare: "Vergleichen",
    growthLimitBefore: "Growth umfasst 1 Wettbewerber pro Tag — ",
    growthLimitLink: "Agency umfasst 5",
    growthLimitAfter: ".",
    requestFailed: (status: number) => `Anfrage fehlgeschlagen (${status})`,
    comparisonFailed: "Vergleich fehlgeschlagen",
  },
};

// ─── visibility cards: AnswerTrackingCard ───────────────────────────────────
const answerTrackingEn = {
  title: "Answer tracking",
  lockedDescription:
    "When customers ask ChatGPT or Claude for a recommendation, are you the answer? Track the exact questions daily and know the moment you appear — or a competitor does. The headline of the Agency plan.",
  upgrade: "Upgrade",
  mentionRateBadge: (rate: number) => `mentioned in ${rate}% of answers (14d)`,
  promptsUsed: (used: number, limit: number) => `${used} / ${limit} prompts`,
  queuing: "Queuing…",
  runNow: "Run now",
  empty:
    "Add the questions your customers actually ask an AI — “best [what you do] in [your city]” — and Echorank runs them every day, flagging whether you were the answer.",
  mentioned: (rank: number | null) => `Mentioned${rank ? ` · #${rank}` : ""}`,
  notMentioned: "Not mentioned",
  firstRunPending: "first run pending",
  deletePrompt: "Delete prompt",
  placeholder: "best plumber in Mérida",
  adding: "Adding…",
  trackPrompt: "Track prompt",
  runningNotice: (n: number) =>
    `Running ${n} prompt${n === 1 ? "" : "s"} — results land here in about a minute.`,
  requestFailed: (status: number) => `Request failed (${status})`,
  loadFailed: "Could not load prompts",
  addFailed: "Could not add prompt",
};
export type AnswerTrackingCopy = typeof answerTrackingEn;

export const ANSWER_TRACKING_COPY: Record<DashLocale, AnswerTrackingCopy> = {
  en: answerTrackingEn,
  fr: {
    title: "Suivi des réponses",
    lockedDescription:
      "Quand des clients demandent une recommandation à ChatGPT ou Claude, êtes-vous la réponse? Suivez ces questions exactes chaque jour et sachez dès l'instant où vous apparaissez — ou qu'un concurrent apparaît. Le point fort du forfait Agency.",
    upgrade: "Passer au forfait supérieur",
    mentionRateBadge: (rate: number) => `mentionné dans ${rate} % des réponses (14 j)`,
    promptsUsed: (used: number, limit: number) => `${used} / ${limit} requêtes`,
    queuing: "Mise en file…",
    runNow: "Exécuter maintenant",
    empty:
      "Ajoutez les questions que vos clients posent réellement à une IA — « meilleur [votre métier] à [votre ville] » — et Echorank les exécute chaque jour en signalant si vous étiez la réponse.",
    mentioned: (rank: number | null) => `Mentionné${rank ? ` · #${rank}` : ""}`,
    notMentioned: "Non mentionné",
    firstRunPending: "première exécution en attente",
    deletePrompt: "Supprimer la requête",
    placeholder: "meilleur plombier à Mérida",
    adding: "Ajout…",
    trackPrompt: "Suivre la requête",
    runningNotice: (n: number) =>
      `Exécution de ${n} requête${n === 1 ? "" : "s"} — les résultats apparaîtront ici dans environ une minute.`,
    requestFailed: (status: number) => `Échec de la requête (${status})`,
    loadFailed: "Impossible de charger les requêtes",
    addFailed: "Impossible d'ajouter la requête",
  },
  "de-CH": {
    title: "Antwort-Tracking",
    lockedDescription:
      "Wenn Kunden ChatGPT oder Claude um eine Empfehlung bitten — sind Sie die Antwort? Verfolgen Sie genau diese Fragen täglich und erfahren Sie sofort, wenn Sie erscheinen — oder ein Wettbewerber. Das Kernstück des Agency-Plans.",
    upgrade: "Upgrade durchführen",
    mentionRateBadge: (rate: number) => `in ${rate}% der Antworten erwähnt (14 Tage)`,
    promptsUsed: (used: number, limit: number) => `${used} / ${limit} Prompts`,
    queuing: "Wird eingereiht…",
    runNow: "Jetzt ausführen",
    empty:
      "Fügen Sie die Fragen hinzu, die Ihre Kunden einer KI tatsächlich stellen — «beste/r [Ihre Branche] in [Ihre Stadt]» — und Echorank führt sie täglich aus und zeigt an, ob Sie die Antwort waren.",
    mentioned: (rank: number | null) => `Erwähnt${rank ? ` · #${rank}` : ""}`,
    notMentioned: "Nicht erwähnt",
    firstRunPending: "erster Lauf ausstehend",
    deletePrompt: "Prompt löschen",
    placeholder: "bester Sanitärinstallateur in Mérida",
    adding: "Wird hinzugefügt…",
    trackPrompt: "Prompt verfolgen",
    runningNotice: (n: number) =>
      n === 1
        ? "1 Prompt wird ausgeführt — die Ergebnisse erscheinen hier in etwa einer Minute."
        : `${n} Prompts werden ausgeführt — die Ergebnisse erscheinen hier in etwa einer Minute.`,
    requestFailed: (status: number) => `Anfrage fehlgeschlagen (${status})`,
    loadFailed: "Prompts konnten nicht geladen werden",
    addFailed: "Prompt konnte nicht hinzugefügt werden",
  },
};

// ─── visibility cards: PromptTrends ─────────────────────────────────────────
const promptTrendsEn = {
  loading: "Loading prompt trends…",
  loadFailed: "Could not load prompt history.",
  title: (days: number) => `Mention trend — last ${days} days`,
  noRunsYet: "no runs yet",
  mentionedTooltip: (date: string, rank: number | null) =>
    `${date} — mentioned${rank ? ` #${rank}` : ""}`,
  notMentionedTooltip: (date: string) => `${date} — not mentioned`,
};
export type PromptTrendsCopy = typeof promptTrendsEn;

export const PROMPT_TRENDS_COPY: Record<DashLocale, PromptTrendsCopy> = {
  en: promptTrendsEn,
  fr: {
    loading: "Chargement des tendances de requêtes…",
    loadFailed: "Impossible de charger l'historique des requêtes.",
    title: (days: number) => `Tendance des mentions — ${days} derniers jours`,
    noRunsYet: "aucune exécution pour l'instant",
    mentionedTooltip: (date: string, rank: number | null) =>
      `${date} — mentionné${rank ? ` #${rank}` : ""}`,
    notMentionedTooltip: (date: string) => `${date} — non mentionné`,
  },
  "de-CH": {
    loading: "Prompt-Trends werden geladen…",
    loadFailed: "Prompt-Verlauf konnte nicht geladen werden.",
    title: (days: number) => `Erwähnungstrend — letzte ${days} Tage`,
    noRunsYet: "noch keine Läufe",
    mentionedTooltip: (date: string, rank: number | null) =>
      `${date} — erwähnt${rank ? ` #${rank}` : ""}`,
    notMentionedTooltip: (date: string) => `${date} — nicht erwähnt`,
  },
};

// ─── /visibility ────────────────────────────────────────────────────────────
const visibilityEn = {
  title: "AI Visibility",
  subtitle: "Can AI answer engines find, crawl, and cite your site?",
  keywordsLink: "Keyword suggester",
  // search
  urlPlaceholder: "example.com",
  auditing: "Auditing…",
  runAudit: "Run audit",
  // errors
  requestFailed: (status: number) => `Request failed (${status})`,
  somethingWrong: "Something went wrong",
  fixesFailed: "Could not generate fixes",
  pasteLogAndDate: "Paste an access log and a deploy date.",
  attrFailed: "Could not measure impact",
  auditFailed: "Audit failed",
  // stat cards
  statScore: "Visibility Score",
  statGrade: "Grade",
  statCrawlersOpen: "AI Crawlers Open",
  statRendering: "Rendering",
  clientSide: "Client-side",
  serverSide: "Server-side",
  // reachability
  reachabilityTitle: "Answer-engine reachability",
  openDataset: "open dataset",
  openBadge: "OPEN",
  blockedBadge: "BLOCKED",
  // scored checks
  checksTitle: "Scored checks",
  // fixes
  fixesTitle: "Generated fixes",
  mockBadge: "mock copy — set ANTHROPIC_API_KEY",
  fixesIntro:
    "Turn the findings into paste-ready artifacts: schema markup, FAQ content, and a robots.txt patch, written from your live page.",
  generating: "Generating…",
  generateFixes: "Generate fixes",
  lockedFixesA: "AI-written schema, FAQ, and metadata are a ",
  lockedFixesB:
    " feature. Upgrade your plan to generate paste-ready fixes grounded in your page.",
  upgradePlan: "Upgrade plan",
  fixLabels: {
    schema_jsonld: "Schema markup (JSON-LD)",
    faq_html: "FAQ content (visible HTML)",
    robots_patch: "robots.txt patch",
    meta_description: "Meta description",
  } as Record<string, string>,
  copy: "Copy",
  copied: "Copied",
  // attribution
  attrTitle: "AI impact — prove the fix paid off",
  attrIntro:
    "Paste a web-server access log and the date you deployed fixes. Measures AI crawler hits and AI referral traffic, before vs after.",
  logPlaceholder: `1.2.3.4 - - [02/Jun/2026:10:00:00 +0000] "GET /about HTTP/1.1" 200 1200 "-" "GPTBot/1.0"\n... or Caddy JSON lines`,
  deployPlaceholder: "Deploy date, e.g. 2026-06-01",
  measuring: "Measuring…",
  measureImpact: "Measure AI impact",
  lockedAttr:
    "ROI attribution is a Growth feature. Upgrade to connect your access logs and prove the fixes drove AI crawlers and referrals.",
  deltaNa: "n/a",
  deltaNew: "new",
  totalRow: "TOTAL",
  deploySummary: (deploy: string, before: number, after: number, parsed: number) =>
    `Deploy ${deploy} · ${before}d before vs ${after}d after · parsed ${parsed} lines`,
  crawlerActivity: "AI crawler activity (hits/day)",
  referralTraffic: "AI referral traffic (views/day)",
  noneDetected: "none detected (many AI surfaces send no Referer — see caveats)",
  caveatsTitle: "Caveats",
};
export type VisibilityCopy = typeof visibilityEn;

export const VISIBILITY_COPY: Record<DashLocale, VisibilityCopy> = {
  en: visibilityEn,
  fr: {
    title: "Visibilité IA",
    subtitle: "Les moteurs de réponse IA peuvent-ils trouver, explorer et citer votre site?",
    keywordsLink: "Suggesteur de mots-clés",
    urlPlaceholder: "example.com",
    auditing: "Audit en cours…",
    runAudit: "Lancer l'audit",
    requestFailed: (status: number) => `Échec de la requête (${status})`,
    somethingWrong: "Une erreur est survenue",
    fixesFailed: "Impossible de générer les correctifs",
    pasteLogAndDate: "Collez un journal d'accès et une date de déploiement.",
    attrFailed: "Impossible de mesurer l'impact",
    auditFailed: "Échec de l'audit",
    statScore: "Score de visibilité",
    statGrade: "Note",
    statCrawlersOpen: "Robots d'IA ouverts",
    statRendering: "Rendu",
    clientSide: "Côté client",
    serverSide: "Côté serveur",
    reachabilityTitle: "Accessibilité aux moteurs de réponse",
    openDataset: "ensemble de données ouvert",
    openBadge: "OUVERT",
    blockedBadge: "BLOQUÉ",
    checksTitle: "Vérifications notées",
    fixesTitle: "Correctifs générés",
    mockBadge: "contenu factice — définissez ANTHROPIC_API_KEY",
    fixesIntro:
      "Transformez les constats en éléments prêts à coller : balisage Schema, contenu FAQ et correctif robots.txt, rédigés à partir de votre page en ligne.",
    generating: "Génération…",
    generateFixes: "Générer les correctifs",
    lockedFixesA: "Le schéma, la FAQ et les métadonnées rédigés par l'IA sont une fonctionnalité ",
    lockedFixesB:
      ". Passez au forfait supérieur pour générer des correctifs prêts à coller, ancrés dans votre page.",
    upgradePlan: "Passer au forfait supérieur",
    fixLabels: {
      schema_jsonld: "Balisage Schema (JSON-LD)",
      faq_html: "Contenu FAQ (HTML visible)",
      robots_patch: "Correctif robots.txt",
      meta_description: "Méta-description",
    } as Record<string, string>,
    copy: "Copier",
    copied: "Copié",
    attrTitle: "Impact IA — prouvez que les correctifs ont porté fruit",
    attrIntro:
      "Collez un journal d'accès de votre serveur web et la date de déploiement des correctifs. Mesure les requêtes des robots d'IA et le trafic référé par l'IA, avant et après.",
    logPlaceholder: `1.2.3.4 - - [02/Jun/2026:10:00:00 +0000] "GET /about HTTP/1.1" 200 1200 "-" "GPTBot/1.0"\n... ou des lignes JSON Caddy`,
    deployPlaceholder: "Date de déploiement, p. ex. 2026-06-01",
    measuring: "Mesure en cours…",
    measureImpact: "Mesurer l'impact IA",
    lockedAttr:
      "L'attribution du ROI est une fonctionnalité Growth. Passez au forfait supérieur pour connecter vos journaux d'accès et prouver que les correctifs ont attiré robots d'IA et références.",
    deltaNa: "s. o.",
    deltaNew: "nouveau",
    totalRow: "TOTAL",
    deploySummary: (deploy: string, before: number, after: number, parsed: number) =>
      `Déploiement ${deploy} · ${before} j avant vs ${after} j après · ${parsed} lignes analysées`,
    crawlerActivity: "Activité des robots d'IA (requêtes/jour)",
    referralTraffic: "Trafic référé par l'IA (vues/jour)",
    noneDetected:
      "aucun détecté (plusieurs surfaces d'IA n'envoient pas d'en-tête Referer — voir les mises en garde)",
    caveatsTitle: "Mises en garde",
  },
  "de-CH": {
    title: "KI-Sichtbarkeit",
    subtitle: "Können KI-Antwortmaschinen Ihre Website finden, crawlen und zitieren?",
    keywordsLink: "Keyword-Vorschläge",
    urlPlaceholder: "example.com",
    auditing: "Audit läuft…",
    runAudit: "Audit starten",
    requestFailed: (status: number) => `Anfrage fehlgeschlagen (${status})`,
    somethingWrong: "Etwas ist schiefgelaufen",
    fixesFailed: "Korrekturen konnten nicht generiert werden",
    pasteLogAndDate: "Fügen Sie ein Zugriffsprotokoll und ein Deploy-Datum ein.",
    attrFailed: "Wirkung konnte nicht gemessen werden",
    auditFailed: "Audit fehlgeschlagen",
    statScore: "Sichtbarkeits-Score",
    statGrade: "Note",
    statCrawlersOpen: "Offene KI-Crawler",
    statRendering: "Rendering",
    clientSide: "Clientseitig",
    serverSide: "Serverseitig",
    reachabilityTitle: "Erreichbarkeit für Antwortmaschinen",
    openDataset: "offener Datensatz",
    openBadge: "OFFEN",
    blockedBadge: "BLOCKIERT",
    checksTitle: "Bewertete Prüfungen",
    fixesTitle: "Generierte Korrekturen",
    mockBadge: "Platzhaltertext — ANTHROPIC_API_KEY setzen",
    fixesIntro:
      "Verwandeln Sie die Ergebnisse in einsatzbereite Artefakte: Schema-Markup, FAQ-Inhalte und einen robots.txt-Patch, erstellt aus Ihrer Live-Seite.",
    generating: "Wird generiert…",
    generateFixes: "Korrekturen generieren",
    lockedFixesA: "KI-generierte Schema-, FAQ- und Metadaten sind eine ",
    lockedFixesB:
      "-Funktion. Führen Sie ein Upgrade durch, um einsatzbereite, auf Ihrer Seite basierende Korrekturen zu generieren.",
    upgradePlan: "Upgrade durchführen",
    fixLabels: {
      schema_jsonld: "Schema-Markup (JSON-LD)",
      faq_html: "FAQ-Inhalt (sichtbares HTML)",
      robots_patch: "robots.txt-Patch",
      meta_description: "Meta-Beschreibung",
    } as Record<string, string>,
    copy: "Kopieren",
    copied: "Kopiert",
    attrTitle: "KI-Wirkung — belegen Sie, dass sich die Korrekturen ausgezahlt haben",
    attrIntro:
      "Fügen Sie ein Webserver-Zugriffsprotokoll und das Datum ein, an dem Sie die Korrekturen bereitgestellt haben. Misst KI-Crawler-Zugriffe und KI-Referral-Traffic, vorher vs. nachher.",
    logPlaceholder: `1.2.3.4 - - [02/Jun/2026:10:00:00 +0000] "GET /about HTTP/1.1" 200 1200 "-" "GPTBot/1.0"\n... oder Caddy-JSON-Zeilen`,
    deployPlaceholder: "Deploy-Datum, z. B. 2026-06-01",
    measuring: "Wird gemessen…",
    measureImpact: "KI-Wirkung messen",
    lockedAttr:
      "ROI-Attribution ist eine Growth-Funktion. Führen Sie ein Upgrade durch, um Ihre Zugriffsprotokolle zu verbinden und zu belegen, dass die Korrekturen KI-Crawler und Referrals gebracht haben.",
    deltaNa: "k. A.",
    deltaNew: "neu",
    totalRow: "TOTAL",
    deploySummary: (deploy: string, before: number, after: number, parsed: number) =>
      `Deployment ${deploy} · ${before} Tage davor vs. ${after} Tage danach · ${parsed} Zeilen analysiert`,
    crawlerActivity: "KI-Crawler-Aktivität (Zugriffe/Tag)",
    referralTraffic: "KI-Referral-Traffic (Aufrufe/Tag)",
    noneDetected:
      "keine erkannt (viele KI-Oberflächen senden keinen Referer — siehe Vorbehalte)",
    caveatsTitle: "Vorbehalte",
  },
};

// ─── VisibilityHelpButton (src/components/help/VisibilityHelpButton.tsx) ────
const visibilityHelpEn = {
  fullGuide: "Full guide",
  howItWorks: "How it works",
  modalTitle: "How AI visibility works",
  iframeTitle: "AI visibility — guide",
  openFullPage: "Open as a full page →",
};
export type VisibilityHelpCopy = typeof visibilityHelpEn;

export const VISIBILITY_HELP_COPY: Record<DashLocale, VisibilityHelpCopy> = {
  en: visibilityHelpEn,
  fr: {
    fullGuide: "Guide complet",
    howItWorks: "Comment ça marche",
    modalTitle: "Comment fonctionne la visibilité IA",
    iframeTitle: "Visibilité IA — guide",
    openFullPage: "Ouvrir en pleine page →",
  },
  "de-CH": {
    fullGuide: "Vollständiger Leitfaden",
    howItWorks: "So funktioniert es",
    modalTitle: "So funktioniert die KI-Sichtbarkeit",
    iframeTitle: "KI-Sichtbarkeit — Leitfaden",
    openFullPage: "Als ganze Seite öffnen →",
  },
};

// ─── /visibility/keywords (SEO keyword suggester) ───────────────────────────
const keywordsEn = {
  title: "Keyword Suggester",
  subtitle:
    "Crawl your site, extract the keywords it should own, and see the AI prompts you should be recommended in.",
  backToVisibility: "← AI Visibility",
  urlPlaceholder: "example.com",
  scanning: "Scanning…",
  runScan: "Scan keywords",
  regenerateAi: "Regenerate with AI",
  regeneratingAi: "Regenerating…",
  aiBadge: "AI-enhanced",
  aiUnavailable: (note: string) => `AI enhancement unavailable — showing heuristic results (${note})`,
  requestFailed: (status: number) => `Request failed (${status})`,
  somethingWrong: "Something went wrong",
  scanFailed: "Scan failed",
  lockedPage:
    "The keyword suggester is part of your paid Echorank360 plan. Activate a subscription to scan your site.",
  upgradePlan: "Upgrade plan",
  pagesCrawled: (n: number) => `${n} page${n === 1 ? "" : "s"} crawled`,
  // tabs (the four benchmark classes)
  tabSeeds: "Keywords",
  tabContent: "Content optimization",
  tabPrompts: "AI visibility",
  tabTechnical: "Technical",
  // seeds tab
  seedsIntro: "Seed and question keywords, weighted by where they appear on your pages.",
  questionHeading: "Question keywords",
  difficulty: "Difficulty",
  diffLabels: { low: "easy", medium: "medium", high: "hard" } as Record<string, string>,
  sourceLabels: { heuristic: "heuristic", ai: "AI" } as Record<string, string>,
  copy: "Copy",
  copied: "Copied",
  // content tab
  presentTitle: "Terms already prominent (title / H1 / meta)",
  missingTitle: "Terms on the page but not in your title, H1 or meta",
  titleSuggestion: "Suggested title",
  metaSuggestion: "Suggested meta description",
  flagsTitle: "Flags",
  flagLabels: {
    missing_title: "Missing <title>",
    title_too_long: "Title longer than 60 characters",
    missing_meta_description: "Missing meta description",
    meta_description_too_long: "Meta description longer than 160 characters",
    meta_description_too_short: "Meta description shorter than 50 characters",
    missing_h1: "Missing H1",
    multiple_h1: "More than one H1",
  } as Record<string, string>,
  stuffingFlag: (term: string) => `Possible keyword stuffing: "${term}"`,
  noFlags: "No content flags — nice.",
  noSuggestions: "Title and meta description already carry your top keyword.",
  // prompts tab
  promptsIntro:
    "Recommendation-style prompts an AI user would type where your site should appear in the answer. Track them on the AI Visibility page.",
  trackPrompt: "Track this prompt →",
  // technical tab
  techIntro: "SEO-relevant technical checks from the last scan.",
  statusLabels: { pass: "PASS", warn: "WARN", fail: "FAIL" } as Record<string, string>,
  emptyTitle: "No scan yet",
  emptyDescription: "Enter your domain above to extract keyword suggestions.",
};
export type KeywordsCopy = typeof keywordsEn;

export const KEYWORDS_COPY: Record<DashLocale, KeywordsCopy> = {
  en: keywordsEn,
  fr: {
    title: "Suggesteur de mots-clés",
    subtitle:
      "Explorez votre site, extrayez les mots-clés qu'il devrait dominer et voyez les requêtes IA où vous devriez être recommandé.",
    backToVisibility: "← Visibilité IA",
    urlPlaceholder: "example.com",
    scanning: "Analyse en cours…",
    runScan: "Analyser les mots-clés",
    regenerateAi: "Régénérer avec l'IA",
    regeneratingAi: "Régénération…",
    aiBadge: "Enrichi par l'IA",
    aiUnavailable: (note: string) =>
      `Enrichissement IA indisponible — résultats heuristiques affichés (${note})`,
    requestFailed: (status: number) => `Échec de la requête (${status})`,
    somethingWrong: "Une erreur est survenue",
    scanFailed: "Échec de l'analyse",
    lockedPage:
      "Le suggesteur de mots-clés fait partie de votre forfait payant Echorank360. Activez un abonnement pour analyser votre site.",
    upgradePlan: "Passer au forfait supérieur",
    pagesCrawled: (n: number) => `${n} page${n === 1 ? "" : "s"} explorée${n === 1 ? "" : "s"}`,
    tabSeeds: "Mots-clés",
    tabContent: "Optimisation du contenu",
    tabPrompts: "Visibilité IA",
    tabTechnical: "Technique",
    seedsIntro:
      "Mots-clés de base et en question, pondérés selon leur emplacement sur vos pages.",
    questionHeading: "Mots-clés en question",
    difficulty: "Difficulté",
    diffLabels: { low: "facile", medium: "moyen", high: "difficile" } as Record<string, string>,
    sourceLabels: { heuristic: "heuristique", ai: "IA" } as Record<string, string>,
    copy: "Copier",
    copied: "Copié",
    presentTitle: "Termes déjà bien en vue (titre / H1 / méta)",
    missingTitle: "Termes présents sur la page mais absents du titre, du H1 ou de la méta",
    titleSuggestion: "Titre suggéré",
    metaSuggestion: "Méta-description suggérée",
    flagsTitle: "Signalements",
    flagLabels: {
      missing_title: "Balise <title> manquante",
      title_too_long: "Titre de plus de 60 caractères",
      missing_meta_description: "Méta-description manquante",
      meta_description_too_long: "Méta-description de plus de 160 caractères",
      meta_description_too_short: "Méta-description de moins de 50 caractères",
      missing_h1: "H1 manquant",
      multiple_h1: "Plus d'un H1",
    } as Record<string, string>,
    stuffingFlag: (term: string) => `Bourrage de mots-clés possible : « ${term} »`,
    noFlags: "Aucun signalement de contenu — bravo.",
    noSuggestions: "Le titre et la méta-description portent déjà votre mot-clé principal.",
    promptsIntro:
      "Requêtes de recommandation qu'un utilisateur d'IA taperait et où votre site devrait figurer dans la réponse. Suivez-les sur la page Visibilité IA.",
    trackPrompt: "Suivre cette requête →",
    techIntro: "Vérifications techniques pertinentes pour le SEO de la dernière analyse.",
    statusLabels: { pass: "RÉUSSI", warn: "ATTENTION", fail: "ÉCHEC" } as Record<string, string>,
    emptyTitle: "Aucune analyse pour l'instant",
    emptyDescription: "Saisissez votre domaine ci-dessus pour extraire des suggestions de mots-clés.",
  },
  "de-CH": {
    title: "Keyword-Vorschläge",
    subtitle:
      "Crawlen Sie Ihre Website, extrahieren Sie die Keywords, die sie besitzen sollte, und sehen Sie die KI-Prompts, in denen Sie empfohlen werden sollten.",
    backToVisibility: "← KI-Sichtbarkeit",
    urlPlaceholder: "example.com",
    scanning: "Scan läuft…",
    runScan: "Keywords scannen",
    regenerateAi: "Mit KI neu generieren",
    regeneratingAi: "Wird neu generiert…",
    aiBadge: "KI-erweitert",
    aiUnavailable: (note: string) =>
      `KI-Erweiterung nicht verfügbar — heuristische Ergebnisse werden angezeigt (${note})`,
    requestFailed: (status: number) => `Anfrage fehlgeschlagen (${status})`,
    somethingWrong: "Etwas ist schiefgelaufen",
    scanFailed: "Scan fehlgeschlagen",
    lockedPage:
      "Die Keyword-Vorschläge sind Teil Ihres bezahlten Echorank360-Plans. Aktivieren Sie ein Abonnement, um Ihre Website zu scannen.",
    upgradePlan: "Upgrade durchführen",
    pagesCrawled: (n: number) => `${n} Seite${n === 1 ? "" : "n"} gecrawlt`,
    tabSeeds: "Keywords",
    tabContent: "Content-Optimierung",
    tabPrompts: "KI-Sichtbarkeit",
    tabTechnical: "Technik",
    seedsIntro:
      "Basis- und Frage-Keywords, gewichtet danach, wo sie auf Ihren Seiten erscheinen.",
    questionHeading: "Frage-Keywords",
    difficulty: "Schwierigkeit",
    diffLabels: { low: "leicht", medium: "mittel", high: "schwer" } as Record<string, string>,
    sourceLabels: { heuristic: "heuristisch", ai: "KI" } as Record<string, string>,
    copy: "Kopieren",
    copied: "Kopiert",
    presentTitle: "Bereits prominente Begriffe (Titel / H1 / Meta)",
    missingTitle: "Begriffe auf der Seite, aber nicht in Titel, H1 oder Meta",
    titleSuggestion: "Vorgeschlagener Titel",
    metaSuggestion: "Vorgeschlagene Meta-Beschreibung",
    flagsTitle: "Hinweise",
    flagLabels: {
      missing_title: "Fehlender <title>",
      title_too_long: "Titel länger als 60 Zeichen",
      missing_meta_description: "Fehlende Meta-Beschreibung",
      meta_description_too_long: "Meta-Beschreibung länger als 160 Zeichen",
      meta_description_too_short: "Meta-Beschreibung kürzer als 50 Zeichen",
      missing_h1: "Fehlendes H1",
      multiple_h1: "Mehr als ein H1",
    } as Record<string, string>,
    stuffingFlag: (term: string) => `Mögliches Keyword-Stuffing: «${term}»`,
    noFlags: "Keine Content-Hinweise — gut.",
    noSuggestions: "Titel und Meta-Beschreibung tragen Ihr Top-Keyword bereits.",
    promptsIntro:
      "Empfehlungs-Prompts, die ein KI-Nutzer eingeben würde und in deren Antwort Ihre Website erscheinen sollte. Verfolgen Sie sie auf der Seite KI-Sichtbarkeit.",
    trackPrompt: "Diesen Prompt verfolgen →",
    techIntro: "SEO-relevante technische Prüfungen aus dem letzten Scan.",
    statusLabels: { pass: "OK", warn: "WARNUNG", fail: "FEHLER" } as Record<string, string>,
    emptyTitle: "Noch kein Scan",
    emptyDescription:
      "Geben Sie oben Ihre Domain ein, um Keyword-Vorschläge zu extrahieren.",
  },
};

// ─── Onboarding (welcome setup, first-audit banner, checklist) ──────────────
const onboardingEn = {
  // Welcome setup modal
  welcomeTitle: "Welcome to Echorank360",
  welcomeIntro:
    "Two quick questions and we'll run your first AI Visibility audit — it shows how your business appears in AI answers today.",
  intentQuestion: "Which best describes you?",
  intentBusiness: "I'm a business",
  intentBusinessHint: "I want to track my own visibility",
  intentAgency: "I'm an agency",
  intentAgencyHint: "I manage visibility for clients",
  domainLabel: "Your website domain",
  domainPlaceholder: "yourbusiness.com",
  runAuditCta: "Run my first audit",
  saveCta: "Save",
  skipForNow: "Skip for now",
  genericError: "Something went wrong. Please try again.",

  // First-audit banner / runner on /visibility
  bannerTitle: "Your first AI Visibility audit",
  bannerSub:
    "This is your starting point — the checks and fixes below show where to improve.",
  runningTitle: "Running your first audit…",
  runningSub: "This usually takes under a minute.",
  retryTitle: "Your audit didn't finish",
  retrySub:
    "No worries — your dashboard is ready anyway. Run the audit again whenever you like.",
  retryCta: "Retry audit",

  // Checklist card
  checklistTitle: "Your first steps",
  progress: (done: number, total: number) => `${done} of ${total} done`,
  dismissAria: "Dismiss checklist",
  steps: {
    first_audit: "Run your first AI Visibility audit",
    download_pdf: "Download your PDF report",
    review_link: "Set up a review link",
    add_prompts: "Add 3 tracked prompts",
    explore_roadmap: "Explore your fix roadmap",
    connect_source: "Connect a review source",
    second_audit: "Run a follow-up audit",
    add_client: "Add your first client workspace",
    invite_teammate: "Invite a teammate",
  } as Record<string, string>,

  // Add-client modal (agency intent)
  addClientTitle: "Add a client workspace",
  addClientIntro:
    "Each client gets their own workspace with separate audits, monitoring and reports. Switch between them from your account menu.",
  addClientNameLabel: "Client business name",
  addClientNamePlaceholder: "Client Inc.",
  addClientCta: "Create workspace",
  addClientSuccess: "Workspace created — you've been switched to it.",
};
export type OnboardingCopy = typeof onboardingEn;

export const ONBOARDING_COPY: Record<DashLocale, OnboardingCopy> = {
  en: onboardingEn,
  fr: {
    welcomeTitle: "Bienvenue dans Echorank360",
    welcomeIntro:
      "Deux petites questions et nous lancerons votre premier audit de visibilité IA — il montre comment votre entreprise apparaît aujourd'hui dans les réponses des IA.",
    intentQuestion: "Qu'est-ce qui vous décrit le mieux?",
    intentBusiness: "Je suis une entreprise",
    intentBusinessHint: "Je veux suivre ma propre visibilité",
    intentAgency: "Je suis une agence",
    intentAgencyHint: "Je gère la visibilité de mes clients",
    domainLabel: "Le domaine de votre site Web",
    domainPlaceholder: "votreentreprise.com",
    runAuditCta: "Lancer mon premier audit",
    saveCta: "Enregistrer",
    skipForNow: "Passer pour l'instant",
    genericError: "Une erreur est survenue. Veuillez réessayer.",

    bannerTitle: "Votre premier audit de visibilité IA",
    bannerSub:
      "C'est votre point de départ — les vérifications et correctifs ci-dessous montrent où vous améliorer.",
    runningTitle: "Votre premier audit est en cours…",
    runningSub: "Cela prend habituellement moins d'une minute.",
    retryTitle: "Votre audit ne s'est pas terminé",
    retrySub:
      "Pas de souci — votre tableau de bord est prêt quand même. Relancez l'audit quand vous voulez.",
    retryCta: "Relancer l'audit",

    checklistTitle: "Vos premiers pas",
    progress: (done: number, total: number) => `${done} sur ${total} terminées`,
    dismissAria: "Masquer la liste de vérification",
    steps: {
      first_audit: "Lancez votre premier audit de visibilité IA",
      download_pdf: "Téléchargez votre rapport PDF",
      review_link: "Configurez un lien d'avis",
      add_prompts: "Ajoutez 3 requêtes suivies",
      explore_roadmap: "Explorez votre plan de correctifs",
      connect_source: "Connectez une source d'avis",
      second_audit: "Lancez un audit de suivi",
      add_client: "Ajoutez votre premier espace client",
      invite_teammate: "Invitez un membre de l'équipe",
    } as Record<string, string>,

    addClientTitle: "Ajouter un espace client",
    addClientIntro:
      "Chaque client a son propre espace avec ses audits, sa surveillance et ses rapports distincts. Passez de l'un à l'autre depuis le menu de votre compte.",
    addClientNameLabel: "Nom de l'entreprise cliente",
    addClientNamePlaceholder: "Client inc.",
    addClientCta: "Créer l'espace",
    addClientSuccess: "Espace créé — vous y avez été basculé.",
  },
  "de-CH": {
    welcomeTitle: "Willkommen bei Echorank360",
    welcomeIntro:
      "Zwei kurze Fragen, dann starten wir Ihr erstes KI-Sichtbarkeits-Audit — es zeigt, wie Ihr Unternehmen heute in KI-Antworten erscheint.",
    intentQuestion: "Was beschreibt Sie am besten?",
    intentBusiness: "Ich bin ein Unternehmen",
    intentBusinessHint: "Ich möchte meine eigene Sichtbarkeit verfolgen",
    intentAgency: "Ich bin eine Agentur",
    intentAgencyHint: "Ich betreue die Sichtbarkeit meiner Kunden",
    domainLabel: "Die Domain Ihrer Website",
    domainPlaceholder: "ihrunternehmen.ch",
    runAuditCta: "Mein erstes Audit starten",
    saveCta: "Speichern",
    skipForNow: "Vorerst überspringen",
    genericError: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",

    bannerTitle: "Ihr erstes KI-Sichtbarkeits-Audit",
    bannerSub:
      "Das ist Ihr Ausgangspunkt — die Prüfungen und Korrekturen unten zeigen, wo Sie sich verbessern können.",
    runningTitle: "Ihr erstes Audit läuft…",
    runningSub: "Das dauert in der Regel weniger als eine Minute.",
    retryTitle: "Ihr Audit wurde nicht abgeschlossen",
    retrySub:
      "Kein Problem — Ihr Dashboard ist trotzdem bereit. Starten Sie das Audit einfach erneut, wann immer Sie möchten.",
    retryCta: "Audit erneut starten",

    checklistTitle: "Ihre ersten Schritte",
    progress: (done: number, total: number) => `${done} von ${total} erledigt`,
    dismissAria: "Checkliste ausblenden",
    steps: {
      first_audit: "Starten Sie Ihr erstes KI-Sichtbarkeits-Audit",
      download_pdf: "Laden Sie Ihren PDF-Bericht herunter",
      review_link: "Richten Sie einen Bewertungslink ein",
      add_prompts: "Fügen Sie 3 verfolgte Prompts hinzu",
      explore_roadmap: "Erkunden Sie Ihren Korrektur-Fahrplan",
      connect_source: "Verbinden Sie eine Bewertungsquelle",
      second_audit: "Führen Sie ein Folge-Audit durch",
      add_client: "Fügen Sie Ihren ersten Kunden-Arbeitsbereich hinzu",
      invite_teammate: "Laden Sie ein Teammitglied ein",
    } as Record<string, string>,

    addClientTitle: "Kunden-Arbeitsbereich hinzufügen",
    addClientIntro:
      "Jeder Kunde erhält einen eigenen Arbeitsbereich mit separaten Audits, Überwachung und Berichten. Wechseln Sie über Ihr Kontomenü zwischen ihnen.",
    addClientNameLabel: "Name des Kundenunternehmens",
    addClientNamePlaceholder: "Kunde AG",
    addClientCta: "Arbeitsbereich erstellen",
    addClientSuccess: "Arbeitsbereich erstellt — Sie wurden dorthin gewechselt.",
  },
};

// ─── Products menu + feature scaffolds ──────────────────────────────────────
// Typed against the nav config's id unions (imported at the top of this
// file): adding an item/group/scaffold in src/lib/seo-tools.ts without copy
// in ALL THREE catalogs is a type error.
const seoToolsEn = {
  hubTitle: "SEO Tools",
  hubSubtitle: "Every Echorank360 search, content, and reporting tool in one place.",
  classicTitle: "Classic SEO Tools",
  classicSubtitle: "Traditional search data — rankings, keywords, backlinks and technical health.",
  upgradeTitle: "SEO Tools are part of your paid plan",
  upgradeBody:
    "Your workspace does not have an active subscription yet. Activate any Echorank360 plan to open the SEO Tools hub — keyword research, site analysis, content and reporting tools included.",
  upgradeCta: "Go to billing",
  newBadge: "New",
  newBadgeSr: "new feature",
  comingSoon: "Coming soon",
  scaffoldIntro:
    "This workspace is coming to Echorank360. Nothing is tracked yet — once the module launches, your projects and data will appear here.",
  groups: {
    search_marketing: "Search Marketing",
    website_performance: "Website Performance",
    content_marketing: "Content Marketing",
    reporting: "Reporting",
    local_seo: "Local SEO",
    developers: "Developers",
  } satisfies Record<SeoToolGroupId, string>,
  items: {
    serp_checker: {
      name: "SERP Checker",
      description: "Live top-100 organic results for any keyword, location, and device.",
    },
    backlinks: {
      name: "Backlinks",
      description: "Referring domains, link profile breakdown, top linked pages, and growth history.",
    },
    lighthouse: {
      name: "Lighthouse",
      description: "Core Web Vitals, performance, accessibility, best-practices, and SEO scores for any URL.",
    },
    site_explorer: {
      name: "Site Explorer",
      description: "Analyze websites, competitors, backlinks, and organic search performance.",
    },
    keywords_explorer: {
      name: "Keywords Explorer",
      description: "Discover keywords, search demand, difficulty, and ranking opportunities.",
    },
    rank_tracker: {
      name: "Rank Tracker",
      description: "Monitor keyword rankings and search visibility over time.",
    },
    gsc_insights: {
      name: "GSC Insights",
      description: "Analyze Google Search Console performance and uncover search opportunities.",
    },
    brand_radar: {
      name: "Brand Radar",
      description: "Track brand visibility, mentions, and presence across search and AI platforms.",
    },
    custom_prompts: {
      name: "Custom Prompts",
      description: "Create and monitor the AI prompts that matter to your brand.",
    },
    site_audit: {
      name: "Site Audit",
      description: "Crawl your website and identify technical SEO issues.",
    },
    web_analytics: {
      name: "Web Analytics",
      description: "Understand website traffic, acquisition, engagement, and conversions.",
    },
    bot_analytics: {
      name: "Bot Analytics",
      description: "Monitor search-engine and AI crawler activity across your website.",
    },
    content_explorer: {
      name: "Content Explorer",
      description: "Research successful content, trends, mentions, and link opportunities.",
    },
    ai_content_helper: {
      name: "AI Content Helper",
      description: "Plan, create, optimize, and improve content with AI.",
    },
    social_media_manager: {
      name: "Social Media Manager",
      description: "Plan, edit, schedule, and manage social media content.",
    },
    dashboard: {
      name: "Dashboard",
      description: "Track key marketing and SEO performance across projects.",
    },
    portfolios: {
      name: "Portfolios",
      description: "Monitor combined performance across multiple websites and projects.",
    },
    report_builder: {
      name: "Report Builder",
      description: "Create customizable reports that demonstrate marketing impact.",
    },
    gbp_monitor: {
      name: "GBP Monitor",
      description: "Monitor and manage Google Business Profile performance at scale.",
    },
    api_access: {
      name: "API access",
      description: "Query your Echorank360 data — keywords, audits, visibility — from your own code with tenant API keys.",
    },
    mcp_server: {
      name: "MCP Server",
      description: "Connect Claude and other AI assistants to your Echorank360 data via the Model Context Protocol.",
    },
  } satisfies Record<SeoToolId, { name: string; description: string }>,
  scaffolds: {
    serp_checker: { cta: "Check a SERP", related: "Find keywords to check →" },
    backlinks: { cta: "Analyze backlinks" },
    lighthouse: { cta: "Run a Lighthouse audit", related: "Open Site Audit →" },
    site_explorer: { cta: "Analyze a domain", related: "Open competitor intelligence →" },
    rank_tracker: { cta: "Create a tracking project", related: "Find keywords to track →" },
    gsc_insights: { cta: "Connect Google Search Console" },
    brand_radar: { cta: "Add a brand", related: "Track AI prompts now →" },
    web_analytics: { cta: "Connect analytics", related: "Open reputation analytics →" },
    bot_analytics: { cta: "Add a website", related: "Measure AI crawler impact →" },
    content_explorer: { cta: "Explore content" },
    ai_content_helper: { cta: "Create content", related: "Open message templates →" },
    social_media_manager: { cta: "Create a post" },
    portfolios: { cta: "Create a portfolio" },
    report_builder: { cta: "Create a report", related: "Download existing PDF reports →" },
    gbp_monitor: { cta: "Connect Google Business Profile", related: "Open review monitoring →" },
  } satisfies Record<ScaffoldId, { cta: string; related?: string }>,
};
// Widen scaffolds so `related` is uniformly optional (the `satisfies` check
// above still enforces per-key completeness on the English source catalog).
export type SeoToolsCopy = Omit<typeof seoToolsEn, "scaffolds"> & {
  scaffolds: Record<ScaffoldId, { cta: string; related?: string }>;
};

export const SEO_TOOLS_COPY: Record<DashLocale, SeoToolsCopy> = {
  en: seoToolsEn,
  fr: {
    hubTitle: "Outils SEO",
    hubSubtitle: "Tous les outils de recherche, de contenu et de rapports d'Echorank360, réunis au même endroit.",
    classicTitle: "Outils SEO classiques",
    classicSubtitle: "Données de recherche traditionnelles — positions, mots-clés, liens retour et santé technique.",
    upgradeTitle: "Les outils SEO font partie de votre forfait payant",
    upgradeBody:
      "Votre espace de travail n'a pas encore d'abonnement actif. Activez n'importe quel forfait Echorank360 pour ouvrir le centre d'outils SEO — recherche de mots-clés, analyse de site, outils de contenu et de rapports inclus.",
    upgradeCta: "Aller à la facturation",
    newBadge: "Nouveau",
    newBadgeSr: "nouvelle fonctionnalité",
    comingSoon: "Bientôt offert",
    scaffoldIntro:
      "Cet espace de travail s'en vient dans Echorank360. Rien n'est encore suivi — au lancement du module, vos projets et vos données apparaîtront ici.",
    groups: {
      search_marketing: "Marketing de recherche",
      website_performance: "Performance du site web",
      content_marketing: "Marketing de contenu",
      reporting: "Rapports",
      local_seo: "SEO local",
      developers: "Développeurs",
    },
    items: {
      serp_checker: {
        name: "Vérificateur SERP",
        description: "Top 100 des résultats organiques en direct pour tout mot-clé, lieu et appareil.",
      },
      backlinks: {
        name: "Liens retour",
        description: "Domaines référents, répartition du profil de liens, pages les plus liées et historique de croissance.",
      },
      lighthouse: {
        name: "Lighthouse",
        description: "Core Web Vitals, performance, accessibilité, bonnes pratiques et scores SEO pour toute URL.",
      },
      site_explorer: {
        name: "Explorateur de sites",
        description: "Analysez les sites web, les concurrents, les liens retour et la performance en recherche organique.",
      },
      keywords_explorer: {
        name: "Explorateur de mots-clés",
        description: "Découvrez les mots-clés, la demande de recherche, la difficulté et les occasions de classement.",
      },
      rank_tracker: {
        name: "Suivi des positions",
        description: "Surveillez le classement de vos mots-clés et votre visibilité de recherche au fil du temps.",
      },
      gsc_insights: {
        name: "Analyses GSC",
        description: "Analysez la performance Google Search Console et découvrez des occasions de recherche.",
      },
      brand_radar: {
        name: "Radar de marque",
        description: "Suivez la visibilité, les mentions et la présence de votre marque dans la recherche et les plateformes d'IA.",
      },
      custom_prompts: {
        name: "Requêtes personnalisées",
        description: "Créez et surveillez les requêtes d'IA qui comptent pour votre marque.",
      },
      site_audit: {
        name: "Audit de site",
        description: "Explorez votre site web et identifiez les problèmes techniques de SEO.",
      },
      web_analytics: {
        name: "Analytique web",
        description: "Comprenez le trafic, l'acquisition, l'engagement et les conversions de votre site web.",
      },
      bot_analytics: {
        name: "Analytique des robots",
        description: "Surveillez l'activité des robots des moteurs de recherche et d'IA sur votre site web.",
      },
      content_explorer: {
        name: "Explorateur de contenu",
        description: "Recherchez les contenus performants, les tendances, les mentions et les occasions de liens.",
      },
      ai_content_helper: {
        name: "Assistant de contenu IA",
        description: "Planifiez, créez, optimisez et améliorez votre contenu avec l'IA.",
      },
      social_media_manager: {
        name: "Gestionnaire de médias sociaux",
        description: "Planifiez, modifiez, programmez et gérez le contenu de vos médias sociaux.",
      },
      dashboard: {
        name: "Tableau de bord",
        description: "Suivez la performance marketing et SEO clé de tous vos projets.",
      },
      portfolios: {
        name: "Portefeuilles",
        description: "Surveillez la performance combinée de plusieurs sites web et projets.",
      },
      report_builder: {
        name: "Générateur de rapports",
        description: "Créez des rapports personnalisables qui démontrent l'impact marketing.",
      },
      gbp_monitor: {
        name: "Suivi GBP",
        description: "Surveillez et gérez la performance de vos fiches Google Business Profile à grande échelle.",
      },
      api_access: {
        name: "Accès API",
        description: "Interrogez vos données Echorank360 — mots-clés, audits, visibilité — depuis votre propre code avec des clés API.",
      },
      mcp_server: {
        name: "Serveur MCP",
        description: "Connectez Claude et d'autres assistants IA à vos données Echorank360 via le Model Context Protocol.",
      },
    },
    scaffolds: {
      serp_checker: { cta: "Vérifier une SERP", related: "Trouver des mots-clés à vérifier →" },
      backlinks: { cta: "Analyser les liens retour" },
      lighthouse: { cta: "Lancer un audit Lighthouse", related: "Ouvrir l'audit de site →" },
      site_explorer: { cta: "Analyser un domaine", related: "Ouvrir l'intelligence concurrentielle →" },
      rank_tracker: { cta: "Créer un projet de suivi", related: "Trouver des mots-clés à suivre →" },
      gsc_insights: { cta: "Connecter Google Search Console" },
      brand_radar: { cta: "Ajouter une marque", related: "Suivre des requêtes d'IA →" },
      web_analytics: { cta: "Connecter l'analytique", related: "Ouvrir l'analytique de réputation →" },
      bot_analytics: { cta: "Ajouter un site web", related: "Mesurer l'impact des robots d'IA →" },
      content_explorer: { cta: "Explorer le contenu" },
      ai_content_helper: { cta: "Créer du contenu", related: "Ouvrir les modèles de messages →" },
      social_media_manager: { cta: "Créer une publication" },
      portfolios: { cta: "Créer un portefeuille" },
      report_builder: { cta: "Créer un rapport", related: "Télécharger les rapports PDF existants →" },
      gbp_monitor: { cta: "Connecter Google Business Profile", related: "Ouvrir la surveillance des avis →" },
    },
  },
  "de-CH": {
    hubTitle: "SEO-Tools",
    hubSubtitle: "Alle Such-, Content- und Berichtstools von Echorank360 an einem Ort.",
    classicTitle: "Klassische SEO-Tools",
    classicSubtitle: "Traditionelle Suchdaten — Rankings, Keywords, Backlinks und technische Gesundheit.",
    upgradeTitle: "SEO-Tools sind Teil Ihres bezahlten Plans",
    upgradeBody:
      "Ihr Arbeitsbereich hat noch kein aktives Abonnement. Aktivieren Sie einen beliebigen Echorank360-Plan, um das SEO-Tools-Hub zu öffnen — Keyword-Recherche, Website-Analyse, Content- und Berichtstools inklusive.",
    upgradeCta: "Zur Abrechnung",
    newBadge: "Neu",
    newBadgeSr: "neue Funktion",
    comingSoon: "Bald verfügbar",
    scaffoldIntro:
      "Dieser Arbeitsbereich kommt in Echorank360. Noch wird nichts erfasst — sobald das Modul startet, erscheinen hier Ihre Projekte und Daten.",
    groups: {
      search_marketing: "Suchmaschinenmarketing",
      website_performance: "Website-Leistung",
      content_marketing: "Content-Marketing",
      reporting: "Berichte",
      local_seo: "Lokales SEO",
      developers: "Entwickler",
    },
    items: {
      serp_checker: {
        name: "SERP-Checker",
        description: "Live-Top-100 der organischen Ergebnisse für jedes Keyword, jeden Standort und jedes Gerät.",
      },
      backlinks: {
        name: "Backlinks",
        description: "Verweisende Domains, Linkprofil-Aufschlüsselung, meistverlinkte Seiten und Wachstumsverlauf.",
      },
      lighthouse: {
        name: "Lighthouse",
        description: "Core Web Vitals, Performance, Barrierefreiheit, Best Practices und SEO-Scores für jede URL.",
      },
      site_explorer: {
        name: "Site Explorer",
        description: "Analysieren Sie Websites, Wettbewerber, Backlinks und die organische Suchleistung.",
      },
      keywords_explorer: {
        name: "Keywords Explorer",
        description: "Entdecken Sie Keywords, Suchnachfrage, Schwierigkeit und Ranking-Chancen.",
      },
      rank_tracker: {
        name: "Rank Tracker",
        description: "Überwachen Sie Keyword-Rankings und Suchsichtbarkeit im Zeitverlauf.",
      },
      gsc_insights: {
        name: "GSC Insights",
        description: "Analysieren Sie die Google-Search-Console-Leistung und decken Sie Suchchancen auf.",
      },
      brand_radar: {
        name: "Brand Radar",
        description: "Verfolgen Sie Markensichtbarkeit, Erwähnungen und Präsenz in Suche und KI-Plattformen.",
      },
      custom_prompts: {
        name: "Eigene Prompts",
        description: "Erstellen und überwachen Sie die KI-Prompts, die für Ihre Marke zählen.",
      },
      site_audit: {
        name: "Site-Audit",
        description: "Crawlen Sie Ihre Website und identifizieren Sie technische SEO-Probleme.",
      },
      web_analytics: {
        name: "Web-Analytics",
        description: "Verstehen Sie Traffic, Akquise, Engagement und Conversions Ihrer Website.",
      },
      bot_analytics: {
        name: "Bot-Analytics",
        description: "Überwachen Sie die Aktivität von Suchmaschinen- und KI-Crawlern auf Ihrer Website.",
      },
      content_explorer: {
        name: "Content Explorer",
        description: "Recherchieren Sie erfolgreiche Inhalte, Trends, Erwähnungen und Link-Chancen.",
      },
      ai_content_helper: {
        name: "KI-Content-Assistent",
        description: "Planen, erstellen, optimieren und verbessern Sie Inhalte mit KI.",
      },
      social_media_manager: {
        name: "Social-Media-Manager",
        description: "Planen, bearbeiten, terminieren und verwalten Sie Social-Media-Inhalte.",
      },
      dashboard: {
        name: "Dashboard",
        description: "Verfolgen Sie zentrale Marketing- und SEO-Leistung über alle Projekte.",
      },
      portfolios: {
        name: "Portfolios",
        description: "Überwachen Sie die kombinierte Leistung mehrerer Websites und Projekte.",
      },
      report_builder: {
        name: "Report Builder",
        description: "Erstellen Sie anpassbare Berichte, die den Marketing-Impact belegen.",
      },
      gbp_monitor: {
        name: "GBP-Monitor",
        description: "Überwachen und verwalten Sie die Leistung von Google-Business-Profilen im grossen Massstab.",
      },
      api_access: {
        name: "API-Zugriff",
        description: "Fragen Sie Ihre Echorank360-Daten — Keywords, Audits, Sichtbarkeit — mit Mandanten-API-Schlüsseln aus eigenem Code ab.",
      },
      mcp_server: {
        name: "MCP-Server",
        description: "Verbinden Sie Claude und andere KI-Assistenten über das Model Context Protocol mit Ihren Echorank360-Daten.",
      },
    },
    scaffolds: {
      serp_checker: { cta: "SERP prüfen", related: "Keywords zum Prüfen finden →" },
      backlinks: { cta: "Backlinks analysieren" },
      lighthouse: { cta: "Lighthouse-Audit ausführen", related: "Site-Audit öffnen →" },
      site_explorer: { cta: "Domain analysieren", related: "Wettbewerbs-Intelligence öffnen →" },
      rank_tracker: { cta: "Tracking-Projekt erstellen", related: "Keywords zum Verfolgen finden →" },
      gsc_insights: { cta: "Google Search Console verbinden" },
      brand_radar: { cta: "Marke hinzufügen", related: "KI-Prompts verfolgen →" },
      web_analytics: { cta: "Analytics verbinden", related: "Reputations-Analytics öffnen →" },
      bot_analytics: { cta: "Website hinzufügen", related: "KI-Crawler-Wirkung messen →" },
      content_explorer: { cta: "Inhalte erkunden" },
      ai_content_helper: { cta: "Inhalt erstellen", related: "Nachrichtenvorlagen öffnen →" },
      social_media_manager: { cta: "Beitrag erstellen" },
      portfolios: { cta: "Portfolio erstellen" },
      report_builder: { cta: "Bericht erstellen", related: "Vorhandene PDF-Berichte herunterladen →" },
      gbp_monitor: { cta: "Google Business Profile verbinden", related: "Bewertungsüberwachung öffnen →" },
    },
  },
};

// ─── /visibility/tools/brand-radar ──────────────────────────────────────────
const brandRadarEn = {
  domainLabel: "Tracked site",
  statScore: "AI Visibility Score",
  statGrade: "Grade",
  statMentionRate: (days: number) => `Mention rate (${days}d)`,
  statActivePrompts: "Active prompts",
  auditAt: (date: string) => `Last audit: ${date}`,
  enginesTitle: "Engine coverage",
  enginesIntro: (days: number) =>
    `Share of tracking runs in the last ${days} days where an assistant mentioned your brand.`,
  engineRuns: (n: number) => `${n} run${n === 1 ? "" : "s"}`,
  noRuns:
    "No tracking runs in this window yet. Runs happen on your prompt schedule — results appear here after the next sweep.",
  trendsNote:
    "Per-prompt trends below come from the same tracking runs shown on the AI Visibility page.",
  alertsTitle: "Recent visibility alerts",
  noAlerts: "No visibility alerts recorded — no lost recommendations or rank drops detected.",
  promptsCta: "Create a prompt →",
  auditCta: "Run an audit →",
  emptyTitle: "No brand data yet",
  emptyBody:
    "Brand Radar reads the data your workspace already tracks: AI-visibility audits, tracked prompts, and alerts. Run a first audit or create a tracked prompt to start filling this page.",
  loadFailed: "Could not load brand data. Try again in a minute.",
  loading: "Loading brand data…",
  severityLabels: { warning: "Warning", critical: "Critical" } as Record<string, string>,
};
export type BrandRadarCopy = typeof brandRadarEn;

export const BRAND_RADAR_COPY: Record<DashLocale, BrandRadarCopy> = {
  en: brandRadarEn,
  fr: {
    domainLabel: "Site suivi",
    statScore: "Score de visibilité IA",
    statGrade: "Note",
    statMentionRate: (days: number) => `Taux de mention (${days} j)`,
    statActivePrompts: "Requêtes actives",
    auditAt: (date: string) => `Dernier audit : ${date}`,
    enginesTitle: "Couverture par moteur",
    enginesIntro: (days: number) =>
      `Part des exécutions de suivi des ${days} derniers jours où un assistant a mentionné votre marque.`,
    engineRuns: (n: number) => `${n} exécution${n === 1 ? "" : "s"}`,
    noRuns:
      "Aucune exécution de suivi dans cette fenêtre pour l'instant. Les exécutions suivent le calendrier de vos requêtes — les résultats apparaîtront ici après le prochain passage.",
    trendsNote:
      "Les tendances par requête ci-dessous proviennent des mêmes exécutions de suivi que la page Visibilité IA.",
    alertsTitle: "Alertes de visibilité récentes",
    noAlerts:
      "Aucune alerte de visibilité enregistrée — aucune recommandation perdue ni chute de rang détectée.",
    promptsCta: "Créer une requête →",
    auditCta: "Lancer un audit →",
    emptyTitle: "Aucune donnée de marque pour l'instant",
    emptyBody:
      "Le radar de marque lit les données que votre espace de travail suit déjà : audits de visibilité IA, requêtes suivies et alertes. Lancez un premier audit ou créez une requête suivie pour alimenter cette page.",
    loadFailed: "Impossible de charger les données de marque. Réessayez dans une minute.",
    loading: "Chargement des données de marque…",
    severityLabels: { warning: "Avertissement", critical: "Critique" } as Record<string, string>,
  },
  "de-CH": {
    domainLabel: "Verfolgte Website",
    statScore: "KI-Sichtbarkeits-Score",
    statGrade: "Note",
    statMentionRate: (days: number) => `Erwähnungsrate (${days} T.)`,
    statActivePrompts: "Aktive Prompts",
    auditAt: (date: string) => `Letztes Audit: ${date}`,
    enginesTitle: "Abdeckung pro Engine",
    enginesIntro: (days: number) =>
      `Anteil der Tracking-Läufe der letzten ${days} Tage, in denen ein Assistent Ihre Marke erwähnt hat.`,
    engineRuns: (n: number) => `${n} Lauf${n === 1 ? "" : "läufe"}`,
    noRuns:
      "Noch keine Tracking-Läufe in diesem Zeitfenster. Läufe folgen Ihrem Prompt-Zeitplan — Ergebnisse erscheinen hier nach dem nächsten Durchgang.",
    trendsNote:
      "Die Trends pro Prompt unten stammen aus denselben Tracking-Läufen wie auf der Seite KI-Sichtbarkeit.",
    alertsTitle: "Aktuelle Sichtbarkeits-Alerts",
    noAlerts:
      "Keine Sichtbarkeits-Alerts erfasst — keine verlorenen Empfehlungen oder Rangverluste erkannt.",
    promptsCta: "Prompt erstellen →",
    auditCta: "Audit starten →",
    emptyTitle: "Noch keine Markendaten",
    emptyBody:
      "Brand Radar liest die Daten, die Ihr Arbeitsbereich bereits erfasst: KI-Sichtbarkeits-Audits, verfolgte Prompts und Alerts. Starten Sie ein erstes Audit oder erstellen Sie einen Prompt, um diese Seite zu füllen.",
    loadFailed: "Markendaten konnten nicht geladen werden. Versuchen Sie es in einer Minute erneut.",
    loading: "Markendaten werden geladen…",
    severityLabels: { warning: "Warnung", critical: "Kritisch" } as Record<string, string>,
  },
};

// ─── /visibility/tools/bot-analytics ────────────────────────────────────────
const botAnalyticsEn = {
  postureNote:
    "This page shows access posture — what your site permits each crawler to do — based on your live robots.txt. It is not traffic data; Echorank360 does not collect crawler hit logs for your site yet.",
  checkedAt: (date: string) => `Checked ${date}`,
  staleNote: (date: string) =>
    `Live check unavailable — showing the robots.txt snapshot from your last audit (${date}).`,
  siteLabel: "Site",
  robotsPresent: "robots.txt found",
  robotsMissing: "No robots.txt — all crawlers allowed by default",
  sitemapFound: "Sitemap found",
  sitemapMissing: "No sitemap found",
  llmsFound: "llms.txt present",
  llmsMissing: "No llms.txt",
  statusOpen: "ALLOWED",
  statusBlocked: "BLOCKED",
  categoryLabels: {
    search: "Search index",
    ai_training: "AI training",
    ai_answers: "AI answers",
  } as Record<string, string>,
  botDesc: {
    Googlebot: "Feeds Google Search results — blocking it removes you from Google.",
    Bingbot: "Feeds Bing search results and Microsoft Copilot answers.",
    "Google-Extended": "Opt-out token for Google's Gemini model training.",
    GPTBot: "Collects pages for OpenAI model training.",
    "OAI-SearchBot": "Feeds ChatGPT Search — blocking it keeps you out of ChatGPT's cited answers.",
    ClaudeBot: "Collects pages for Anthropic's Claude models.",
    "anthropic-ai": "Legacy Anthropic crawler token; some sites still rule on it.",
    PerplexityBot: "Indexes pages for Perplexity's cited answers.",
    CCBot: "Builds the Common Crawl dataset, used to train many AI models.",
    Bytespider: "ByteDance's crawler for AI training data.",
    Amazonbot: "Feeds Alexa and Amazon AI answers.",
    "Applebot-Extended": "Opt-out token for Apple Intelligence model training.",
  } as Record<string, string>,
  emptyTitle: "No website configured",
  emptyBody:
    "Bot Analytics reads the site your workspace already tracks. Run a first AI-visibility audit so Echorank360 knows which site to check.",
  loadFailed: "Could not check crawler access. Try again in a minute.",
  loading: "Checking crawler access…",
};
export type BotAnalyticsCopy = typeof botAnalyticsEn;

export const BOT_ANALYTICS_COPY: Record<DashLocale, BotAnalyticsCopy> = {
  en: botAnalyticsEn,
  fr: {
    postureNote:
      "Cette page montre la posture d'accès — ce que votre site permet à chaque robot — d'après votre robots.txt en direct. Ce ne sont pas des données de trafic; Echorank360 ne collecte pas encore les journaux de visites des robots pour votre site.",
    checkedAt: (date: string) => `Vérifié le ${date}`,
    staleNote: (date: string) =>
      `Vérification en direct indisponible — affichage de l'instantané robots.txt de votre dernier audit (${date}).`,
    siteLabel: "Site",
    robotsPresent: "robots.txt trouvé",
    robotsMissing: "Aucun robots.txt — tous les robots sont permis par défaut",
    sitemapFound: "Plan de site trouvé",
    sitemapMissing: "Aucun plan de site trouvé",
    llmsFound: "llms.txt présent",
    llmsMissing: "Aucun llms.txt",
    statusOpen: "PERMIS",
    statusBlocked: "BLOQUÉ",
    categoryLabels: {
      search: "Index de recherche",
      ai_training: "Entraînement d'IA",
      ai_answers: "Réponses d'IA",
    } as Record<string, string>,
    botDesc: {
      Googlebot: "Alimente les résultats de recherche Google — le bloquer vous retire de Google.",
      Bingbot: "Alimente les résultats Bing et les réponses de Microsoft Copilot.",
      "Google-Extended": "Jeton de retrait pour l'entraînement du modèle Gemini de Google.",
      GPTBot: "Collecte des pages pour l'entraînement des modèles d'OpenAI.",
      "OAI-SearchBot": "Alimente ChatGPT Search — le bloquer vous exclut des réponses citées de ChatGPT.",
      ClaudeBot: "Collecte des pages pour les modèles Claude d'Anthropic.",
      "anthropic-ai": "Ancien jeton du robot d'Anthropic; certains sites le règlent encore.",
      PerplexityBot: "Indexe des pages pour les réponses citées de Perplexity.",
      CCBot: "Constitue l'ensemble de données Common Crawl, utilisé pour entraîner de nombreux modèles d'IA.",
      Bytespider: "Robot de ByteDance pour les données d'entraînement d'IA.",
      Amazonbot: "Alimente Alexa et les réponses d'IA d'Amazon.",
      "Applebot-Extended": "Jeton de retrait pour l'entraînement des modèles Apple Intelligence.",
    } as Record<string, string>,
    emptyTitle: "Aucun site web configuré",
    emptyBody:
      "L'analytique des robots lit le site que votre espace de travail suit déjà. Lancez un premier audit de visibilité IA pour qu'Echorank360 sache quel site vérifier.",
    loadFailed: "Impossible de vérifier l'accès des robots. Réessayez dans une minute.",
    loading: "Vérification de l'accès des robots…",
  },
  "de-CH": {
    postureNote:
      "Diese Seite zeigt die Zugriffslage — was Ihre Website jedem Crawler erlaubt — auf Basis Ihrer aktuellen robots.txt. Das sind keine Traffic-Daten; Echorank360 erfasst für Ihre Website noch keine Crawler-Zugriffsprotokolle.",
    checkedAt: (date: string) => `Geprüft am ${date}`,
    staleNote: (date: string) =>
      `Live-Prüfung nicht verfügbar — angezeigt wird der robots.txt-Schnappschuss aus Ihrem letzten Audit (${date}).`,
    siteLabel: "Website",
    robotsPresent: "robots.txt gefunden",
    robotsMissing: "Keine robots.txt — alle Crawler standardmässig erlaubt",
    sitemapFound: "Sitemap gefunden",
    sitemapMissing: "Keine Sitemap gefunden",
    llmsFound: "llms.txt vorhanden",
    llmsMissing: "Keine llms.txt",
    statusOpen: "ERLAUBT",
    statusBlocked: "BLOCKIERT",
    categoryLabels: {
      search: "Suchindex",
      ai_training: "KI-Training",
      ai_answers: "KI-Antworten",
    } as Record<string, string>,
    botDesc: {
      Googlebot: "Speist die Google-Suchergebnisse — eine Blockierung entfernt Sie aus Google.",
      Bingbot: "Speist Bing-Suchergebnisse und Microsoft-Copilot-Antworten.",
      "Google-Extended": "Opt-out-Token für das Training von Googles Gemini-Modellen.",
      GPTBot: "Sammelt Seiten für das Training der OpenAI-Modelle.",
      "OAI-SearchBot": "Speist ChatGPT Search — eine Blockierung hält Sie aus ChatGPTs zitierten Antworten heraus.",
      ClaudeBot: "Sammelt Seiten für Anthropics Claude-Modelle.",
      "anthropic-ai": "Älteres Anthropic-Crawler-Token; manche Websites regeln es noch.",
      PerplexityBot: "Indexiert Seiten für Perplexitys zitierte Antworten.",
      CCBot: "Erstellt den Common-Crawl-Datensatz, mit dem viele KI-Modelle trainiert werden.",
      Bytespider: "ByteDance-Crawler für KI-Trainingsdaten.",
      Amazonbot: "Speist Alexa und Amazons KI-Antworten.",
      "Applebot-Extended": "Opt-out-Token für das Training von Apple-Intelligence-Modellen.",
    } as Record<string, string>,
    emptyTitle: "Keine Website konfiguriert",
    emptyBody:
      "Bot-Analytics liest die Website, die Ihr Arbeitsbereich bereits verfolgt. Starten Sie ein erstes KI-Sichtbarkeits-Audit, damit Echorank360 weiss, welche Website zu prüfen ist.",
    loadFailed: "Crawler-Zugriff konnte nicht geprüft werden. Versuchen Sie es in einer Minute erneut.",
    loading: "Crawler-Zugriff wird geprüft…",
  },
};

// ─── /visibility/tools/api-access ───────────────────────────────────────────
const apiAccessEn = {
  intro:
    "Tenant API keys for the Echorank360 public API. Keys are shown once at creation and stored only as a hash — treat them like passwords.",
  createTitle: "Create an API key",
  labelLabel: "Label",
  labelPlaceholder: "CI pipeline",
  createButton: "Create key",
  creating: "Creating…",
  keyOnce: "Copy your key now — it is shown only once.",
  copy: "Copy",
  copied: "Copied",
  done: "Done",
  yourKeys: "Your keys",
  emptyKeys: "No keys yet. Create one above to call the API.",
  statusActive: "Active",
  statusRevoked: "Revoked",
  createdLabel: "Created",
  lastUsedLabel: "Last used",
  neverUsed: "never",
  revoke: "Revoke",
  revokeConfirm: "Revoke this key? Requests using it will fail immediately.",
  loading: "Loading…",
  loadFailed: "Failed to load keys",
  actionFailed: "Action failed",
  docsTitle: "API reference",
  docsIntro:
    "All endpoints are GET, authenticated with `Authorization: Bearer <key>`, scoped to your workspace, and rate-limited to 60 requests/minute per key. This is the complete v1 surface — nothing else exists yet.",
  docsEndpoints: {
    suggest:
      "Run the SEO keyword suggester against a URL. Params: url (required), depth=single|site.",
    audit: "Your workspace's most recent stored AI-visibility audit (404 if none yet).",
    summary:
      "Visibility summary: latest audit score, 30-day AI mention rate, per-engine coverage, recent alerts.",
  },
  mcpHint: "These same capabilities are exposed to AI assistants via the MCP Server tool.",
};
export type ApiAccessCopy = typeof apiAccessEn;

export const API_ACCESS_COPY: Record<DashLocale, ApiAccessCopy> = {
  en: apiAccessEn,
  fr: {
    intro:
      "Clés API de votre espace de travail pour l'API publique d'Echorank360. Les clés sont affichées une seule fois à la création et stockées uniquement sous forme de hachage — traitez-les comme des mots de passe.",
    createTitle: "Créer une clé API",
    labelLabel: "Étiquette",
    labelPlaceholder: "Pipeline CI",
    createButton: "Créer la clé",
    creating: "Création…",
    keyOnce: "Copiez votre clé maintenant — elle n'est affichée qu'une seule fois.",
    copy: "Copier",
    copied: "Copié",
    done: "Terminé",
    yourKeys: "Vos clés",
    emptyKeys: "Aucune clé pour l'instant. Créez-en une ci-dessus pour appeler l'API.",
    statusActive: "Active",
    statusRevoked: "Révoquée",
    createdLabel: "Créée",
    lastUsedLabel: "Dernière utilisation",
    neverUsed: "jamais",
    revoke: "Révoquer",
    revokeConfirm: "Révoquer cette clé? Les requêtes qui l'utilisent échoueront immédiatement.",
    loading: "Chargement…",
    loadFailed: "Échec du chargement des clés",
    actionFailed: "Échec de l'action",
    docsTitle: "Référence de l'API",
    docsIntro:
      "Tous les points de terminaison sont en GET, authentifiés avec `Authorization: Bearer <clé>`, limités à votre espace de travail et à 60 requêtes/minute par clé. C'est la surface v1 complète — rien d'autre n'existe encore.",
    docsEndpoints: {
      suggest:
        "Lance le suggesteur de mots-clés SEO sur une URL. Paramètres : url (requis), depth=single|site.",
      audit: "Le plus récent audit de visibilité IA stocké de votre espace de travail (404 s'il n'y en a pas encore).",
      summary:
        "Résumé de visibilité : score du dernier audit, taux de mention IA sur 30 jours, couverture par moteur, alertes récentes.",
    },
    mcpHint: "Ces mêmes capacités sont exposées aux assistants IA via l'outil Serveur MCP.",
  },
  "de-CH": {
    intro:
      "API-Schlüssel Ihres Arbeitsbereichs für die öffentliche Echorank360-API. Schlüssel werden nur einmal bei der Erstellung angezeigt und ausschliesslich als Hash gespeichert — behandeln Sie sie wie Passwörter.",
    createTitle: "API-Schlüssel erstellen",
    labelLabel: "Bezeichnung",
    labelPlaceholder: "CI-Pipeline",
    createButton: "Schlüssel erstellen",
    creating: "Wird erstellt…",
    keyOnce: "Kopieren Sie Ihren Schlüssel jetzt — er wird nur einmal angezeigt.",
    copy: "Kopieren",
    copied: "Kopiert",
    done: "Fertig",
    yourKeys: "Ihre Schlüssel",
    emptyKeys: "Noch keine Schlüssel. Erstellen Sie oben einen, um die API aufzurufen.",
    statusActive: "Aktiv",
    statusRevoked: "Widerrufen",
    createdLabel: "Erstellt",
    lastUsedLabel: "Zuletzt verwendet",
    neverUsed: "nie",
    revoke: "Widerrufen",
    revokeConfirm: "Diesen Schlüssel widerrufen? Anfragen damit schlagen sofort fehl.",
    loading: "Wird geladen…",
    loadFailed: "Schlüssel konnten nicht geladen werden",
    actionFailed: "Aktion fehlgeschlagen",
    docsTitle: "API-Referenz",
    docsIntro:
      "Alle Endpunkte sind GET, authentifiziert mit `Authorization: Bearer <Schlüssel>`, auf Ihren Arbeitsbereich beschränkt und auf 60 Anfragen/Minute pro Schlüssel limitiert. Das ist die vollständige v1-Oberfläche — mehr existiert noch nicht.",
    docsEndpoints: {
      suggest:
        "Führt den SEO-Keyword-Vorschlag für eine URL aus. Parameter: url (erforderlich), depth=single|site.",
      audit: "Das zuletzt gespeicherte KI-Sichtbarkeits-Audit Ihres Arbeitsbereichs (404, falls noch keines existiert).",
      summary:
        "Sichtbarkeits-Zusammenfassung: letzter Audit-Score, KI-Erwähnungsrate über 30 Tage, Abdeckung pro Engine, aktuelle Alerts.",
    },
    mcpHint: "Dieselben Fähigkeiten stehen KI-Assistenten über das MCP-Server-Tool zur Verfügung.",
  },
};

// ─── /visibility/tools/mcp-server ───────────────────────────────────────────
const mcpServerEn = {
  intro:
    "Echorank360 runs a Model Context Protocol server (Streamable HTTP). Connect Claude or any MCP client and it can query your keywords, audits, and visibility data directly — authenticated with your tenant API key.",
  endpointLabel: "Server endpoint",
  toolsTitle: "Available tools",
  toolDescs: {
    suggest_keywords: "Run the SEO keyword suggester against any URL.",
    get_latest_audit: "Fetch your latest stored AI-visibility audit.",
    get_visibility_summary: "Fetch your visibility summary (score, mention rate, alerts).",
  } as Record<string, string>,
  setupTitle: "Connect a client",
  step1: "Create an API key in the API access tool, then substitute it for the placeholder below.",
  step1Link: "Open API access →",
  step2: "Claude Code — one command:",
  step3: "Claude Desktop — Settings → Connectors → Add custom connector, or via mcp-remote:",
  keysActive: (n: number) => `${n} active key${n === 1 ? "" : "s"} in this workspace`,
  noKeys: "No active API keys yet — create one first.",
  copy: "Copy",
  copied: "Copied",
  securityNote:
    "The server is read-only, scoped to your workspace, and rate-limited per key. Revoking the key disconnects every client using it.",
};
export type McpServerCopy = typeof mcpServerEn;

export const MCP_SERVER_COPY: Record<DashLocale, McpServerCopy> = {
  en: mcpServerEn,
  fr: {
    intro:
      "Echorank360 exploite un serveur Model Context Protocol (Streamable HTTP). Connectez Claude ou tout client MCP pour interroger directement vos mots-clés, audits et données de visibilité — avec votre clé API comme authentification.",
    endpointLabel: "Point de terminaison du serveur",
    toolsTitle: "Outils offerts",
    toolDescs: {
      suggest_keywords: "Lancer le suggesteur de mots-clés SEO sur n'importe quelle URL.",
      get_latest_audit: "Récupérer votre plus récent audit de visibilité IA stocké.",
      get_visibility_summary: "Récupérer votre résumé de visibilité (score, taux de mention, alertes).",
    } as Record<string, string>,
    setupTitle: "Connecter un client",
    step1: "Créez une clé API dans l'outil Accès API, puis remplacez l'espace réservé ci-dessous.",
    step1Link: "Ouvrir l'accès API →",
    step2: "Claude Code — une seule commande :",
    step3: "Claude Desktop — Réglages → Connecteurs → Ajouter un connecteur personnalisé, ou via mcp-remote :",
    keysActive: (n: number) => `${n} clé${n === 1 ? "" : "s"} active${n === 1 ? "" : "s"} dans cet espace de travail`,
    noKeys: "Aucune clé API active pour l'instant — créez-en une d'abord.",
    copy: "Copier",
    copied: "Copié",
    securityNote:
      "Le serveur est en lecture seule, limité à votre espace de travail et à un débit par clé. Révoquer la clé déconnecte tous les clients qui l'utilisent.",
  },
  "de-CH": {
    intro:
      "Echorank360 betreibt einen Model-Context-Protocol-Server (Streamable HTTP). Verbinden Sie Claude oder einen beliebigen MCP-Client, um Ihre Keywords, Audits und Sichtbarkeitsdaten direkt abzufragen — authentifiziert mit Ihrem API-Schlüssel.",
    endpointLabel: "Server-Endpunkt",
    toolsTitle: "Verfügbare Tools",
    toolDescs: {
      suggest_keywords: "Den SEO-Keyword-Vorschlag für eine beliebige URL ausführen.",
      get_latest_audit: "Ihr zuletzt gespeichertes KI-Sichtbarkeits-Audit abrufen.",
      get_visibility_summary: "Ihre Sichtbarkeits-Zusammenfassung abrufen (Score, Erwähnungsrate, Alerts).",
    } as Record<string, string>,
    setupTitle: "Client verbinden",
    step1: "Erstellen Sie im Tool API-Zugriff einen API-Schlüssel und ersetzen Sie damit den Platzhalter unten.",
    step1Link: "API-Zugriff öffnen →",
    step2: "Claude Code — ein Befehl:",
    step3: "Claude Desktop — Einstellungen → Connectors → Eigenen Connector hinzufügen, oder via mcp-remote:",
    keysActive: (n: number) => `${n} aktive${n === 1 ? "r" : ""} Schlüssel in diesem Arbeitsbereich`,
    noKeys: "Noch keine aktiven API-Schlüssel — erstellen Sie zuerst einen.",
    copy: "Kopieren",
    copied: "Kopiert",
    securityNote:
      "Der Server ist schreibgeschützt, auf Ihren Arbeitsbereich beschränkt und pro Schlüssel ratenlimitiert. Das Widerrufen des Schlüssels trennt alle Clients, die ihn verwenden.",
  },
};

// ─── /visibility/tools/gsc-insights ─────────────────────────────────────────
const gscEn = {
  connectTitle: "Connect Google Search Console",
  connectBody:
    "Connecting lets Echorank360 read your Search Console performance (queries, clicks, impressions, positions) with a read-only scope. Data syncs nightly and powers this page and the upcoming Rank Tracker.",
  connectCta: "Connect Google Search Console",
  reconnect: "Reconnect",
  reauthBanner:
    "Google access has expired or was revoked. Reconnect to resume syncing — your stored history is unaffected.",
  connectedBanner: "Google Search Console connected.",
  pickTitle: "Choose a property",
  pickBody: "Your Google account has several Search Console properties. Pick the one for this workspace.",
  pickButton: "Use this property",
  picking: "Saving…",
  propertyLabel: "Property",
  lastSync: (d: string) => `Last sync: ${d}`,
  neverSynced: "Not synced yet",
  syncNow: "Sync now",
  syncing: "Syncing…",
  syncDone: (n: number) => `Synced ${n} query rows.`,
  rateLimited: "Sync limit reached (3/hour). Try again later.",
  disconnect: "Disconnect",
  disconnectConfirm:
    "Disconnect Google Search Console? The stored token is deleted; synced history is kept.",
  statClicks: "Clicks (28d)",
  statImpressions: "Impressions (28d)",
  statCtr: "Avg CTR (28d)",
  statPosition: "Avg position (28d)",
  chartTitle: "Clicks & impressions — last 28 days",
  clicksLegend: "Clicks",
  impressionsLegend: "Impressions",
  topQueriesTitle: "Top queries",
  topPagesTitle: "Top pages",
  colQuery: "Query",
  colPage: "Page",
  colClicks: "Clicks",
  colImpressions: "Impr.",
  colCtr: "CTR",
  colPosition: "Pos.",
  emptyData:
    "Connected, but Search Console returned no rows for this period yet. New properties can take a few days to accumulate data.",
  loading: "Loading Search Console data…",
  loadFailed: "Could not load Search Console data. Try again in a minute.",
  errors: {
    denied: "Google access was declined. Connect again when ready.",
    bad_state: "The sign-in link expired or was invalid. Start the connection again from this page.",
    no_refresh_token: "Google did not grant offline access. Try connecting again.",
    no_properties: "This Google account has no verified Search Console properties.",
    exchange_failed: "Connecting to Google failed. Try again in a minute.",
  } as Record<string, string>,
};
export type GscCopy = typeof gscEn;

export const GSC_COPY: Record<DashLocale, GscCopy> = {
  en: gscEn,
  fr: {
    connectTitle: "Connecter Google Search Console",
    connectBody:
      "La connexion permet à Echorank360 de lire votre performance Search Console (requêtes, clics, impressions, positions) avec une portée en lecture seule. Les données se synchronisent chaque nuit et alimentent cette page ainsi que le futur suivi des positions.",
    connectCta: "Connecter Google Search Console",
    reconnect: "Reconnecter",
    reauthBanner:
      "L'accès Google a expiré ou a été révoqué. Reconnectez-vous pour reprendre la synchronisation — votre historique stocké est intact.",
    connectedBanner: "Google Search Console connectée.",
    pickTitle: "Choisir une propriété",
    pickBody: "Votre compte Google possède plusieurs propriétés Search Console. Choisissez celle de cet espace de travail.",
    pickButton: "Utiliser cette propriété",
    picking: "Enregistrement…",
    propertyLabel: "Propriété",
    lastSync: (d: string) => `Dernière synchronisation : ${d}`,
    neverSynced: "Pas encore synchronisé",
    syncNow: "Synchroniser maintenant",
    syncing: "Synchronisation…",
    syncDone: (n: number) => `${n} lignes de requêtes synchronisées.`,
    rateLimited: "Limite de synchronisation atteinte (3/heure). Réessayez plus tard.",
    disconnect: "Déconnecter",
    disconnectConfirm:
      "Déconnecter Google Search Console? Le jeton stocké est supprimé; l'historique synchronisé est conservé.",
    statClicks: "Clics (28 j)",
    statImpressions: "Impressions (28 j)",
    statCtr: "CTR moyen (28 j)",
    statPosition: "Position moyenne (28 j)",
    chartTitle: "Clics et impressions — 28 derniers jours",
    clicksLegend: "Clics",
    impressionsLegend: "Impressions",
    topQueriesTitle: "Meilleures requêtes",
    topPagesTitle: "Meilleures pages",
    colQuery: "Requête",
    colPage: "Page",
    colClicks: "Clics",
    colImpressions: "Impr.",
    colCtr: "CTR",
    colPosition: "Pos.",
    emptyData:
      "Connectée, mais Search Console n'a encore retourné aucune ligne pour cette période. Les nouvelles propriétés peuvent prendre quelques jours à accumuler des données.",
    loading: "Chargement des données Search Console…",
    loadFailed: "Impossible de charger les données Search Console. Réessayez dans une minute.",
    errors: {
      denied: "L'accès Google a été refusé. Reconnectez-vous quand vous serez prêt.",
      bad_state: "Le lien de connexion a expiré ou est invalide. Relancez la connexion depuis cette page.",
      no_refresh_token: "Google n'a pas accordé l'accès hors ligne. Essayez de vous reconnecter.",
      no_properties: "Ce compte Google n'a aucune propriété Search Console vérifiée.",
      exchange_failed: "La connexion à Google a échoué. Réessayez dans une minute.",
    } as Record<string, string>,
  },
  "de-CH": {
    connectTitle: "Google Search Console verbinden",
    connectBody:
      "Die Verbindung erlaubt Echorank360, Ihre Search-Console-Leistung (Suchanfragen, Klicks, Impressionen, Positionen) mit reinem Lesezugriff auszulesen. Die Daten werden nächtlich synchronisiert und speisen diese Seite sowie den kommenden Rank Tracker.",
    connectCta: "Google Search Console verbinden",
    reconnect: "Erneut verbinden",
    reauthBanner:
      "Der Google-Zugriff ist abgelaufen oder wurde widerrufen. Verbinden Sie sich erneut, um die Synchronisierung fortzusetzen — Ihr gespeicherter Verlauf bleibt erhalten.",
    connectedBanner: "Google Search Console verbunden.",
    pickTitle: "Property auswählen",
    pickBody: "Ihr Google-Konto hat mehrere Search-Console-Properties. Wählen Sie die für diesen Arbeitsbereich.",
    pickButton: "Diese Property verwenden",
    picking: "Wird gespeichert…",
    propertyLabel: "Property",
    lastSync: (d: string) => `Letzte Synchronisierung: ${d}`,
    neverSynced: "Noch nicht synchronisiert",
    syncNow: "Jetzt synchronisieren",
    syncing: "Wird synchronisiert…",
    syncDone: (n: number) => `${n} Suchanfragen-Zeilen synchronisiert.`,
    rateLimited: "Synchronisierungslimit erreicht (3/Stunde). Versuchen Sie es später erneut.",
    disconnect: "Trennen",
    disconnectConfirm:
      "Google Search Console trennen? Das gespeicherte Token wird gelöscht; der synchronisierte Verlauf bleibt erhalten.",
    statClicks: "Klicks (28 T.)",
    statImpressions: "Impressionen (28 T.)",
    statCtr: "Ø CTR (28 T.)",
    statPosition: "Ø Position (28 T.)",
    chartTitle: "Klicks & Impressionen — letzte 28 Tage",
    clicksLegend: "Klicks",
    impressionsLegend: "Impressionen",
    topQueriesTitle: "Top-Suchanfragen",
    topPagesTitle: "Top-Seiten",
    colQuery: "Suchanfrage",
    colPage: "Seite",
    colClicks: "Klicks",
    colImpressions: "Impr.",
    colCtr: "CTR",
    colPosition: "Pos.",
    emptyData:
      "Verbunden, aber Search Console hat für diesen Zeitraum noch keine Zeilen geliefert. Neue Properties brauchen einige Tage, um Daten zu sammeln.",
    loading: "Search-Console-Daten werden geladen…",
    loadFailed: "Search-Console-Daten konnten nicht geladen werden. Versuchen Sie es in einer Minute erneut.",
    errors: {
      denied: "Der Google-Zugriff wurde abgelehnt. Verbinden Sie sich erneut, wenn Sie bereit sind.",
      bad_state: "Der Anmeldelink ist abgelaufen oder ungültig. Starten Sie die Verbindung erneut von dieser Seite.",
      no_refresh_token: "Google hat keinen Offline-Zugriff gewährt. Versuchen Sie die Verbindung erneut.",
      no_properties: "Dieses Google-Konto hat keine bestätigten Search-Console-Properties.",
      exchange_failed: "Die Verbindung zu Google ist fehlgeschlagen. Versuchen Sie es in einer Minute erneut.",
    } as Record<string, string>,
  },
};

// ─── SERP Checker ───────────────────────────────────────────────────────────
// Async tool: the form queues a standard-queue task and the card polls until
// the worker fills it in. Copy is written for that wait — "Results take 1–5
// minutes." is the promise the queue actually keeps.
const serpCheckerEn = {
  formTitle: "Check a SERP",
  formIntro:
    "See the top 100 organic results Google returns for a keyword — by location, language, and device.",
  keywordLabel: "Keyword",
  keywordPlaceholder: "plumber toronto",
  locationLabel: "Location",
  languageLabel: "Language",
  deviceLabel: "Device",
  deviceDesktop: "Desktop",
  deviceMobile: "Mobile",
  submit: "Run check",
  submitting: "Queueing…",
  checkingTitle: "Checking…",
  checkingBody: "Results take 1–5 minutes. You can leave this page — the check keeps running.",
  cachedNote: "Shown from a matching check run in the last 24 hours. No new check was used.",
  resultsFor: (keyword: string) => `Results for “${keyword}”`,
  resultCount: (n: number) => (n === 1 ? "1 organic result" : `${n} organic results`),
  featuresTitle: "SERP features",
  noFeatures: "No extra SERP features on this page.",
  colPosition: "#",
  colTitle: "Title",
  colUrl: "URL",
  colDomain: "Domain",
  untitled: "(no title)",
  emptyResults: "Google returned no organic results for this query.",
  failedTitle: "This check did not finish",
  failedBody: "Something went wrong upstream. Run the check again — nothing was counted against your monthly limit for a failed check.",
  historyTitle: "Recent checks",
  historyEmpty: "No checks yet. Run your first one above.",
  colKeyword: "Keyword",
  colDevice: "Device",
  colStatus: "Status",
  colResults: "Results",
  colWhen: "Run",
  statusQueued: "Checking",
  statusCompleted: "Done",
  statusFailed: "Failed",
  view: "View",
  usage: (used: number, limit: number) => `${used} of ${limit} checks used this month`,
  quotaTitle: "Monthly check limit reached",
  quotaBody: (limit: number) =>
    `Your plan includes ${limit} SERP checks per month. Upgrade to run more, or wait for the counter to reset next month.`,
  quotaCta: "See plans",
  spend: (usd: string) => `SERP data cost for this workspace: $${usd} USD`,
  submitFailed: "Could not queue the check. Try again in a minute.",
  loadFailed: "Could not load your checks. Try again in a minute.",
  locationLabels: {
    2124: "Canada",
    2840: "United States",
    2826: "United Kingdom",
    2250: "France",
    2276: "Germany",
    2756: "Switzerland",
    2036: "Australia",
  } satisfies Record<SerpLocationCode, string>,
  languageLabels: {
    en: "English",
    fr: "French",
    de: "German",
    es: "Spanish",
  } satisfies Record<SerpLanguageCode, string>,
};
export type SerpCheckerCopy = typeof serpCheckerEn;

export const SERP_CHECKER_COPY: Record<DashLocale, SerpCheckerCopy> = {
  en: serpCheckerEn,
  fr: {
    formTitle: "Vérifier une SERP",
    formIntro:
      "Voyez les 100 premiers résultats organiques que Google retourne pour un mot-clé — par lieu, langue et appareil.",
    keywordLabel: "Mot-clé",
    keywordPlaceholder: "plombier montréal",
    locationLabel: "Lieu",
    languageLabel: "Langue",
    deviceLabel: "Appareil",
    deviceDesktop: "Ordinateur",
    deviceMobile: "Mobile",
    submit: "Lancer la vérification",
    submitting: "Mise en file…",
    checkingTitle: "Vérification en cours…",
    checkingBody:
      "Les résultats prennent de 1 à 5 minutes. Vous pouvez quitter cette page — la vérification continue.",
    cachedNote:
      "Affiché à partir d'une vérification identique des dernières 24 heures. Aucune nouvelle vérification n'a été utilisée.",
    resultsFor: (keyword: string) => `Résultats pour « ${keyword} »`,
    resultCount: (n: number) => (n === 1 ? "1 résultat organique" : `${n} résultats organiques`),
    featuresTitle: "Fonctionnalités SERP",
    noFeatures: "Aucune fonctionnalité SERP supplémentaire sur cette page.",
    colPosition: "No",
    colTitle: "Titre",
    colUrl: "URL",
    colDomain: "Domaine",
    untitled: "(sans titre)",
    emptyResults: "Google n'a retourné aucun résultat organique pour cette requête.",
    failedTitle: "Cette vérification ne s'est pas terminée",
    failedBody:
      "Un problème est survenu en amont. Relancez la vérification — une vérification échouée n'est pas comptée dans votre limite mensuelle.",
    historyTitle: "Vérifications récentes",
    historyEmpty: "Aucune vérification pour l'instant. Lancez la première ci-dessus.",
    colKeyword: "Mot-clé",
    colDevice: "Appareil",
    colStatus: "Statut",
    colResults: "Résultats",
    colWhen: "Lancée",
    statusQueued: "En cours",
    statusCompleted: "Terminée",
    statusFailed: "Échouée",
    view: "Voir",
    usage: (used: number, limit: number) =>
      `${used} vérifications sur ${limit} utilisées ce mois-ci`,
    quotaTitle: "Limite mensuelle de vérifications atteinte",
    quotaBody: (limit: number) =>
      `Votre forfait comprend ${limit} vérifications SERP par mois. Passez à un forfait supérieur pour en faire plus, ou attendez la remise à zéro le mois prochain.`,
    quotaCta: "Voir les forfaits",
    spend: (usd: string) => `Coût des données SERP pour cet espace de travail : ${usd} $ US`,
    submitFailed: "Impossible de mettre la vérification en file. Réessayez dans une minute.",
    loadFailed: "Impossible de charger vos vérifications. Réessayez dans une minute.",
    locationLabels: {
      2124: "Canada",
      2840: "États-Unis",
      2826: "Royaume-Uni",
      2250: "France",
      2276: "Allemagne",
      2756: "Suisse",
      2036: "Australie",
    },
    languageLabels: {
      en: "Anglais",
      fr: "Français",
      de: "Allemand",
      es: "Espagnol",
    },
  },
  "de-CH": {
    formTitle: "SERP prüfen",
    formIntro:
      "Sehen Sie die Top-100-Organik-Ergebnisse, die Google für ein Keyword liefert — nach Standort, Sprache und Gerät.",
    keywordLabel: "Keyword",
    keywordPlaceholder: "sanitär zürich",
    locationLabel: "Standort",
    languageLabel: "Sprache",
    deviceLabel: "Gerät",
    deviceDesktop: "Desktop",
    deviceMobile: "Mobil",
    submit: "Prüfung starten",
    submitting: "Wird eingereiht…",
    checkingTitle: "Wird geprüft…",
    checkingBody:
      "Ergebnisse dauern 1–5 Minuten. Sie können die Seite verlassen — die Prüfung läuft weiter.",
    cachedNote:
      "Aus einer gleichen Prüfung der letzten 24 Stunden angezeigt. Es wurde keine neue Prüfung verbraucht.",
    resultsFor: (keyword: string) => `Ergebnisse für «${keyword}»`,
    resultCount: (n: number) => (n === 1 ? "1 organisches Ergebnis" : `${n} organische Ergebnisse`),
    featuresTitle: "SERP-Funktionen",
    noFeatures: "Keine zusätzlichen SERP-Funktionen auf dieser Seite.",
    colPosition: "Nr.",
    colTitle: "Titel",
    colUrl: "URL",
    colDomain: "Domain",
    untitled: "(ohne Titel)",
    emptyResults: "Google hat für diese Anfrage keine organischen Ergebnisse geliefert.",
    failedTitle: "Diese Prüfung wurde nicht abgeschlossen",
    failedBody:
      "Vorgelagert ist etwas schiefgelaufen. Starten Sie die Prüfung erneut — eine fehlgeschlagene Prüfung zählt nicht gegen Ihr Monatslimit.",
    historyTitle: "Letzte Prüfungen",
    historyEmpty: "Noch keine Prüfungen. Starten Sie oben Ihre erste.",
    colKeyword: "Keyword",
    colDevice: "Gerät",
    colStatus: "Status",
    colResults: "Ergebnisse",
    colWhen: "Gestartet",
    statusQueued: "Läuft",
    statusCompleted: "Fertig",
    statusFailed: "Fehlgeschlagen",
    view: "Ansehen",
    usage: (used: number, limit: number) =>
      `${used} von ${limit} Prüfungen diesen Monat verwendet`,
    quotaTitle: "Monatliches Prüfungslimit erreicht",
    quotaBody: (limit: number) =>
      `Ihr Plan enthält ${limit} SERP-Prüfungen pro Monat. Wechseln Sie den Plan für mehr, oder warten Sie auf die Rücksetzung im nächsten Monat.`,
    quotaCta: "Pläne ansehen",
    spend: (usd: string) => `SERP-Datenkosten für diesen Arbeitsbereich: ${usd} USD`,
    submitFailed: "Die Prüfung konnte nicht eingereiht werden. Versuchen Sie es in einer Minute erneut.",
    loadFailed: "Ihre Prüfungen konnten nicht geladen werden. Versuchen Sie es in einer Minute erneut.",
    locationLabels: {
      2124: "Kanada",
      2840: "Vereinigte Staaten",
      2826: "Vereinigtes Königreich",
      2250: "Frankreich",
      2276: "Deutschland",
      2756: "Schweiz",
      2036: "Australien",
    },
    languageLabels: {
      en: "Englisch",
      fr: "Französisch",
      de: "Deutsch",
      es: "Spanisch",
    },
  },
};

// ─── Site Explorer ──────────────────────────────────────────────────────────
// Synchronous tool: one submit runs four live upstream calls and the four
// cards fill in together (~3-5 s). Copy is written for that — a short wait, a
// cache note that explains why a re-run is unavailable, and per-section
// failure text, because one section can be down while the other three render.
const siteExplorerEn = {
  formTitle: "Analyze a domain",
  formIntro:
    "Organic traffic, top keywords, competitors, and the backlink profile for any domain — one analysis, four data sets.",
  domainLabel: "Domain",
  domainPlaceholder: "example.com",
  domainHint: "Paste any URL — the scheme, www., and path are stripped.",
  invalidDomain: "Enter a domain like example.com",
  analyzing: "Analyzing…",
  analyzingTitle: "Analyzing the domain…",
  // Measured 8-12 s live for a large domain (Jul 2026), not "a few seconds".
  analyzingBody: "Four data sets are collected in sequence — usually 10 to 15 seconds.",
  analyzedAgo: (ago: string) => `Analyzed ${ago}`,
  reRunIn: (hours: number) =>
    hours <= 1 ? "Re-run available in under an hour" : `Re-run available in ${hours}h`,
  cachedIntro: "Showing your saved analysis — no new data was pulled.",
  partialNote: "Some sections did not load. Everything else below is complete.",

  // ── Overview card ──
  overviewTitle: "Overview",
  metricTraffic: "Est. organic traffic",
  metricTrafficUnit: "visits / month",
  metricKeywords: "Organic keywords",
  metricKeywordsUnit: "in the top 100",
  metricTrafficValue: "Traffic value",
  metricTrafficValueUnit: "per month, if paid",
  distributionTitle: "Position spread",
  distributionLabels: {
    pos1: "#1",
    pos2_3: "#2–3",
    pos4_10: "#4–10",
    pos11_20: "#11–20",
    pos21_100: "#21–100",
  },
  noDistribution: "This domain does not rank in the top 100 for any tracked keyword.",

  // ── Keywords card ──
  keywordsTitle: "Top keywords",
  keywordsSubtitle: (shown: number, total: number) =>
    `Showing ${shown} of ${total.toLocaleString("en-US")} organic keywords`,
  sortHint: "Click a column header to sort.",
  colKeyword: "Keyword",
  colPosition: "Pos.",
  colVolume: "Volume",
  colEtv: "Traffic",
  colUrl: "Ranking URL",
  emptyKeywords: "This domain does not rank in the top 100 for any keyword in this market.",

  // ── Competitors card ──
  competitorsTitle: "Competitors",
  competitorsSubtitle: "Domains competing for the same keywords.",
  colDomain: "Domain",
  colIntersections: "Shared keywords",
  colAvgPosition: "Avg. position",
  emptyCompetitors: "No competing domains were found for this market.",

  // ── Backlinks card ──
  backlinksTitle: "Backlinks",
  metricBacklinks: "Backlinks",
  metricReferringDomains: "Referring domains",
  metricRank: "Domain rank",
  metricRankUnit: "0–1000",
  metricBroken: "Broken backlinks",
  metricDofollow: "Dofollow domains",
  dofollowRatio: (percent: string) =>
    `${percent}% of referring domains link without rel=nofollow`,
  noDofollowData: "No referring domains were reported for this domain.",

  // ── Per-section failure ──
  sectionFailedTitle: "Couldn't load this section",
  sectionFailedBody: "The data provider did not return this part of the analysis. Run the analysis again later — the other sections are unaffected.",

  // ── History ──
  historyTitle: "Recent analyses",
  historyEmpty: "No analyses yet. Analyze your first domain above.",
  colStatus: "Status",
  colCost: "Cost",
  colWhen: "Run",
  statusCompleted: "Complete",
  statusPartial: "Partial",
  view: "View",

  // ── Quota / errors ──
  usage: (used: number, limit: number) => `${used} of ${limit} analyses used this month`,
  remaining: (left: number) =>
    left === 1 ? "1 analysis left this month" : `${left} analyses left this month`,
  quotaTitle: "Monthly analysis limit reached",
  quotaBody: (limit: number) =>
    `Your plan includes ${limit} site analyses per month. Upgrade to run more, or wait for the counter to reset next month.`,
  quotaCta: "See plans",
  spend: (usd: string) => `Site data cost for this workspace: $${usd} USD`,
  submitFailed: "Could not analyze that domain. Try again in a minute.",
  loadFailed: "Could not load your analyses. Try again in a minute.",
};
export type SiteExplorerCopy = typeof siteExplorerEn;

export const SITE_EXPLORER_COPY: Record<DashLocale, SiteExplorerCopy> = {
  en: siteExplorerEn,
  fr: {
    formTitle: "Analyser un domaine",
    formIntro:
      "Trafic organique, meilleurs mots-clés, concurrents et profil de liens pour n'importe quel domaine — une analyse, quatre jeux de données.",
    domainLabel: "Domaine",
    domainPlaceholder: "exemple.com",
    domainHint: "Collez n'importe quelle URL — le protocole, le www. et le chemin sont retirés.",
    invalidDomain: "Entrez un domaine comme exemple.com",
    analyzing: "Analyse en cours…",
    analyzingTitle: "Analyse du domaine…",
    analyzingBody:
      "Quatre jeux de données sont collectés à la suite — habituellement de 10 à 15 secondes.",
    analyzedAgo: (ago: string) => `Analysé ${ago}`,
    reRunIn: (hours: number) =>
      hours <= 1
        ? "Relance possible dans moins d'une heure"
        : `Relance possible dans ${hours} h`,
    cachedIntro: "Affichage de votre analyse enregistrée — aucune nouvelle donnée n'a été tirée.",
    partialNote: "Certaines sections ne se sont pas chargées. Tout le reste ci-dessous est complet.",

    overviewTitle: "Aperçu",
    metricTraffic: "Trafic organique estimé",
    metricTrafficUnit: "visites / mois",
    metricKeywords: "Mots-clés organiques",
    metricKeywordsUnit: "dans le top 100",
    metricTrafficValue: "Valeur du trafic",
    metricTrafficValueUnit: "par mois, en équivalent payant",
    distributionTitle: "Répartition des positions",
    distributionLabels: {
      pos1: "no 1",
      pos2_3: "no 2–3",
      pos4_10: "no 4–10",
      pos11_20: "no 11–20",
      pos21_100: "no 21–100",
    },
    noDistribution:
      "Ce domaine ne se classe dans le top 100 pour aucun mot-clé suivi.",

    keywordsTitle: "Meilleurs mots-clés",
    keywordsSubtitle: (shown: number, total: number) =>
      `Affichage de ${shown} mots-clés organiques sur ${total.toLocaleString("fr-CA")}`,
    sortHint: "Cliquez sur un en-tête de colonne pour trier.",
    colKeyword: "Mot-clé",
    colPosition: "Pos.",
    colVolume: "Volume",
    colEtv: "Trafic",
    colUrl: "URL classée",
    emptyKeywords:
      "Ce domaine ne se classe dans le top 100 pour aucun mot-clé de ce marché.",

    competitorsTitle: "Concurrents",
    competitorsSubtitle: "Domaines en concurrence sur les mêmes mots-clés.",
    colDomain: "Domaine",
    colIntersections: "Mots-clés partagés",
    colAvgPosition: "Position moyenne",
    emptyCompetitors: "Aucun domaine concurrent trouvé pour ce marché.",

    backlinksTitle: "Liens entrants",
    metricBacklinks: "Liens entrants",
    metricReferringDomains: "Domaines référents",
    metricRank: "Rang du domaine",
    metricRankUnit: "0–1000",
    metricBroken: "Liens brisés",
    metricDofollow: "Domaines dofollow",
    dofollowRatio: (percent: string) =>
      `${percent} % des domaines référents pointent sans rel=nofollow`,
    noDofollowData: "Aucun domaine référent n'a été rapporté pour ce domaine.",

    sectionFailedTitle: "Impossible de charger cette section",
    sectionFailedBody:
      "Le fournisseur de données n'a pas retourné cette partie de l'analyse. Relancez l'analyse plus tard — les autres sections ne sont pas touchées.",

    historyTitle: "Analyses récentes",
    historyEmpty: "Aucune analyse pour l'instant. Analysez votre premier domaine ci-dessus.",
    colStatus: "Statut",
    colCost: "Coût",
    colWhen: "Lancée",
    statusCompleted: "Complète",
    statusPartial: "Partielle",
    view: "Voir",

    usage: (used: number, limit: number) => `${used} analyses sur ${limit} utilisées ce mois-ci`,
    remaining: (left: number) =>
      left === 1 ? "1 analyse restante ce mois-ci" : `${left} analyses restantes ce mois-ci`,
    quotaTitle: "Limite mensuelle d'analyses atteinte",
    quotaBody: (limit: number) =>
      `Votre forfait comprend ${limit} analyses de site par mois. Passez à un forfait supérieur pour en faire plus, ou attendez la remise à zéro le mois prochain.`,
    quotaCta: "Voir les forfaits",
    spend: (usd: string) => `Coût des données de site pour cet espace de travail : ${usd} $ US`,
    submitFailed: "Impossible d'analyser ce domaine. Réessayez dans une minute.",
    loadFailed: "Impossible de charger vos analyses. Réessayez dans une minute.",
  },
  "de-CH": {
    formTitle: "Domain analysieren",
    formIntro:
      "Organischer Traffic, Top-Keywords, Wettbewerber und Backlink-Profil für jede Domain — eine Analyse, vier Datensätze.",
    domainLabel: "Domain",
    domainPlaceholder: "beispiel.ch",
    domainHint: "Fügen Sie eine beliebige URL ein — Protokoll, www. und Pfad werden entfernt.",
    invalidDomain: "Geben Sie eine Domain wie beispiel.ch ein",
    analyzing: "Wird analysiert…",
    analyzingTitle: "Domain wird analysiert…",
    analyzingBody:
      "Vier Datensätze werden nacheinander erhoben — normalerweise 10 bis 15 Sekunden.",
    analyzedAgo: (ago: string) => `Analysiert ${ago}`,
    reRunIn: (hours: number) =>
      hours <= 1
        ? "Neue Analyse in weniger als einer Stunde möglich"
        : `Neue Analyse in ${hours} Std. möglich`,
    cachedIntro:
      "Ihre gespeicherte Analyse wird angezeigt — es wurden keine neuen Daten abgerufen.",
    partialNote:
      "Einige Abschnitte konnten nicht geladen werden. Alles Übrige unten ist vollständig.",

    overviewTitle: "Übersicht",
    metricTraffic: "Geschätzter organischer Traffic",
    metricTrafficUnit: "Besuche / Monat",
    metricKeywords: "Organische Keywords",
    metricKeywordsUnit: "in den Top 100",
    metricTrafficValue: "Traffic-Wert",
    metricTrafficValueUnit: "pro Monat, als bezahlter Traffic",
    distributionTitle: "Positionsverteilung",
    distributionLabels: {
      pos1: "Nr. 1",
      pos2_3: "Nr. 2–3",
      pos4_10: "Nr. 4–10",
      pos11_20: "Nr. 11–20",
      pos21_100: "Nr. 21–100",
    },
    noDistribution:
      "Diese Domain rankt für kein erfasstes Keyword in den Top 100.",

    keywordsTitle: "Top-Keywords",
    keywordsSubtitle: (shown: number, total: number) =>
      `${shown} von ${total.toLocaleString("de-CH")} organischen Keywords angezeigt`,
    sortHint: "Klicken Sie auf eine Spaltenüberschrift zum Sortieren.",
    colKeyword: "Keyword",
    colPosition: "Pos.",
    colVolume: "Volumen",
    colEtv: "Traffic",
    colUrl: "Rankende URL",
    emptyKeywords:
      "Diese Domain rankt in diesem Markt für kein Keyword in den Top 100.",

    competitorsTitle: "Wettbewerber",
    competitorsSubtitle: "Domains, die um dieselben Keywords konkurrieren.",
    colDomain: "Domain",
    colIntersections: "Gemeinsame Keywords",
    colAvgPosition: "Ø Position",
    emptyCompetitors: "Für diesen Markt wurden keine konkurrierenden Domains gefunden.",

    backlinksTitle: "Backlinks",
    metricBacklinks: "Backlinks",
    metricReferringDomains: "Verweisende Domains",
    metricRank: "Domain-Rang",
    metricRankUnit: "0–1000",
    metricBroken: "Defekte Backlinks",
    metricDofollow: "Dofollow-Domains",
    dofollowRatio: (percent: string) =>
      `${percent} % der verweisenden Domains verlinken ohne rel=nofollow`,
    noDofollowData: "Für diese Domain wurden keine verweisenden Domains gemeldet.",

    sectionFailedTitle: "Dieser Abschnitt konnte nicht geladen werden",
    sectionFailedBody:
      "Der Datenanbieter hat diesen Teil der Analyse nicht geliefert. Starten Sie die Analyse später erneut — die anderen Abschnitte sind nicht betroffen.",

    historyTitle: "Letzte Analysen",
    historyEmpty: "Noch keine Analysen. Analysieren Sie oben Ihre erste Domain.",
    colStatus: "Status",
    colCost: "Kosten",
    colWhen: "Gestartet",
    statusCompleted: "Vollständig",
    statusPartial: "Teilweise",
    view: "Ansehen",

    usage: (used: number, limit: number) => `${used} von ${limit} Analysen diesen Monat verwendet`,
    remaining: (left: number) =>
      left === 1 ? "Noch 1 Analyse diesen Monat" : `Noch ${left} Analysen diesen Monat`,
    quotaTitle: "Monatliches Analyselimit erreicht",
    quotaBody: (limit: number) =>
      `Ihr Plan enthält ${limit} Site-Analysen pro Monat. Wechseln Sie den Plan für mehr, oder warten Sie auf die Rücksetzung im nächsten Monat.`,
    quotaCta: "Pläne ansehen",
    spend: (usd: string) => `Site-Datenkosten für diesen Arbeitsbereich: ${usd} USD`,
    submitFailed: "Diese Domain konnte nicht analysiert werden. Versuchen Sie es in einer Minute erneut.",
    loadFailed: "Ihre Analysen konnten nicht geladen werden. Versuchen Sie es in einer Minute erneut.",
  },
};

// ─── Rank Tracker ───────────────────────────────────────────────────────────
// Scheduled tool: projects run on a cadence, so most of this copy is about
// state the user did not trigger just now — when it last ran, what changed
// since, and why a run was skipped. Deltas are phrased as "up/down" rather
// than "+/-" because a FALLING position number is an IMPROVEMENT, and the
// sign convention confuses everyone at least once.
const rankTrackerEn = {
  // ── Page + list ──
  listTitle: "Tracking projects",
  listIntro:
    "Track where your domain ranks for a set of keywords, and watch the positions move over time.",
  newProject: "New project",
  emptyTitle: "No tracking projects yet",
  emptyBody:
    "Create a project to track a domain against a list of keywords. Positions are checked on your schedule and charted over time.",
  colProject: "Project",
  colDomain: "Domain",
  colKeywords: "Keywords",
  colAvgPosition: "Avg. position",
  colFrequency: "Schedule",
  colLastRun: "Last run",
  neverRun: "Never",
  open: "Open",
  freqDaily: "Daily",
  freqWeekly: "Weekly",
  weeklyAnchor: (weekday: string) => `Weekly, every ${weekday}`,

  // ── Locked (STARTER / AI_VISIBILITY) ──
  lockedTitle: "Rank Tracker is not in your plan",
  lockedBody:
    "Rank tracking is available on Growth and Agency plans. Upgrade to track keyword positions on a schedule and see how they move.",
  lockedCta: "See plans",

  // ── Project detail ──
  backToList: "All projects",
  runNow: "Run now",
  runQueued: "Run queued — positions will update as results arrive.",
  running: "Checking…",
  pendingNote: (n: number) =>
    n === 1 ? "1 keyword is being checked" : `${n} keywords are being checked`,
  editProject: "Edit",
  deleteProject: "Delete",
  deleteConfirm: "Delete this project and all of its position history?",
  overCapTitle: "This project is paused",
  overCapBody:
    "It tracks more keywords than your current plan allows, so scheduled runs are being skipped. Remove keywords or upgrade to resume.",
  chartTitle: "Average position over time",
  chartEmpty: "No completed runs yet. Positions will appear here after the first run.",
  chartAxisNote: "Lower is better — position 1 is the top of page one.",

  // ── Keywords table ──
  keywordsTitle: "Keywords",
  colKeyword: "Keyword",
  colPosition: "Position",
  colChange: "Change",
  col30d: "30 days",
  colBestUrl: "Ranking URL",
  colTrend: "Trend",
  notRanked: "Not in top 100",
  notRankedShort: "—",
  noData: "—",
  improvedBy: (n: number) => `up ${n}`,
  droppedBy: (n: number) => `down ${n}`,
  unchanged: "no change",
  keywordsEmpty: "This project has no keywords yet. Edit it to add some.",

  // ── Create / edit modal ──
  createTitle: "New tracking project",
  editTitle: "Edit project",
  nameLabel: "Project name",
  namePlaceholder: "Main site",
  nameHint: "Optional — defaults to the domain.",
  domainLabel: "Domain",
  domainPlaceholder: "example.com",
  invalidDomain: "Enter a domain like example.com",
  keywordsLabel: "Keywords",
  keywordsPlaceholder: "plumber toronto\nemergency plumber toronto\ndrain cleaning toronto",
  keywordsHint: "One per line. Duplicates and blank lines are ignored.",
  keywordCounter: (count: number, limit: number) => `${count} of ${limit} keywords`,
  duplicatesIgnored: (n: number) =>
    n === 1 ? "1 duplicate ignored" : `${n} duplicates ignored`,
  overLimit: (count: number, limit: number) =>
    `${count} keywords entered — your plan allows ${limit} in total.`,
  locationLabel: "Location",
  languageLabel: "Language",
  deviceLabel: "Device",
  deviceDesktop: "Desktop",
  deviceMobile: "Mobile",
  frequencyLabel: "Check frequency",
  frequencyDailyLocked: "Daily (Agency plan)",
  save: "Save project",
  saving: "Saving…",
  cancel: "Cancel",

  // ── Usage / quota / errors ──
  usageKeywords: (used: number, limit: number) => `${used} of ${limit} keywords tracked`,
  usageChecks: (used: number, limit: number) => `${used} of ${limit} checks used this month`,
  quotaTitle: "Monthly check limit reached",
  quotaBody: (limit: number) =>
    `Your plan includes ${limit} keyword checks per month. Upgrade to run more, or wait for the counter to reset next month.`,
  quotaCta: "See plans",
  capTitle: "Keyword limit reached",
  capBody: (limit: number) =>
    `Your plan allows ${limit} tracked keywords in total. Remove some, or upgrade to track more.`,
  frequencyLockedNote: "Daily checks are available on the Agency plan.",
  spend: (usd: string) => `Rank data cost for this project: $${usd} USD`,
  saveFailed: "Could not save the project. Try again in a minute.",
  runFailed: "Could not start the run. Try again in a minute.",
  loadFailed: "Could not load your projects. Try again in a minute.",
};
export type RankTrackerCopy = typeof rankTrackerEn;

export const RANK_TRACKER_COPY: Record<DashLocale, RankTrackerCopy> = {
  en: rankTrackerEn,
  fr: {
    listTitle: "Projets de suivi",
    listIntro:
      "Suivez le classement de votre domaine pour une liste de mots-clés et observez l'évolution des positions.",
    newProject: "Nouveau projet",
    emptyTitle: "Aucun projet de suivi",
    emptyBody:
      "Créez un projet pour suivre un domaine sur une liste de mots-clés. Les positions sont vérifiées selon votre horaire et illustrées dans le temps.",
    colProject: "Projet",
    colDomain: "Domaine",
    colKeywords: "Mots-clés",
    colAvgPosition: "Position moyenne",
    colFrequency: "Horaire",
    colLastRun: "Dernière exécution",
    neverRun: "Jamais",
    open: "Ouvrir",
    freqDaily: "Quotidien",
    freqWeekly: "Hebdomadaire",
    weeklyAnchor: (weekday: string) => `Hebdomadaire, chaque ${weekday}`,

    lockedTitle: "Le suivi de positions n'est pas inclus dans votre forfait",
    lockedBody:
      "Le suivi de positions est offert avec les forfaits Croissance et Agence. Passez à un forfait supérieur pour suivre vos positions selon un horaire et voir leur évolution.",
    lockedCta: "Voir les forfaits",

    backToList: "Tous les projets",
    runNow: "Lancer maintenant",
    runQueued: "Exécution lancée — les positions se mettront à jour à mesure des résultats.",
    running: "Vérification…",
    pendingNote: (n: number) =>
      n === 1 ? "1 mot-clé est en cours de vérification" : `${n} mots-clés sont en cours de vérification`,
    editProject: "Modifier",
    deleteProject: "Supprimer",
    deleteConfirm: "Supprimer ce projet et tout son historique de positions ?",
    overCapTitle: "Ce projet est en pause",
    overCapBody:
      "Il suit plus de mots-clés que votre forfait actuel ne le permet, donc les exécutions planifiées sont ignorées. Retirez des mots-clés ou changez de forfait pour reprendre.",
    chartTitle: "Position moyenne dans le temps",
    chartEmpty:
      "Aucune exécution terminée. Les positions apparaîtront ici après la première exécution.",
    chartAxisNote: "Plus bas est meilleur — la position 1 est en haut de la première page.",

    keywordsTitle: "Mots-clés",
    colKeyword: "Mot-clé",
    colPosition: "Position",
    colChange: "Variation",
    col30d: "30 jours",
    colBestUrl: "URL classée",
    colTrend: "Tendance",
    notRanked: "Hors du top 100",
    notRankedShort: "—",
    noData: "—",
    improvedBy: (n: number) => `+${n} places`,
    droppedBy: (n: number) => `−${n} places`,
    unchanged: "stable",
    keywordsEmpty: "Ce projet n'a aucun mot-clé. Modifiez-le pour en ajouter.",

    createTitle: "Nouveau projet de suivi",
    editTitle: "Modifier le projet",
    nameLabel: "Nom du projet",
    namePlaceholder: "Site principal",
    nameHint: "Facultatif — le domaine est utilisé par défaut.",
    domainLabel: "Domaine",
    domainPlaceholder: "exemple.com",
    invalidDomain: "Entrez un domaine comme exemple.com",
    keywordsLabel: "Mots-clés",
    keywordsPlaceholder: "plombier montréal\nplombier urgence montréal\ndébouchage de drain montréal",
    keywordsHint: "Un par ligne. Les doublons et les lignes vides sont ignorés.",
    keywordCounter: (count: number, limit: number) => `${count} mots-clés sur ${limit}`,
    duplicatesIgnored: (n: number) =>
      n === 1 ? "1 doublon ignoré" : `${n} doublons ignorés`,
    overLimit: (count: number, limit: number) =>
      `${count} mots-clés saisis — votre forfait en permet ${limit} au total.`,
    locationLabel: "Lieu",
    languageLabel: "Langue",
    deviceLabel: "Appareil",
    deviceDesktop: "Ordinateur",
    deviceMobile: "Mobile",
    frequencyLabel: "Fréquence de vérification",
    frequencyDailyLocked: "Quotidien (forfait Agence)",
    save: "Enregistrer le projet",
    saving: "Enregistrement…",
    cancel: "Annuler",

    usageKeywords: (used: number, limit: number) => `${used} mots-clés suivis sur ${limit}`,
    usageChecks: (used: number, limit: number) =>
      `${used} vérifications sur ${limit} utilisées ce mois-ci`,
    quotaTitle: "Limite mensuelle de vérifications atteinte",
    quotaBody: (limit: number) =>
      `Votre forfait comprend ${limit} vérifications de mots-clés par mois. Passez à un forfait supérieur pour en faire plus, ou attendez la remise à zéro le mois prochain.`,
    quotaCta: "Voir les forfaits",
    capTitle: "Limite de mots-clés atteinte",
    capBody: (limit: number) =>
      `Votre forfait permet ${limit} mots-clés suivis au total. Retirez-en, ou passez à un forfait supérieur.`,
    frequencyLockedNote: "Les vérifications quotidiennes sont offertes avec le forfait Agence.",
    spend: (usd: string) => `Coût des données de positions pour ce projet : ${usd} $ US`,
    saveFailed: "Impossible d'enregistrer le projet. Réessayez dans une minute.",
    runFailed: "Impossible de lancer l'exécution. Réessayez dans une minute.",
    loadFailed: "Impossible de charger vos projets. Réessayez dans une minute.",
  },
  "de-CH": {
    listTitle: "Tracking-Projekte",
    listIntro:
      "Verfolgen Sie, wo Ihre Domain für eine Liste von Keywords rankt, und beobachten Sie die Positionen über die Zeit.",
    newProject: "Neues Projekt",
    emptyTitle: "Noch keine Tracking-Projekte",
    emptyBody:
      "Erstellen Sie ein Projekt, um eine Domain gegen eine Keyword-Liste zu verfolgen. Positionen werden nach Ihrem Zeitplan geprüft und über die Zeit dargestellt.",
    colProject: "Projekt",
    colDomain: "Domain",
    colKeywords: "Keywords",
    colAvgPosition: "Ø Position",
    colFrequency: "Zeitplan",
    colLastRun: "Letzter Lauf",
    neverRun: "Nie",
    open: "Öffnen",
    freqDaily: "Täglich",
    freqWeekly: "Wöchentlich",
    weeklyAnchor: (weekday: string) => `Wöchentlich, jeden ${weekday}`,

    lockedTitle: "Rank Tracker ist nicht in Ihrem Plan enthalten",
    lockedBody:
      "Positions-Tracking ist in den Plänen Growth und Agency enthalten. Wechseln Sie den Plan, um Keyword-Positionen nach Zeitplan zu verfolgen und ihre Entwicklung zu sehen.",
    lockedCta: "Pläne ansehen",

    backToList: "Alle Projekte",
    runNow: "Jetzt starten",
    runQueued: "Lauf gestartet — Positionen aktualisieren sich, sobald Ergebnisse eintreffen.",
    running: "Wird geprüft…",
    pendingNote: (n: number) =>
      n === 1 ? "1 Keyword wird geprüft" : `${n} Keywords werden geprüft`,
    editProject: "Bearbeiten",
    deleteProject: "Löschen",
    deleteConfirm: "Dieses Projekt und seinen gesamten Positionsverlauf löschen?",
    overCapTitle: "Dieses Projekt pausiert",
    overCapBody:
      "Es verfolgt mehr Keywords, als Ihr aktueller Plan erlaubt, daher werden geplante Läufe übersprungen. Entfernen Sie Keywords oder wechseln Sie den Plan, um fortzufahren.",
    chartTitle: "Durchschnittliche Position über die Zeit",
    chartEmpty:
      "Noch keine abgeschlossenen Läufe. Positionen erscheinen hier nach dem ersten Lauf.",
    chartAxisNote: "Niedriger ist besser — Position 1 ist zuoberst auf Seite eins.",

    keywordsTitle: "Keywords",
    colKeyword: "Keyword",
    colPosition: "Position",
    colChange: "Veränderung",
    col30d: "30 Tage",
    colBestUrl: "Rankende URL",
    colTrend: "Trend",
    notRanked: "Nicht in den Top 100",
    notRankedShort: "—",
    noData: "—",
    improvedBy: (n: number) => `+${n} Plätze`,
    droppedBy: (n: number) => `−${n} Plätze`,
    unchanged: "unverändert",
    keywordsEmpty: "Dieses Projekt hat noch keine Keywords. Bearbeiten Sie es, um welche hinzuzufügen.",

    createTitle: "Neues Tracking-Projekt",
    editTitle: "Projekt bearbeiten",
    nameLabel: "Projektname",
    namePlaceholder: "Hauptseite",
    nameHint: "Optional — standardmässig die Domain.",
    domainLabel: "Domain",
    domainPlaceholder: "beispiel.ch",
    invalidDomain: "Geben Sie eine Domain wie beispiel.ch ein",
    keywordsLabel: "Keywords",
    keywordsPlaceholder: "sanitär zürich\nnotfall sanitär zürich\nrohrreinigung zürich",
    keywordsHint: "Eines pro Zeile. Duplikate und Leerzeilen werden ignoriert.",
    keywordCounter: (count: number, limit: number) => `${count} von ${limit} Keywords`,
    duplicatesIgnored: (n: number) =>
      n === 1 ? "1 Duplikat ignoriert" : `${n} Duplikate ignoriert`,
    overLimit: (count: number, limit: number) =>
      `${count} Keywords eingegeben — Ihr Plan erlaubt insgesamt ${limit}.`,
    locationLabel: "Standort",
    languageLabel: "Sprache",
    deviceLabel: "Gerät",
    deviceDesktop: "Desktop",
    deviceMobile: "Mobil",
    frequencyLabel: "Prüffrequenz",
    frequencyDailyLocked: "Täglich (Agency-Plan)",
    save: "Projekt speichern",
    saving: "Wird gespeichert…",
    cancel: "Abbrechen",

    usageKeywords: (used: number, limit: number) => `${used} von ${limit} Keywords verfolgt`,
    usageChecks: (used: number, limit: number) =>
      `${used} von ${limit} Prüfungen diesen Monat verwendet`,
    quotaTitle: "Monatliches Prüfungslimit erreicht",
    quotaBody: (limit: number) =>
      `Ihr Plan enthält ${limit} Keyword-Prüfungen pro Monat. Wechseln Sie den Plan für mehr, oder warten Sie auf die Rücksetzung im nächsten Monat.`,
    quotaCta: "Pläne ansehen",
    capTitle: "Keyword-Limit erreicht",
    capBody: (limit: number) =>
      `Ihr Plan erlaubt insgesamt ${limit} verfolgte Keywords. Entfernen Sie einige, oder wechseln Sie den Plan.`,
    frequencyLockedNote: "Tägliche Prüfungen sind im Agency-Plan enthalten.",
    spend: (usd: string) => `Positionsdatenkosten für dieses Projekt: ${usd} USD`,
    saveFailed: "Das Projekt konnte nicht gespeichert werden. Versuchen Sie es in einer Minute erneut.",
    runFailed: "Der Lauf konnte nicht gestartet werden. Versuchen Sie es in einer Minute erneut.",
    loadFailed: "Ihre Projekte konnten nicht geladen werden. Versuchen Sie es in einer Minute erneut.",
  },
};

// ─── Rank Tracker help modal ────────────────────────────────────────────────
// The plan numbers are NOT written into these strings — they arrive as
// arguments from RANK_TRACKED_KEYWORDS so the help text cannot drift out of
// sync with the config that actually enforces them.
//
// The timing line deliberately says "usually minutes, sometimes up to an hour"
// rather than just "minutes": a live 2-keyword run on 2026-07-28 took roughly
// an hour to come back from the standard queue, so promising minutes would be
// a claim we have already watched fail.
const rankTrackerHelpEn = {
  button: "Help",
  buttonAria: "How Rank Tracker works",
  title: "How Rank Tracker works",
  close: "Close",

  step1Title: "Create a tracking project",
  step1Body:
    "Add your domain and the keywords you want to watch (one per line), pick country, language, device, and how often to check: daily or weekly.",
  step1Plans: (growth: number, agency: number) =>
    `Growth tracks up to ${growth} keywords and checks weekly. Agency tracks up to ${agency} and can also check daily. Rank Tracker is not included on Starter.`,

  step2Title: "Checks run automatically",
  step2Body:
    "On schedule, each keyword is checked against Google's top 100 results. Results usually arrive within a few minutes, though a busy queue can take up to an hour; the page updates as they land. You can also use “Run now” on any project.",

  step3Title: "Read the results",
  step3Body:
    "Each keyword shows its latest position, how it changed since the last check and over 30 days, and the page that ranks. “Not ranked” means the domain was not in the top 100 for that keyword.",

  step4Title: "Tips",
  tips: [
    "Track the keywords customers actually search for, not just your brand name.",
    "Weekly is enough for most businesses. Daily matters when you are actively working on rankings.",
    "Keyword changes take effect at the next scheduled run.",
  ],

  findKeywordsIntro: "Not sure which keywords to track?",
  findKeywordsLink: "Find ideas in Keywords Explorer",
};
export type RankTrackerHelpCopy = typeof rankTrackerHelpEn;

export const RANK_TRACKER_HELP_COPY: Record<DashLocale, RankTrackerHelpCopy> = {
  en: rankTrackerHelpEn,
  fr: {
    button: "Aide",
    buttonAria: "Comment fonctionne le suivi de positions",
    title: "Comment fonctionne le suivi de positions",
    close: "Fermer",

    step1Title: "Créez un projet de suivi",
    step1Body:
      "Ajoutez votre domaine et les mots-clés à surveiller (un par ligne), puis choisissez le pays, la langue, l'appareil et la fréquence de vérification : quotidienne ou hebdomadaire.",
    step1Plans: (growth: number, agency: number) =>
      `Le forfait Croissance suit jusqu'à ${growth} mots-clés avec une vérification hebdomadaire. Le forfait Agence en suit jusqu'à ${agency} et permet aussi la vérification quotidienne. Le suivi de positions n'est pas inclus dans le forfait Démarrage.`,

    step2Title: "Les vérifications se font automatiquement",
    step2Body:
      "Selon votre horaire, chaque mot-clé est vérifié dans les 100 premiers résultats de Google. Les résultats arrivent habituellement en quelques minutes, mais une file d'attente chargée peut prendre jusqu'à une heure ; la page se met à jour au fur et à mesure. Vous pouvez aussi utiliser « Lancer maintenant » sur n'importe quel projet.",

    step3Title: "Lisez les résultats",
    step3Body:
      "Chaque mot-clé affiche sa position actuelle, sa variation depuis la dernière vérification et sur 30 jours, ainsi que la page qui se classe. « Hors du top 100 » signifie que le domaine ne figurait pas dans les 100 premiers résultats pour ce mot-clé.",

    step4Title: "Conseils",
    tips: [
      "Suivez les mots-clés que vos clients recherchent réellement, pas seulement le nom de votre marque.",
      "L'hebdomadaire suffit à la plupart des entreprises. Le quotidien devient utile quand vous travaillez activement vos positions.",
      "Les changements de mots-clés prennent effet à la prochaine exécution planifiée.",
    ],

    findKeywordsIntro: "Vous ne savez pas quels mots-clés suivre ?",
    findKeywordsLink: "Trouvez des idées dans l'explorateur de mots-clés",
  },
  "de-CH": {
    button: "Hilfe",
    buttonAria: "So funktioniert der Rank Tracker",
    title: "So funktioniert der Rank Tracker",
    close: "Schliessen",

    step1Title: "Tracking-Projekt erstellen",
    step1Body:
      "Fügen Sie Ihre Domain und die zu beobachtenden Keywords hinzu (eines pro Zeile) und wählen Sie Land, Sprache, Gerät und Prüfhäufigkeit: täglich oder wöchentlich.",
    step1Plans: (growth: number, agency: number) =>
      `Growth verfolgt bis zu ${growth} Keywords und prüft wöchentlich. Agency verfolgt bis zu ${agency} und kann zusätzlich täglich prüfen. Im Starter-Plan ist der Rank Tracker nicht enthalten.`,

    step2Title: "Prüfungen laufen automatisch",
    step2Body:
      "Nach Ihrem Zeitplan wird jedes Keyword gegen die Top-100-Ergebnisse von Google geprüft. Ergebnisse treffen meist innerhalb weniger Minuten ein, bei ausgelasteter Warteschlange kann es bis zu einer Stunde dauern; die Seite aktualisiert sich laufend. Sie können bei jedem Projekt auch «Jetzt starten» verwenden.",

    step3Title: "Ergebnisse lesen",
    step3Body:
      "Jedes Keyword zeigt seine aktuelle Position, die Veränderung seit der letzten Prüfung und über 30 Tage sowie die rankende Seite. «Nicht in den Top 100» bedeutet, dass die Domain für dieses Keyword nicht unter den ersten 100 Ergebnissen war.",

    step4Title: "Tipps",
    tips: [
      "Verfolgen Sie die Keywords, nach denen Kundinnen und Kunden tatsächlich suchen — nicht nur Ihren Markennamen.",
      "Wöchentlich reicht für die meisten Unternehmen. Täglich lohnt sich, wenn Sie aktiv an Ihren Rankings arbeiten.",
      "Keyword-Änderungen werden beim nächsten geplanten Lauf wirksam.",
    ],

    findKeywordsIntro: "Unsicher, welche Keywords Sie verfolgen sollen?",
    findKeywordsLink: "Ideen im Keywords Explorer finden",
  },
};
