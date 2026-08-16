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
// The homepage ROI calculator's estimate disclaimer, lifted so this catalog and
// src/app/[locale]/HomeClient.tsx read one string instead of keeping two.
// REVENUE_COPY.disclaimer is the only consumer here.
import { ESTIMATE_DISCLAIMER } from "@/lib/revenue/disclaimer";
export type DashLocale = "en" | "fr" | "de-CH";

export function dashboardLocale(cookieValue?: string | null): DashLocale {
  if (cookieValue?.startsWith("fr")) return "fr";
  if (cookieValue?.startsWith("de")) return "de-CH";
  return "en";
}

export const dashNav: Record<DashLocale, Record<string, string>> = {
  en: {
    "/dashboard": "Dashboard",
    "/reputation": "Reputation Tools",
    "/customers": "Customers",
    "/feedback": "Feedback",
    "/campaigns": "Campaigns",
    "/recovery": "Recovery",
    "/analytics": "Reputation Analytics",
    "/intelligence": "Intelligence",
    "/monitoring": "Monitoring",
    "/ai": "AI",
    "/visibility": "AI Visibility",
    "/imports": "Data Sources",
    "/extension": "Extension",
    "/templates": "Templates",
    "/review-links": "Review Links",
    "/team": "Team",
    "/settings": "Settings",
    "/settings/account": "Account",
    "/billing": "Billing",
    "/notifications": "Notifications",
    "/help": "Help",
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
    "/visibility/tools/ai-content-helper": "Marketing Studio",
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
    "/visibility/tools/site-audit": "Site Audit",
    "/visibility/tools/custom-prompts": "Custom Prompts",
    "/visibility/tools/ai-lens": "AI Lens",
    "/visibility/tools/ai-attribution": "AI Attribution",
    "/visibility/tools/share-of-voice": "Share of Voice",
    "/visibility/tools/citation-finder": "Citation Finder",
    "/visibility/tools/citation-opportunities": "Citation Opportunities",
    "/visibility/tools/opportunity-scanner": "Opportunity Scanner",
    "/visibility/tools/funnels": "Audit Funnels",
    "/visibility/tools/revenue": "AI Revenue",
    "/visibility/tools/action-agent": "AI Action Agent",
  },
  "de-CH": {
    "/dashboard": "Dashboard",
    "/reputation": "Reputations-Tools",
    "/customers": "Kunden",
    "/feedback": "Feedback",
    "/campaigns": "Kampagnen",
    "/recovery": "Rückgewinnung",
    "/analytics": "Reputationsanalyse",
    "/intelligence": "Intelligence",
    "/monitoring": "Überwachung",
    "/ai": "KI",
    "/visibility": "KI-Sichtbarkeit",
    "/imports": "Datenquellen",
    "/extension": "Erweiterung",
    "/templates": "Vorlagen",
    "/review-links": "Bewertungslinks",
    "/team": "Team",
    "/settings": "Einstellungen",
    "/settings/account": "Konto",
    "/billing": "Abrechnung",
    "/notifications": "Benachrichtigungen",
    "/help": "Hilfe",
    "/visibility/keywords": "Keywords Explorer",
    "/visibility/tools": "SEO-Tools",
    "/visibility/tools/site-explorer": "Site Explorer",
    "/visibility/tools/rank-tracker": "Rank Tracker",
    "/visibility/tools/gsc-insights": "GSC Insights",
    "/visibility/tools/brand-radar": "Brand Radar",
    "/visibility/tools/web-analytics": "Web-Analytics",
    "/visibility/tools/bot-analytics": "Bot-Analytics",
    "/visibility/tools/content-explorer": "Content Explorer",
    "/visibility/tools/ai-content-helper": "Marketing Studio",
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
    "/visibility/tools/site-audit": "Site-Audit",
    "/visibility/tools/custom-prompts": "Eigene Prompts",
    "/visibility/tools/ai-lens": "AI Lens",
    "/visibility/tools/ai-attribution": "KI-Attribution",
    "/visibility/tools/share-of-voice": "Stimmanteil",
    "/visibility/tools/citation-finder": "Quellenfinder",
    "/visibility/tools/citation-opportunities": "Zitat-Chancen",
    "/visibility/tools/opportunity-scanner": "Chancen-Scanner",
    "/visibility/tools/funnels": "Audit-Funnels",
    "/visibility/tools/revenue": "KI-Umsatz",
    "/visibility/tools/action-agent": "KI-Aktionsagent",
  },
  fr: {
    "/dashboard": "Tableau de bord",
    "/reputation": "Outils de réputation",
    "/customers": "Clients",
    "/feedback": "Rétroaction",
    "/campaigns": "Campagnes",
    "/recovery": "Récupération",
    "/analytics": "Analyses de réputation",
    "/intelligence": "Intelligence",
    "/monitoring": "Surveillance",
    "/ai": "IA",
    "/visibility": "Visibilité IA",
    "/imports": "Sources de données",
    "/extension": "Extension",
    "/templates": "Modèles",
    "/review-links": "Liens d'avis",
    "/team": "Équipe",
    "/settings": "Paramètres",
    "/settings/account": "Compte",
    "/billing": "Facturation",
    "/notifications": "Notifications",
    "/help": "Aide",
    "/visibility/keywords": "Explorateur de mots-clés",
    "/visibility/tools": "Outils SEO",
    "/visibility/tools/site-explorer": "Explorateur de sites",
    "/visibility/tools/rank-tracker": "Suivi des positions",
    "/visibility/tools/gsc-insights": "Analyses GSC",
    "/visibility/tools/brand-radar": "Radar de marque",
    "/visibility/tools/web-analytics": "Analytique web",
    "/visibility/tools/bot-analytics": "Analytique des robots",
    "/visibility/tools/content-explorer": "Explorateur de contenu",
    "/visibility/tools/ai-content-helper": "Studio marketing",
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
    "/visibility/tools/site-audit": "Audit de site",
    "/visibility/tools/custom-prompts": "Requêtes personnalisées",
    "/visibility/tools/ai-lens": "AI Lens",
    "/visibility/tools/ai-attribution": "Attribution IA",
    "/visibility/tools/share-of-voice": "Part de voix",
    "/visibility/tools/citation-finder": "Détecteur de sources",
    "/visibility/tools/citation-opportunities": "Opportunités de citation",
    "/visibility/tools/opportunity-scanner": "Scanner d'opportunités",
    "/visibility/tools/funnels": "Formulaires d'audit",
    "/visibility/tools/revenue": "Revenus IA",
    "/visibility/tools/action-agent": "Agent d'action IA",
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
  title: "Reputation Analytics",
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
    title: "Analyses de réputation",
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
    title: "Reputationsanalyse",
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
  manageSubscription: "Manage subscription",
  manageSubscriptionHint:
    "Update your payment method or cancel. Cancelling keeps your access until the end of the period you have already paid for.",
  manageSubscriptionError: "Could not open the billing portal. Please try again.",
  usageTitle: "Usage This Month",
  feedbackRequests: "Feedback Requests",
  usagePct: (pct: number) => `${pct}% of your monthly limit used`,
  plansTitle: "Plans",
  pricesInUsd: "All prices are in US dollars (USD). If you pay with a card in another currency, your bank converts the charge at its own exchange rate.",
  contactUs: "Contact us",
  popular: "Popular",
  currentPlan: "Current Plan",
  contactSales: "Contact us",
  upgradeTo: (plan: string) => `Upgrade to ${plan}`,
  downgradeTo: (plan: string) => `Downgrade to ${plan}`,
  confirmChange: (isUpgrade: boolean, plan: string, price: number) =>
    `Are you sure you want to ${isUpgrade ? "upgrade" : "downgrade"} to the ${plan} plan ($${price}/mo)?`,
  changeFailed: "Failed to change plan. Please try again.",
  planFeatures: {
    STARTER: [
      "1 location",
      "AI visibility across 4 answer engines",
      "300 feedback requests/mo",
      "Email channel only",
      "Basic analytics",
      "Email support",
    ],
    GROWTH: [
      "3 locations",
      "AI visibility across 4 answer engines",
      "2,000 feedback requests/mo",
      "Email + SMS channels",
      "Advanced analytics",
      "Priority support",
      "Custom templates",
      "Team management (5 seats)",
    ],
    AGENCY: [
      "20 locations",
      "AI visibility across 4 answer engines",
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

  // ── Prospect lookups ──
  // COUNTS, NEVER DOLLARS, like every other credits surface. What a pack cost
  // is on the Stripe receipt; what the customer holds is a number of lookups.
  creditsTitle: "Prospect lookups",
  creditsSubtitle: "Prepaid credits for the Opportunity Scanner. They never expire.",
  creditsBuy: "Buy lookups",
  creditsAvailable: "available",
  creditsEmpty: "No lookups bought yet.",
  creditsColDate: "Date",
  creditsColReason: "Reason",
  creditsColChange: "Change",
  creditsReasons: {
    PURCHASE: "Pack purchased",
    // Named for what the customer sees, not for the enum. "Reserve" is our
    // word for it; theirs is that a scan took them.
    RESERVE: "Held for a scan",
    CONSUME_RELEASE: "Returned unused",
    REFUND: "Refunded",
    ADMIN: "Adjustment",
  } as Record<string, string>,
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
    manageSubscription: "Gérer l'abonnement",
    manageSubscriptionHint:
      "Modifiez votre moyen de paiement ou résiliez. La résiliation conserve votre accès jusqu'à la fin de la période déjà payée.",
    manageSubscriptionError:
      "Impossible d'ouvrir le portail de facturation. Veuillez réessayer.",
    usageTitle: "Utilisation ce mois-ci",
    feedbackRequests: "Demandes de rétroaction",
    usagePct: (pct: number) =>
      `${pct} % de votre limite mensuelle utilisée`,
    plansTitle: "Forfaits",
    pricesInUsd: "Tous les prix sont en dollars américains (USD). Si vous payez avec une carte dans une autre devise, votre banque effectue la conversion à son propre taux de change.",
    contactUs: "Contactez-nous",
    popular: "Populaire",
    currentPlan: "Forfait actuel",
    contactSales: "Nous contacter",
    upgradeTo: (plan: string) => `Passer au forfait ${plan}`,
    downgradeTo: (plan: string) => `Rétrograder vers ${plan}`,
    confirmChange: (isUpgrade: boolean, plan: string, price: number) =>
      isUpgrade
        ? `Voulez-vous vraiment passer au forfait ${plan} (${price} $/mois)?`
        : `Voulez-vous vraiment rétrograder vers le forfait ${plan} (${price} $/mois)?`,
    changeFailed: "Échec du changement de forfait. Veuillez réessayer.",
    planFeatures: {
      STARTER: [
        "1 emplacement",
        "Visibilité IA sur 4 moteurs de réponse",
        "300 demandes de rétroaction/mois",
        "Canal courriel seulement",
        "Analytique de base",
        "Soutien par courriel",
      ],
      GROWTH: [
        "3 emplacements",
        "Visibilité IA sur 4 moteurs de réponse",
        "2 000 demandes de rétroaction/mois",
        "Canaux courriel + SMS",
        "Analytique avancée",
        "Soutien prioritaire",
        "Modèles personnalisés",
        "Gestion d'équipe (5 sièges)",
      ],
      AGENCY: [
        "20 emplacements",
        "Visibilité IA sur 4 moteurs de réponse",
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
    creditsTitle: "Recherches de prospects",
    creditsSubtitle: "Crédits prépayés pour le Scanner d'opportunités. Ils n'expirent jamais.",
    creditsBuy: "Acheter des recherches",
    creditsAvailable: "disponibles",
    creditsEmpty: "Aucune recherche achetée pour l'instant.",
    creditsColDate: "Date",
    creditsColReason: "Motif",
    creditsColChange: "Variation",
    creditsReasons: {
      PURCHASE: "Pack acheté",
      RESERVE: "Réservées pour une analyse",
      CONSUME_RELEASE: "Rendues, non utilisées",
      REFUND: "Remboursées",
      ADMIN: "Ajustement",
    } as Record<string, string>,
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
    manageSubscription: "Abonnement verwalten",
    manageSubscriptionHint:
      "Zahlungsmittel ändern oder kündigen. Bei einer Kündigung bleibt der Zugang bis zum Ende der bereits bezahlten Laufzeit bestehen.",
    manageSubscriptionError:
      "Das Rechnungsportal konnte nicht geöffnet werden. Bitte erneut versuchen.",
    usageTitle: "Nutzung in diesem Monat",
    feedbackRequests: "Feedback-Anfragen",
    usagePct: (pct: number) =>
      `${pct} % Ihres monatlichen Limits verbraucht`,
    plansTitle: "Pläne",
    pricesInUsd: "Alle Preise in US-Dollar (USD). Bei Zahlung mit einer Karte in einer anderen Währung rechnet Ihre Bank den Betrag zu ihrem eigenen Wechselkurs um.",
    contactUs: "Kontaktieren Sie uns",
    popular: "Beliebt",
    currentPlan: "Aktueller Plan",
    contactSales: "Kontakt aufnehmen",
    upgradeTo: (plan: string) => `Upgrade auf ${plan}`,
    downgradeTo: (plan: string) => `Downgrade auf ${plan}`,
    confirmChange: (isUpgrade: boolean, plan: string, price: number) =>
      isUpgrade
        ? `Möchten Sie wirklich ein Upgrade auf den ${plan}-Plan durchführen ($${price}/Monat)?`
        : `Möchten Sie wirklich ein Downgrade auf den ${plan}-Plan durchführen ($${price}/Monat)?`,
    changeFailed:
      "Planwechsel fehlgeschlagen. Bitte versuchen Sie es erneut.",
    planFeatures: {
      STARTER: [
        "1 Standort",
        "KI-Sichtbarkeit über 4 Antwort-Engines",
        "300 Feedback-Anfragen/Monat",
        "Nur E-Mail-Kanal",
        "Basis-Analysen",
        "E-Mail-Support",
      ],
      GROWTH: [
        "3 Standorte",
        "KI-Sichtbarkeit über 4 Antwort-Engines",
        "2'000 Feedback-Anfragen/Monat",
        "E-Mail- + SMS-Kanäle",
        "Erweiterte Analysen",
        "Prioritäts-Support",
        "Individuelle Vorlagen",
        "Teamverwaltung (5 Plätze)",
      ],
      AGENCY: [
        "20 Standorte",
        "KI-Sichtbarkeit über 4 Antwort-Engines",
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
    creditsTitle: "Prospect-Abfragen",
    creditsSubtitle: "Vorausbezahltes Guthaben für den Opportunity Scanner. Es verfällt nie.",
    creditsBuy: "Abfragen kaufen",
    creditsAvailable: "verfügbar",
    creditsEmpty: "Noch keine Abfragen gekauft.",
    creditsColDate: "Datum",
    creditsColReason: "Grund",
    creditsColChange: "Änderung",
    creditsReasons: {
      PURCHASE: "Paket gekauft",
      RESERVE: "Für einen Scan reserviert",
      CONSUME_RELEASE: "Unbenutzt zurückgegeben",
      REFUND: "Erstattet",
      ADMIN: "Anpassung",
    } as Record<string, string>,
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
  // Answer tracking moved to its own tool page; this is the signpost left in
  // its place so the flow from an audit to tracked prompts still exists.
  promptsCardTitle: "Tracked prompts",
  promptsCardBody:
    "Answer tracking now has its own page, with the per-prompt trends beside it.",
  promptsCardLink: "Open Custom Prompts →",
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
    promptsCardTitle: "Requêtes suivies",
    promptsCardBody:
      "Le suivi des réponses dispose désormais de sa propre page, avec les tendances par requête à côté.",
    promptsCardLink: "Ouvrir les requêtes personnalisées →",
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
    promptsCardTitle: "Verfolgte Prompts",
    promptsCardBody:
      "Das Antwort-Tracking hat jetzt eine eigene Seite, mit den Trends je Prompt daneben.",
    promptsCardLink: "Eigene Prompts öffnen →",
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
  hubWhitepaper: "Download the white paper (PDF)",
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
    ai_lens: {
      name: "AI Lens",
      description: "See what AI crawlers see on a page — and what they miss.",
    },
    site_audit: {
      name: "Site Audit",
      description: "Crawl your website and identify technical SEO issues.",
    },
    site_crawler: {
      name: "Site Crawler",
      description: "Crawl every page on your site and list the on-page SEO issues it finds.",
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
      name: "Marketing Studio",
      description: "Plan, create, optimize, and improve content with AI.",
    },
    historical: {
      name: "Historical",
      description: "Investigate historical SERP results and page snapshots over time.",
    },
    ai_attribution: {
      name: "AI Attribution",
      description: "See which AI assistants are sending visitors to your site, and where they land.",
    },
    share_of_voice: {
      name: "Share of Voice",
      description:
        "How much of each AI engine's answers you own, who takes the rest, and how it is moving.",
    },
    citation_finder: {
      name: "Citation Finder",
      description:
        "The sources AI engines cite when they answer about your market — and which of them cite your rivals but never you.",
    },
    citation_opportunities: {
      name: "Citation Opportunities",
      description:
        "The sources worth getting listed on, ranked by what they are worth against what they cost you to win.",
    },
    social_media_manager: {
      name: "Social Media Manager",
      description: "Plan, edit, schedule, and manage social media content.",
    },
    opportunity_scanner: {
      name: "Opportunity Scanner",
      description:
        "Scan a list of prospects for AI visibility gaps, worst first, with a white-labeled report for each one.",
    },
    audit_funnels: {
      name: "Audit Funnels",
      description:
        "Embed a lead-capturing AI visibility audit on your own site, under your own brand.",
    },
    ai_revenue: {
      name: "AI Revenue",
      description:
        "What AI-referred visitors were worth this month, and what your top rival's share of the answers is costing you.",
    },
    action_agent: {
      name: "AI Action Agent",
      description:
        "Drafts schema, FAQ content and review replies for you to approve. Nothing is published — you copy it out and use it.",
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
    hubWhitepaper: "Télécharger le livre blanc (PDF)",
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
      ai_lens: {
        name: "AI Lens",
        description: "Voyez ce que les robots d'IA voient sur une page — et ce qui leur échappe.",
      },
      site_audit: {
        name: "Audit de site",
        description: "Explorez votre site web et identifiez les problèmes techniques de SEO.",
      },
      site_crawler: {
        name: "Explorateur de site",
        description: "Parcourez chaque page de votre site et listez les problèmes SEO on-page détectés.",
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
        name: "Studio marketing",
        description: "Planifiez, créez, optimisez et améliorez votre contenu avec l'IA.",
      },
      historical: {
        name: "Historique",
        description:
          "Explorez l'historique des résultats de recherche et les archives de vos pages.",
      },
      ai_attribution: {
        name: "Attribution IA",
        description:
          "Découvrez quels assistants IA envoient des visiteurs sur votre site, et sur quelles pages ils arrivent.",
      },
      share_of_voice: {
        name: "Part de voix",
        description:
          "Quelle part des réponses de chaque moteur d'IA vous revient, qui prend le reste, et comment cela évolue.",
      },
      citation_finder: {
        name: "Détecteur de sources",
        description:
          "Les sources que citent les moteurs d'IA lorsqu'ils parlent de votre marché — et celles qui citent vos concurrents sans jamais vous mentionner.",
      },
      citation_opportunities: {
        name: "Opportunités de citation",
        description:
          "Les sources où il vaut la peine de se faire référencer, classées selon ce qu'elles rapportent face à ce qu'elles coûtent.",
      },
      social_media_manager: {
        name: "Gestionnaire de médias sociaux",
        description: "Planifiez, modifiez, programmez et gérez le contenu de vos médias sociaux.",
      },
      opportunity_scanner: {
        name: "Scanner d'opportunités",
        description:
          "Analysez une liste de prospects à la recherche de lacunes de visibilité IA, les plus faibles en tête, avec un rapport en marque blanche pour chacun.",
      },
      audit_funnels: {
        name: "Formulaires d'audit",
        description:
          "Intégrez sur votre propre site un audit de visibilité IA qui capte des contacts, sous votre marque.",
      },
      ai_revenue: {
        name: "Revenus IA",
        description:
          "Ce que valaient ce mois-ci les visiteurs venus d'une IA, et ce que vous coûte la part de réponses de votre principal concurrent.",
      },
      action_agent: {
        name: "Agent d'action IA",
        description:
          "Rédige données structurées, contenu FAQ et réponses aux avis, que vous approuvez. Rien n'est publié : vous copiez le texte et vous l'utilisez.",
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
    // MACHINE-TRANSLATED, needs a native de-CH review before it is trusted.
    // (Requested as such; "ss" not "ß" per the house rule, though this string
    // happens to contain neither.)
    hubWhitepaper: "Whitepaper herunterladen (PDF)",
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
      ai_lens: {
        name: "AI Lens",
        description: "Sehen Sie, was KI-Crawler auf einer Seite sehen — und was nicht.",
      },
      site_audit: {
        name: "Site-Audit",
        description: "Crawlen Sie Ihre Website und identifizieren Sie technische SEO-Probleme.",
      },
      site_crawler: {
        name: "Site Crawler",
        description: "Crawlen Sie jede Seite Ihrer Website und erhalten Sie alle gefundenen On-Page-SEO-Probleme.",
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
        name: "Marketing Studio",
        description: "Planen, erstellen, optimieren und verbessern Sie Inhalte mit KI.",
      },
      historical: {
        name: "Verlauf",
        description:
          "Untersuchen Sie frühere Suchergebnisse und Seitenstände im Zeitverlauf.",
      },
      ai_attribution: {
        name: "KI-Attribution",
        description:
          "Sehen Sie, welche KI-Assistenten Besucher auf Ihre Website schicken und wo diese landen.",
      },
      share_of_voice: {
        name: "Stimmanteil",
        description:
          "Welchen Anteil der Antworten jeder KI-Maschine Sie halten, wer den Rest nimmt und wohin es sich bewegt.",
      },
      citation_finder: {
        name: "Quellenfinder",
        description:
          "Die Quellen, die KI-Maschinen zu Ihrem Markt zitieren — und welche davon Ihre Mitbewerber nennen, Sie aber nie.",
      },
      citation_opportunities: {
        name: "Zitat-Chancen",
        description:
          "Die Quellen, bei denen sich ein Eintrag lohnt — sortiert nach Ertrag gegenüber Aufwand.",
      },
      social_media_manager: {
        name: "Social-Media-Manager",
        description: "Planen, bearbeiten, terminieren und verwalten Sie Social-Media-Inhalte.",
      },
      opportunity_scanner: {
        name: "Chancen-Scanner",
        description:
          "Prüfen Sie eine Liste von Interessenten auf Lücken in der KI-Sichtbarkeit — die schwächsten zuoberst, mit einem Bericht im eigenen Label für jeden.",
      },
      audit_funnels: {
        name: "Audit-Funnels",
        description:
          "Binden Sie auf Ihrer eigenen Website einen KI-Sichtbarkeits-Audit mit Kontakterfassung ein, unter Ihrer Marke.",
      },
      ai_revenue: {
        name: "KI-Umsatz",
        description:
          "Was Besucher aus KI-Assistenten diesen Monat wert waren und was Sie der Antwortanteil der stärksten Konkurrenz kostet.",
      },
      action_agent: {
        name: "KI-Aktionsagent",
        description:
          "Entwirft strukturierte Daten, FAQ-Inhalte und Bewertungsantworten zu Ihrer Freigabe. Nichts wird veröffentlicht — Sie kopieren den Text und setzen ihn ein.",
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
  // Two sections now, so the old "posture, not traffic" banner would be wrong:
  // section B IS traffic. The honest line is that each half answers a different
  // question and only the logs are ground truth.
  introNote:
    "Two questions, two answers. The access check asks whether AI crawlers are permitted and able to reach your site. Log analysis asks whether they actually came. Only your server logs can answer the second one — AI and search crawlers do not run JavaScript, so no page tag can ever see them.",
  siteLabel: "Site",
  auditLinkLabel: "Open the AI Visibility audit",

  // ─── Domain ───────────────────────────────────────────────────────────────
  domainTitle: "Which site should we check?",
  domainIntro:
    "Enter the domain you want checked. Echorank360 uses the site your workspace already audits when there is one, and you can override it here at any time.",
  domainPlaceholder: "yourdomain.com",
  domainSave: "Save domain",
  domainSaving: "Saving…",
  domainChange: "Change",
  domainCancel: "Cancel",
  domainInvalid: "Enter a domain like yourdomain.com — no path, no port, no IP address.",
  domainSaveFailed: "Could not save that domain. Try again.",
  domainSourceMonitor: "the site your workspace audits",
  domainSourceSettings: "your workspace settings",
  domainSourceManual: "set on this page",
  domainSourceLabel: (source: string) => `Using ${source}`,

  // ─── Section A: access check ───────────────────────────────────────────────
  accessTitle: "Can AI crawlers reach you?",
  accessIntro:
    "We read your robots.txt, then request your homepage once as each crawler using its real User-Agent. The second step catches the case robots.txt cannot show: a site that says every crawler is welcome while its firewall quietly returns 403 to GPTBot.",
  runCheck: "Run check",
  runningCheck: "Checking…",
  runCheckAgain: "Run check again",
  checkedAt: (date: string) => `Checked ${date}`,
  neverChecked: "Not checked yet",
  staleNote: (date: string) =>
    `This check ran ${date}. Run it again to see your current posture.`,
  checksUsed: (used: number, limit: number) =>
    `${used} of ${limit} checks used this month`,
  capReached:
    "You have used this month's access checks. The allowance resets on the 1st.",
  checkFailed: "Could not complete the access check. Try again in a minute.",
  robotsPresent: "robots.txt found",
  robotsMissing: "No robots.txt — all crawlers allowed by default",
  sitemapFound: "Sitemap found",
  sitemapMissing: "No sitemap found",
  llmsFound: "llms.txt present",
  llmsMissing: "No llms.txt",
  verdictLabels: {
    allowed: "REACHABLE",
    blocked_robots: "BLOCKED BY ROBOTS.TXT",
    blocked_http: "BLOCKED BY SERVER",
    challenged: "CHALLENGED",
    unknown: "UNKNOWN",
  } as Record<string, string>,
  verdictHelp: {
    allowed: "robots.txt permits it and your server answered its request.",
    blocked_robots:
      "Your robots.txt tells this crawler to stay out, so a well-behaved one never asks.",
    blocked_http:
      "robots.txt permits it, but your server refused the request — usually a firewall or bot-management rule.",
    challenged:
      "Your server answered with a rate limit or a human-verification page instead of your content.",
    unknown: "The request did not complete, so we cannot say either way.",
  } as Record<string, string>,
  preferenceOnly: "robots.txt preference token — no crawler sends it",
  probeStatus: (status: number) => `Homepage returned ${status}`,
  probeUnreachable: "Homepage request did not complete",
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
    "meta-externalagent": "Collects pages for Meta's AI model training.",
  } as Record<string, string>,
  problemSummary: (n: number) =>
    n === 1
      ? "1 crawler cannot reach your content."
      : `${n} crawlers cannot reach your content.`,
  allClear: "Every crawler we check can reach your content.",
  fixLink: "See what to change",

  // ─── Section B: log analysis ───────────────────────────────────────────────
  logsTitle: "Who's actually crawling you?",
  logsIntro:
    "Upload a server access log and we count the crawler visits in it: which bots came, when, and which pages they read. This is the only source that shows what actually happened rather than what is permitted.",
  piiNote:
    "Access logs contain visitor IP addresses. We parse your file, store only the counts below, and delete the file itself as soon as parsing finishes — no raw log lines and no IP addresses are kept.",
  dropzoneLabel: "Choose an access log",
  dropzoneHint: ".log, .txt or .gz — up to 50 MB",
  dropzoneDrop: "Drop the file to upload",
  uploading: "Uploading…",
  uploadFailed: "Upload failed. Check the file and try again.",
  uploadTooLarge: "That file is over the 50 MB limit.",
  uploadBadType: "Upload a .log, .txt or .gz access log.",
  uploadsUsed: (used: number, limit: number) =>
    `${used} of ${limit} uploads used this month`,
  uploadCapReached:
    "You have used this month's uploads. The allowance resets on the 1st.",
  historyTitle: "Past analyses",
  noAnalyses: "No logs analyzed yet.",
  statusLabels: {
    PENDING: "Queued",
    PROCESSING: "Parsing…",
    COMPLETE: "Done",
    FAILED: "Failed",
  } as Record<string, string>,
  processingNote: "Parsing your log. This page updates when it finishes.",
  periodLabel: (start: string, end: string) => `${start} – ${end}`,
  linesLabel: (parsed: number, skipped: number) =>
    `${parsed} lines parsed, ${skipped} skipped`,
  hitsChartTitle: "Crawler hits per day",
  topPathsTitle: "Most crawled pages",
  statusSplitTitle: "Response codes",
  botHeader: "Crawler",
  pathHeader: "Page",
  hitsHeader: "Hits",
  statusHeader: "Status",
  firstSeenLabel: "First seen",
  lastSeenLabel: "Last seen",
  verifiedLabel: "IP verified",
  unverifiedLabel: "UA claim only",
  unverifiedNote:
    "Googlebot and Bingbot hits are checked against each operator's published IP ranges. Other crawlers are counted on their User-Agent alone, which anything can send — treat those totals as a ceiling.",
  aiVisitSummary: (bot: string, n: number) =>
    `${bot} visited ${n} times — your content is being read by that crawler.`,
  noAiVisits:
    "No AI crawler visits in this log. Either they have not come yet, or something is turning them away — the access check above will say which.",
  totalBotHits: (n: number) => `${n} crawler hits`,

  // ─── STARTER upsell (section B only) ───────────────────────────────────────
  upsellTitle: "Log analysis is on Growth and Agency",
  upsellBody:
    "The access check above is included on your plan. Log analysis adds the other half: which crawlers actually visited, how often, and which pages they read.",
  upsellCta: "Compare plans",

  loading: "Loading…",
  loadFailed: "Could not load Bot Analytics. Try again in a minute.",
};
export type BotAnalyticsCopy = typeof botAnalyticsEn;

export const BOT_ANALYTICS_COPY: Record<DashLocale, BotAnalyticsCopy> = {
  en: botAnalyticsEn,
  fr: {
    introNote:
      "Deux questions, deux réponses. La vérification d'accès demande si les robots d'IA sont autorisés à atteindre votre site et le peuvent réellement. L'analyse des journaux demande s'ils sont venus. Seuls les journaux de votre serveur répondent à la seconde : les robots d'IA et de recherche n'exécutent pas de JavaScript, donc aucune balise de page ne pourra jamais les voir.",
    siteLabel: "Site",
    auditLinkLabel: "Ouvrir l'audit de visibilité IA",

    domainTitle: "Quel site devons-nous vérifier ?",
    domainIntro:
      "Indiquez le domaine à vérifier. Echorank360 utilise le site que votre espace de travail audite déjà lorsqu'il en existe un, et vous pouvez le remplacer ici à tout moment.",
    domainPlaceholder: "votredomaine.com",
    domainSave: "Enregistrer le domaine",
    domainSaving: "Enregistrement…",
    domainChange: "Modifier",
    domainCancel: "Annuler",
    domainInvalid:
      "Saisissez un domaine tel que votredomaine.com — sans chemin, sans port, sans adresse IP.",
    domainSaveFailed: "Impossible d'enregistrer ce domaine. Réessayez.",
    domainSourceMonitor: "le site que votre espace de travail audite",
    domainSourceSettings: "les paramètres de votre espace de travail",
    domainSourceManual: "défini sur cette page",
    domainSourceLabel: (source: string) => `Utilise ${source}`,

    accessTitle: "Les robots d'IA peuvent-ils vous atteindre ?",
    accessIntro:
      "Nous lisons votre robots.txt, puis demandons votre page d'accueil une fois pour chaque robot avec son véritable User-Agent. Cette seconde étape révèle ce que robots.txt ne peut pas montrer : un site qui déclare accueillir tous les robots alors que son pare-feu renvoie discrètement un 403 à GPTBot.",
    runCheck: "Lancer la vérification",
    runningCheck: "Vérification…",
    runCheckAgain: "Relancer la vérification",
    checkedAt: (date: string) => `Vérifié le ${date}`,
    neverChecked: "Pas encore vérifié",
    staleNote: (date: string) =>
      `Cette vérification date du ${date}. Relancez-la pour connaître votre posture actuelle.`,
    checksUsed: (used: number, limit: number) =>
      `${used} vérifications sur ${limit} utilisées ce mois-ci`,
    capReached:
      "Vous avez utilisé les vérifications de ce mois. L'allocation se renouvelle le 1er.",
    checkFailed:
      "Impossible de terminer la vérification d'accès. Réessayez dans une minute.",
    robotsPresent: "robots.txt trouvé",
    robotsMissing: "Aucun robots.txt — tous les robots sont permis par défaut",
    sitemapFound: "Plan de site trouvé",
    sitemapMissing: "Aucun plan de site trouvé",
    llmsFound: "llms.txt présent",
    llmsMissing: "Aucun llms.txt",
    verdictLabels: {
      allowed: "ACCESSIBLE",
      blocked_robots: "BLOQUÉ PAR ROBOTS.TXT",
      blocked_http: "BLOQUÉ PAR LE SERVEUR",
      challenged: "MIS AU DÉFI",
      unknown: "INDÉTERMINÉ",
    } as Record<string, string>,
    verdictHelp: {
      allowed: "robots.txt l'autorise et votre serveur a répondu à sa requête.",
      blocked_robots:
        "Votre robots.txt demande à ce robot de rester à l'écart; un robot bien élevé ne demande donc rien.",
      blocked_http:
        "robots.txt l'autorise, mais votre serveur a refusé la requête — généralement un pare-feu ou une règle anti-robots.",
      challenged:
        "Votre serveur a répondu par une limite de débit ou une page de vérification humaine au lieu de votre contenu.",
      unknown: "La requête n'a pas abouti; nous ne pouvons donc rien affirmer.",
    } as Record<string, string>,
    preferenceOnly: "jeton de préférence robots.txt — aucun robot ne l'envoie",
    probeStatus: (status: number) => `La page d'accueil a renvoyé ${status}`,
    probeUnreachable: "La requête vers la page d'accueil n'a pas abouti",
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
      "meta-externalagent": "Collecte des pages pour l'entraînement des modèles d'IA de Meta.",
    } as Record<string, string>,
    problemSummary: (n: number) =>
      n === 1
        ? "1 robot ne peut pas atteindre votre contenu."
        : `${n} robots ne peuvent pas atteindre votre contenu.`,
    allClear: "Tous les robots vérifiés peuvent atteindre votre contenu.",
    fixLink: "Voir quoi corriger",

    logsTitle: "Qui vous explore réellement ?",
    logsIntro:
      "Téléversez un journal d'accès de serveur et nous comptons les visites de robots qu'il contient : lesquels sont venus, quand, et quelles pages ils ont lues. C'est la seule source qui montre ce qui s'est réellement passé plutôt que ce qui est permis.",
    piiNote:
      "Les journaux d'accès contiennent les adresses IP des visiteurs. Nous analysons votre fichier, ne conservons que les totaux ci-dessous, et supprimons le fichier dès la fin de l'analyse — aucune ligne brute ni adresse IP n'est conservée.",
    dropzoneLabel: "Choisir un journal d'accès",
    dropzoneHint: ".log, .txt ou .gz — jusqu'à 50 Mo",
    dropzoneDrop: "Déposez le fichier pour le téléverser",
    uploading: "Téléversement…",
    uploadFailed: "Le téléversement a échoué. Vérifiez le fichier et réessayez.",
    uploadTooLarge: "Ce fichier dépasse la limite de 50 Mo.",
    uploadBadType: "Téléversez un journal d'accès .log, .txt ou .gz.",
    uploadsUsed: (used: number, limit: number) =>
      `${used} téléversements sur ${limit} utilisés ce mois-ci`,
    uploadCapReached:
      "Vous avez utilisé les téléversements de ce mois. L'allocation se renouvelle le 1er.",
    historyTitle: "Analyses précédentes",
    noAnalyses: "Aucun journal analysé pour l'instant.",
    statusLabels: {
      PENDING: "En file",
      PROCESSING: "Analyse…",
      COMPLETE: "Terminé",
      FAILED: "Échec",
    } as Record<string, string>,
    processingNote:
      "Analyse de votre journal en cours. Cette page se met à jour dès la fin.",
    periodLabel: (start: string, end: string) => `${start} – ${end}`,
    linesLabel: (parsed: number, skipped: number) =>
      `${parsed} lignes analysées, ${skipped} ignorées`,
    hitsChartTitle: "Visites de robots par jour",
    topPathsTitle: "Pages les plus explorées",
    statusSplitTitle: "Codes de réponse",
    botHeader: "Robot",
    pathHeader: "Page",
    hitsHeader: "Visites",
    statusHeader: "Statut",
    firstSeenLabel: "Première visite",
    lastSeenLabel: "Dernière visite",
    verifiedLabel: "IP vérifiée",
    unverifiedLabel: "User-Agent seul",
    unverifiedNote:
      "Les visites de Googlebot et Bingbot sont confrontées aux plages d'adresses IP publiées par chaque exploitant. Les autres robots sont comptés sur leur seul User-Agent, que n'importe qui peut envoyer — considérez ces totaux comme un plafond.",
    aiVisitSummary: (bot: string, n: number) =>
      `${bot} est venu ${n} fois — ce robot lit bien votre contenu.`,
    noAiVisits:
      "Aucune visite de robot d'IA dans ce journal. Soit ils ne sont pas encore venus, soit quelque chose les repousse — la vérification d'accès ci-dessus vous dira laquelle.",
    totalBotHits: (n: number) => `${n} visites de robots`,

    upsellTitle: "L'analyse des journaux est incluse dans Growth et Agency",
    upsellBody:
      "La vérification d'accès ci-dessus est incluse dans votre forfait. L'analyse des journaux ajoute l'autre moitié : quels robots sont réellement venus, à quelle fréquence, et quelles pages ils ont lues.",
    upsellCta: "Comparer les forfaits",

    loading: "Chargement…",
    loadFailed: "Impossible de charger Bot Analytics. Réessayez dans une minute.",
  },
  "de-CH": {
    introNote:
      "Zwei Fragen, zwei Antworten. Die Zugriffsprüfung fragt, ob KI-Crawler Ihre Website erreichen dürfen und können. Die Protokollanalyse fragt, ob sie tatsächlich gekommen sind. Nur Ihre Server-Protokolle beantworten die zweite Frage: KI- und Such-Crawler führen kein JavaScript aus, deshalb kann kein Seiten-Tag sie jemals sehen.",
    siteLabel: "Website",
    auditLinkLabel: "KI-Sichtbarkeits-Audit öffnen",

    domainTitle: "Welche Website sollen wir prüfen?",
    domainIntro:
      "Geben Sie die zu prüfende Domain ein. Echorank360 verwendet die Website, die Ihr Arbeitsbereich bereits auditiert, sofern vorhanden — Sie können sie hier jederzeit überschreiben.",
    domainPlaceholder: "ihredomain.com",
    domainSave: "Domain speichern",
    domainSaving: "Wird gespeichert…",
    domainChange: "Ändern",
    domainCancel: "Abbrechen",
    domainInvalid:
      "Geben Sie eine Domain wie ihredomain.com ein — ohne Pfad, ohne Port, ohne IP-Adresse.",
    domainSaveFailed: "Diese Domain konnte nicht gespeichert werden. Versuchen Sie es erneut.",
    domainSourceMonitor: "die Website, die Ihr Arbeitsbereich auditiert",
    domainSourceSettings: "Ihre Arbeitsbereich-Einstellungen",
    domainSourceManual: "auf dieser Seite festgelegt",
    domainSourceLabel: (source: string) => `Verwendet ${source}`,

    accessTitle: "Können KI-Crawler Sie erreichen?",
    accessIntro:
      "Wir lesen Ihre robots.txt und rufen dann Ihre Startseite je Crawler einmal mit dessen echtem User-Agent ab. Der zweite Schritt zeigt, was robots.txt nicht zeigen kann: eine Website, die alle Crawler willkommen heisst, während ihre Firewall GPTBot stillschweigend ein 403 zurückgibt.",
    runCheck: "Prüfung starten",
    runningCheck: "Prüfung läuft…",
    runCheckAgain: "Prüfung erneut starten",
    checkedAt: (date: string) => `Geprüft am ${date}`,
    neverChecked: "Noch nicht geprüft",
    staleNote: (date: string) =>
      `Diese Prüfung stammt vom ${date}. Starten Sie sie erneut für Ihre aktuelle Lage.`,
    checksUsed: (used: number, limit: number) =>
      `${used} von ${limit} Prüfungen diesen Monat genutzt`,
    capReached:
      "Sie haben die Prüfungen dieses Monats aufgebraucht. Das Guthaben erneuert sich am 1.",
    checkFailed:
      "Die Zugriffsprüfung konnte nicht abgeschlossen werden. Versuchen Sie es in einer Minute erneut.",
    robotsPresent: "robots.txt gefunden",
    robotsMissing: "Keine robots.txt — alle Crawler standardmässig erlaubt",
    sitemapFound: "Sitemap gefunden",
    sitemapMissing: "Keine Sitemap gefunden",
    llmsFound: "llms.txt vorhanden",
    llmsMissing: "Keine llms.txt",
    verdictLabels: {
      allowed: "ERREICHBAR",
      blocked_robots: "DURCH ROBOTS.TXT BLOCKIERT",
      blocked_http: "VOM SERVER BLOCKIERT",
      challenged: "ABGEFRAGT",
      unknown: "UNBEKANNT",
    } as Record<string, string>,
    verdictHelp: {
      allowed: "robots.txt erlaubt ihn und Ihr Server hat seine Anfrage beantwortet.",
      blocked_robots:
        "Ihre robots.txt weist diesen Crawler ab, ein gut erzogener fragt deshalb nie an.",
      blocked_http:
        "robots.txt erlaubt ihn, aber Ihr Server hat die Anfrage abgelehnt — meist eine Firewall- oder Bot-Management-Regel.",
      challenged:
        "Ihr Server hat mit einer Ratenbegrenzung oder einer Personenprüfung geantwortet statt mit Ihrem Inhalt.",
      unknown: "Die Anfrage kam nicht zustande, wir können es deshalb nicht sagen.",
    } as Record<string, string>,
    preferenceOnly: "robots.txt-Präferenz-Token — kein Crawler sendet es",
    probeStatus: (status: number) => `Startseite antwortete mit ${status}`,
    probeUnreachable: "Anfrage an die Startseite kam nicht zustande",
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
      "meta-externalagent": "Sammelt Seiten für das Training der KI-Modelle von Meta.",
    } as Record<string, string>,
    problemSummary: (n: number) =>
      n === 1
        ? "1 Crawler kann Ihren Inhalt nicht erreichen."
        : `${n} Crawler können Ihren Inhalt nicht erreichen.`,
    allClear: "Alle geprüften Crawler können Ihren Inhalt erreichen.",
    fixLink: "Sehen, was zu ändern ist",

    logsTitle: "Wer crawlt Sie tatsächlich?",
    logsIntro:
      "Laden Sie ein Server-Zugriffsprotokoll hoch und wir zählen die Crawler-Besuche darin: welche Bots kamen, wann, und welche Seiten sie gelesen haben. Das ist die einzige Quelle, die zeigt, was wirklich geschah, statt was erlaubt ist.",
    piiNote:
      "Zugriffsprotokolle enthalten IP-Adressen von Besuchern. Wir analysieren Ihre Datei, speichern nur die Zahlen unten und löschen die Datei selbst, sobald die Analyse fertig ist — es werden keine Rohzeilen und keine IP-Adressen behalten.",
    dropzoneLabel: "Zugriffsprotokoll auswählen",
    dropzoneHint: ".log, .txt oder .gz — bis 50 MB",
    dropzoneDrop: "Datei zum Hochladen hier ablegen",
    uploading: "Wird hochgeladen…",
    uploadFailed: "Hochladen fehlgeschlagen. Prüfen Sie die Datei und versuchen Sie es erneut.",
    uploadTooLarge: "Diese Datei liegt über der Grenze von 50 MB.",
    uploadBadType: "Laden Sie ein .log-, .txt- oder .gz-Zugriffsprotokoll hoch.",
    uploadsUsed: (used: number, limit: number) =>
      `${used} von ${limit} Uploads diesen Monat genutzt`,
    uploadCapReached:
      "Sie haben die Uploads dieses Monats aufgebraucht. Das Guthaben erneuert sich am 1.",
    historyTitle: "Frühere Analysen",
    noAnalyses: "Noch keine Protokolle analysiert.",
    statusLabels: {
      PENDING: "In Warteschlange",
      PROCESSING: "Analyse läuft…",
      COMPLETE: "Fertig",
      FAILED: "Fehlgeschlagen",
    } as Record<string, string>,
    processingNote:
      "Ihr Protokoll wird analysiert. Diese Seite aktualisiert sich, sobald es fertig ist.",
    periodLabel: (start: string, end: string) => `${start} – ${end}`,
    linesLabel: (parsed: number, skipped: number) =>
      `${parsed} Zeilen analysiert, ${skipped} übersprungen`,
    hitsChartTitle: "Crawler-Zugriffe pro Tag",
    topPathsTitle: "Am häufigsten gecrawlte Seiten",
    statusSplitTitle: "Antwortcodes",
    botHeader: "Crawler",
    pathHeader: "Seite",
    hitsHeader: "Zugriffe",
    statusHeader: "Status",
    firstSeenLabel: "Zuerst gesehen",
    lastSeenLabel: "Zuletzt gesehen",
    verifiedLabel: "IP geprüft",
    unverifiedLabel: "nur User-Agent",
    unverifiedNote:
      "Zugriffe von Googlebot und Bingbot werden gegen die veröffentlichten IP-Bereiche des jeweiligen Betreibers geprüft. Andere Crawler werden allein anhand ihres User-Agents gezählt, den jeder senden kann — behandeln Sie diese Zahlen als Obergrenze.",
    aiVisitSummary: (bot: string, n: number) =>
      `${bot} war ${n} Mal da — dieser Crawler liest Ihren Inhalt.`,
    noAiVisits:
      "Keine KI-Crawler-Besuche in diesem Protokoll. Entweder waren sie noch nicht da, oder etwas weist sie ab — die Zugriffsprüfung oben sagt Ihnen, was davon zutrifft.",
    totalBotHits: (n: number) => `${n} Crawler-Zugriffe`,

    upsellTitle: "Die Protokollanalyse gehört zu Growth und Agency",
    upsellBody:
      "Die Zugriffsprüfung oben ist in Ihrem Abo enthalten. Die Protokollanalyse ergänzt die andere Hälfte: welche Crawler tatsächlich kamen, wie oft, und welche Seiten sie gelesen haben.",
    upsellCta: "Abos vergleichen",

    loading: "Wird geladen…",
    loadFailed: "Bot Analytics konnte nicht geladen werden. Versuchen Sie es in einer Minute erneut.",
  },
};

// ─── /visibility/tools/bot-analytics — help modal ───────────────────────────
// The modal has one job the rest of the page cannot do: explain why a crawler is
// not a visitor. Every other misunderstanding of this tool follows from that one.
const botAnalyticsHelpEn = {
  button: "Help",
  buttonAria: "How Bot Analytics works",
  title: "How Bot Analytics works",
  close: "Close",

  intro:
    "This page answers two different questions, and only the second one is about what actually happened.",

  noJsTitle: "Crawlers are not visitors",
  noJsBody:
    "AI and search crawlers fetch your HTML and leave. They do not run JavaScript, so no analytics tag on your page can ever see them — that is why crawler traffic is missing from every dashboard that relies on a page script, and why this tool asks your server instead of your browser.",

  checkTitle: "The access check asks whether they can reach you",
  checkBody:
    "We read your robots.txt and evaluate it per crawler, then request your homepage once as each one using its real User-Agent. The second step is what makes this more than a robots.txt reader: a site can say every crawler is welcome while its firewall returns 403 to GPTBot, and only an actual request reveals that.",

  verdictsTitle: "What each verdict means",
  verdictsBullets: [
    "Reachable — robots.txt permits it and your server answered its request.",
    "Blocked by robots.txt — you are telling it to stay out, so a well-behaved crawler never asks.",
    "Blocked by server — robots.txt permits it but your server refused. Usually a firewall or bot-management rule, and usually a surprise.",
    "Challenged — your server returned a rate limit or a human-verification page instead of your content. A crawler cannot solve either.",
    "Unknown — the request did not complete, so we will not guess.",
  ],

  preferenceTitle: "Two of the tokens are not crawlers",
  preferenceBody:
    "Google-Extended and Applebot-Extended are robots.txt preference signals, not fetching crawlers: they control whether Gemini and Apple Intelligence may train on content those companies already fetched. Nothing sends them as a User-Agent, so they are never probed and their verdict comes from robots.txt alone.",

  logsTitle: "Only your logs are ground truth",
  logsBody:
    "The access check tells you a crawler could reach you. It cannot tell you that one did. Your server access log is the only record of actual visits, which is why the second half of this page takes an upload — and why the counts there can differ sharply from what the access check would lead you to expect.",

  verifyTitle: "Some crawler names are verified, most cannot be",
  verifyBody:
    "Googlebot and Bingbot hits are checked against each operator's published IP ranges, because impersonating Googlebot is common and easy. Other crawlers publish no usable ranges, so those totals rest on the User-Agent alone — treat them as a ceiling rather than a count.",

  piiTitle: "Your log file is deleted, not stored",
  piiBody:
    "Access logs contain visitor IP addresses. We parse your upload, keep only the aggregate counts you see here, and delete the file as soon as parsing finishes. No raw log lines and no IP addresses are retained.",
  fixLink: "Open the AI Visibility audit",
};
export type BotAnalyticsHelpCopy = typeof botAnalyticsHelpEn;

export const BOT_ANALYTICS_HELP_COPY: Record<DashLocale, BotAnalyticsHelpCopy> = {
  en: botAnalyticsHelpEn,
  fr: {
    button: "Aide",
    buttonAria: "Fonctionnement de Bot Analytics",
    title: "Fonctionnement de Bot Analytics",
    close: "Fermer",

    intro:
      "Cette page répond à deux questions distinctes, et seule la seconde porte sur ce qui s'est réellement produit.",

    noJsTitle: "Les robots ne sont pas des visiteurs",
    noJsBody:
      "Les robots d'IA et de recherche récupèrent votre HTML puis repartent. Ils n'exécutent pas de JavaScript, donc aucune balise d'analyse sur votre page ne pourra jamais les voir — c'est pourquoi le trafic des robots est absent de tous les tableaux de bord fondés sur un script de page, et pourquoi cet outil interroge votre serveur plutôt que votre navigateur.",

    checkTitle: "La vérification d'accès demande s'ils peuvent vous atteindre",
    checkBody:
      "Nous lisons votre robots.txt et l'évaluons robot par robot, puis demandons votre page d'accueil une fois pour chacun avec son véritable User-Agent. Cette seconde étape fait toute la différence avec un simple lecteur de robots.txt : un site peut déclarer accueillir tous les robots alors que son pare-feu renvoie un 403 à GPTBot, et seule une vraie requête le révèle.",

    verdictsTitle: "Ce que signifie chaque verdict",
    verdictsBullets: [
      "Accessible — robots.txt l'autorise et votre serveur a répondu à sa requête.",
      "Bloqué par robots.txt — vous lui demandez de rester à l'écart, un robot bien élevé ne demande donc rien.",
      "Bloqué par le serveur — robots.txt l'autorise mais votre serveur a refusé. Généralement un pare-feu ou une règle anti-robots, et généralement une surprise.",
      "Mis au défi — votre serveur a renvoyé une limite de débit ou une page de vérification humaine au lieu de votre contenu. Un robot ne peut résoudre ni l'une ni l'autre.",
      "Indéterminé — la requête n'a pas abouti, nous ne devinerons pas.",
    ],

    preferenceTitle: "Deux des jetons ne sont pas des robots",
    preferenceBody:
      "Google-Extended et Applebot-Extended sont des signaux de préférence robots.txt, non des robots qui récupèrent des pages : ils contrôlent si Gemini et Apple Intelligence peuvent s'entraîner sur du contenu que ces entreprises ont déjà récupéré. Rien ne les envoie comme User-Agent, ils ne sont donc jamais sondés et leur verdict provient du seul robots.txt.",

    logsTitle: "Seuls vos journaux constituent la vérité de terrain",
    logsBody:
      "La vérification d'accès vous dit qu'un robot pouvait vous atteindre. Elle ne peut pas vous dire qu'il l'a fait. Le journal d'accès de votre serveur est le seul relevé des visites réelles, d'où le téléversement dans la seconde moitié de cette page — et d'où le fait que ces totaux peuvent différer nettement de ce que la vérification d'accès laisserait attendre.",

    verifyTitle: "Certains noms de robots sont vérifiés, la plupart ne peuvent pas l'être",
    verifyBody:
      "Les visites de Googlebot et Bingbot sont confrontées aux plages d'adresses IP publiées par chaque exploitant, car usurper Googlebot est courant et facile. Les autres robots ne publient aucune plage exploitable; ces totaux reposent donc sur le seul User-Agent — considérez-les comme un plafond plutôt qu'un décompte.",

    piiTitle: "Votre fichier journal est supprimé, non conservé",
    piiBody:
      "Les journaux d'accès contiennent les adresses IP des visiteurs. Nous analysons votre téléversement, ne conservons que les totaux affichés ici, et supprimons le fichier dès la fin de l'analyse. Aucune ligne brute ni adresse IP n'est conservée.",
    fixLink: "Ouvrir l'audit de visibilité IA",
  },
  "de-CH": {
    button: "Hilfe",
    buttonAria: "So funktioniert Bot Analytics",
    title: "So funktioniert Bot Analytics",
    close: "Schliessen",

    intro:
      "Diese Seite beantwortet zwei verschiedene Fragen, und nur die zweite handelt davon, was tatsächlich geschehen ist.",

    noJsTitle: "Crawler sind keine Besucher",
    noJsBody:
      "KI- und Such-Crawler holen Ihr HTML und gehen wieder. Sie führen kein JavaScript aus, deshalb kann kein Analyse-Tag auf Ihrer Seite sie jemals sehen — darum fehlt Crawler-Traffic in jedem Dashboard, das auf einem Seitenskript beruht, und darum fragt dieses Werkzeug Ihren Server statt Ihren Browser.",

    checkTitle: "Die Zugriffsprüfung fragt, ob sie Sie erreichen können",
    checkBody:
      "Wir lesen Ihre robots.txt und bewerten sie je Crawler, dann rufen wir Ihre Startseite je Crawler einmal mit dessen echtem User-Agent ab. Der zweite Schritt macht den Unterschied zu einem reinen robots.txt-Leser: Eine Website kann alle Crawler willkommen heissen, während ihre Firewall GPTBot ein 403 zurückgibt — nur eine echte Anfrage zeigt das.",

    verdictsTitle: "Was jedes Urteil bedeutet",
    verdictsBullets: [
      "Erreichbar — robots.txt erlaubt ihn und Ihr Server hat seine Anfrage beantwortet.",
      "Durch robots.txt blockiert — Sie weisen ihn ab, ein gut erzogener Crawler fragt deshalb nie an.",
      "Vom Server blockiert — robots.txt erlaubt ihn, aber Ihr Server hat abgelehnt. Meist eine Firewall- oder Bot-Management-Regel, und meist eine Überraschung.",
      "Abgefragt — Ihr Server hat eine Ratenbegrenzung oder eine Personenprüfung zurückgegeben statt Ihres Inhalts. Ein Crawler kann beides nicht lösen.",
      "Unbekannt — die Anfrage kam nicht zustande, wir raten nicht.",
    ],

    preferenceTitle: "Zwei der Token sind keine Crawler",
    preferenceBody:
      "Google-Extended und Applebot-Extended sind robots.txt-Präferenzsignale, keine abrufenden Crawler: Sie steuern, ob Gemini und Apple Intelligence mit Inhalten trainieren dürfen, die diese Firmen schon geholt haben. Nichts sendet sie als User-Agent, sie werden deshalb nie geprüft und ihr Urteil stammt allein aus der robots.txt.",

    logsTitle: "Nur Ihre Protokolle sind die Wahrheit",
    logsBody:
      "Die Zugriffsprüfung sagt Ihnen, dass ein Crawler Sie erreichen konnte. Sie kann nicht sagen, dass einer es getan hat. Das Zugriffsprotokoll Ihres Servers ist der einzige Nachweis echter Besuche — daher der Upload in der zweiten Hälfte dieser Seite, und daher können diese Zahlen deutlich von dem abweichen, was die Zugriffsprüfung erwarten liesse.",

    verifyTitle: "Einige Crawler-Namen sind geprüft, die meisten nicht",
    verifyBody:
      "Zugriffe von Googlebot und Bingbot werden gegen die veröffentlichten IP-Bereiche des Betreibers geprüft, denn Googlebot zu imitieren ist verbreitet und einfach. Andere Crawler veröffentlichen keine brauchbaren Bereiche; diese Zahlen beruhen allein auf dem User-Agent — behandeln Sie sie als Obergrenze statt als Zählung.",

    piiTitle: "Ihre Protokolldatei wird gelöscht, nicht gespeichert",
    piiBody:
      "Zugriffsprotokolle enthalten IP-Adressen von Besuchern. Wir analysieren Ihren Upload, behalten nur die hier gezeigten Summen und löschen die Datei, sobald die Analyse fertig ist. Es werden keine Rohzeilen und keine IP-Adressen aufbewahrt.",
    fixLink: "KI-Sichtbarkeits-Audit öffnen",
  },
};

// ─── /visibility/tools/content-explorer ─────────────────────────────────────
// Web mentions from DataForSEO Content Analysis. Two honesty constraints run
// through this copy: sentiment is an automated distribution rather than a
// verdict, and every search costs the same whether it finds 1.5 million pages or
// none — so the empty state is a real answer, not a failure.
const contentExplorerEn = {
  intro:
    "Find the pages across the web that mention a phrase — your brand, a competitor, or a topic. Each result is a real page with its own domain authority, so the list doubles as an outreach shortlist.",
  mentionNote:
    "A mention is a page whose text contains your phrase. It is not a link to you, and not every mention is about you — a phrase that doubles as a common word will pick up pages that have nothing to do with your brand.",

  angleLabel: "Search angle",
  angleBrand: "My brand",
  angleCompetitor: "Competitor",
  angleTopic: "Topic",
  angleHint: "Presets only fill the box — every angle runs the same search.",

  queryLabel: "Phrase to find",
  queryPlaceholder: "your brand, a competitor, or a topic",
  searchBtn: "Search mentions",
  searching: "Searching…",
  usageLine: (used: number, limit: number) =>
    `${used} of ${limit} searches used this month`,
  costNote: (cost: string) =>
    `Each new search costs about ${cost} in provider fees, whether or not it finds anything. Repeating a phrase within 24 hours is free.`,
  capReached:
    "You have used this month's searches. The allowance resets on the 1st.",
  rateLimited: "Too many searches at once — try again in a minute.",
  searchFailed: "Could not search mentions right now. Try again in a minute.",
  cachedNote: (date: string) =>
    `Showing your saved search from ${date}. Searching again after 24 hours costs a new search.`,

  planLockedTitle: "Content Explorer is on Starter and above",
  planLockedBody:
    "Web mention research is included from the Starter plan up. Your current plan does not include it.",
  upgradeCta: "Compare plans",

  // Summary band
  totalMentions: (n: string) => `${n} pages mention this phrase`,
  totalMentionsOne: "1 page mentions this phrase",
  showingTop: (n: number) => `Showing the top ${n}`,
  sentimentTitle: "Sentiment across all matches",
  sentimentPositive: "Positive",
  sentimentNegative: "Negative",
  sentimentNeutral: "Neutral",
  sentimentCaveat:
    "Sentiment is scored automatically from page text. Treat it as directional, not as a verdict — sarcasm, comparisons and quoted complaints all read badly to a machine.",
  topDomainsTitle: "Domains publishing most often",
  languagesTitle: "Languages",
  countriesTitle: "Countries",
  unknownValue: "Unknown",

  // Mentions table
  mentionsTitle: "Pages mentioning this phrase",
  colPage: "Page",
  colDomain: "Domain",
  colDate: "Date",
  colSentiment: "Sentiment",
  sortDate: "Newest first",
  sortRank: "Highest authority first",
  sortLabel: "Sort",
  highAuthority: "High authority",
  highAuthorityTip:
    "Domain rank at or above the high-authority threshold and a low spam score — worth approaching for a link.",
  rankLabel: (rank: number) => `Rank ${rank}`,
  crawlDateNote: "crawl date",
  noDate: "No date",
  openPage: "Open page",

  // Verdict callouts
  verdictMostlyPositive: (n: string) =>
    `${n} mentions found, and the overall tone leans positive. The high-authority domains below are your best link-outreach targets.`,
  verdictMixed: (n: string) =>
    `${n} mentions found, with a mixed tone. Worth reading the negative ones before you plan outreach.`,
  verdictMostlyNegative: (n: string) =>
    `${n} mentions found, and the overall tone leans negative. Read these before anything else — automated scoring is rough, but a negative lean on a brand phrase is worth a human look.`,
  emptyTitle: "No mentions found",
  emptyBody:
    "Nothing on the web mentions this phrase yet. For a brand name that is a real answer, not an error — it means nobody is writing about you, which is the thing to change.",
  emptyCampaigns: "Run a review campaign",
  emptyReviewLinks: "Set up review links",
  emptyCross:
    "Reviews are the fastest way to get your name onto pages that AI engines and search engines read.",

  // History
  historyTitle: "Your past searches",
  noHistory: "No searches yet.",
  viewBtn: "View",
  freeToOpen: "Reopening a past search is free.",
  historyMeta: (mentions: number, total: string) =>
    `${mentions} pages shown of ${total} matches`,
  historyEmptyResult: "No mentions",

  loading: "Loading…",
  loadFailed: "Could not load Content Explorer. Try again in a minute.",
};
export type ContentExplorerCopy = typeof contentExplorerEn;

export const CONTENT_EXPLORER_COPY: Record<DashLocale, ContentExplorerCopy> = {
  en: contentExplorerEn,
  fr: {
    intro:
      "Trouvez les pages du web qui mentionnent une expression — votre marque, un concurrent ou un sujet. Chaque résultat est une page réelle avec son autorité de domaine, si bien que la liste sert aussi de liste de prospection.",
    mentionNote:
      "Une mention est une page dont le texte contient votre expression. Ce n'est pas un lien vers vous, et toutes les mentions ne vous concernent pas — une expression qui est aussi un mot courant ramènera des pages sans rapport avec votre marque.",

    angleLabel: "Angle de recherche",
    angleBrand: "Ma marque",
    angleCompetitor: "Concurrent",
    angleTopic: "Sujet",
    angleHint:
      "Les préréglages ne font que remplir le champ — tous les angles lancent la même recherche.",

    queryLabel: "Expression à trouver",
    queryPlaceholder: "votre marque, un concurrent ou un sujet",
    searchBtn: "Rechercher les mentions",
    searching: "Recherche…",
    usageLine: (used: number, limit: number) =>
      `${used} recherches sur ${limit} utilisées ce mois-ci`,
    costNote: (cost: string) =>
      `Chaque nouvelle recherche coûte environ ${cost} en frais de fournisseur, qu'elle trouve quelque chose ou non. Répéter une expression dans les 24 heures est gratuit.`,
    capReached:
      "Vous avez utilisé les recherches de ce mois. L'allocation se renouvelle le 1er.",
    rateLimited: "Trop de recherches à la fois — réessayez dans une minute.",
    searchFailed:
      "Impossible de rechercher les mentions pour l'instant. Réessayez dans une minute.",
    cachedNote: (date: string) =>
      `Affichage de votre recherche enregistrée du ${date}. Relancer après 24 heures consomme une nouvelle recherche.`,

    planLockedTitle: "Content Explorer est inclus à partir de Starter",
    planLockedBody:
      "La recherche de mentions web est incluse à partir du forfait Starter. Votre forfait actuel ne l'inclut pas.",
    upgradeCta: "Comparer les forfaits",

    totalMentions: (n: string) => `${n} pages mentionnent cette expression`,
    totalMentionsOne: "1 page mentionne cette expression",
    showingTop: (n: number) => `Affichage des ${n} premières`,
    sentimentTitle: "Tonalité sur l'ensemble des résultats",
    sentimentPositive: "Positive",
    sentimentNegative: "Négative",
    sentimentNeutral: "Neutre",
    sentimentCaveat:
      "La tonalité est évaluée automatiquement à partir du texte des pages. Considérez-la comme indicative, non comme un verdict — l'ironie, les comparaisons et les plaintes citées sont toutes mal interprétées par une machine.",
    topDomainsTitle: "Domaines qui publient le plus souvent",
    languagesTitle: "Langues",
    countriesTitle: "Pays",
    unknownValue: "Inconnu",

    mentionsTitle: "Pages mentionnant cette expression",
    colPage: "Page",
    colDomain: "Domaine",
    colDate: "Date",
    colSentiment: "Tonalité",
    sortDate: "Plus récentes d'abord",
    sortRank: "Autorité la plus forte d'abord",
    sortLabel: "Trier",
    highAuthority: "Forte autorité",
    highAuthorityTip:
      "Rang de domaine au-dessus du seuil de forte autorité et faible score de spam — vaut la peine d'être contacté pour un lien.",
    rankLabel: (rank: number) => `Rang ${rank}`,
    crawlDateNote: "date d'exploration",
    noDate: "Sans date",
    openPage: "Ouvrir la page",

    verdictMostlyPositive: (n: string) =>
      `${n} mentions trouvées, avec une tonalité plutôt positive. Les domaines à forte autorité ci-dessous sont vos meilleures cibles de prospection de liens.`,
    verdictMixed: (n: string) =>
      `${n} mentions trouvées, avec une tonalité mitigée. Lisez les mentions négatives avant de planifier votre prospection.`,
    verdictMostlyNegative: (n: string) =>
      `${n} mentions trouvées, avec une tonalité plutôt négative. Lisez-les en priorité — l'évaluation automatique reste grossière, mais une tendance négative sur une expression de marque mérite un regard humain.`,
    emptyTitle: "Aucune mention trouvée",
    emptyBody:
      "Rien sur le web ne mentionne encore cette expression. Pour un nom de marque, c'est une vraie réponse et non une erreur — cela signifie que personne n'écrit à votre sujet, et c'est précisément ce qu'il faut changer.",
    emptyCampaigns: "Lancer une campagne d'avis",
    emptyReviewLinks: "Configurer les liens d'avis",
    emptyCross:
      "Les avis sont le moyen le plus rapide de faire apparaître votre nom sur des pages que les moteurs d'IA et de recherche lisent.",

    historyTitle: "Vos recherches précédentes",
    noHistory: "Aucune recherche pour l'instant.",
    viewBtn: "Voir",
    freeToOpen: "Réouvrir une recherche précédente est gratuit.",
    historyMeta: (mentions: number, total: string) =>
      `${mentions} pages affichées sur ${total} résultats`,
    historyEmptyResult: "Aucune mention",

    loading: "Chargement…",
    loadFailed:
      "Impossible de charger Content Explorer. Réessayez dans une minute.",
  },
  "de-CH": {
    intro:
      "Finden Sie die Seiten im Web, die einen Begriff erwähnen — Ihre Marke, einen Mitbewerber oder ein Thema. Jedes Ergebnis ist eine echte Seite mit eigener Domain-Autorität, damit die Liste gleich als Outreach-Liste dient.",
    mentionNote:
      "Eine Erwähnung ist eine Seite, deren Text Ihren Begriff enthält. Es ist kein Link zu Ihnen, und nicht jede Erwähnung betrifft Sie — ein Begriff, der auch ein Alltagswort ist, bringt Seiten ohne Bezug zu Ihrer Marke mit.",

    angleLabel: "Suchwinkel",
    angleBrand: "Meine Marke",
    angleCompetitor: "Mitbewerber",
    angleTopic: "Thema",
    angleHint:
      "Vorlagen füllen nur das Feld — jeder Winkel startet dieselbe Suche.",

    queryLabel: "Zu suchender Begriff",
    queryPlaceholder: "Ihre Marke, ein Mitbewerber oder ein Thema",
    searchBtn: "Erwähnungen suchen",
    searching: "Suche läuft…",
    usageLine: (used: number, limit: number) =>
      `${used} von ${limit} Suchen diesen Monat genutzt`,
    costNote: (cost: string) =>
      `Jede neue Suche kostet rund ${cost} an Anbietergebühren — unabhängig davon, ob sie etwas findet. Denselben Begriff innerhalb von 24 Stunden zu wiederholen ist kostenlos.`,
    capReached:
      "Sie haben die Suchen dieses Monats aufgebraucht. Das Guthaben erneuert sich am 1.",
    rateLimited: "Zu viele Suchen gleichzeitig — versuchen Sie es in einer Minute erneut.",
    searchFailed:
      "Erwähnungen konnten derzeit nicht gesucht werden. Versuchen Sie es in einer Minute erneut.",
    cachedNote: (date: string) =>
      `Angezeigt wird Ihre gespeicherte Suche vom ${date}. Ein erneuter Lauf nach 24 Stunden verbraucht eine neue Suche.`,

    planLockedTitle: "Content Explorer gibt es ab Starter",
    planLockedBody:
      "Die Recherche von Web-Erwähnungen ist ab dem Starter-Abo enthalten. Ihr aktuelles Abo umfasst sie nicht.",
    upgradeCta: "Abos vergleichen",

    totalMentions: (n: string) => `${n} Seiten erwähnen diesen Begriff`,
    totalMentionsOne: "1 Seite erwähnt diesen Begriff",
    showingTop: (n: number) => `Angezeigt werden die ersten ${n}`,
    sentimentTitle: "Tonalität über alle Treffer",
    sentimentPositive: "Positiv",
    sentimentNegative: "Negativ",
    sentimentNeutral: "Neutral",
    sentimentCaveat:
      "Die Tonalität wird automatisch aus dem Seitentext bewertet. Nehmen Sie sie als Richtung, nicht als Urteil — Ironie, Vergleiche und zitierte Beschwerden liest eine Maschine alle als negativ.",
    topDomainsTitle: "Domains, die am häufigsten publizieren",
    languagesTitle: "Sprachen",
    countriesTitle: "Länder",
    unknownValue: "Unbekannt",

    mentionsTitle: "Seiten, die diesen Begriff erwähnen",
    colPage: "Seite",
    colDomain: "Domain",
    colDate: "Datum",
    colSentiment: "Tonalität",
    sortDate: "Neueste zuerst",
    sortRank: "Höchste Autorität zuerst",
    sortLabel: "Sortieren",
    highAuthority: "Hohe Autorität",
    highAuthorityTip:
      "Domain-Rang auf oder über der Schwelle für hohe Autorität und niedriger Spam-Wert — lohnt eine Anfrage für einen Link.",
    rankLabel: (rank: number) => `Rang ${rank}`,
    crawlDateNote: "Crawl-Datum",
    noDate: "Kein Datum",
    openPage: "Seite öffnen",

    verdictMostlyPositive: (n: string) =>
      `${n} Erwähnungen gefunden, die Tonalität tendiert positiv. Die Domains mit hoher Autorität unten sind Ihre besten Ziele für Link-Outreach.`,
    verdictMixed: (n: string) =>
      `${n} Erwähnungen gefunden, mit gemischter Tonalität. Lesen Sie die negativen, bevor Sie Outreach planen.`,
    verdictMostlyNegative: (n: string) =>
      `${n} Erwähnungen gefunden, die Tonalität tendiert negativ. Lesen Sie diese zuerst — die automatische Bewertung ist grob, aber eine negative Tendenz bei einem Markenbegriff verdient einen menschlichen Blick.`,
    emptyTitle: "Keine Erwähnungen gefunden",
    emptyBody:
      "Noch nichts im Web erwähnt diesen Begriff. Bei einem Markennamen ist das eine echte Antwort und kein Fehler — es heisst, dass niemand über Sie schreibt, und genau das gilt es zu ändern.",
    emptyCampaigns: "Bewertungskampagne starten",
    emptyReviewLinks: "Bewertungslinks einrichten",
    emptyCross:
      "Bewertungen sind der schnellste Weg, Ihren Namen auf Seiten zu bringen, die KI- und Suchmaschinen lesen.",

    historyTitle: "Ihre früheren Suchen",
    noHistory: "Noch keine Suchen.",
    viewBtn: "Ansehen",
    freeToOpen: "Eine frühere Suche erneut zu öffnen ist kostenlos.",
    historyMeta: (mentions: number, total: string) =>
      `${mentions} Seiten angezeigt von ${total} Treffern`,
    historyEmptyResult: "Keine Erwähnungen",

    loading: "Wird geladen…",
    loadFailed:
      "Content Explorer konnte nicht geladen werden. Versuchen Sie es in einer Minute erneut.",
  },
};

// ─── /visibility/tools/content-explorer — help modal ────────────────────────
const contentExplorerHelpEn = {
  button: "Help",
  buttonAria: "How Content Explorer works",
  title: "How Content Explorer works",
  close: "Close",

  intro:
    "One search asks the web index: which pages contain this phrase? Everything on the page comes from that answer.",

  mentionTitle: "What counts as a mention",
  mentionBody:
    "A page whose text contains your phrase. That is the whole test. It is not a link to your site, it is not a review, and it does not mean the page is about you — searching a brand name that is also an ordinary word will return pages with no connection to your business. Read the domains before drawing conclusions from the count.",

  sentimentTitle: "Sentiment is automated and directional",
  sentimentBody:
    "The provider scores each page's text as a mix of positive, negative and neutral rather than labelling it. We show the dominant one. It is machine scoring on page text, so sarcasm reads as praise, a comparison article that mentions a competitor's failure reads as negative about everyone, and a page quoting a complaint reads as a complaint. Use it to decide what to read first, never as a finding on its own.",

  outreachTitle: "Mining the list for link outreach",
  outreachBody:
    "Every row carries the domain's authority rank, and rows above the high-authority threshold with a low spam score get a badge. Those are publishers already writing about your topic on sites worth a link — a far warmer approach than a cold list. The summary band's top-domain chips show who publishes on this phrase most often, which is where a repeatable relationship is worth building.",

  costTitle: "What a search costs, and why repeats are free",
  costBody:
    "Every search runs live against the provider and is billed whether it finds a million pages or none — the price is almost entirely fixed. So repeating a phrase within 24 hours serves your saved search instead, reopening anything in your history costs nothing, and a phrase with no mentions is charged once and then remembered.",
  quotaLine: (used: number, limit: number, plan: string) =>
    `Your ${plan} plan includes ${limit} searches per month. You have used ${used}.`,
  fixLink: "Open review campaigns",
};
export type ContentExplorerHelpCopy = typeof contentExplorerHelpEn;

export const CONTENT_EXPLORER_HELP_COPY: Record<DashLocale, ContentExplorerHelpCopy> = {
  en: contentExplorerHelpEn,
  fr: {
    button: "Aide",
    buttonAria: "Fonctionnement de Content Explorer",
    title: "Fonctionnement de Content Explorer",
    close: "Fermer",

    intro:
      "Une recherche pose une question à l'index du web : quelles pages contiennent cette expression ? Tout ce qui s'affiche découle de cette réponse.",

    mentionTitle: "Ce qui compte comme une mention",
    mentionBody:
      "Une page dont le texte contient votre expression. C'est tout le critère. Ce n'est pas un lien vers votre site, ce n'est pas un avis, et cela ne signifie pas que la page vous concerne — rechercher un nom de marque qui est aussi un mot courant ramènera des pages sans lien avec votre activité. Lisez les domaines avant de tirer des conclusions du nombre.",

    sentimentTitle: "La tonalité est automatique et indicative",
    sentimentBody:
      "Le fournisseur évalue le texte de chaque page comme un mélange de positif, négatif et neutre plutôt que de lui attribuer une étiquette. Nous affichons la dominante. C'est une évaluation machine sur du texte : l'ironie passe pour un éloge, un article comparatif mentionnant l'échec d'un concurrent paraît négatif envers tout le monde, et une page citant une plainte est lue comme une plainte. Servez-vous-en pour décider quoi lire en premier, jamais comme d'un constat en soi.",

    outreachTitle: "Exploiter la liste pour la prospection de liens",
    outreachBody:
      "Chaque ligne porte le rang d'autorité du domaine, et les lignes au-dessus du seuil de forte autorité avec un faible score de spam reçoivent un badge. Ce sont des éditeurs qui écrivent déjà sur votre sujet, sur des sites où un lien vaut la peine — une approche bien plus chaleureuse qu'une liste froide. Les pastilles de domaines du bandeau de synthèse montrent qui publie le plus souvent sur cette expression, et c'est là qu'une relation durable mérite d'être construite.",

    costTitle: "Ce que coûte une recherche, et pourquoi les répétitions sont gratuites",
    costBody:
      "Chaque recherche interroge le fournisseur en direct et est facturée qu'elle trouve un million de pages ou aucune — le prix est presque entièrement fixe. Répéter une expression dans les 24 heures affiche donc votre recherche enregistrée, réouvrir n'importe quel élément de votre historique ne coûte rien, et une expression sans mention est facturée une fois puis mémorisée.",
    quotaLine: (used: number, limit: number, plan: string) =>
      `Votre forfait ${plan} inclut ${limit} recherches par mois. Vous en avez utilisé ${used}.`,
    fixLink: "Ouvrir les campagnes d'avis",
  },
  "de-CH": {
    button: "Hilfe",
    buttonAria: "So funktioniert Content Explorer",
    title: "So funktioniert Content Explorer",
    close: "Schliessen",

    intro:
      "Eine Suche stellt dem Web-Index eine Frage: Welche Seiten enthalten diesen Begriff? Alles auf der Seite stammt aus dieser Antwort.",

    mentionTitle: "Was als Erwähnung gilt",
    mentionBody:
      "Eine Seite, deren Text Ihren Begriff enthält. Das ist der ganze Test. Es ist kein Link zu Ihrer Website, keine Bewertung, und es heisst nicht, dass die Seite von Ihnen handelt — die Suche nach einem Markennamen, der auch ein gewöhnliches Wort ist, liefert Seiten ohne Bezug zu Ihrem Geschäft. Lesen Sie die Domains, bevor Sie aus der Zahl Schlüsse ziehen.",

    sentimentTitle: "Die Tonalität ist automatisch und richtungsweisend",
    sentimentBody:
      "Der Anbieter bewertet den Text jeder Seite als Mischung aus positiv, negativ und neutral, statt ihn zu etikettieren. Wir zeigen den dominanten Anteil. Es ist maschinelle Bewertung von Seitentext: Ironie liest sich als Lob, ein Vergleichsartikel über das Scheitern eines Mitbewerbers wirkt gegenüber allen negativ, und eine Seite, die eine Beschwerde zitiert, liest sich als Beschwerde. Nutzen Sie sie, um zu entscheiden, was Sie zuerst lesen, nie als Befund für sich.",

    outreachTitle: "Die Liste für Link-Outreach nutzen",
    outreachBody:
      "Jede Zeile trägt den Autoritätsrang der Domain, und Zeilen über der Schwelle für hohe Autorität mit niedrigem Spam-Wert erhalten ein Abzeichen. Das sind Publisher, die schon über Ihr Thema schreiben, auf Websites, bei denen ein Link etwas wert ist — ein viel wärmerer Zugang als eine kalte Liste. Die Domain-Chips im Übersichtsband zeigen, wer zu diesem Begriff am häufigsten publiziert, und dort lohnt sich eine dauerhafte Beziehung.",

    costTitle: "Was eine Suche kostet, und warum Wiederholungen gratis sind",
    costBody:
      "Jede Suche läuft live gegen den Anbieter und wird verrechnet, ob sie eine Million Seiten findet oder keine — der Preis ist fast vollständig fix. Denselben Begriff innerhalb von 24 Stunden zu wiederholen zeigt deshalb Ihre gespeicherte Suche, das erneute Öffnen aus dem Verlauf kostet nichts, und ein Begriff ohne Erwähnungen wird einmal verrechnet und danach behalten.",
    quotaLine: (used: number, limit: number, plan: string) =>
      `Ihr ${plan}-Abo enthält ${limit} Suchen pro Monat. Sie haben ${used} genutzt.`,
    fixLink: "Bewertungskampagnen öffnen",
  },
};

// ─── Pooled SEO search quota — counter + exhausted banner ───────────────────
// Rendered on every DataForSEO tool page. The numbers are injected from live
// usage (src/lib/seo-quota.ts) and never written into the copy: a hardcoded
// "250" here would be wrong for four of the five tiers.
const seoQuotaEn = {
  counter: (used: number, limit: number) =>
    `${used} of ${limit} searches used this month`,
  unlimited: "Unlimited searches on this plan",
  runningLow: "running low",
  exceededTitle: (used: number, limit: number) =>
    `Monthly search quota reached (${used} of ${limit} used)`,
  resets: (date: string) => `Your allowance resets on ${date}. Upgrade for more.`,
  notIncludedTitle: "SEO searches are not included in this plan",
  notIncludedBody:
    "SEO searches are not part of this tier. Upgrade to run them.",
  upgrade: "Upgrade",
};
export type SeoQuotaCopy = typeof seoQuotaEn;

export const SEO_QUOTA_COPY: Record<DashLocale, SeoQuotaCopy> = {
  en: seoQuotaEn,
  fr: {
    counter: (used: number, limit: number) =>
      `${used} recherches sur ${limit} utilisées ce mois-ci`,
    unlimited: "Recherches illimitées avec ce forfait",
    runningLow: "bientôt épuisées",
    exceededTitle: (used: number, limit: number) =>
      `Quota de recherches mensuel atteint (${used} sur ${limit} utilisées)`,
    resets: (date: string) =>
      `Votre allocation se renouvelle le ${date}. Passez à un forfait supérieur pour en obtenir davantage.`,
    notIncludedTitle: "Les recherches SEO ne sont pas incluses dans ce forfait",
    notIncludedBody:
      "Les recherches SEO ne font pas partie de ce palier. Passez à un forfait supérieur pour en lancer.",
    upgrade: "Améliorer",
  },
  "de-CH": {
    counter: (used: number, limit: number) =>
      `${used} von ${limit} Suchen diesen Monat genutzt`,
    unlimited: "Unbegrenzte Suchen in diesem Abo",
    runningLow: "bald aufgebraucht",
    exceededTitle: (used: number, limit: number) =>
      `Monatliches Suchkontingent erreicht (${used} von ${limit} genutzt)`,
    resets: (date: string) =>
      `Ihr Guthaben erneuert sich am ${date}. Für mehr bitte das Abo erweitern.`,
    notIncludedTitle: "SEO-Suchen sind in diesem Abo nicht enthalten",
    notIncludedBody:
      "SEO-Suchen gehören nicht zu dieser Stufe. Erweitern Sie das Abo, um sie auszuführen.",
    upgrade: "Erweitern",
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
  // "Last sync" alone cannot distinguish a sync that ran and stored rows from
  // one that ran and stored none — the second looks identical to a broken
  // sync. lastRowsSynced makes the difference visible.
  syncedRows: (rows: number) => (rows === 1 ? "1 row stored" : `${rows} rows stored`),
  syncedNoRows: "0 rows stored",
  syncedNoRowsHint:
    "The sync ran and Google returned no query rows. That is normal on a low-traffic property: Google withholds queries searched by too few people to stay anonymous.",
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
    syncedRows: (rows: number) =>
      rows === 1 ? "1 ligne enregistrée" : `${rows} lignes enregistrées`,
    syncedNoRows: "0 ligne enregistrée",
    syncedNoRowsHint:
      "La synchronisation a bien eu lieu et Google n'a renvoyé aucune ligne de requête. C'est normal sur une propriété à faible trafic : Google masque les requêtes effectuées par trop peu de personnes pour rester anonymes.",
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
    syncedRows: (rows: number) =>
      rows === 1 ? "1 Zeile gespeichert" : `${rows} Zeilen gespeichert`,
    syncedNoRows: "0 Zeilen gespeichert",
    syncedNoRowsHint:
      "Die Synchronisierung lief und Google lieferte keine Suchanfragen-Zeilen. Bei einer Property mit wenig Traffic ist das normal: Google hält Suchanfragen zurück, die von zu wenigen Personen gestellt wurden, um anonym zu bleiben.",
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
  checkingBody: "Results usually take a few minutes. You can leave this page — the check keeps running.",
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

  // ── Locked (STARTER) ──
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

// ─── Backlinks ──────────────────────────────────────────────────────────────
// Sibling of SITE_EXPLORER_COPY: same synchronous run-and-render shape, five
// sections instead of four. Plan numbers arrive as arguments rather than being
// written into the strings, so the copy cannot claim a cap the code does not
// enforce.
const backlinksToolEn = {
  formTitle: "Analyze a link profile",
  formIntro:
    "See who links to a site, which pages they point at, what text they use, and how the profile has grown.",
  targetLabel: "Domain or page URL",
  targetPlaceholderDomain: "example.com",
  targetPlaceholderUrl: "https://example.com/pricing",
  invalidDomain: "Enter a domain like example.com",
  invalidUrl: "Enter a full page URL like https://example.com/pricing",
  modeLabel: "Analyze",
  modeDomain: "Whole domain",
  modeExactUrl: "Exact URL",
  modeDomainHint: "Links to any page on the domain, including subdomains.",
  modeExactUrlHint: "Links to this one page only.",
  analyze: "Analyze",
  analyzing: "Analyzing…",
  analyzingTitle: "Checking the link profile…",
  analyzingBody: "Five data sets are collected in sequence — usually 10 to 20 seconds.",
  analyzedAgo: (ago: string) => `Analyzed ${ago}`,
  reRunIn: (hours: number) =>
    hours <= 1 ? "Re-run available in under an hour" : `Re-run available in ${hours}h`,
  cachedIntro: "Showing your saved analysis — no new data was pulled.",
  partialNote: "Some sections did not load. Everything else below is complete.",

  // ── Locked (STARTER) ──
  lockedTitle: "Backlinks is not in your plan",
  lockedBody:
    "Backlink analysis is available on Growth and Agency plans. Upgrade to see who links to any site and how its link profile is changing.",
  lockedCta: "See plans",

  // ── Summary ──
  summaryTitle: "Overview",
  metricBacklinks: "Backlinks",
  metricReferringDomains: "Referring domains",
  metricRank: "Domain rank",
  metricRankUnit: "0–1000",
  metricBroken: "Broken backlinks",
  metricDofollow: "Dofollow domains",
  metricSpam: "Spam score",
  metricSpamUnit: "0–100, lower is better",
  dofollowRatio: (percent: string) => `${percent}% of referring domains link without rel=nofollow`,
  noDofollowData: "No referring domains were reported for this target.",

  // ── History / growth chart ──
  historyTitle: "Growth over time",
  historySubtitle: "Backlinks and referring domains, month by month.",
  historyEmpty: "No history is available for this target yet.",
  legendBacklinks: "Backlinks",
  legendReferringDomains: "Referring domains",

  // ── Referring domains ──
  domainsTitle: "Referring domains",
  domainsSubtitle: (shown: number, total: number) =>
    `Strongest ${shown} of ${total.toLocaleString("en-US")} linking domains`,
  colDomain: "Domain",
  colRank: "Rank",
  colBacklinks: "Backlinks",
  colSpam: "Spam",
  colFirstSeen: "First seen",
  domainsEmpty: "No referring domains were found for this target.",
  lostLabel: "lost",

  // ── Anchors ──
  anchorsTitle: "Anchor text",
  anchorsSubtitle: (shown: number, total: number) =>
    `Top ${shown} of ${total.toLocaleString("en-US")} anchors`,
  colAnchor: "Anchor",
  colRefDomains: "Domains",
  noAnchorText: "(no text — image link)",
  anchorsEmpty: "No anchor text was found for this target.",

  // ── Pages ──
  pagesTitle: "Most linked pages",
  pagesSubtitle: (shown: number, total: number) =>
    `Top ${shown} of ${total.toLocaleString("en-US")} pages`,
  colPage: "Page",
  colStatus: "Status",
  pagesEmpty: "No linked pages were found for this target.",

  // ── Per-section failure ──
  sectionFailedTitle: "Couldn't load this section",
  sectionFailedBody:
    "The data provider did not return this part of the analysis. Run the analysis again later — the other sections are unaffected.",

  // ── History list ──
  recentTitle: "Recent analyses",
  recentEmpty: "No analyses yet. Analyze your first target above.",
  colTarget: "Target",
  colMode: "Scope",
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
    `Your plan includes ${limit} backlink analyses per month. Upgrade to run more, or wait for the counter to reset next month.`,
  quotaCta: "See plans",
  spend: (usd: string) => `Backlink data cost for this workspace: $${usd} USD`,
  submitFailed: "Could not analyze that target. Try again in a minute.",
  loadFailed: "Could not load your analyses. Try again in a minute.",
};
export type BacklinksToolCopy = typeof backlinksToolEn;

export const BACKLINKS_TOOL_COPY: Record<DashLocale, BacklinksToolCopy> = {
  en: backlinksToolEn,
  fr: {
    formTitle: "Analyser un profil de liens",
    formIntro:
      "Voyez qui pointe vers un site, vers quelles pages, avec quel texte d'ancrage, et comment le profil a évolué.",
    targetLabel: "Domaine ou URL de page",
    targetPlaceholderDomain: "exemple.com",
    targetPlaceholderUrl: "https://exemple.com/tarifs",
    invalidDomain: "Entrez un domaine comme exemple.com",
    invalidUrl: "Entrez une URL complète comme https://exemple.com/tarifs",
    modeLabel: "Analyser",
    modeDomain: "Tout le domaine",
    modeExactUrl: "URL exacte",
    modeDomainHint: "Les liens vers n'importe quelle page du domaine, sous-domaines inclus.",
    modeExactUrlHint: "Les liens vers cette seule page.",
    analyze: "Analyser",
    analyzing: "Analyse en cours…",
    analyzingTitle: "Vérification du profil de liens…",
    analyzingBody:
      "Cinq jeux de données sont collectés à la suite — habituellement de 10 à 20 secondes.",
    analyzedAgo: (ago: string) => `Analysé ${ago}`,
    reRunIn: (hours: number) =>
      hours <= 1
        ? "Relance possible dans moins d'une heure"
        : `Relance possible dans ${hours} h`,
    cachedIntro: "Affichage de votre analyse enregistrée — aucune nouvelle donnée n'a été tirée.",
    partialNote: "Certaines sections ne se sont pas chargées. Tout le reste ci-dessous est complet.",

    lockedTitle: "L'analyse de liens n'est pas incluse dans votre forfait",
    lockedBody:
      "L'analyse de liens est offerte avec les forfaits Croissance et Agence. Passez à un forfait supérieur pour voir qui pointe vers un site et comment son profil de liens évolue.",
    lockedCta: "Voir les forfaits",

    summaryTitle: "Aperçu",
    metricBacklinks: "Liens entrants",
    metricReferringDomains: "Domaines référents",
    metricRank: "Rang du domaine",
    metricRankUnit: "0–1000",
    metricBroken: "Liens brisés",
    metricDofollow: "Domaines dofollow",
    metricSpam: "Score de pourriel",
    metricSpamUnit: "0–100, plus bas est mieux",
    dofollowRatio: (percent: string) =>
      `${percent} % des domaines référents pointent sans rel=nofollow`,
    noDofollowData: "Aucun domaine référent n'a été rapporté pour cette cible.",

    historyTitle: "Évolution dans le temps",
    historySubtitle: "Liens entrants et domaines référents, mois par mois.",
    historyEmpty: "Aucun historique n'est disponible pour cette cible.",
    legendBacklinks: "Liens entrants",
    legendReferringDomains: "Domaines référents",

    domainsTitle: "Domaines référents",
    domainsSubtitle: (shown: number, total: number) =>
      `Les ${shown} domaines les plus forts sur ${total.toLocaleString("fr-CA")}`,
    colDomain: "Domaine",
    colRank: "Rang",
    colBacklinks: "Liens",
    colSpam: "Pourriel",
    colFirstSeen: "Vu la première fois",
    domainsEmpty: "Aucun domaine référent trouvé pour cette cible.",
    lostLabel: "perdu",

    anchorsTitle: "Texte d'ancrage",
    anchorsSubtitle: (shown: number, total: number) =>
      `Les ${shown} premières ancres sur ${total.toLocaleString("fr-CA")}`,
    colAnchor: "Ancre",
    colRefDomains: "Domaines",
    noAnchorText: "(sans texte — lien image)",
    anchorsEmpty: "Aucun texte d'ancrage trouvé pour cette cible.",

    pagesTitle: "Pages les plus liées",
    pagesSubtitle: (shown: number, total: number) =>
      `Les ${shown} premières pages sur ${total.toLocaleString("fr-CA")}`,
    colPage: "Page",
    colStatus: "Statut",
    pagesEmpty: "Aucune page liée trouvée pour cette cible.",

    sectionFailedTitle: "Impossible de charger cette section",
    sectionFailedBody:
      "Le fournisseur de données n'a pas retourné cette partie de l'analyse. Relancez l'analyse plus tard — les autres sections ne sont pas touchées.",

    recentTitle: "Analyses récentes",
    recentEmpty: "Aucune analyse pour l'instant. Analysez votre première cible ci-dessus.",
    colTarget: "Cible",
    colMode: "Portée",
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
      `Votre forfait comprend ${limit} analyses de liens par mois. Passez à un forfait supérieur pour en faire plus, ou attendez la remise à zéro le mois prochain.`,
    quotaCta: "Voir les forfaits",
    spend: (usd: string) => `Coût des données de liens pour cet espace de travail : ${usd} $ US`,
    submitFailed: "Impossible d'analyser cette cible. Réessayez dans une minute.",
    loadFailed: "Impossible de charger vos analyses. Réessayez dans une minute.",
  },
  "de-CH": {
    formTitle: "Linkprofil analysieren",
    formIntro:
      "Sehen Sie, wer auf eine Website verlinkt, auf welche Seiten, mit welchem Ankertext und wie sich das Profil entwickelt hat.",
    targetLabel: "Domain oder Seiten-URL",
    targetPlaceholderDomain: "beispiel.ch",
    targetPlaceholderUrl: "https://beispiel.ch/preise",
    invalidDomain: "Geben Sie eine Domain wie beispiel.ch ein",
    invalidUrl: "Geben Sie eine vollständige URL wie https://beispiel.ch/preise ein",
    modeLabel: "Analysieren",
    modeDomain: "Ganze Domain",
    modeExactUrl: "Genaue URL",
    modeDomainHint: "Links auf jede Seite der Domain, Subdomains eingeschlossen.",
    modeExactUrlHint: "Nur Links auf diese eine Seite.",
    analyze: "Analysieren",
    analyzing: "Wird analysiert…",
    analyzingTitle: "Linkprofil wird geprüft…",
    analyzingBody:
      "Fünf Datensätze werden nacheinander erhoben — normalerweise 10 bis 20 Sekunden.",
    analyzedAgo: (ago: string) => `Analysiert ${ago}`,
    reRunIn: (hours: number) =>
      hours <= 1
        ? "Neue Analyse in weniger als einer Stunde möglich"
        : `Neue Analyse in ${hours} Std. möglich`,
    cachedIntro:
      "Ihre gespeicherte Analyse wird angezeigt — es wurden keine neuen Daten abgerufen.",
    partialNote:
      "Einige Abschnitte konnten nicht geladen werden. Alles Übrige unten ist vollständig.",

    lockedTitle: "Backlinks ist nicht in Ihrem Plan enthalten",
    lockedBody:
      "Die Backlink-Analyse ist in den Plänen Growth und Agency enthalten. Wechseln Sie den Plan, um zu sehen, wer auf eine Website verlinkt und wie sich ihr Linkprofil verändert.",
    lockedCta: "Pläne ansehen",

    summaryTitle: "Übersicht",
    metricBacklinks: "Backlinks",
    metricReferringDomains: "Verweisende Domains",
    metricRank: "Domain-Rang",
    metricRankUnit: "0–1000",
    metricBroken: "Defekte Backlinks",
    metricDofollow: "Dofollow-Domains",
    metricSpam: "Spam-Score",
    metricSpamUnit: "0–100, tiefer ist besser",
    dofollowRatio: (percent: string) =>
      `${percent} % der verweisenden Domains verlinken ohne rel=nofollow`,
    noDofollowData: "Für dieses Ziel wurden keine verweisenden Domains gemeldet.",

    historyTitle: "Entwicklung über die Zeit",
    historySubtitle: "Backlinks und verweisende Domains, Monat für Monat.",
    historyEmpty: "Für dieses Ziel ist noch kein Verlauf verfügbar.",
    legendBacklinks: "Backlinks",
    legendReferringDomains: "Verweisende Domains",

    domainsTitle: "Verweisende Domains",
    domainsSubtitle: (shown: number, total: number) =>
      `Die ${shown} stärksten von ${total.toLocaleString("de-CH")} verlinkenden Domains`,
    colDomain: "Domain",
    colRank: "Rang",
    colBacklinks: "Backlinks",
    colSpam: "Spam",
    colFirstSeen: "Zuerst gesehen",
    domainsEmpty: "Für dieses Ziel wurden keine verweisenden Domains gefunden.",
    lostLabel: "verloren",

    anchorsTitle: "Ankertext",
    anchorsSubtitle: (shown: number, total: number) =>
      `Top ${shown} von ${total.toLocaleString("de-CH")} Ankern`,
    colAnchor: "Anker",
    colRefDomains: "Domains",
    noAnchorText: "(ohne Text — Bildlink)",
    anchorsEmpty: "Für dieses Ziel wurde kein Ankertext gefunden.",

    pagesTitle: "Meistverlinkte Seiten",
    pagesSubtitle: (shown: number, total: number) =>
      `Top ${shown} von ${total.toLocaleString("de-CH")} Seiten`,
    colPage: "Seite",
    colStatus: "Status",
    pagesEmpty: "Für dieses Ziel wurden keine verlinkten Seiten gefunden.",

    sectionFailedTitle: "Dieser Abschnitt konnte nicht geladen werden",
    sectionFailedBody:
      "Der Datenanbieter hat diesen Teil der Analyse nicht geliefert. Starten Sie die Analyse später erneut — die anderen Abschnitte sind nicht betroffen.",

    recentTitle: "Letzte Analysen",
    recentEmpty: "Noch keine Analysen. Analysieren Sie oben Ihr erstes Ziel.",
    colTarget: "Ziel",
    colMode: "Bereich",
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
      `Ihr Plan enthält ${limit} Backlink-Analysen pro Monat. Wechseln Sie den Plan für mehr, oder warten Sie auf die Rücksetzung im nächsten Monat.`,
    quotaCta: "Pläne ansehen",
    spend: (usd: string) => `Backlink-Datenkosten für diesen Arbeitsbereich: ${usd} USD`,
    submitFailed: "Dieses Ziel konnte nicht analysiert werden. Versuchen Sie es in einer Minute erneut.",
    loadFailed: "Ihre Analysen konnten nicht geladen werden. Versuchen Sie es in einer Minute erneut.",
  },
};

// ─── Backlinks help modal ───────────────────────────────────────────────────
// Same shape as RANK_TRACKER_HELP_COPY. One plain-language line per section,
// plus the index-freshness caveat: DataForSEO recrawls continuously, so this
// tool and any other backlink checker will disagree slightly on the same
// domain. Saying so up front is cheaper than answering the support ticket.
const backlinksHelpEn = {
  button: "Help",
  buttonAria: "How the Backlinks tool works",
  title: "How Backlinks works",
  close: "Close",

  intro:
    "Enter a domain to see every site linking to it, or switch to Exact URL to look at a single page.",

  backlinksTitle: "Backlinks vs referring domains",
  backlinksBody:
    "A backlink is one link. A referring domain is one website, however many links it sends. Ten links from one blog is one referring domain — usually worth less than ten links from ten different sites.",

  dofollowTitle: "Dofollow and nofollow",
  dofollowBody:
    "A nofollow link tells search engines not to pass ranking credit. Dofollow links are the ones that count toward rankings, so the split matters more than the raw total.",

  anchorsTitle: "Anchor text",
  anchorsBody:
    "The clickable words other sites use to link to you. It tells search engines what your page is about — and a profile where almost every anchor is the same phrase can look manipulated.",

  historyTitle: "Why growth history matters",
  historyBody:
    "A steady climb suggests links earned over time. A sudden spike, or a sharp drop, is worth investigating — it can mean a viral mention, a lost partnership, or links that were removed.",

  freshnessTitle: "About the numbers",
  freshnessBody:
    "The link index is refreshed continuously, so totals move day to day and will differ slightly from other backlink tools. Use the trend rather than the exact figure.",
};
export type BacklinksHelpCopy = typeof backlinksHelpEn;

export const BACKLINKS_HELP_COPY: Record<DashLocale, BacklinksHelpCopy> = {
  en: backlinksHelpEn,
  fr: {
    button: "Aide",
    buttonAria: "Comment fonctionne l'outil d'analyse de liens",
    title: "Comment fonctionne l'analyse de liens",
    close: "Fermer",

    intro:
      "Entrez un domaine pour voir tous les sites qui pointent vers lui, ou choisissez « URL exacte » pour examiner une seule page.",

    backlinksTitle: "Liens entrants et domaines référents",
    backlinksBody:
      "Un lien entrant est un seul lien. Un domaine référent est un site web, peu importe le nombre de liens qu'il envoie. Dix liens d'un même blogue comptent pour un domaine référent — généralement moins utile que dix liens provenant de dix sites différents.",

    dofollowTitle: "Dofollow et nofollow",
    dofollowBody:
      "Un lien nofollow indique aux moteurs de recherche de ne pas transmettre de valeur de classement. Ce sont les liens dofollow qui comptent pour le référencement, donc la répartition importe plus que le total brut.",

    anchorsTitle: "Texte d'ancrage",
    anchorsBody:
      "Les mots cliquables que les autres sites utilisent pour vous lier. Ils indiquent aux moteurs de recherche le sujet de votre page — et un profil où presque toutes les ancres sont identiques peut sembler manipulé.",

    historyTitle: "Pourquoi l'historique compte",
    historyBody:
      "Une hausse régulière suggère des liens gagnés au fil du temps. Une pointe soudaine, ou une chute marquée, mérite d'être examinée : mention virale, partenariat perdu ou liens retirés.",

    freshnessTitle: "À propos des chiffres",
    freshnessBody:
      "L'index de liens est rafraîchi en continu : les totaux bougent d'un jour à l'autre et différeront légèrement de ceux d'autres outils. Fiez-vous à la tendance plutôt qu'au chiffre exact.",
  },
  "de-CH": {
    button: "Hilfe",
    buttonAria: "So funktioniert das Backlinks-Tool",
    title: "So funktioniert Backlinks",
    close: "Schliessen",

    intro:
      "Geben Sie eine Domain ein, um alle darauf verlinkenden Websites zu sehen, oder wechseln Sie zu «Genaue URL», um eine einzelne Seite zu betrachten.",

    backlinksTitle: "Backlinks und verweisende Domains",
    backlinksBody:
      "Ein Backlink ist ein einzelner Link. Eine verweisende Domain ist eine Website, egal wie viele Links sie sendet. Zehn Links von einem Blog sind eine verweisende Domain — meist weniger wert als zehn Links von zehn verschiedenen Seiten.",

    dofollowTitle: "Dofollow und Nofollow",
    dofollowBody:
      "Ein Nofollow-Link sagt Suchmaschinen, keine Ranking-Wertung weiterzugeben. Dofollow-Links sind die, die fürs Ranking zählen — die Aufteilung ist daher wichtiger als die reine Gesamtzahl.",

    anchorsTitle: "Ankertext",
    anchorsBody:
      "Die anklickbaren Wörter, mit denen andere Seiten auf Sie verlinken. Sie sagen Suchmaschinen, worum es auf Ihrer Seite geht — und ein Profil, in dem fast jeder Anker gleich lautet, kann manipuliert wirken.",

    historyTitle: "Warum der Verlauf zählt",
    historyBody:
      "Ein stetiger Anstieg deutet auf über die Zeit verdiente Links hin. Ein plötzlicher Ausschlag oder ein starker Einbruch lohnt eine Prüfung: virale Erwähnung, verlorene Partnerschaft oder entfernte Links.",

    freshnessTitle: "Zu den Zahlen",
    freshnessBody:
      "Der Link-Index wird laufend aktualisiert. Die Summen bewegen sich von Tag zu Tag und weichen leicht von anderen Backlink-Tools ab. Achten Sie auf den Trend statt auf die exakte Zahl.",
  },
};

// ─── Lighthouse ─────────────────────────────────────────────────────────────
// Metric ABBREVIATIONS (LCP, CLS, TBT, INP…) are deliberately absent from
// these catalogs: they are the names of the things, identical in every locale
// and in every other tool the user reads. Only the surrounding prose is
// translated. Lighthouse's own formatted values ("2.4 s") come from the API.
const lighthouseToolEn = {
  formTitle: "Run a speed audit",
  formIntro:
    "Check how fast a page loads and how it scores on performance, accessibility, best practices and SEO.",
  urlLabel: "Page URL",
  urlPlaceholder: "https://example.com/pricing",
  invalidUrl: "Enter a full URL like https://example.com/pricing",
  notPublicUrl: "That address is not reachable from the public internet",
  strategyLabel: "Device",
  strategyMobile: "Mobile",
  strategyDesktop: "Desktop",
  strategyHint: "Mobile is throttled harder and usually scores lower — it is what Google indexes.",
  run: "Run audit",
  running: "Auditing…",
  runningTitle: "Auditing the page…",
  runningBody: "This takes up to 30 seconds. The page is loaded and measured in a real browser.",
  auditedAgo: (ago: string) => `Audited ${ago}`,
  reRunIn: (hours: number) =>
    hours <= 1 ? "Re-run available in under an hour" : `Re-run available in ${hours}h`,
  cachedIntro: "Showing your saved audit — the page was not re-tested.",
  finalUrlNote: (url: string) => `Redirected to ${url}`,
  versionNote: (version: string) => `Lighthouse ${version}`,

  // ── Scores ──
  scoresTitle: "Scores",
  scorePerformance: "Performance",
  scoreAccessibility: "Accessibility",
  scoreBestPractices: "Best practices",
  scoreSeo: "SEO",
  scoreNotAvailable: "Not scored",
  bandGood: "Good",
  bandAverage: "Needs work",
  bandPoor: "Poor",

  // ── Core Web Vitals ──
  vitalsTitle: "Core Web Vitals",
  fieldDataTitle: "Field data",
  fieldDataIntro: "What real Chrome users experienced over the last 28 days.",
  fieldDataOriginNote:
    "Not enough data for this exact page, so these figures describe the whole site.",
  noFieldDataTitle: "No field data available",
  noFieldDataBody:
    "Google only reports real-user data for pages with enough Chrome traffic. The lab measurements below still apply.",
  labDataTitle: "Lab data",
  labDataIntro: "Measured in a single simulated load, on a throttled connection.",
  metricNoValue: "—",

  // ── Opportunities ──
  opportunitiesTitle: "Opportunities",
  opportunitiesIntro: "Estimated time savings if each item is addressed.",
  opportunitiesEmpty: "No significant opportunities were found. Nice.",
  savingsMs: (ms: number) => `~${(ms / 1000).toFixed(1)}s faster`,
  savingsBytes: (kib: string) => `${kib} KiB smaller`,

  // ── History ──
  recentTitle: "Recent audits",
  recentEmpty: "No audits yet. Run your first one above.",
  colUrl: "Page",
  colDevice: "Device",
  colWhen: "Run",
  view: "View",

  // ── Limiter / errors ──
  usage: (used: number, limit: number) => `${used} of ${limit} audits used this hour`,
  limitTitle: "Hourly audit limit reached",
  limitBody: (limit: number) =>
    `You can run ${limit} audits an hour. Wait a few minutes and try again — this keeps the speed-test service responsive for everyone.`,
  runFailed: "Could not complete the audit. Try again in a minute.",
  loadFailed: "Could not load your audits. Try again in a minute.",
};
export type LighthouseToolCopy = typeof lighthouseToolEn;

export const LIGHTHOUSE_TOOL_COPY: Record<DashLocale, LighthouseToolCopy> = {
  en: lighthouseToolEn,
  fr: {
    formTitle: "Lancer un audit de vitesse",
    formIntro:
      "Vérifiez la vitesse de chargement d'une page et ses scores de performance, d'accessibilité, de bonnes pratiques et de référencement.",
    urlLabel: "URL de la page",
    urlPlaceholder: "https://exemple.com/tarifs",
    invalidUrl: "Entrez une URL complète comme https://exemple.com/tarifs",
    notPublicUrl: "Cette adresse n'est pas accessible depuis l'internet public",
    strategyLabel: "Appareil",
    strategyMobile: "Mobile",
    strategyDesktop: "Ordinateur",
    strategyHint:
      "Le mobile est plus fortement bridé et obtient généralement un score plus bas — c'est ce que Google indexe.",
    run: "Lancer l'audit",
    running: "Audit en cours…",
    runningTitle: "Audit de la page…",
    runningBody:
      "Cela prend jusqu'à 30 secondes. La page est chargée et mesurée dans un vrai navigateur.",
    auditedAgo: (ago: string) => `Audité ${ago}`,
    reRunIn: (hours: number) =>
      hours <= 1
        ? "Relance possible dans moins d'une heure"
        : `Relance possible dans ${hours} h`,
    cachedIntro: "Affichage de votre audit enregistré — la page n'a pas été retestée.",
    finalUrlNote: (url: string) => `Redirigé vers ${url}`,
    versionNote: (version: string) => `Lighthouse ${version}`,

    scoresTitle: "Scores",
    scorePerformance: "Performance",
    scoreAccessibility: "Accessibilité",
    scoreBestPractices: "Bonnes pratiques",
    scoreSeo: "Référencement",
    scoreNotAvailable: "Non évalué",
    bandGood: "Bon",
    bandAverage: "À améliorer",
    bandPoor: "Faible",

    vitalsTitle: "Signaux web essentiels",
    fieldDataTitle: "Données terrain",
    fieldDataIntro: "Ce qu'ont vécu de vrais utilisateurs de Chrome au cours des 28 derniers jours.",
    fieldDataOriginNote:
      "Pas assez de données pour cette page précise : ces chiffres décrivent l'ensemble du site.",
    noFieldDataTitle: "Aucune donnée terrain disponible",
    noFieldDataBody:
      "Google ne publie des données d'utilisateurs réels que pour les pages ayant assez de trafic Chrome. Les mesures en laboratoire ci-dessous restent valables.",
    labDataTitle: "Données de laboratoire",
    labDataIntro: "Mesurées lors d'un seul chargement simulé, sur une connexion bridée.",
    metricNoValue: "—",

    opportunitiesTitle: "Pistes d'amélioration",
    opportunitiesIntro: "Gains de temps estimés si chaque élément est corrigé.",
    opportunitiesEmpty: "Aucune piste significative trouvée. Bravo.",
    savingsMs: (ms: number) => `~${(ms / 1000).toFixed(1)} s plus rapide`,
    savingsBytes: (kib: string) => `${kib} Kio de moins`,

    recentTitle: "Audits récents",
    recentEmpty: "Aucun audit pour l'instant. Lancez le premier ci-dessus.",
    colUrl: "Page",
    colDevice: "Appareil",
    colWhen: "Lancé",
    view: "Voir",

    usage: (used: number, limit: number) => `${used} audits sur ${limit} utilisés cette heure`,
    limitTitle: "Limite d'audits horaire atteinte",
    limitBody: (limit: number) =>
      `Vous pouvez lancer ${limit} audits par heure. Attendez quelques minutes et réessayez — cela garde le service de test de vitesse réactif pour tout le monde.`,
    runFailed: "Impossible de terminer l'audit. Réessayez dans une minute.",
    loadFailed: "Impossible de charger vos audits. Réessayez dans une minute.",
  },
  "de-CH": {
    formTitle: "Geschwindigkeitsaudit starten",
    formIntro:
      "Prüfen Sie, wie schnell eine Seite lädt und wie sie bei Performance, Barrierefreiheit, Best Practices und SEO abschneidet.",
    urlLabel: "Seiten-URL",
    urlPlaceholder: "https://beispiel.ch/preise",
    invalidUrl: "Geben Sie eine vollständige URL wie https://beispiel.ch/preise ein",
    notPublicUrl: "Diese Adresse ist aus dem öffentlichen Internet nicht erreichbar",
    strategyLabel: "Gerät",
    strategyMobile: "Mobil",
    strategyDesktop: "Desktop",
    strategyHint:
      "Mobil wird stärker gedrosselt und schneidet meist schlechter ab — und ist das, was Google indexiert.",
    run: "Audit starten",
    running: "Audit läuft…",
    runningTitle: "Seite wird geprüft…",
    runningBody:
      "Das dauert bis zu 30 Sekunden. Die Seite wird in einem echten Browser geladen und gemessen.",
    auditedAgo: (ago: string) => `Geprüft ${ago}`,
    reRunIn: (hours: number) =>
      hours <= 1
        ? "Neues Audit in weniger als einer Stunde möglich"
        : `Neues Audit in ${hours} Std. möglich`,
    cachedIntro: "Ihr gespeichertes Audit wird angezeigt — die Seite wurde nicht neu getestet.",
    finalUrlNote: (url: string) => `Weitergeleitet zu ${url}`,
    versionNote: (version: string) => `Lighthouse ${version}`,

    scoresTitle: "Scores",
    scorePerformance: "Performance",
    scoreAccessibility: "Barrierefreiheit",
    scoreBestPractices: "Best Practices",
    scoreSeo: "SEO",
    scoreNotAvailable: "Nicht bewertet",
    bandGood: "Gut",
    bandAverage: "Verbesserungswürdig",
    bandPoor: "Schlecht",

    vitalsTitle: "Core Web Vitals",
    fieldDataTitle: "Felddaten",
    fieldDataIntro: "Was echte Chrome-Nutzende in den letzten 28 Tagen erlebt haben.",
    fieldDataOriginNote:
      "Zu wenig Daten für genau diese Seite — diese Werte beschreiben die ganze Website.",
    noFieldDataTitle: "Keine Felddaten verfügbar",
    noFieldDataBody:
      "Google meldet Daten echter Nutzender nur für Seiten mit genügend Chrome-Traffic. Die Labormessungen unten gelten trotzdem.",
    labDataTitle: "Labordaten",
    labDataIntro: "Gemessen in einem einzelnen simulierten Ladevorgang, über eine gedrosselte Verbindung.",
    metricNoValue: "—",

    opportunitiesTitle: "Verbesserungspotenzial",
    opportunitiesIntro: "Geschätzte Zeitersparnis, wenn der jeweilige Punkt behoben wird.",
    opportunitiesEmpty: "Kein nennenswertes Potenzial gefunden. Sehr gut.",
    savingsMs: (ms: number) => `~${(ms / 1000).toFixed(1)} s schneller`,
    savingsBytes: (kib: string) => `${kib} KiB kleiner`,

    recentTitle: "Letzte Audits",
    recentEmpty: "Noch keine Audits. Starten Sie oben Ihr erstes.",
    colUrl: "Seite",
    colDevice: "Gerät",
    colWhen: "Gestartet",
    view: "Ansehen",

    usage: (used: number, limit: number) => `${used} von ${limit} Audits in dieser Stunde verwendet`,
    limitTitle: "Stündliches Audit-Limit erreicht",
    limitBody: (limit: number) =>
      `Sie können ${limit} Audits pro Stunde starten. Warten Sie einige Minuten und versuchen Sie es erneut — das hält den Geschwindigkeitstest für alle reaktionsfähig.`,
    runFailed: "Das Audit konnte nicht abgeschlossen werden. Versuchen Sie es in einer Minute erneut.",
    loadFailed: "Ihre Audits konnten nicht geladen werden. Versuchen Sie es in einer Minute erneut.",
  },
};

// ─── Lighthouse help modal ──────────────────────────────────────────────────
const lighthouseHelpEn = {
  button: "Help",
  buttonAria: "How the speed audit works",
  title: "How the speed audit works",
  close: "Close",

  intro: "Each audit loads your page in a real browser and scores it the way Google does.",

  labFieldTitle: "Lab data vs field data",
  labFieldBody:
    "Lab data is one simulated load on a throttled connection — repeatable, and available for any page. Field data is what real Chrome users actually experienced over the last 28 days, and only exists for pages with enough traffic. Google ranks on field data; lab data is how you debug it.",

  scoresTitle: "What each score covers",
  scoresBody:
    "Performance is how fast the page loads and responds. Accessibility checks things like contrast, labels and keyboard use. Best practices covers security and modern web standards. SEO checks that search engines can crawl and understand the page.",

  devicesTitle: "Why mobile and desktop differ",
  devicesBody:
    "Mobile runs on a deliberately slow simulated connection and a weaker CPU, so it almost always scores lower. Google indexes the mobile version first, so treat the mobile score as the real one.",

  fluctuationTitle: "Scores move between runs",
  fluctuationBody:
    "The same page can score several points differently minute to minute — network conditions, ad scripts and server load all vary. Look at the trend across several audits rather than reacting to one number.",
};
export type LighthouseHelpCopy = typeof lighthouseHelpEn;

export const LIGHTHOUSE_HELP_COPY: Record<DashLocale, LighthouseHelpCopy> = {
  en: lighthouseHelpEn,
  fr: {
    button: "Aide",
    buttonAria: "Comment fonctionne l'audit de vitesse",
    title: "Comment fonctionne l'audit de vitesse",
    close: "Fermer",

    intro:
      "Chaque audit charge votre page dans un vrai navigateur et la note de la même façon que Google.",

    labFieldTitle: "Données de laboratoire et données terrain",
    labFieldBody:
      "Les données de laboratoire proviennent d'un seul chargement simulé sur une connexion bridée : reproductibles, et disponibles pour n'importe quelle page. Les données terrain correspondent à ce qu'ont réellement vécu les utilisateurs de Chrome au cours des 28 derniers jours, et n'existent que pour les pages ayant assez de trafic. Google classe selon les données terrain ; le laboratoire sert à les déboguer.",

    scoresTitle: "Ce que couvre chaque score",
    scoresBody:
      "La performance mesure la vitesse de chargement et de réaction. L'accessibilité vérifie le contraste, les libellés et l'utilisation au clavier. Les bonnes pratiques couvrent la sécurité et les standards web modernes. Le référencement vérifie que les moteurs de recherche peuvent explorer et comprendre la page.",

    devicesTitle: "Pourquoi mobile et ordinateur diffèrent",
    devicesBody:
      "Le mobile s'exécute sur une connexion simulée volontairement lente et un processeur plus faible : il obtient donc presque toujours un score inférieur. Google indexe d'abord la version mobile — considérez le score mobile comme le vrai.",

    fluctuationTitle: "Les scores varient d'une exécution à l'autre",
    fluctuationBody:
      "Une même page peut perdre ou gagner plusieurs points d'une minute à l'autre : conditions réseau, scripts publicitaires et charge du serveur varient tous. Regardez la tendance sur plusieurs audits plutôt que de réagir à un seul chiffre.",
  },
  "de-CH": {
    button: "Hilfe",
    buttonAria: "So funktioniert das Geschwindigkeitsaudit",
    title: "So funktioniert das Geschwindigkeitsaudit",
    close: "Schliessen",

    intro:
      "Jedes Audit lädt Ihre Seite in einem echten Browser und bewertet sie so, wie Google es tut.",

    labFieldTitle: "Labordaten und Felddaten",
    labFieldBody:
      "Labordaten stammen aus einem einzelnen simulierten Ladevorgang über eine gedrosselte Verbindung — wiederholbar und für jede Seite verfügbar. Felddaten sind das, was echte Chrome-Nutzende in den letzten 28 Tagen tatsächlich erlebt haben, und existieren nur für Seiten mit genügend Traffic. Google bewertet anhand der Felddaten; Labordaten dienen der Fehlersuche.",

    scoresTitle: "Was die einzelnen Scores abdecken",
    scoresBody:
      "Performance misst, wie schnell die Seite lädt und reagiert. Barrierefreiheit prüft Dinge wie Kontrast, Beschriftungen und Tastaturbedienung. Best Practices deckt Sicherheit und moderne Webstandards ab. SEO prüft, ob Suchmaschinen die Seite crawlen und verstehen können.",

    devicesTitle: "Warum Mobil und Desktop abweichen",
    devicesBody:
      "Mobil läuft auf einer bewusst langsamen simulierten Verbindung und schwächerer CPU und schneidet deshalb fast immer schlechter ab. Google indexiert zuerst die mobile Version — behandeln Sie den Mobil-Score als den massgebenden.",

    fluctuationTitle: "Scores schwanken zwischen Läufen",
    fluctuationBody:
      "Dieselbe Seite kann von Minute zu Minute mehrere Punkte anders abschneiden — Netzbedingungen, Werbeskripte und Serverlast schwanken alle. Achten Sie auf den Trend über mehrere Audits statt auf eine einzelne Zahl.",
  },
};

// ─── Site Audit ─────────────────────────────────────────────────────────────
// The technical-SEO crawl. Copy repeatedly distinguishes it from the audit on
// /visibility, which measures AI-engine readability — two different products
// with the word "audit" in both, and users WILL conflate them otherwise.
// Crawls take minutes, so the copy is written for leaving and coming back.
const siteAuditEn = {
  formTitle: "Audit a site",
  formIntro:
    "Crawl a site and find the technical problems holding it back in search: broken links, duplicate titles, missing meta, redirect and canonical issues.",
  vsVisibilityNote:
    "This checks technical SEO. To measure how AI assistants read your site, use the AI Visibility audit.",
  vsVisibilityLink: "Open AI Visibility →",
  domainLabel: "Domain",
  domainPlaceholder: "example.com",
  invalidDomain: "Enter a domain like example.com",
  start: "Start audit",
  starting: "Starting…",
  pageCapNote: (pages: number) => `Your plan crawls up to ${pages} pages per audit.`,

  // ── In flight ──
  crawlingTitle: "Crawling the site…",
  crawlingBody:
    "This takes a few minutes. You can leave this page — the crawl keeps running and the result appears in your history.",
  progress: (crawled: number, total: number) => `${crawled} of ${total} pages crawled`,
  statusQueued: "Starting",
  statusCrawling: "Crawling",
  statusCompleted: "Done",
  statusFailed: "Failed",
  failedTitle: "This audit did not finish",
  failedBody: "The crawl stopped before it completed. Start a new audit — nothing further was charged.",

  auditedAgo: (ago: string) => `Audited ${ago}`,
  reRunIn: (hours: number) =>
    hours <= 1 ? "Re-run available in under an hour" : `Re-run available in ${hours}h`,
  cachedIntro: "Showing your saved audit — the site was not re-crawled.",

  // ── Score + summary ──
  scoreTitle: "OnPage score",
  scoreUnit: "out of 100",
  scoreNotAvailable: "Not scored",
  summaryTitle: "Crawl summary",
  metricPagesCrawled: "Pages crawled",
  metricBrokenLinks: "Broken links",
  metricBrokenResources: "Broken resources",
  metricDuplicateTitles: "Duplicate titles",
  metricDuplicateDescriptions: "Duplicate descriptions",
  metric4xx: "4xx pages",
  metric5xx: "5xx pages",
  metricRedirects: "Redirects",

  // ── Issues ──
  issuesTitle: "Issues found",
  issuesEmpty: "No catalogued issues were found on the crawled pages. Nice.",
  severityError: "Errors",
  severityWarning: "Warnings",
  severityNotice: "Notices",
  severityErrorHint: "Broken, or invisible to search engines",
  severityWarningHint: "Works, but costing you rankings",
  severityNoticeHint: "Worth tidying up",
  affectedPages: (n: number) => (n === 1 ? "1 page" : `${n} pages`),
  showAffected: "Show pages",
  hideAffected: "Hide pages",
  noAffectedListed: "Affected pages are not listed for this check.",
  groupAvailability: "Availability",
  groupLinks: "Links and resources",
  groupContent: "Content",
  groupMeta: "Titles and meta",
  groupPerformance: "Speed",
  groupCanonical: "Canonical",
  groupSecurity: "HTTPS",

  // ── Pages ──
  pagesTitle: "Top problem pages",
  pagesSubtitle: (shown: number, total: number) =>
    `${shown} of ${total.toLocaleString("en-US")} crawled pages, most issues first`,
  colPage: "Page",
  colIssues: "Issues",
  colScore: "Score",
  colStatusCode: "Status",
  pagesEmpty: "No pages with issues were found.",

  // ── History ──
  recentTitle: "Recent audits",
  recentEmpty: "No audits yet. Start your first one above.",
  colDomain: "Domain",
  colPagesCol: "Pages",
  colWhen: "Started",
  view: "View",

  // ── Quota / errors ──
  usage: (used: number, limit: number) => `${used} of ${limit} audits used this month`,
  quotaTitle: "Monthly audit limit reached",
  quotaBody: (limit: number) =>
    `Your plan includes ${limit} site audits per month. Upgrade to run more, or wait for the counter to reset next month.`,
  quotaCta: "See plans",
  startFailed: "Could not start the audit. Try again in a minute.",
  loadFailed: "Could not load your audits. Try again in a minute.",
};
export type SiteAuditCopy = typeof siteAuditEn;

export const SITE_AUDIT_COPY: Record<DashLocale, SiteAuditCopy> = {
  en: siteAuditEn,
  fr: {
    formTitle: "Auditer un site",
    formIntro:
      "Explorez un site et trouvez les problèmes techniques qui freinent son référencement : liens brisés, titres en double, métadonnées manquantes, problèmes de redirection et de canonique.",
    vsVisibilityNote:
      "Ceci vérifie le référencement technique. Pour mesurer la façon dont les assistants IA lisent votre site, utilisez l'audit de visibilité IA.",
    vsVisibilityLink: "Ouvrir la visibilité IA →",
    domainLabel: "Domaine",
    domainPlaceholder: "exemple.com",
    invalidDomain: "Entrez un domaine comme exemple.com",
    start: "Lancer l'audit",
    starting: "Démarrage…",
    pageCapNote: (pages: number) =>
      `Votre forfait explore jusqu'à ${pages} pages par audit.`,

    crawlingTitle: "Exploration du site…",
    crawlingBody:
      "Cela prend quelques minutes. Vous pouvez quitter cette page — l'exploration continue et le résultat apparaîtra dans votre historique.",
    progress: (crawled: number, total: number) => `${crawled} pages explorées sur ${total}`,
    statusQueued: "Démarrage",
    statusCrawling: "Exploration",
    statusCompleted: "Terminé",
    statusFailed: "Échoué",
    failedTitle: "Cet audit ne s'est pas terminé",
    failedBody:
      "L'exploration s'est arrêtée avant la fin. Lancez un nouvel audit — rien de plus n'a été facturé.",

    auditedAgo: (ago: string) => `Audité ${ago}`,
    reRunIn: (hours: number) =>
      hours <= 1
        ? "Relance possible dans moins d'une heure"
        : `Relance possible dans ${hours} h`,
    cachedIntro: "Affichage de votre audit enregistré — le site n'a pas été réexploré.",

    scoreTitle: "Score OnPage",
    scoreUnit: "sur 100",
    scoreNotAvailable: "Non évalué",
    summaryTitle: "Résumé de l'exploration",
    metricPagesCrawled: "Pages explorées",
    metricBrokenLinks: "Liens brisés",
    metricBrokenResources: "Ressources brisées",
    metricDuplicateTitles: "Titres en double",
    metricDuplicateDescriptions: "Descriptions en double",
    metric4xx: "Pages 4xx",
    metric5xx: "Pages 5xx",
    metricRedirects: "Redirections",

    issuesTitle: "Problèmes détectés",
    issuesEmpty: "Aucun problème répertorié sur les pages explorées. Bravo.",
    severityError: "Erreurs",
    severityWarning: "Avertissements",
    severityNotice: "Remarques",
    severityErrorHint: "Brisé, ou invisible pour les moteurs de recherche",
    severityWarningHint: "Fonctionne, mais nuit à votre classement",
    severityNoticeHint: "À nettoyer",
    affectedPages: (n: number) => (n === 1 ? "1 page" : `${n} pages`),
    showAffected: "Voir les pages",
    hideAffected: "Masquer les pages",
    noAffectedListed: "Les pages concernées ne sont pas listées pour cette vérification.",
    groupAvailability: "Disponibilité",
    groupLinks: "Liens et ressources",
    groupContent: "Contenu",
    groupMeta: "Titres et métadonnées",
    groupPerformance: "Vitesse",
    groupCanonical: "Canonique",
    groupSecurity: "HTTPS",

    pagesTitle: "Pages les plus problématiques",
    pagesSubtitle: (shown: number, total: number) =>
      `${shown} pages sur ${total.toLocaleString("fr-CA")} explorées, les plus problématiques d'abord`,
    colPage: "Page",
    colIssues: "Problèmes",
    colScore: "Score",
    colStatusCode: "Statut",
    pagesEmpty: "Aucune page problématique trouvée.",

    recentTitle: "Audits récents",
    recentEmpty: "Aucun audit pour l'instant. Lancez le premier ci-dessus.",
    colDomain: "Domaine",
    colPagesCol: "Pages",
    colWhen: "Lancé",
    view: "Voir",

    usage: (used: number, limit: number) => `${used} audits sur ${limit} utilisés ce mois-ci`,
    quotaTitle: "Limite mensuelle d'audits atteinte",
    quotaBody: (limit: number) =>
      `Votre forfait comprend ${limit} audits de site par mois. Passez à un forfait supérieur pour en faire plus, ou attendez la remise à zéro le mois prochain.`,
    quotaCta: "Voir les forfaits",
    startFailed: "Impossible de lancer l'audit. Réessayez dans une minute.",
    loadFailed: "Impossible de charger vos audits. Réessayez dans une minute.",
  },
  "de-CH": {
    formTitle: "Website auditieren",
    formIntro:
      "Crawlen Sie eine Website und finden Sie die technischen Probleme, die sie in der Suche bremsen: defekte Links, doppelte Titel, fehlende Meta-Angaben, Weiterleitungs- und Canonical-Probleme.",
    vsVisibilityNote:
      "Dies prüft technisches SEO. Um zu messen, wie KI-Assistenten Ihre Website lesen, nutzen Sie das AI-Visibility-Audit.",
    vsVisibilityLink: "AI Visibility öffnen →",
    domainLabel: "Domain",
    domainPlaceholder: "beispiel.ch",
    invalidDomain: "Geben Sie eine Domain wie beispiel.ch ein",
    start: "Audit starten",
    starting: "Wird gestartet…",
    pageCapNote: (pages: number) => `Ihr Plan crawlt bis zu ${pages} Seiten pro Audit.`,

    crawlingTitle: "Website wird gecrawlt…",
    crawlingBody:
      "Das dauert einige Minuten. Sie können die Seite verlassen — der Crawl läuft weiter und das Ergebnis erscheint in Ihrem Verlauf.",
    progress: (crawled: number, total: number) => `${crawled} von ${total} Seiten gecrawlt`,
    statusQueued: "Startet",
    statusCrawling: "Crawlt",
    statusCompleted: "Fertig",
    statusFailed: "Fehlgeschlagen",
    failedTitle: "Dieses Audit wurde nicht abgeschlossen",
    failedBody:
      "Der Crawl wurde vor dem Ende gestoppt. Starten Sie ein neues Audit — es wurde nichts Weiteres verrechnet.",

    auditedAgo: (ago: string) => `Auditiert ${ago}`,
    reRunIn: (hours: number) =>
      hours <= 1
        ? "Neues Audit in weniger als einer Stunde möglich"
        : `Neues Audit in ${hours} Std. möglich`,
    cachedIntro: "Ihr gespeichertes Audit wird angezeigt — die Website wurde nicht neu gecrawlt.",

    scoreTitle: "OnPage-Score",
    scoreUnit: "von 100",
    scoreNotAvailable: "Nicht bewertet",
    summaryTitle: "Crawl-Zusammenfassung",
    metricPagesCrawled: "Gecrawlte Seiten",
    metricBrokenLinks: "Defekte Links",
    metricBrokenResources: "Defekte Ressourcen",
    metricDuplicateTitles: "Doppelte Titel",
    metricDuplicateDescriptions: "Doppelte Beschreibungen",
    metric4xx: "4xx-Seiten",
    metric5xx: "5xx-Seiten",
    metricRedirects: "Weiterleitungen",

    issuesTitle: "Gefundene Probleme",
    issuesEmpty: "Auf den gecrawlten Seiten wurden keine erfassten Probleme gefunden. Sehr gut.",
    severityError: "Fehler",
    severityWarning: "Warnungen",
    severityNotice: "Hinweise",
    severityErrorHint: "Defekt oder für Suchmaschinen unsichtbar",
    severityWarningHint: "Funktioniert, kostet aber Rankings",
    severityNoticeHint: "Sollte aufgeräumt werden",
    affectedPages: (n: number) => (n === 1 ? "1 Seite" : `${n} Seiten`),
    showAffected: "Seiten anzeigen",
    hideAffected: "Seiten ausblenden",
    noAffectedListed: "Für diese Prüfung sind keine betroffenen Seiten aufgeführt.",
    groupAvailability: "Verfügbarkeit",
    groupLinks: "Links und Ressourcen",
    groupContent: "Inhalt",
    groupMeta: "Titel und Meta",
    groupPerformance: "Geschwindigkeit",
    groupCanonical: "Canonical",
    groupSecurity: "HTTPS",

    pagesTitle: "Problematischste Seiten",
    pagesSubtitle: (shown: number, total: number) =>
      `${shown} von ${total.toLocaleString("de-CH")} gecrawlten Seiten, meiste Probleme zuerst`,
    colPage: "Seite",
    colIssues: "Probleme",
    colScore: "Score",
    colStatusCode: "Status",
    pagesEmpty: "Es wurden keine problematischen Seiten gefunden.",

    recentTitle: "Letzte Audits",
    recentEmpty: "Noch keine Audits. Starten Sie oben Ihr erstes.",
    colDomain: "Domain",
    colPagesCol: "Seiten",
    colWhen: "Gestartet",
    view: "Ansehen",

    usage: (used: number, limit: number) => `${used} von ${limit} Audits diesen Monat verwendet`,
    quotaTitle: "Monatliches Auditlimit erreicht",
    quotaBody: (limit: number) =>
      `Ihr Plan enthält ${limit} Website-Audits pro Monat. Wechseln Sie den Plan für mehr, oder warten Sie auf die Rücksetzung im nächsten Monat.`,
    quotaCta: "Pläne ansehen",
    startFailed: "Das Audit konnte nicht gestartet werden. Versuchen Sie es in einer Minute erneut.",
    loadFailed: "Ihre Audits konnten nicht geladen werden. Versuchen Sie es in einer Minute erneut.",
  },
};

// ─── Site Audit help modal ──────────────────────────────────────────────────
const siteAuditHelpEn = {
  button: "Help",
  buttonAria: "How the site audit works",
  title: "How the site audit works",
  close: "Close",

  intro: "Each audit crawls your site page by page and reports what search engines would trip over.",

  scoreTitle: "What the OnPage score means",
  scoreBody:
    "A single 0-100 summary of how clean the crawled pages are. It weighs broken pages and missing basics heavily, so a handful of 4xx pages drags it down fast. Treat it as a direction of travel, not a grade.",

  severityTitle: "Errors, warnings and notices",
  severityBody:
    "Errors mean a page is broken or invisible to search engines — fix these first. Warnings work but cost you rankings, like a missing description or a duplicate title. Notices are tidy-ups with little direct impact.",

  limitsTitle: "How many pages get crawled",
  limitsBody: (starter: number, growth: number, agency: number) =>
    `Crawl size depends on your plan: Starter ${starter} pages, Growth ${growth}, Agency ${agency}. The crawler starts at your home page and follows internal links, so the most important pages are covered first.`,

  vsVisibilityTitle: "This is not the AI Visibility audit",
  vsVisibilityBody:
    "This tool checks classic technical SEO — the things Google's crawler cares about. The AI Visibility audit on the Visibility page measures something different: how readable and quotable your site is to AI assistants. Most sites need both.",
};
export type SiteAuditHelpCopy = typeof siteAuditHelpEn;

export const SITE_AUDIT_HELP_COPY: Record<DashLocale, SiteAuditHelpCopy> = {
  en: siteAuditHelpEn,
  fr: {
    button: "Aide",
    buttonAria: "Comment fonctionne l'audit de site",
    title: "Comment fonctionne l'audit de site",
    close: "Fermer",

    intro:
      "Chaque audit explore votre site page par page et signale ce sur quoi les moteurs de recherche buteraient.",

    scoreTitle: "Ce que signifie le score OnPage",
    scoreBody:
      "Un résumé unique de 0 à 100 de la propreté des pages explorées. Il pénalise fortement les pages brisées et les éléments de base manquants : quelques pages 4xx le font chuter rapidement. Voyez-le comme une tendance, pas comme une note.",

    severityTitle: "Erreurs, avertissements et remarques",
    severityBody:
      "Une erreur signifie qu'une page est brisée ou invisible pour les moteurs de recherche — corrigez-les en premier. Les avertissements fonctionnent mais nuisent à votre classement, comme une description manquante ou un titre en double. Les remarques sont des nettoyages à faible impact direct.",

    limitsTitle: "Combien de pages sont explorées",
    limitsBody: (starter: number, growth: number, agency: number) =>
      `La taille de l'exploration dépend de votre forfait : Démarrage ${starter} pages, Croissance ${growth}, Agence ${agency}. L'explorateur part de votre page d'accueil et suit les liens internes, donc les pages les plus importantes sont couvertes en premier.`,

    vsVisibilityTitle: "Ce n'est pas l'audit de visibilité IA",
    vsVisibilityBody:
      "Cet outil vérifie le référencement technique classique — ce qui compte pour l'explorateur de Google. L'audit de visibilité IA, sur la page Visibilité, mesure autre chose : à quel point votre site est lisible et citable par les assistants IA. La plupart des sites ont besoin des deux.",
  },
  "de-CH": {
    button: "Hilfe",
    buttonAria: "So funktioniert das Website-Audit",
    title: "So funktioniert das Website-Audit",
    close: "Schliessen",

    intro:
      "Jedes Audit crawlt Ihre Website Seite für Seite und meldet, worüber Suchmaschinen stolpern würden.",

    scoreTitle: "Was der OnPage-Score bedeutet",
    scoreBody:
      "Eine einzelne Zusammenfassung von 0 bis 100, wie sauber die gecrawlten Seiten sind. Defekte Seiten und fehlende Grundlagen wiegen schwer — schon einige 4xx-Seiten drücken ihn deutlich. Betrachten Sie ihn als Richtung, nicht als Note.",

    severityTitle: "Fehler, Warnungen und Hinweise",
    severityBody:
      "Ein Fehler bedeutet, dass eine Seite defekt oder für Suchmaschinen unsichtbar ist — zuerst beheben. Warnungen funktionieren, kosten aber Rankings, etwa eine fehlende Beschreibung oder ein doppelter Titel. Hinweise sind Aufräumarbeiten mit geringer direkter Wirkung.",

    limitsTitle: "Wie viele Seiten gecrawlt werden",
    limitsBody: (starter: number, growth: number, agency: number) =>
      `Die Crawl-Grösse hängt vom Plan ab: Starter ${starter} Seiten, Growth ${growth}, Agency ${agency}. Der Crawler startet auf Ihrer Startseite und folgt internen Links, sodass die wichtigsten Seiten zuerst abgedeckt sind.`,

    vsVisibilityTitle: "Das ist nicht das AI-Visibility-Audit",
    vsVisibilityBody:
      "Dieses Tool prüft klassisches technisches SEO — das, was Googles Crawler interessiert. Das AI-Visibility-Audit auf der Visibility-Seite misst etwas anderes: wie lesbar und zitierfähig Ihre Website für KI-Assistenten ist. Die meisten Websites brauchen beides.",
  },
};

// ─── Web Analytics (GA4) ────────────────────────────────────────────────────
// A CONNECTION-first tool: most of this copy is states the user is in before
// any data exists (disconnected, picking a property, needing to reconnect),
// which is where an integration actually lives or dies.
// Metric names stay in plain language; GA4's own field names (sessionSource,
// engagementRate) never reach the UI.
const webAnalyticsEn = {
  // ── Connect ──
  connectTitle: "Connect Google Analytics",
  connectBody:
    "See how people find and use your site — sessions, traffic sources, top pages and conversions — without leaving Echorank360.",
  connectCta: "Connect analytics",
  connectPrivacy: "We request read-only access. Echorank360 can never change anything in your Analytics account.",
  vsInternalNote:
    "This is your website traffic from Google Analytics. Reputation analytics — reviews, ratings and feedback — lives on its own page.",
  vsInternalLink: "Open reputation analytics →",

  // ── Property picker ──
  pickTitle: "Choose a property",
  pickBody: "Pick the Analytics property you want to report on. You can change it later.",
  pickCta: "Use this property",
  picking: "Saving…",
  noProperties:
    "This Google account has no Analytics properties. Connect an account with access to a GA4 property.",

  // ── Reconnect / errors ──
  reauthTitle: "Reconnect Google Analytics",
  reauthBody:
    "Your connection expired or access was withdrawn in Google. Reconnect to keep reporting.",
  reauthCta: "Reconnect",
  missingScopeTitle: "Analytics access is not enabled",
  missingScopeBody:
    "The Google connection is missing permission to read Analytics. Your administrator needs to enable it before this tool can load data.",
  quotaTitle: "Google is rate limiting this property",
  quotaBody: "Google's Analytics quota is temporarily used up. Try again in a few minutes.",
  rateLimitTitle: "Too many refreshes",
  rateLimitBody: (limit: number) =>
    `You can refresh ${limit} times an hour. The data updates hourly anyway, so this is rarely a limit worth hitting.`,
  loadFailed: "Could not load your analytics. Try again in a minute.",
  connectFailed: "Could not complete the connection. Try again.",
  errorDenied: "The Google connection was cancelled.",
  errorBadState: "That connection link expired. Start again.",
  errorNoRefreshToken: "Google did not return a lasting connection. Try connecting again.",
  errorNoProperties: "That Google account has no Analytics properties.",
  errorExchangeFailed: "Could not complete the connection. Try again.",

  // ── Connected chrome ──
  connectedTo: (property: string) => `Reporting on ${property}`,
  changeProperty: "Change property",
  disconnect: "Disconnect",
  disconnectConfirm: "Disconnect Google Analytics? Your reports will stop loading until you reconnect.",
  refresh: "Refresh",
  refreshing: "Refreshing…",
  updatedAgo: (ago: string) => `Updated ${ago}`,
  cachedNote: "Cached for up to an hour.",
  rangeLabel: "Date range",
  range7: "Last 7 days",
  range28: "Last 28 days",
  range90: "Last 90 days",
  comparedTo: (start: string, end: string) => `compared to ${start} – ${end}`,
  loading: "Loading your analytics…",

  // ── Empty ──
  emptyTitle: "No data for this period",
  emptyBody:
    "This property has not recorded any traffic in the selected range. If you just installed the tag, data can take up to 48 hours to appear.",

  // ── Headline ──
  headlineTitle: "Overview",
  metricSessions: "Sessions",
  metricTotalUsers: "Total users",
  metricNewUsers: "New users",
  metricEngagementRate: "Engagement rate",
  metricAvgEngagementTime: "Avg. session length",
  metricConversions: "Key events",
  metricUnavailable: "Not configured",
  metricUnavailableHint: "This property does not report this metric.",

  // ── Traffic ──
  trafficTitle: "Traffic over time",
  trafficSubtitle: "Sessions and users, day by day.",
  legendSessions: "Sessions",
  legendUsers: "Users",

  // ── Channels ──
  channelsTitle: "Where visitors come from",
  channelsSubtitle: "Sessions by channel.",
  colChannel: "Channel",
  colSessions: "Sessions",
  colShare: "Share",
  channelsEmpty: "No channel data for this period.",

  // ── Pages ──
  pagesTitle: "Top pages",
  colPage: "Page",
  colViews: "Views",
  colEngagement: "Engagement",
  pagesEmpty: "No page data for this period.",

  // ── Referrers ──
  referrersTitle: "Top referrers",
  referrersSubtitle: "Sites sending you referral traffic.",
  colSource: "Source",
  referrersEmpty: "No referral traffic in this period.",
};
export type WebAnalyticsCopy = typeof webAnalyticsEn;

export const WEB_ANALYTICS_COPY: Record<DashLocale, WebAnalyticsCopy> = {
  en: webAnalyticsEn,
  fr: {
    connectTitle: "Connecter Google Analytics",
    connectBody:
      "Découvrez comment les gens trouvent et utilisent votre site — sessions, sources de trafic, pages populaires et conversions — sans quitter Echorank360.",
    connectCta: "Connecter Analytics",
    connectPrivacy:
      "Nous demandons un accès en lecture seule. Echorank360 ne peut jamais rien modifier dans votre compte Analytics.",
    vsInternalNote:
      "Il s'agit du trafic de votre site web, provenant de Google Analytics. L'analyse de réputation — avis, notes et commentaires — se trouve sur sa propre page.",
    vsInternalLink: "Ouvrir l'analyse de réputation →",

    pickTitle: "Choisissez une propriété",
    pickBody:
      "Sélectionnez la propriété Analytics sur laquelle porteront les rapports. Vous pourrez la changer plus tard.",
    pickCta: "Utiliser cette propriété",
    picking: "Enregistrement…",
    noProperties:
      "Ce compte Google ne possède aucune propriété Analytics. Connectez un compte ayant accès à une propriété GA4.",

    reauthTitle: "Reconnecter Google Analytics",
    reauthBody:
      "Votre connexion a expiré ou l'accès a été retiré dans Google. Reconnectez-vous pour continuer à voir vos rapports.",
    reauthCta: "Reconnecter",
    missingScopeTitle: "L'accès à Analytics n'est pas activé",
    missingScopeBody:
      "La connexion Google n'a pas la permission de lire Analytics. Votre administrateur doit l'activer avant que cet outil puisse charger des données.",
    quotaTitle: "Google limite temporairement cette propriété",
    quotaBody:
      "Le quota Analytics de Google est temporairement épuisé. Réessayez dans quelques minutes.",
    rateLimitTitle: "Trop d'actualisations",
    rateLimitBody: (limit: number) =>
      `Vous pouvez actualiser ${limit} fois par heure. Les données se mettent de toute façon à jour chaque heure.`,
    loadFailed: "Impossible de charger vos données. Réessayez dans une minute.",
    connectFailed: "Impossible de terminer la connexion. Réessayez.",
    errorDenied: "La connexion Google a été annulée.",
    errorBadState: "Ce lien de connexion a expiré. Recommencez.",
    errorNoRefreshToken: "Google n'a pas retourné de connexion durable. Essayez de vous reconnecter.",
    errorNoProperties: "Ce compte Google ne possède aucune propriété Analytics.",
    errorExchangeFailed: "Impossible de terminer la connexion. Réessayez.",

    connectedTo: (property: string) => `Rapports pour ${property}`,
    changeProperty: "Changer de propriété",
    disconnect: "Déconnecter",
    disconnectConfirm:
      "Déconnecter Google Analytics ? Vos rapports cesseront de se charger jusqu'à une nouvelle connexion.",
    refresh: "Actualiser",
    refreshing: "Actualisation…",
    updatedAgo: (ago: string) => `Mis à jour ${ago}`,
    cachedNote: "Mis en cache jusqu'à une heure.",
    rangeLabel: "Période",
    range7: "7 derniers jours",
    range28: "28 derniers jours",
    range90: "90 derniers jours",
    comparedTo: (start: string, end: string) => `par rapport au ${start} – ${end}`,
    loading: "Chargement de vos données…",

    emptyTitle: "Aucune donnée pour cette période",
    emptyBody:
      "Cette propriété n'a enregistré aucun trafic sur la période choisie. Si vous venez d'installer la balise, les données peuvent prendre jusqu'à 48 heures à apparaître.",

    headlineTitle: "Aperçu",
    metricSessions: "Sessions",
    metricTotalUsers: "Utilisateurs totaux",
    metricNewUsers: "Nouveaux utilisateurs",
    metricEngagementRate: "Taux d'engagement",
    metricAvgEngagementTime: "Durée moyenne des sessions",
    metricConversions: "Événements clés",
    metricUnavailable: "Non configuré",
    metricUnavailableHint: "Cette propriété ne fournit pas cette mesure.",

    trafficTitle: "Trafic dans le temps",
    trafficSubtitle: "Sessions et utilisateurs, jour par jour.",
    legendSessions: "Sessions",
    legendUsers: "Utilisateurs",

    channelsTitle: "D'où viennent les visiteurs",
    channelsSubtitle: "Sessions par canal.",
    colChannel: "Canal",
    colSessions: "Sessions",
    colShare: "Part",
    channelsEmpty: "Aucune donnée de canal pour cette période.",

    pagesTitle: "Pages les plus vues",
    colPage: "Page",
    colViews: "Vues",
    colEngagement: "Engagement",
    pagesEmpty: "Aucune donnée de page pour cette période.",

    referrersTitle: "Principaux sites référents",
    referrersSubtitle: "Sites qui vous envoient du trafic de référence.",
    colSource: "Source",
    referrersEmpty: "Aucun trafic de référence sur cette période.",
  },
  "de-CH": {
    connectTitle: "Google Analytics verbinden",
    connectBody:
      "Sehen Sie, wie Menschen Ihre Website finden und nutzen — Sitzungen, Traffic-Quellen, Top-Seiten und Conversions — ohne Echorank360 zu verlassen.",
    connectCta: "Analytics verbinden",
    connectPrivacy:
      "Wir fragen nur Lesezugriff an. Echorank360 kann in Ihrem Analytics-Konto nichts verändern.",
    vsInternalNote:
      "Dies ist Ihr Website-Traffic aus Google Analytics. Die Reputationsanalyse — Bewertungen, Sterne und Feedback — hat ihre eigene Seite.",
    vsInternalLink: "Reputationsanalyse öffnen →",

    pickTitle: "Property auswählen",
    pickBody:
      "Wählen Sie die Analytics-Property für Ihre Berichte. Sie können sie später ändern.",
    pickCta: "Diese Property verwenden",
    picking: "Wird gespeichert…",
    noProperties:
      "Dieses Google-Konto hat keine Analytics-Properties. Verbinden Sie ein Konto mit Zugriff auf eine GA4-Property.",

    reauthTitle: "Google Analytics neu verbinden",
    reauthBody:
      "Ihre Verbindung ist abgelaufen oder der Zugriff wurde in Google entzogen. Verbinden Sie neu, um weiter Berichte zu sehen.",
    reauthCta: "Neu verbinden",
    missingScopeTitle: "Analytics-Zugriff ist nicht aktiviert",
    missingScopeBody:
      "Der Google-Verbindung fehlt die Berechtigung, Analytics zu lesen. Ihre Administration muss sie aktivieren, bevor dieses Tool Daten laden kann.",
    quotaTitle: "Google drosselt diese Property gerade",
    quotaBody:
      "Das Analytics-Kontingent von Google ist vorübergehend aufgebraucht. Versuchen Sie es in einigen Minuten erneut.",
    rateLimitTitle: "Zu viele Aktualisierungen",
    rateLimitBody: (limit: number) =>
      `Sie können ${limit}-mal pro Stunde aktualisieren. Die Daten werden ohnehin stündlich aktualisiert.`,
    loadFailed: "Ihre Daten konnten nicht geladen werden. Versuchen Sie es in einer Minute erneut.",
    connectFailed: "Die Verbindung konnte nicht abgeschlossen werden. Versuchen Sie es erneut.",
    errorDenied: "Die Google-Verbindung wurde abgebrochen.",
    errorBadState: "Dieser Verbindungslink ist abgelaufen. Beginnen Sie neu.",
    errorNoRefreshToken:
      "Google hat keine dauerhafte Verbindung zurückgegeben. Versuchen Sie es erneut.",
    errorNoProperties: "Dieses Google-Konto hat keine Analytics-Properties.",
    errorExchangeFailed: "Die Verbindung konnte nicht abgeschlossen werden. Versuchen Sie es erneut.",

    connectedTo: (property: string) => `Berichte für ${property}`,
    changeProperty: "Property wechseln",
    disconnect: "Trennen",
    disconnectConfirm:
      "Google Analytics trennen? Ihre Berichte laden erst nach einer neuen Verbindung wieder.",
    refresh: "Aktualisieren",
    refreshing: "Wird aktualisiert…",
    updatedAgo: (ago: string) => `Aktualisiert ${ago}`,
    cachedNote: "Bis zu eine Stunde zwischengespeichert.",
    rangeLabel: "Zeitraum",
    range7: "Letzte 7 Tage",
    range28: "Letzte 28 Tage",
    range90: "Letzte 90 Tage",
    comparedTo: (start: string, end: string) => `verglichen mit ${start} – ${end}`,
    loading: "Ihre Daten werden geladen…",

    emptyTitle: "Keine Daten für diesen Zeitraum",
    emptyBody:
      "Diese Property hat im gewählten Zeitraum keinen Traffic erfasst. Wenn Sie das Tag gerade erst eingebaut haben, kann es bis zu 48 Stunden dauern, bis Daten erscheinen.",

    headlineTitle: "Übersicht",
    metricSessions: "Sitzungen",
    metricTotalUsers: "Nutzende gesamt",
    metricNewUsers: "Neue Nutzende",
    metricEngagementRate: "Interaktionsrate",
    metricAvgEngagementTime: "Ø Sitzungsdauer",
    metricConversions: "Schlüsselereignisse",
    metricUnavailable: "Nicht konfiguriert",
    metricUnavailableHint: "Diese Property liefert diese Kennzahl nicht.",

    trafficTitle: "Traffic über die Zeit",
    trafficSubtitle: "Sitzungen und Nutzende, Tag für Tag.",
    legendSessions: "Sitzungen",
    legendUsers: "Nutzende",

    channelsTitle: "Woher die Besuchenden kommen",
    channelsSubtitle: "Sitzungen nach Kanal.",
    colChannel: "Kanal",
    colSessions: "Sitzungen",
    colShare: "Anteil",
    channelsEmpty: "Keine Kanaldaten für diesen Zeitraum.",

    pagesTitle: "Top-Seiten",
    colPage: "Seite",
    colViews: "Aufrufe",
    colEngagement: "Interaktion",
    pagesEmpty: "Keine Seitendaten für diesen Zeitraum.",

    referrersTitle: "Top-Verweisquellen",
    referrersSubtitle: "Websites, die Ihnen Verweis-Traffic senden.",
    colSource: "Quelle",
    referrersEmpty: "Kein Verweis-Traffic in diesem Zeitraum.",
  },
};

// ─── SERP Checker help modal ────────────────────────────────────────────────
// Same shape as the other tool help catalogs. The single thing users get wrong
// here is expecting an instant answer: the check is queued and a worker fills
// it in, so the wait is a first-class part of the explanation, not a footnote.
const serpCheckerHelpEn = {
  button: "Help",
  buttonAria: "How the SERP checker works",
  title: "How the SERP checker works",
  close: "Close",

  intro: "Each check captures Google's live results page for one keyword, exactly as it looked at that moment.",

  snapshotTitle: "A check is a snapshot, not a tracker",
  snapshotBody:
    "You get the top 100 organic results for that keyword at the moment the check ran — position, title, URL and domain. It is a photograph of one search. To watch a position change over time, add the keyword to Rank Tracker instead.",

  targetingTitle: "Location, language and device change the answer",
  targetingBody:
    "Google returns different results for the same keyword depending on where the searcher is, what language they search in, and whether they are on a phone. Set these to match the customer you are trying to reach — a desktop check from the wrong country tells you very little.",

  featuresTitle: "SERP features push organic results down",
  featuresBody:
    "The chips above the table are the non-organic blocks Google put on the page: ads, featured snippets, People Also Ask, local packs, videos. Position 1 organic can still sit below the fold when enough of them are present, which is why two keywords at the same position perform differently.",

  timingTitle: "Results usually take a few minutes",
  timingBody:
    "The check is queued and completed by a background worker, so it appears as Queued first. You can leave this page — the result lands in your history either way. Re-running the same keyword and settings shortly after reuses the stored result rather than spending your quota again.",
};
export type SerpCheckerHelpCopy = typeof serpCheckerHelpEn;

export const SERP_CHECKER_HELP_COPY: Record<DashLocale, SerpCheckerHelpCopy> = {
  en: serpCheckerHelpEn,
  fr: {
    button: "Aide",
    buttonAria: "Comment fonctionne le vérificateur de SERP",
    title: "Comment fonctionne le vérificateur de SERP",
    close: "Fermer",

    intro:
      "Chaque vérification capture la page de résultats de Google pour un mot-clé, telle qu'elle était à cet instant.",

    snapshotTitle: "Une vérification est un instantané, pas un suivi",
    snapshotBody:
      "Vous obtenez les 100 premiers résultats organiques pour ce mot-clé au moment de la vérification : position, titre, URL et domaine. C'est la photographie d'une seule recherche. Pour suivre l'évolution d'une position dans le temps, ajoutez plutôt le mot-clé au suivi de positions.",

    targetingTitle: "Lieu, langue et appareil changent la réponse",
    targetingBody:
      "Google renvoie des résultats différents pour un même mot-clé selon l'endroit d'où l'on cherche, la langue utilisée et l'usage d'un téléphone. Réglez ces champs sur le client que vous visez : une vérification sur ordinateur depuis le mauvais pays vous apprend peu de choses.",

    featuresTitle: "Les fonctionnalités SERP repoussent l'organique vers le bas",
    featuresBody:
      "Les étiquettes au-dessus du tableau sont les blocs non organiques que Google a placés sur la page : annonces, extraits optimisés, questions fréquentes, packs locaux, vidéos. La première position organique peut rester sous la ligne de flottaison quand ils sont nombreux — d'où deux mots-clés à la même position qui ne performent pas pareil.",

    timingTitle: "Les résultats prennent généralement quelques minutes",
    timingBody:
      "La vérification est mise en file d'attente puis complétée par un processus en arrière-plan : elle apparaît donc d'abord comme « En attente ». Vous pouvez quitter cette page — le résultat arrive dans votre historique dans tous les cas. Relancer le même mot-clé avec les mêmes réglages peu après réutilise le résultat stocké au lieu de consommer votre quota.",
  },
  "de-CH": {
    button: "Hilfe",
    buttonAria: "So funktioniert die SERP-Prüfung",
    title: "So funktioniert die SERP-Prüfung",
    close: "Schliessen",

    intro:
      "Jede Prüfung erfasst die Google-Ergebnisseite für ein Keyword genau so, wie sie in diesem Moment aussah.",

    snapshotTitle: "Eine Prüfung ist eine Momentaufnahme, kein Monitoring",
    snapshotBody:
      "Sie erhalten die ersten 100 organischen Ergebnisse für dieses Keyword zum Zeitpunkt der Prüfung — Position, Titel, URL und Domain. Es ist die Aufnahme einer einzelnen Suche. Um eine Position über die Zeit zu beobachten, nehmen Sie das Keyword stattdessen ins Rank Tracking auf.",

    targetingTitle: "Standort, Sprache und Gerät ändern das Ergebnis",
    targetingBody:
      "Google liefert für dasselbe Keyword unterschiedliche Ergebnisse — je nachdem, von wo gesucht wird, in welcher Sprache und ob am Mobilgerät. Stellen Sie diese Felder auf die Kundschaft ein, die Sie erreichen wollen: eine Desktop-Prüfung aus dem falschen Land sagt wenig aus.",

    featuresTitle: "SERP-Features drängen organische Treffer nach unten",
    featuresBody:
      "Die Chips über der Tabelle sind die nicht-organischen Blöcke, die Google auf der Seite platziert hat: Anzeigen, hervorgehobene Snippets, «Ähnliche Fragen», lokale Packs, Videos. Position 1 organisch kann trotzdem unterhalb des sichtbaren Bereichs liegen, wenn genügend davon vorhanden sind — deshalb liefern zwei Keywords auf derselben Position unterschiedliche Ergebnisse.",

    timingTitle: "Ergebnisse dauern meist einige Minuten",
    timingBody:
      "Die Prüfung wird eingereiht und von einem Hintergrundprozess abgeschlossen, erscheint also zuerst als «In Warteschlange». Sie können diese Seite verlassen — das Ergebnis landet ohnehin in Ihrem Verlauf. Dasselbe Keyword mit denselben Einstellungen kurz darauf erneut zu prüfen nutzt das gespeicherte Ergebnis, statt Ihr Kontingent nochmals zu belasten.",
  },
};

// ─── Site Explorer help modal ───────────────────────────────────────────────
// The recurring support question is "why doesn't this match Analytics?" — the
// answer (these are modelled estimates for ANY domain, including ones you do
// not own) leads the modal rather than hiding in a caveat at the bottom.
const siteExplorerHelpEn = {
  button: "Help",
  buttonAria: "How Site Explorer works",
  title: "How Site Explorer works",
  close: "Close",

  intro: "Enter any domain — yours or a competitor's — and see what it ranks for, who it competes with, and who links to it.",

  estimatesTitle: "The traffic numbers are estimates",
  estimatesBody:
    "Monthly traffic and traffic value are modelled from each keyword's search volume and the typical click-through rate at the position the domain holds. They will not match Google Analytics, and they are not meant to — the point is that the same model is applied to every domain, so you can compare them fairly.",

  distributionTitle: "Read the position distribution first",
  distributionBody:
    "The five buckets show how many keywords sit at position 1, 2–3, 4–10, 11–20 and 21–100. Positions 4–10 and 11–20 are where the work pays off fastest: those pages already rank and a few places of movement changes real traffic.",

  competitorsTitle: "Competitors means shared rankings",
  competitorsBody:
    "These are the domains that appear alongside this one for the most keywords — intersections is how many keywords they share. They are search competitors, not necessarily business rivals, and that difference is often the useful part.",

  backlinksTitle: "The backlink summary",
  backlinksBody:
    "Referring domains matters more than raw backlink count: a thousand links from one site is one relationship. Dofollow domains are the ones passing ranking signals, and broken backlinks are links pointing at pages that no longer resolve — the cheapest wins on the page.",

  quotaTitle: "Each analysis spends quota",
  quotaBody:
    "Running a domain makes four live calls, so it counts against your monthly allowance; opening a stored analysis from your history never does. If one section shows as unavailable the rest still render — the analysis is marked partial rather than thrown away.",
};
export type SiteExplorerHelpCopy = typeof siteExplorerHelpEn;

export const SITE_EXPLORER_HELP_COPY: Record<DashLocale, SiteExplorerHelpCopy> = {
  en: siteExplorerHelpEn,
  fr: {
    button: "Aide",
    buttonAria: "Comment fonctionne l'explorateur de site",
    title: "Comment fonctionne l'explorateur de site",
    close: "Fermer",

    intro:
      "Saisissez n'importe quel domaine — le vôtre ou celui d'un concurrent — et voyez sur quoi il se positionne, face à qui, et qui pointe vers lui.",

    estimatesTitle: "Les chiffres de trafic sont des estimations",
    estimatesBody:
      "Le trafic mensuel et sa valeur sont modélisés à partir du volume de recherche de chaque mot-clé et du taux de clic habituel à la position occupée. Ils ne correspondront pas à Google Analytics, et ce n'est pas le but : le même modèle s'applique à tous les domaines, ce qui permet de les comparer équitablement.",

    distributionTitle: "Lisez d'abord la répartition des positions",
    distributionBody:
      "Les cinq tranches indiquent combien de mots-clés se situent en position 1, 2–3, 4–10, 11–20 et 21–100. Les positions 4–10 et 11–20 sont celles où le travail paie le plus vite : ces pages se positionnent déjà, et quelques places gagnées changent le trafic réel.",

    competitorsTitle: "« Concurrents » signifie positions partagées",
    competitorsBody:
      "Ce sont les domaines qui apparaissent aux côtés de celui-ci sur le plus de mots-clés — les intersections indiquent combien de mots-clés sont communs. Ce sont des concurrents dans les résultats de recherche, pas nécessairement des rivaux commerciaux, et cette différence est souvent la partie utile.",

    backlinksTitle: "Le résumé des backlinks",
    backlinksBody:
      "Le nombre de domaines référents compte plus que le nombre brut de liens : mille liens depuis un seul site, c'est une seule relation. Les domaines dofollow sont ceux qui transmettent des signaux de classement, et les backlinks cassés pointent vers des pages qui ne répondent plus — les gains les plus faciles de la page.",

    quotaTitle: "Chaque analyse consomme du quota",
    quotaBody:
      "Analyser un domaine déclenche quatre appels en direct et compte donc dans votre allocation mensuelle ; rouvrir une analyse depuis votre historique ne coûte rien. Si une section est indisponible, les autres s'affichent quand même — l'analyse est marquée comme partielle plutôt que jetée.",
  },
  "de-CH": {
    button: "Hilfe",
    buttonAria: "So funktioniert der Site Explorer",
    title: "So funktioniert der Site Explorer",
    close: "Schliessen",

    intro:
      "Geben Sie eine beliebige Domain ein — Ihre eigene oder die der Konkurrenz — und sehen Sie, wofür sie rankt, mit wem sie konkurriert und wer auf sie verlinkt.",

    estimatesTitle: "Die Traffic-Zahlen sind Schätzungen",
    estimatesBody:
      "Monatlicher Traffic und Traffic-Wert werden aus dem Suchvolumen jedes Keywords und der üblichen Klickrate auf der belegten Position modelliert. Sie stimmen nicht mit Google Analytics überein und sollen es auch nicht — entscheidend ist, dass dasselbe Modell auf jede Domain angewendet wird und ein fairer Vergleich möglich ist.",

    distributionTitle: "Lesen Sie zuerst die Positionsverteilung",
    distributionBody:
      "Die fünf Gruppen zeigen, wie viele Keywords auf Position 1, 2–3, 4–10, 11–20 und 21–100 liegen. Bei 4–10 und 11–20 zahlt sich Arbeit am schnellsten aus: Diese Seiten ranken bereits, und wenige Plätze Bewegung verändern echten Traffic.",

    competitorsTitle: "«Mitbewerber» heisst geteilte Rankings",
    competitorsBody:
      "Das sind die Domains, die bei den meisten Keywords neben dieser erscheinen — Überschneidungen zeigt, wie viele Keywords sie teilen. Es sind Suchmaschinen-Mitbewerber, nicht zwingend geschäftliche Konkurrenz, und genau dieser Unterschied ist oft das Nützliche daran.",

    backlinksTitle: "Die Backlink-Übersicht",
    backlinksBody:
      "Verweisende Domains zählen mehr als die reine Zahl der Backlinks: tausend Links von einer Website sind eine Beziehung. Dofollow-Domains geben Ranking-Signale weiter, und defekte Backlinks zeigen auf Seiten, die nicht mehr erreichbar sind — die günstigsten Erfolge auf dieser Seite.",

    quotaTitle: "Jede Analyse verbraucht Kontingent",
    quotaBody:
      "Eine Domain zu analysieren löst vier Live-Abfragen aus und zählt daher gegen Ihr Monatskontingent; eine gespeicherte Analyse aus dem Verlauf zu öffnen nie. Ist ein Abschnitt nicht verfügbar, werden die übrigen trotzdem dargestellt — die Analyse gilt als unvollständig statt als verworfen.",
  },
};

// ─── Keywords Explorer help modal ───────────────────────────────────────────
// This tool crawls the page you give it rather than querying a keyword index,
// which is the opposite of what the name leads people to expect. The modal
// says so in the first line.
const keywordsExplorerHelpEn = {
  button: "Help",
  buttonAria: "How the keyword suggester works",
  title: "How the keyword suggester works",
  close: "Close",

  intro: "Point it at one of your pages. It reads the page and suggests the keywords that page could realistically win.",

  crawlTitle: "It reads your page, not a keyword database",
  crawlBody:
    "Enter a URL and the scan crawls that page and a few linked ones, then works from the words actually on them. Suggestions are therefore grounded in what you already publish — which is why a thin page produces thin suggestions, and the fix is the page rather than the tool.",

  scoringTitle: "Score and difficulty are estimates",
  scoringBody:
    "Score ranks the suggestions against each other for this page; difficulty is a low / medium / high band, not a competitor count. Treat them as an ordering to work through, not as absolute numbers to report.",

  contentTitle: "Present and missing terms",
  contentBody:
    "Present terms are the relevant words the page already uses. Missing terms are ones closely related pages tend to cover and this one does not — each is a paragraph you could add. The title and meta suggestions are drafts to edit, not text to paste unread.",

  promptsTitle: "AI visibility prompts are the handoff",
  promptsBody:
    "The prompts tab turns the same analysis into questions a customer might ask an AI assistant. Track the ones that matter and you can watch whether your brand gets mentioned in the answers over time.",
  promptsLink: "Open Custom Prompts →",

  aiTitle: "The AI pass is optional",
  aiBody:
    "Regenerate with AI re-runs the analysis through a language model for broader suggestions. Without a provider configured, the scan still works — it falls back to the built-in heuristics and tells you so instead of failing.",
};
export type KeywordsExplorerHelpCopy = typeof keywordsExplorerHelpEn;

export const KEYWORDS_EXPLORER_HELP_COPY: Record<DashLocale, KeywordsExplorerHelpCopy> = {
  en: keywordsExplorerHelpEn,
  fr: {
    button: "Aide",
    buttonAria: "Comment fonctionne le suggesteur de mots-clés",
    title: "Comment fonctionne le suggesteur de mots-clés",
    close: "Fermer",

    intro:
      "Indiquez-lui une de vos pages. Il la lit et propose les mots-clés que cette page pourrait réellement gagner.",

    crawlTitle: "Il lit votre page, pas une base de mots-clés",
    crawlBody:
      "Saisissez une URL : l'analyse explore cette page et quelques pages liées, puis travaille à partir des mots qui s'y trouvent réellement. Les suggestions sont donc ancrées dans ce que vous publiez déjà — une page pauvre produit des suggestions pauvres, et c'est la page qu'il faut corriger, pas l'outil.",

    scoringTitle: "Le score et la difficulté sont des estimations",
    scoringBody:
      "Le score classe les suggestions les unes par rapport aux autres pour cette page ; la difficulté est une tranche faible / moyenne / élevée, pas un nombre de concurrents. Voyez-y un ordre de travail, pas des valeurs absolues à reporter.",

    contentTitle: "Termes présents et termes manquants",
    contentBody:
      "Les termes présents sont les mots pertinents que la page utilise déjà. Les termes manquants sont ceux que les pages proches traitent généralement et que celle-ci ignore — chacun est un paragraphe à ajouter. Les suggestions de titre et de méta-description sont des brouillons à retravailler, pas du texte à coller sans le lire.",

    promptsTitle: "Les requêtes d'IA sont le prolongement",
    promptsBody:
      "L'onglet des requêtes transforme la même analyse en questions qu'un client pourrait poser à un assistant IA. Suivez celles qui comptent et vous verrez si votre marque est citée dans les réponses au fil du temps.",
    promptsLink: "Ouvrir les requêtes personnalisées →",

    aiTitle: "Le passage par l'IA est facultatif",
    aiBody:
      "« Régénérer avec l'IA » relance l'analyse via un modèle de langage pour élargir les suggestions. Sans fournisseur configuré, l'analyse fonctionne quand même : elle revient aux heuristiques intégrées et vous le signale au lieu d'échouer.",
  },
  "de-CH": {
    button: "Hilfe",
    buttonAria: "So funktioniert der Keyword-Vorschlag",
    title: "So funktioniert der Keyword-Vorschlag",
    close: "Schliessen",

    intro:
      "Geben Sie eine Ihrer Seiten an. Das Tool liest die Seite und schlägt die Keywords vor, die diese Seite realistisch gewinnen kann.",

    crawlTitle: "Es liest Ihre Seite, keine Keyword-Datenbank",
    crawlBody:
      "Geben Sie eine URL ein: Der Scan crawlt diese Seite und einige verlinkte Seiten und arbeitet dann mit den Wörtern, die tatsächlich darauf stehen. Die Vorschläge beruhen also auf dem, was Sie bereits veröffentlichen — eine dünne Seite liefert dünne Vorschläge, und zu korrigieren ist die Seite, nicht das Tool.",

    scoringTitle: "Score und Schwierigkeit sind Schätzungen",
    scoringBody:
      "Der Score ordnet die Vorschläge für diese Seite untereinander; die Schwierigkeit ist eine Einstufung tief / mittel / hoch, keine Anzahl Mitbewerber. Nutzen Sie beides als Reihenfolge zum Abarbeiten, nicht als absolute Kennzahl für einen Bericht.",

    contentTitle: "Vorhandene und fehlende Begriffe",
    contentBody:
      "Vorhandene Begriffe sind die relevanten Wörter, welche die Seite bereits verwendet. Fehlende Begriffe decken vergleichbare Seiten üblicherweise ab, diese jedoch nicht — jeder davon ist ein Absatz, den Sie ergänzen könnten. Die Titel- und Meta-Vorschläge sind Entwürfe zum Überarbeiten, kein Text zum ungelesenen Einfügen.",

    promptsTitle: "Die KI-Prompts sind die Übergabe",
    promptsBody:
      "Der Prompt-Tab übersetzt dieselbe Analyse in Fragen, die Kundschaft einem KI-Assistenten stellen könnte. Verfolgen Sie die relevanten, und Sie sehen über die Zeit, ob Ihre Marke in den Antworten erwähnt wird.",
    promptsLink: "Eigene Prompts öffnen →",

    aiTitle: "Der KI-Durchlauf ist optional",
    aiBody:
      "«Mit KI neu erzeugen» lässt die Analyse zusätzlich durch ein Sprachmodell laufen. Ohne konfigurierten Anbieter funktioniert der Scan weiterhin — er fällt auf die eingebauten Heuristiken zurück und weist Sie darauf hin, statt fehlzuschlagen.",
  },
};

// ─── GSC Insights help modal ────────────────────────────────────────────────
// The data-timing section exists because of a real support case: a connected,
// healthy property synced on schedule and stored zero query rows, which looks
// exactly like a broken sync. It is not — Google withholds queries below its
// anonymity threshold, and a low-traffic property can legitimately have none.
// That sentence is the reason this modal was written; do not soften it away.
const gscHelpEn = {
  button: "Help",
  buttonAria: "How Search Console insights work",
  title: "How Search Console insights work",
  close: "Close",

  intro: "This is your own Search Console data, read directly from Google for the property you connect.",

  connectTitle: "Connect once, pick a property",
  connectBody:
    "Sign in with the Google account that already has access in Search Console and choose one property. Access is read-only — nothing is ever written back to your Search Console account, and you can disconnect at any time.",

  metricsTitle: "What the four numbers mean",
  metricsBody:
    "Clicks are visits from Google. Impressions are times you appeared in results, whether or not anyone clicked. CTR is clicks divided by impressions. Average position is weighted by impressions, so a keyword you appear for constantly moves it far more than a rare one.",

  timingTitle: "Data lags, and low-traffic sites show no queries",
  timingBody:
    "Search Console data is roughly two days behind, so the most recent days are always missing and the 28-day window ends where Google's data ends. Separately, Google withholds any query searched by too few people to stay anonymous. On a low-traffic property that can mean real clicks and impressions in the totals but no query rows at all — that is Google's anonymity threshold, not a failed sync or a bug on our side.",

  syncTitle: "Sync now stores the daily rows",
  syncBody:
    "The totals and charts read live from Google every time you open the page. Sync now is separate: it saves that day's query rows so Rank Tracker has history to draw from. The property line shows both when the sync last ran and how many rows it stored, so a sync that ran and legitimately found nothing is visible rather than looking like a failure.",
};
export type GscHelpCopy = typeof gscHelpEn;

export const GSC_HELP_COPY: Record<DashLocale, GscHelpCopy> = {
  en: gscHelpEn,
  fr: {
    button: "Aide",
    buttonAria: "Comment fonctionnent les données Search Console",
    title: "Comment fonctionnent les données Search Console",
    close: "Fermer",

    intro:
      "Ce sont vos propres données Search Console, lues directement chez Google pour la propriété que vous connectez.",

    connectTitle: "Connectez-vous une fois, choisissez une propriété",
    connectBody:
      "Identifiez-vous avec le compte Google qui a déjà accès dans Search Console et choisissez une propriété. L'accès est en lecture seule — rien n'est jamais écrit dans votre compte Search Console, et vous pouvez vous déconnecter à tout moment.",

    metricsTitle: "Ce que signifient les quatre chiffres",
    metricsBody:
      "Les clics sont les visites venues de Google. Les impressions sont les fois où vous êtes apparu dans les résultats, avec ou sans clic. Le CTR est le rapport des clics aux impressions. La position moyenne est pondérée par les impressions : un mot-clé sur lequel vous apparaissez constamment pèse bien plus qu'un mot-clé rare.",

    timingTitle: "Les données ont du retard, et les sites peu visités n'affichent aucune requête",
    timingBody:
      "Les données de Search Console accusent environ deux jours de retard : les jours les plus récents manquent toujours et la fenêtre de 28 jours s'arrête là où s'arrêtent les données de Google. Par ailleurs, Google masque toute requête effectuée par trop peu de personnes pour rester anonyme. Sur une propriété à faible trafic, cela peut donner de vrais clics et impressions dans les totaux mais aucune ligne de requête — c'est le seuil d'anonymat de Google, pas une synchronisation en échec ni un défaut de notre côté.",

    syncTitle: "« Synchroniser » enregistre les lignes du jour",
    syncBody:
      "Les totaux et les graphiques sont lus en direct chez Google à chaque ouverture de la page. « Synchroniser » est autre chose : cela enregistre les lignes de requêtes du jour pour que le suivi de positions dispose d'un historique. La ligne de la propriété indique à la fois la date de la dernière synchronisation et le nombre de lignes enregistrées — ainsi, une synchronisation qui n'a légitimement rien trouvé se voit au lieu de ressembler à une panne.",
  },
  "de-CH": {
    button: "Hilfe",
    buttonAria: "So funktionieren die Search-Console-Daten",
    title: "So funktionieren die Search-Console-Daten",
    close: "Schliessen",

    intro:
      "Das sind Ihre eigenen Search-Console-Daten, direkt bei Google für die verbundene Property abgerufen.",

    connectTitle: "Einmal verbinden, eine Property wählen",
    connectBody:
      "Melden Sie sich mit dem Google-Konto an, das in der Search Console bereits Zugriff hat, und wählen Sie eine Property. Der Zugriff erfolgt nur lesend — es wird nie etwas in Ihr Search-Console-Konto zurückgeschrieben, und Sie können die Verbindung jederzeit trennen.",

    metricsTitle: "Was die vier Zahlen bedeuten",
    metricsBody:
      "Klicks sind Besuche über Google. Impressionen sind die Male, die Sie in den Ergebnissen erschienen sind — mit oder ohne Klick. Die CTR ist Klicks geteilt durch Impressionen. Die durchschnittliche Position ist nach Impressionen gewichtet: Ein Keyword, für das Sie ständig erscheinen, bewegt sie weit stärker als ein seltenes.",

    timingTitle: "Daten hinken nach, und Seiten mit wenig Traffic zeigen keine Suchanfragen",
    timingBody:
      "Search-Console-Daten hinken rund zwei Tage hinterher: Die jüngsten Tage fehlen immer, und das 28-Tage-Fenster endet dort, wo Googles Daten enden. Zusätzlich hält Google jede Suchanfrage zurück, die von zu wenigen Personen gestellt wurde, um anonym zu bleiben. Bei einer Property mit wenig Traffic kann das echte Klicks und Impressionen in den Summen bedeuten, aber gar keine Zeilen mit Suchanfragen — das ist Googles Anonymitätsschwelle, keine fehlgeschlagene Synchronisation und kein Fehler auf unserer Seite.",

    syncTitle: "«Jetzt synchronisieren» speichert die Tageszeilen",
    syncBody:
      "Summen und Diagramme werden bei jedem Öffnen der Seite live bei Google gelesen. «Jetzt synchronisieren» ist etwas anderes: Es speichert die Suchanfragen-Zeilen des Tages, damit das Rank Tracking auf einen Verlauf zurückgreifen kann. Die Property-Zeile zeigt sowohl den Zeitpunkt der letzten Synchronisation als auch die Anzahl gespeicherter Zeilen — so ist eine Synchronisation, die berechtigterweise nichts gefunden hat, sichtbar, statt wie ein Fehler auszusehen.",
  },
};

// ─── Brand Radar help modal ─────────────────────────────────────────────────
// Written from the fields the visibility summary actually returns: the latest
// VisibilityAudit score/grade, PromptRun aggregates (mention rate, per-engine
// coverage) and visibility_* AlertEvents. There is deliberately no "trust
// score" section — nothing persists one, and inventing copy for it would be
// the first fake number on the page.
const brandRadarHelpEn = {
  button: "Help",
  buttonAria: "How Brand Radar works",
  title: "How Brand Radar works",
  close: "Close",

  intro: "Everything here is your own stored data — your audits, your prompt runs, your alerts. Nothing on this page is modelled or estimated.",

  scoreTitle: "Score and grade come from your latest audit",
  scoreBody:
    "The two leading cards are the score and grade of the most recent AI Visibility audit for your domain, with the date it ran beside them. They do not change until you run another audit, so a stale date means a stale score rather than a stable one.",
  scoreLink: "Run an audit →",

  mentionTitle: "Mention rate is measured, not estimated",
  mentionBody:
    "It is the share of prompt runs in the window where an AI assistant actually named your brand in its answer. It only exists once your tracked prompts have run, and a small number of runs makes it jump around — read it alongside the run count rather than on its own.",

  enginesTitle: "Engine coverage compares assistants",
  enginesBody:
    "Each row is one AI assistant: how many times your prompts ran against it, and how often you were mentioned. Assistants differ a lot on the same question, so a low rate on one and a high rate on another is normal and tells you where the gap is.",

  alertsTitle: "Alerts are the things worth reacting to",
  alertsBody:
    "Visibility alerts are raised when something moves enough to matter — a score drop, a prompt you stopped being mentioned in. Critical and warning are separated so a quiet week reads as quiet rather than empty.",

  emptyTitle: "An empty radar is a real answer",
  emptyBody:
    "With no audit and no tracked prompts there is genuinely nothing to show, so the page says so instead of filling the space. Run an audit and track a few prompts, and the cards populate from the next runs onward.",
};
export type BrandRadarHelpCopy = typeof brandRadarHelpEn;

export const BRAND_RADAR_HELP_COPY: Record<DashLocale, BrandRadarHelpCopy> = {
  en: brandRadarHelpEn,
  fr: {
    button: "Aide",
    buttonAria: "Comment fonctionne le radar de marque",
    title: "Comment fonctionne le radar de marque",
    close: "Fermer",

    intro:
      "Tout ici provient de vos propres données enregistrées — vos audits, vos exécutions de requêtes, vos alertes. Rien sur cette page n'est modélisé ni estimé.",

    scoreTitle: "Le score et la note viennent de votre dernier audit",
    scoreBody:
      "Les deux premières cartes reprennent le score et la note du dernier audit de visibilité IA de votre domaine, avec sa date à côté. Ils ne changent qu'après un nouvel audit : une date ancienne signifie un score périmé, pas un score stable.",
    scoreLink: "Lancer un audit →",

    mentionTitle: "Le taux de mention est mesuré, pas estimé",
    mentionBody:
      "C'est la part des exécutions de requêtes de la période où un assistant IA a réellement nommé votre marque dans sa réponse. Il n'existe qu'une fois vos requêtes suivies exécutées, et un faible nombre d'exécutions le fait fortement varier — lisez-le avec le nombre d'exécutions, jamais seul.",

    enginesTitle: "La couverture par moteur compare les assistants",
    enginesBody:
      "Chaque ligne correspond à un assistant IA : combien de fois vos requêtes y ont été exécutées, et à quelle fréquence vous avez été mentionné. Les assistants divergent beaucoup sur une même question ; un taux faible sur l'un et élevé sur l'autre est normal et vous montre où se situe l'écart.",

    alertsTitle: "Les alertes signalent ce qui mérite une réaction",
    alertsBody:
      "Une alerte de visibilité se déclenche quand quelque chose bouge suffisamment : une chute de score, une requête où vous n'êtes plus cité. Les niveaux critique et avertissement sont distingués, pour qu'une semaine calme se lise comme calme et non comme vide.",

    emptyTitle: "Un radar vide est une vraie réponse",
    emptyBody:
      "Sans audit ni requête suivie, il n'y a réellement rien à montrer : la page le dit plutôt que de remplir l'espace. Lancez un audit, suivez quelques requêtes, et les cartes se remplissent dès les exécutions suivantes.",
  },
  "de-CH": {
    button: "Hilfe",
    buttonAria: "So funktioniert Brand Radar",
    title: "So funktioniert Brand Radar",
    close: "Schliessen",

    intro:
      "Alles hier stammt aus Ihren eigenen gespeicherten Daten — Ihren Audits, Ihren Prompt-Läufen, Ihren Warnungen. Nichts auf dieser Seite ist modelliert oder geschätzt.",

    scoreTitle: "Score und Note stammen aus Ihrem letzten Audit",
    scoreBody:
      "Die beiden ersten Karten zeigen Score und Note des jüngsten KI-Sichtbarkeits-Audits Ihrer Domain, mit dem Datum daneben. Sie ändern sich erst mit einem neuen Audit — ein altes Datum bedeutet also einen veralteten Score, keinen stabilen.",
    scoreLink: "Audit starten →",

    mentionTitle: "Die Erwähnungsrate ist gemessen, nicht geschätzt",
    mentionBody:
      "Sie ist der Anteil der Prompt-Läufe im Zeitraum, in denen ein KI-Assistent Ihre Marke tatsächlich in der Antwort genannt hat. Sie entsteht erst, wenn Ihre verfolgten Prompts gelaufen sind, und bei wenigen Läufen schwankt sie stark — lesen Sie sie zusammen mit der Anzahl Läufe, nie allein.",

    enginesTitle: "Die Engine-Abdeckung vergleicht die Assistenten",
    enginesBody:
      "Jede Zeile steht für einen KI-Assistenten: wie oft Ihre Prompts dort liefen und wie oft Sie erwähnt wurden. Assistenten unterscheiden sich bei derselben Frage stark; eine tiefe Rate beim einen und eine hohe beim anderen ist normal und zeigt Ihnen, wo die Lücke liegt.",

    alertsTitle: "Warnungen zeigen, worauf es zu reagieren lohnt",
    alertsBody:
      "Eine Sichtbarkeitswarnung entsteht, wenn sich etwas spürbar bewegt — ein Score-Einbruch, ein Prompt, in dem Sie nicht mehr erwähnt werden. Kritisch und Warnung sind getrennt, damit eine ruhige Woche als ruhig und nicht als leer erscheint.",

    emptyTitle: "Ein leeres Radar ist eine echte Antwort",
    emptyBody:
      "Ohne Audit und ohne verfolgte Prompts gibt es tatsächlich nichts zu zeigen — die Seite sagt das, statt den Platz zu füllen. Starten Sie ein Audit, verfolgen Sie einige Prompts, und die Karten füllen sich ab den nächsten Läufen.",
  },
};

// ─── Custom Prompts help modal ──────────────────────────────────────────────
// Written from what the page actually does: prompts run once a day (the
// visibility-monitoring sweep advances nextRunAt by 24 h), "Run now" re-queues
// every active prompt for an immediate batch, each run stores the full answer
// with a Mentioned / Not mentioned verdict, and the trend strip covers 90 days
// (prompts/history?days=90).
//
// Deliberately does NOT claim a number of AI engines. PromptRun.engine defaults
// to "claude" and every stored run today is that one engine, so "we ask the
// engines" would be copy ahead of the product. The wording survives more being
// added without becoming a lie either way.
const customPromptsHelpEn = {
  button: "Help",
  buttonAria: "How Custom Prompts works",
  title: "How Custom Prompts works",
  close: "Close",

  intro:
    "These are the questions your customers ask AI. Track whether the answers mention you.",

  trackTitle: "Track a prompt",
  trackBody:
    "Add the questions that matter, phrased the way a real customer would ask — “best plumber in montreal”, not “plumber montreal seo”. Nobody types keywords at an assistant.",
  /** Live, from the same payload the card's counter reads. */
  trackQuota: (used: number, limit: number) =>
    `You are tracking ${used} of ${limit} prompts on your plan.`,

  runsTitle: "Runs and results",
  runsBody:
    "Every active prompt runs once a day. Run now re-queues all of them immediately and the results land in about a minute. Each run asks your question, stores the full answer, and marks it Mentioned or Not mentioned for your brand — with the position you were named in when there is one.",

  trendTitle: "The trend",
  trendBody:
    "The 90-day line shows whether you are entering the answers or fading from them. Going from absent to mentioned on a buying-intent prompt beats most ranking wins.",

  writeTitle: "Write better prompts",
  writeBody:
    "Cover the funnel: “best X in [city]”, “X vs Y”, “is X worth it”. Three angles beat ten rephrasings of one.",

  auditTitle: "Not mentioned anywhere?",
  auditBody:
    "Run the AI Visibility audit. If the engines cannot read your site, they cannot cite you.",
  auditLink: "Open AI Visibility →",
};
export type CustomPromptsHelpCopy = typeof customPromptsHelpEn;

export const CUSTOM_PROMPTS_HELP_COPY: Record<DashLocale, CustomPromptsHelpCopy> = {
  en: customPromptsHelpEn,
  fr: {
    button: "Aide",
    buttonAria: "Comment fonctionnent les requêtes personnalisées",
    title: "Comment fonctionnent les requêtes personnalisées",
    close: "Fermer",

    intro:
      "Ce sont les questions que vos clients posent à l'IA. Vérifiez si les réponses vous mentionnent.",

    trackTitle: "Suivre une requête",
    trackBody:
      "Ajoutez les questions qui comptent, formulées comme un vrai client les poserait — « meilleur plombier à montréal », et non « plombier montréal seo ». Personne ne tape des mots-clés à un assistant.",
    trackQuota: (used: number, limit: number) =>
      `Vous suivez ${used} requêtes sur les ${limit} incluses dans votre forfait.`,

    runsTitle: "Exécutions et résultats",
    runsBody:
      "Chaque requête active s'exécute une fois par jour. « Lancer maintenant » les relance toutes immédiatement et les résultats arrivent en une minute environ. Chaque exécution pose votre question, enregistre la réponse complète et la marque « Mentionné » ou « Non mentionné » pour votre marque — avec la position à laquelle vous avez été cité le cas échéant.",

    trendTitle: "La tendance",
    trendBody:
      "La courbe sur 90 jours montre si vous entrez dans les réponses ou si vous en disparaissez. Passer d'absent à mentionné sur une requête à intention d'achat vaut mieux que la plupart des gains de position.",

    writeTitle: "Rédiger de meilleures requêtes",
    writeBody:
      "Couvrez tout le parcours : « meilleur X à [ville] », « X ou Y », « est-ce que X en vaut la peine ». Trois angles valent mieux que dix reformulations d'un seul.",

    auditTitle: "Mentionné nulle part ?",
    auditBody:
      "Lancez l'audit de visibilité IA. Si les moteurs ne peuvent pas lire votre site, ils ne peuvent pas vous citer.",
    auditLink: "Ouvrir Visibilité IA →",
  },
  "de-CH": {
    button: "Hilfe",
    buttonAria: "So funktionieren eigene Prompts",
    title: "So funktionieren eigene Prompts",
    close: "Schliessen",

    intro:
      "Das sind die Fragen, die Ihre Kundschaft der KI stellt. Verfolgen Sie, ob die Antworten Sie erwähnen.",

    trackTitle: "Einen Prompt verfolgen",
    trackBody:
      "Nehmen Sie die Fragen auf, die zählen — so formuliert, wie eine echte Kundin sie stellen würde: «bester Sanitär in Zürich», nicht «sanitär zürich seo». Niemand tippt Keywords in einen Assistenten.",
    trackQuota: (used: number, limit: number) =>
      `Sie verfolgen ${used} von ${limit} Prompts in Ihrem Abo.`,

    runsTitle: "Läufe und Ergebnisse",
    runsBody:
      "Jeder aktive Prompt läuft einmal täglich. «Jetzt ausführen» stellt alle sofort erneut in die Warteschlange, die Ergebnisse treffen in etwa einer Minute ein. Jeder Lauf stellt Ihre Frage, speichert die vollständige Antwort und markiert sie für Ihre Marke als «Erwähnt» oder «Nicht erwähnt» — mit der Position, an der Sie genannt wurden, sofern vorhanden.",

    trendTitle: "Der Verlauf",
    trendBody:
      "Die 90-Tage-Linie zeigt, ob Sie in die Antworten hineinkommen oder daraus verschwinden. Bei einem Prompt mit Kaufabsicht von «nicht erwähnt» zu «erwähnt» zu wechseln, wiegt schwerer als die meisten Ranking-Erfolge.",

    writeTitle: "Bessere Prompts schreiben",
    writeBody:
      "Decken Sie den ganzen Funnel ab: «bestes X in [Stadt]», «X oder Y», «lohnt sich X». Drei Blickwinkel bringen mehr als zehn Umformulierungen eines einzigen.",

    auditTitle: "Nirgends erwähnt?",
    auditBody:
      "Starten Sie das KI-Sichtbarkeits-Audit. Wenn die Engines Ihre Website nicht lesen können, können sie Sie auch nicht zitieren.",
    auditLink: "KI-Sichtbarkeit öffnen →",
  },
};

// ─── AI Lens ────────────────────────────────────────────────────────────────
// Copy for the crawler-visibility gap tool. The headline number is the product,
// so its wording is unusually load-bearing: it has to be honest at 0% (the good
// case, which most SSR sites will hit) without reading like a broken measurement.
const aiLensEn = {
  formTitle: "Analyze a page",
  formIntro:
    "AI answer engines fetch your pages without running JavaScript. This fetches one URL twice — once as an AI crawler, once as a real browser — and shows you the difference.",
  ownDomainNote: "Your plan analyzes pages on your own site.",
  crossDomainNote: "Your plan analyzes any URL, including a competitor's.",
  urlLabel: "Page URL",
  urlPlaceholder: "https://example.com/pricing",
  invalidUrl: "Enter a full URL like https://example.com/pricing",
  submit: "Analyze page",
  submitting: "Analyzing…",
  usage: (used: number, limit: number) => `${used} of ${limit} analyses used this month`,
  remaining: (left: number) => `${left} left`,

  // ── In flight ──
  progressTitle: "Looking at your page twice",
  progressRaw: "Fetching as an AI crawler…",
  progressRender: "Rendering as a browser…",
  progressNote: "A full render takes around 15 seconds. Leave this page open.",

  // ── Headline ──
  gapHeadline: (pct: string) => `${pct}% of this page is invisible to AI engines`,
  gapHeadlineClean: "This page is fully visible to AI engines",
  gapLabel: "Visibility gap",
  verdictReadable: "AI-readable",
  verdictReadableBody:
    "An AI crawler sees essentially everything a visitor sees. Nothing to fix here.",
  verdictPartial: "Partially visible",
  verdictPartialBody:
    "Some content only exists after JavaScript runs. An AI engine answering about this page is working from an incomplete copy.",
  verdictSubstantial: "Substantially invisible",
  verdictSubstantialBody:
    "Most of this page does not exist for an AI crawler. Answers about it will be wrong or absent, however good the content is.",

  wordsTitle: "Word counts",
  wordsRaw: "Seen by an AI crawler",
  wordsRendered: "Seen in a browser",
  wordsMissing: "Missing",
  wordsUnit: "words",

  // ── Missing content ──
  missingTitle: "What AI crawlers cannot see",
  missingIntro: "Largest missing blocks first. Location is the heading each block sits under.",
  missingEmpty: "Nothing is missing — the raw fetch and the rendered page match.",
  missingUnder: (location: string) => `under ${location}`,
  missingWords: (n: number) => (n === 1 ? "1 word" : `${n} words`),
  missingTruncated: (n: number) =>
    n === 1 ? "1 more block not shown" : `${n} more blocks not shown`,

  // ── Fetch detail ──
  metaTitle: "Fetch detail",
  metaRawStatus: "Raw fetch",
  metaRenderStatus: "Rendered fetch",
  metaRenderTime: "Render time",
  metaCrawler: "Requested as",
  metaNoindex: "This page asks search engines not to index it (noindex).",
  metaRedirected: (to: string) => `Redirected to ${to}`,
  seconds: (s: string) => `${s}s`,

  cachedNote: "Showing a result from the last 24 hours. It did not use an analysis.",

  // ── History ──
  historyTitle: "Recent analyses",
  historyEmpty: "No analyses yet. Check your most important page first.",
  colUrl: "Page",
  colGap: "Gap",
  colVerdict: "Verdict",
  colWhen: "Analyzed",
  view: "View",

  // ── Errors ──
  quotaTitle: "Monthly analysis limit reached",
  quotaBody: (limit: number) =>
    `Your plan includes ${limit} AI Lens analyses per month. Each one renders the page in a real browser, which is why it is capped.`,
  quotaCta: "See plans →",
  foreignTitle: "That page is not on your site",
  foreignBody:
    "Your plan analyzes pages on domains you have audited. Analyzing any URL — including a competitor's — is an Agency feature.",
  foreignCta: "See plans →",
  busyTitle: "All render slots are busy",
  busyBody:
    "Two pages can render at once. Try again in a few seconds — this did not use an analysis.",
  failedTitle: "Could not analyze that page",
  failedBody:
    "The page did not respond, redirected off its own domain, or took too long to render. Check the URL and try again.",
  loadFailed: "Could not load your analyses. Try again in a minute.",
};
export type AiLensCopy = typeof aiLensEn;

export const AI_LENS_COPY: Record<DashLocale, AiLensCopy> = {
  en: aiLensEn,
  fr: {
    formTitle: "Analyser une page",
    formIntro:
      "Les moteurs de réponse IA récupèrent vos pages sans exécuter le JavaScript. Cet outil récupère une URL deux fois — une fois comme un robot d'IA, une fois comme un vrai navigateur — et vous montre l'écart.",
    ownDomainNote: "Votre forfait analyse les pages de votre propre site.",
    crossDomainNote: "Votre forfait analyse n'importe quelle URL, y compris celle d'un concurrent.",
    urlLabel: "URL de la page",
    urlPlaceholder: "https://exemple.com/tarifs",
    invalidUrl: "Saisissez une URL complète, par exemple https://exemple.com/tarifs",
    submit: "Analyser la page",
    submitting: "Analyse en cours…",
    usage: (used: number, limit: number) => `${used} analyses sur ${limit} utilisées ce mois-ci`,
    remaining: (left: number) => `${left} restantes`,

    progressTitle: "Nous regardons votre page deux fois",
    progressRaw: "Récupération comme un robot d'IA…",
    progressRender: "Rendu comme un navigateur…",
    progressNote:
      "Un rendu complet prend environ 15 secondes. Laissez cette page ouverte.",

    gapHeadline: (pct: string) => `${pct} % de cette page est invisible pour les moteurs d'IA`,
    gapHeadlineClean: "Cette page est entièrement visible pour les moteurs d'IA",
    gapLabel: "Écart de visibilité",
    verdictReadable: "Lisible par l'IA",
    verdictReadableBody:
      "Un robot d'IA voit pratiquement tout ce que voit un visiteur. Rien à corriger ici.",
    verdictPartial: "Partiellement visible",
    verdictPartialBody:
      "Une partie du contenu n'existe qu'après l'exécution du JavaScript. Un moteur d'IA qui répond au sujet de cette page travaille sur une copie incomplète.",
    verdictSubstantial: "Largement invisible",
    verdictSubstantialBody:
      "L'essentiel de cette page n'existe pas pour un robot d'IA. Les réponses la concernant seront fausses ou absentes, quelle que soit la qualité du contenu.",

    wordsTitle: "Nombre de mots",
    wordsRaw: "Vu par un robot d'IA",
    wordsRendered: "Vu dans un navigateur",
    wordsMissing: "Manquants",
    wordsUnit: "mots",

    missingTitle: "Ce que les robots d'IA ne peuvent pas voir",
    missingIntro:
      "Les blocs manquants les plus importants d'abord. L'emplacement correspond au titre sous lequel se trouve chaque bloc.",
    missingEmpty: "Rien ne manque — la récupération brute et la page rendue correspondent.",
    missingUnder: (location: string) => `sous ${location}`,
    missingWords: (n: number) => (n === 1 ? "1 mot" : `${n} mots`),
    missingTruncated: (n: number) =>
      n === 1 ? "1 bloc supplémentaire non affiché" : `${n} blocs supplémentaires non affichés`,

    metaTitle: "Détail de la récupération",
    metaRawStatus: "Récupération brute",
    metaRenderStatus: "Récupération avec rendu",
    metaRenderTime: "Temps de rendu",
    metaCrawler: "Demandé en tant que",
    metaNoindex:
      "Cette page demande aux moteurs de recherche de ne pas l'indexer (noindex).",
    metaRedirected: (to: string) => `Redirigée vers ${to}`,
    seconds: (s: string) => `${s} s`,

    cachedNote:
      "Résultat des dernières 24 heures. Il n'a pas consommé d'analyse.",

    historyTitle: "Analyses récentes",
    historyEmpty: "Aucune analyse pour l'instant. Commencez par votre page la plus importante.",
    colUrl: "Page",
    colGap: "Écart",
    colVerdict: "Verdict",
    colWhen: "Analysée",
    view: "Voir",

    quotaTitle: "Limite mensuelle d'analyses atteinte",
    quotaBody: (limit: number) =>
      `Votre forfait comprend ${limit} analyses AI Lens par mois. Chacune effectue le rendu de la page dans un vrai navigateur, d'où le plafond.`,
    quotaCta: "Voir les forfaits →",
    foreignTitle: "Cette page n'appartient pas à votre site",
    foreignBody:
      "Votre forfait analyse les pages des domaines que vous avez audités. Analyser n'importe quelle URL — y compris celle d'un concurrent — est une fonctionnalité Agence.",
    foreignCta: "Voir les forfaits →",
    busyTitle: "Tous les emplacements de rendu sont occupés",
    busyBody:
      "Deux pages peuvent être rendues à la fois. Réessayez dans quelques secondes — aucune analyse n'a été consommée.",
    failedTitle: "Impossible d'analyser cette page",
    failedBody:
      "La page n'a pas répondu, a redirigé hors de son propre domaine, ou a mis trop de temps à s'afficher. Vérifiez l'URL et réessayez.",
    loadFailed: "Impossible de charger vos analyses. Réessayez dans une minute.",
  },
  "de-CH": {
    formTitle: "Eine Seite analysieren",
    formIntro:
      "KI-Antwortmaschinen rufen Ihre Seiten ab, ohne JavaScript auszuführen. Dieses Tool ruft eine URL zweimal ab — einmal als KI-Crawler, einmal als echter Browser — und zeigt Ihnen den Unterschied.",
    ownDomainNote: "Ihr Abo analysiert Seiten Ihrer eigenen Website.",
    crossDomainNote:
      "Ihr Abo analysiert jede beliebige URL, auch die der Konkurrenz.",
    urlLabel: "Seiten-URL",
    urlPlaceholder: "https://beispiel.ch/preise",
    invalidUrl: "Geben Sie eine vollständige URL ein, z. B. https://beispiel.ch/preise",
    submit: "Seite analysieren",
    submitting: "Wird analysiert…",
    usage: (used: number, limit: number) =>
      `${used} von ${limit} Analysen in diesem Monat verwendet`,
    remaining: (left: number) => `${left} übrig`,

    progressTitle: "Wir sehen uns Ihre Seite zweimal an",
    progressRaw: "Abruf als KI-Crawler…",
    progressRender: "Rendering als Browser…",
    progressNote:
      "Ein vollständiges Rendering dauert rund 15 Sekunden. Lassen Sie diese Seite offen.",

    gapHeadline: (pct: string) => `${pct} % dieser Seite sind für KI-Engines unsichtbar`,
    gapHeadlineClean: "Diese Seite ist für KI-Engines vollständig sichtbar",
    gapLabel: "Sichtbarkeitslücke",
    verdictReadable: "KI-lesbar",
    verdictReadableBody:
      "Ein KI-Crawler sieht praktisch alles, was auch Besuchende sehen. Hier gibt es nichts zu korrigieren.",
    verdictPartial: "Teilweise sichtbar",
    verdictPartialBody:
      "Ein Teil des Inhalts entsteht erst, wenn JavaScript läuft. Eine KI-Engine, die über diese Seite Auskunft gibt, arbeitet mit einer unvollständigen Kopie.",
    verdictSubstantial: "Weitgehend unsichtbar",
    verdictSubstantialBody:
      "Der Grossteil dieser Seite existiert für einen KI-Crawler nicht. Antworten dazu werden falsch oder gar nicht erfolgen — unabhängig davon, wie gut der Inhalt ist.",

    wordsTitle: "Wortzahlen",
    wordsRaw: "Von einem KI-Crawler gesehen",
    wordsRendered: "Im Browser gesehen",
    wordsMissing: "Fehlend",
    wordsUnit: "Wörter",

    missingTitle: "Was KI-Crawler nicht sehen können",
    missingIntro:
      "Die grössten fehlenden Blöcke zuerst. Der Ort ist die Überschrift, unter der ein Block steht.",
    missingEmpty:
      "Es fehlt nichts — der Rohabruf und die gerenderte Seite stimmen überein.",
    missingUnder: (location: string) => `unter ${location}`,
    missingWords: (n: number) => (n === 1 ? "1 Wort" : `${n} Wörter`),
    missingTruncated: (n: number) =>
      n === 1 ? "1 weiterer Block nicht angezeigt" : `${n} weitere Blöcke nicht angezeigt`,

    metaTitle: "Abrufdetails",
    metaRawStatus: "Rohabruf",
    metaRenderStatus: "Gerenderter Abruf",
    metaRenderTime: "Rendering-Dauer",
    metaCrawler: "Angefragt als",
    metaNoindex:
      "Diese Seite bittet Suchmaschinen, sie nicht zu indexieren (noindex).",
    metaRedirected: (to: string) => `Weitergeleitet zu ${to}`,
    seconds: (s: string) => `${s} s`,

    cachedNote:
      "Ergebnis aus den letzten 24 Stunden. Es hat keine Analyse verbraucht.",

    historyTitle: "Letzte Analysen",
    historyEmpty:
      "Noch keine Analysen. Prüfen Sie zuerst Ihre wichtigste Seite.",
    colUrl: "Seite",
    colGap: "Lücke",
    colVerdict: "Urteil",
    colWhen: "Analysiert",
    view: "Ansehen",

    quotaTitle: "Monatliches Analyse-Limit erreicht",
    quotaBody: (limit: number) =>
      `Ihr Abo umfasst ${limit} AI-Lens-Analysen pro Monat. Jede rendert die Seite in einem echten Browser — daher die Obergrenze.`,
    quotaCta: "Abos ansehen →",
    foreignTitle: "Diese Seite gehört nicht zu Ihrer Website",
    foreignBody:
      "Ihr Abo analysiert Seiten von Domains, die Sie auditiert haben. Beliebige URLs — auch die der Konkurrenz — zu analysieren ist eine Agency-Funktion.",
    foreignCta: "Abos ansehen →",
    busyTitle: "Alle Rendering-Plätze sind belegt",
    busyBody:
      "Zwei Seiten können gleichzeitig gerendert werden. Versuchen Sie es in einigen Sekunden erneut — es wurde keine Analyse verbraucht.",
    failedTitle: "Diese Seite konnte nicht analysiert werden",
    failedBody:
      "Die Seite hat nicht geantwortet, auf eine andere Domain weitergeleitet oder zu lange zum Rendern gebraucht. Prüfen Sie die URL und versuchen Sie es erneut.",
    loadFailed: "Ihre Analysen konnten nicht geladen werden. Versuchen Sie es in einer Minute erneut.",
  },
};

// ─── AI Lens help modal ─────────────────────────────────────────────────────
const aiLensHelpEn = {
  button: "Help",
  buttonAria: "How AI Lens works",
  title: "How AI Lens works",
  close: "Close",

  intro:
    "AI answer engines read your pages with JavaScript switched off. AI Lens shows you what they get.",

  whyTitle: "AI crawlers do not run JavaScript",
  whyBody:
    "GPTBot, ClaudeBot and PerplexityBot request your page over plain HTTP and read whatever the server sends back. They do not wait for scripts, they do not click, and they do not scroll. Anything your site builds in the browser after that response simply is not there as far as they are concerned.",

  gapTitle: "What the gap number means",
  gapBody:
    "We fetch your page twice — once with an AI crawler's user agent, once in a real browser — turn both into plain text, and compare them block by block. The gap is the share of the browser's words that never appeared in the crawler's copy. Under 5% is AI-readable, 5-25% is partial, above 25% means most of the page is invisible.",

  fixTitle: "How to close it",
  fixBody:
    "Send the important content in the server's first response: server-side rendering or static generation for headings, body copy, prices and FAQs. Client-side rendering is fine for things that are not the point of the page — a map widget, a chat launcher, a carousel's controls. The test is whether an answer about your page would be wrong without that text.",

  goalTitle: "Identical is the goal",
  goalBody:
    "A 0% gap is not a boring result — it is the target. It means an AI engine citing your page is working from the same words your customers read.",
};
export type AiLensHelpCopy = typeof aiLensHelpEn;

export const AI_LENS_HELP_COPY: Record<DashLocale, AiLensHelpCopy> = {
  en: aiLensHelpEn,
  fr: {
    button: "Aide",
    buttonAria: "Comment fonctionne AI Lens",
    title: "Comment fonctionne AI Lens",
    close: "Fermer",

    intro:
      "Les moteurs de réponse IA lisent vos pages avec le JavaScript désactivé. AI Lens vous montre ce qu'ils obtiennent.",

    whyTitle: "Les robots d'IA n'exécutent pas le JavaScript",
    whyBody:
      "GPTBot, ClaudeBot et PerplexityBot demandent votre page en HTTP simple et lisent ce que le serveur renvoie. Ils n'attendent aucun script, ne cliquent pas et ne défilent pas. Tout ce que votre site construit ensuite dans le navigateur n'existe tout simplement pas pour eux.",

    gapTitle: "Ce que signifie le chiffre de l'écart",
    gapBody:
      "Nous récupérons votre page deux fois — une fois avec l'agent utilisateur d'un robot d'IA, une fois dans un vrai navigateur — nous convertissons les deux en texte brut, puis nous les comparons bloc par bloc. L'écart correspond à la part des mots du navigateur qui n'apparaissent jamais dans la copie du robot. Moins de 5 % : lisible par l'IA ; 5 à 25 % : partiel ; au-delà de 25 %, l'essentiel de la page est invisible.",

    fixTitle: "Comment le réduire",
    fixBody:
      "Envoyez le contenu important dès la première réponse du serveur : rendu côté serveur ou génération statique pour les titres, le corps du texte, les prix et les questions fréquentes. Le rendu côté client convient pour ce qui n'est pas l'objet de la page — une carte, un lanceur de discussion, les commandes d'un carrousel. Le test : une réponse sur votre page serait-elle fausse sans ce texte ?",

    goalTitle: "L'objectif est l'identité",
    goalBody:
      "Un écart de 0 % n'est pas un résultat ennuyeux : c'est la cible. Cela signifie qu'un moteur d'IA qui cite votre page travaille sur les mêmes mots que ceux lus par vos clients.",
  },
  "de-CH": {
    button: "Hilfe",
    buttonAria: "So funktioniert AI Lens",
    title: "So funktioniert AI Lens",
    close: "Schliessen",

    intro:
      "KI-Antwortmaschinen lesen Ihre Seiten mit abgeschaltetem JavaScript. AI Lens zeigt Ihnen, was dabei ankommt.",

    whyTitle: "KI-Crawler führen kein JavaScript aus",
    whyBody:
      "GPTBot, ClaudeBot und PerplexityBot fordern Ihre Seite über einfaches HTTP an und lesen, was der Server zurückschickt. Sie warten auf keine Skripte, klicken nicht und scrollen nicht. Alles, was Ihre Website danach im Browser aufbaut, existiert für sie einfach nicht.",

    gapTitle: "Was die Lückenzahl bedeutet",
    gapBody:
      "Wir rufen Ihre Seite zweimal ab — einmal mit dem User-Agent eines KI-Crawlers, einmal in einem echten Browser —, wandeln beides in reinen Text um und vergleichen Block für Block. Die Lücke ist der Anteil der Browser-Wörter, die in der Crawler-Kopie nie vorkamen. Unter 5 % gilt als KI-lesbar, 5–25 % als teilweise, über 25 % heisst, der Grossteil der Seite ist unsichtbar.",

    fixTitle: "So schliessen Sie sie",
    fixBody:
      "Liefern Sie die wichtigen Inhalte schon mit der ersten Serverantwort: serverseitiges Rendering oder statische Generierung für Überschriften, Fliesstext, Preise und FAQ. Clientseitiges Rendering ist in Ordnung für alles, was nicht der Zweck der Seite ist — eine Karte, ein Chat-Starter, die Steuerung eines Karussells. Die Prüffrage: Wäre eine Antwort über Ihre Seite ohne diesen Text falsch?",

    goalTitle: "Identisch ist das Ziel",
    goalBody:
      "Eine Lücke von 0 % ist kein langweiliges Ergebnis, sondern das Ziel. Sie bedeutet, dass eine KI-Engine, die Ihre Seite zitiert, mit denselben Worten arbeitet, die Ihre Kundschaft liest.",
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Marketing Studio (tool page: /visibility/tools/ai-content-helper)
   ═══════════════════════════════════════════════════════════════════════════

   Everything a user reads now says Marketing Studio: the hub card, the sidebar
   row and the page itself. Only the INTERNAL identifiers still say
   ai_content_helper — the tool id, the /visibility/tools/ai-content-helper
   slug, the dashNav key and the route table in seo-tools.test.ts. A label and a
   slug do not have to match, and renaming the slug would orphan every link that
   already points at it.

   Category names and variable labels are resolved from the dotted keys in
   marketing-templates.ts via marketingLabel() below, so the config stays the
   single source of which fields exist and this file stays the single source of
   what they are called.
*/

const marketingEn = {
  hubTitle: "Marketing Studio",
  hubIntro:
    "Twelve briefs that turn a few facts about your business into a finished marketing asset. Pick the one that matches what you need today.",
  hubPickPrompt: "What are you working on?",

  // Mode chips on each card. These are user-facing promises about cost and
  // privacy, not internal jargon — the whole doctrine is visible here.
  modeGenerate: "Written for you",
  modeHybrid: "Computed, then written",
  modeHeuristic: "Computed on this server",
  modeHeuristicNote:
    "No AI call at all. Everything is measured from what you paste, and what you paste never leaves this server.",
  modeHybridNote:
    "The analysis runs here. Only the summary it produces is sent to be written up — never the data you pasted.",

  backToStudio: "← All briefs",
  requiredField: "Required",

  generateBtn: "Generate",
  generating: "Generating…",
  computeBtn: "Analyse",
  computing: "Analysing…",
  writeUpBtn: "Write it up",
  writeUpHint:
    "Optional. This is the only step that costs anything, and it sends the summary above — nothing else.",

  resultTitle: "Your draft",
  computedTitle: "What the analysis found",
  payloadTitle: "Exactly what would be sent",
  payloadNote:
    "This is the whole payload. Your pasted text is not in it, and there is no second request that includes it.",
  copyBtn: "Copy",
  copied: "Copied",
  cachedNote:
    "You already generated this exact brief today, so this is your saved draft — it cost nothing. Change a field to generate a new one.",

  usageLine: (used: string, limit: string) => `${used} of ${limit} generation tokens used this month`,
  usageUnlimited: (used: string) => `${used} generation tokens used this month`,
  usageResets: "Resets on the 1st.",
  usageFree: "Analysis is free and does not count against this.",

  lockedTitle: "Marketing Studio is on Starter and above",
  lockedBody:
    "Marketing Studio is included from the Starter plan up. Your current plan does not include it.",
  upgradeCta: "Compare plans",

  // Brand voice
  voiceTitle: "Brand voice",
  voiceIntro:
    "Paste a few things you have already written. We measure the rhythm, vocabulary and punctuation habits and write you a style guide — no AI call, and the samples are never stored.",
  voiceSaveBtn: "Use this voice everywhere",
  voiceSaved: "Saved. Every other brief will now be written in this voice.",
  voiceClearBtn: "Stop using it",
  voiceCleared: "Cleared. Briefs will use a neutral voice.",
  voiceActive: "Your saved brand voice is being applied to this brief.",
  voiceNone: "No brand voice saved yet.",
  voiceEditHint:
    "Edit it before saving if anything is wrong — it is plain text, and your edits are kept exactly as written.",
  voiceSamplesNotStored: "Only the guide is saved. The writing samples are discarded.",

  // Errors
  errRateLimited: "Too many at once — try again in a minute.",
  errBudget: "You have used this month's generation budget. Analysis still works, and the budget resets on the 1st.",
  errNotConfigured: "Content generation is not switched on for this deployment yet.",
  errUpstream: "That could not be generated right now. Try again in a minute.",
  errGeneric: "Something went wrong. Try again.",
  errTooShort: "That is too short to work from. Add a few more sentences.",

  loading: "Loading…",

  categories: {
    positioning: {
      name: "Positioning angles",
      role: "Five ways to stand somewhere your competitor is not already standing.",
    },
    ads: {
      name: "Ad variations",
      role: "Ten angles on one product, then the three worth testing first.",
    },
    email: {
      name: "Welcome sequence",
      role: "A sequence that earns the ask before it makes one.",
    },
    seo: {
      name: "Content cluster",
      role: "The subtopics that each deserve their own article, and how they link back.",
    },
    social: {
      name: "Content calendar",
      role: "A pillar-balanced schedule built here, with one hook written per slot.",
    },
    landing: {
      name: "Landing page",
      role: "Benefit-led sections, objection handling, and what to A/B test first.",
    },
    video: {
      name: "Video script",
      role: "A script with a shot list, not just the words.",
    },
    voice: {
      name: "Brand voice",
      role: "Measured from your own writing. No AI call, and nothing is sent anywhere.",
    },
    analytics: {
      name: "Analytics readout",
      role: "What moved and what to do about it. The arithmetic runs here.",
    },
    campaign: {
      name: "Full campaign",
      role: "Every asset for one campaign, all aligned to one success metric.",
    },
    outreach: {
      name: "Partnership outreach",
      role: "Five cold openers that lead with something specific to them.",
    },
    voc: {
      name: "Voice of customer",
      role: "Your customers' own words, counted here and turned into copy.",
    },
  },

  vars: {
    product: "Product or service",
    audience: "Who it is for",
    competitor: "Main competitor",
    theirAngle: "How they position themselves",
    platform: "Platform",
    characterLimit: "Character limit per ad",
    number: "How many emails",
    business: "Business name",
    goal: "Goal of the sequence",
    keyword: "Seed keyword",
    conversionPage: "Page you want people to reach",
    startDate: "Start date",
    days: "How many days",
    pillar1: "Content pillar 1",
    pillar2: "Content pillar 2",
    pillar3: "Content pillar 3",
    maxConsecutive: "Max days in a row on one pillar",
    offer: "What you are offering",
    lengthSeconds: "Length in seconds",
    topic: "Topic",
    writingSamples: "Things you have written",
    data: "Your analytics rows",
    campaignSubject: "What the campaign is for",
    timeframe: "Over what period",
    partnerType: "Who you want to partner with",
    partnershipGoal: "What you want out of it",
    rawFeedback: "Customer feedback",
  },

  /** Format guidance for the fields where the shape is not obvious. */
  varHints: {
    startDate: "YYYY-MM-DD",
    days: "1 to 90",
    maxConsecutive: "2 is a good default",
    characterLimit: "e.g. 90",
    number: "e.g. 5",
    lengthSeconds: "e.g. 45",
    writingSamples: "Paste a few paragraphs — blog posts, emails, anything in your own voice.",
    data: "Paste rows from any analytics export: a label, this period, last period. CSV or tab-separated.",
    rawFeedback: "One review, ticket or survey answer per line.",
  } as Record<string, string>,
};

export type MarketingCopy = typeof marketingEn;

export const MARKETING_COPY: Record<DashLocale, MarketingCopy> = {
  en: marketingEn,
  fr: {
    hubTitle: "Studio marketing",
    hubIntro:
      "Douze briefs qui transforment quelques informations sur votre entreprise en un support marketing fini. Choisissez celui qui correspond à ce dont vous avez besoin aujourd'hui.",
    hubPickPrompt: "Sur quoi travaillez-vous ?",

    modeGenerate: "Rédigé pour vous",
    modeHybrid: "Calculé, puis rédigé",
    modeHeuristic: "Calculé sur ce serveur",
    modeHeuristicNote:
      "Aucun appel à l'IA. Tout est mesuré à partir de ce que vous collez, et ce que vous collez ne quitte jamais ce serveur.",
    modeHybridNote:
      "L'analyse s'exécute ici. Seul le résumé qu'elle produit est envoyé pour rédaction — jamais les données que vous avez collées.",

    backToStudio: "← Tous les briefs",
    requiredField: "Obligatoire",

    generateBtn: "Générer",
    generating: "Génération…",
    computeBtn: "Analyser",
    computing: "Analyse…",
    writeUpBtn: "Rédiger",
    writeUpHint:
      "Facultatif. C'est la seule étape payante, et elle envoie le résumé ci-dessus — rien d'autre.",

    resultTitle: "Votre brouillon",
    computedTitle: "Ce que l'analyse a trouvé",
    payloadTitle: "Exactement ce qui serait envoyé",
    payloadNote:
      "Voici la totalité du contenu envoyé. Votre texte collé n'y figure pas, et aucune seconde requête ne l'inclut.",
    copyBtn: "Copier",
    copied: "Copié",
    cachedNote:
      "Vous avez déjà généré ce brief exact aujourd'hui : voici votre brouillon enregistré, il n'a rien coûté. Modifiez un champ pour en générer un nouveau.",

    usageLine: (used: string, limit: string) => `${used} jetons de génération sur ${limit} utilisés ce mois-ci`,
    usageUnlimited: (used: string) => `${used} jetons de génération utilisés ce mois-ci`,
    usageResets: "Remise à zéro le 1er.",
    usageFree: "L'analyse est gratuite et n'est pas décomptée.",

    lockedTitle: "Le Studio marketing est inclus à partir de Starter",
    lockedBody:
      "Le Studio marketing est inclus à partir du forfait Starter. Votre forfait actuel ne l'inclut pas.",
    upgradeCta: "Comparer les forfaits",

    voiceTitle: "Voix de marque",
    voiceIntro:
      "Collez quelques textes que vous avez déjà écrits. Nous mesurons le rythme, le vocabulaire et les habitudes de ponctuation, puis nous rédigeons votre guide de style — sans appel à l'IA, et les échantillons ne sont jamais conservés.",
    voiceSaveBtn: "Utiliser cette voix partout",
    voiceSaved: "Enregistré. Tous les autres briefs seront désormais rédigés dans cette voix.",
    voiceClearBtn: "Ne plus l'utiliser",
    voiceCleared: "Supprimé. Les briefs utiliseront une voix neutre.",
    voiceActive: "Votre voix de marque enregistrée est appliquée à ce brief.",
    voiceNone: "Aucune voix de marque enregistrée pour l'instant.",
    voiceEditHint:
      "Corrigez-le avant d'enregistrer si quelque chose ne va pas — c'est du texte brut, et vos modifications sont conservées telles quelles.",
    voiceSamplesNotStored: "Seul le guide est enregistré. Les échantillons sont supprimés.",

    errRateLimited: "Trop de demandes à la fois — réessayez dans une minute.",
    errBudget:
      "Vous avez épuisé votre budget de génération du mois. L'analyse reste disponible, et le budget est remis à zéro le 1er.",
    errNotConfigured: "La génération de contenu n'est pas encore activée sur ce déploiement.",
    errUpstream: "Impossible de générer pour le moment. Réessayez dans une minute.",
    errGeneric: "Une erreur est survenue. Réessayez.",
    errTooShort: "C'est trop court pour en tirer quelque chose. Ajoutez quelques phrases.",

    loading: "Chargement…",

    categories: {
      positioning: {
        name: "Angles de positionnement",
        role: "Cinq façons de vous placer là où votre concurrent ne se trouve pas déjà.",
      },
      ads: {
        name: "Variantes publicitaires",
        role: "Dix angles pour un même produit, puis les trois à tester en premier.",
      },
      email: {
        name: "Séquence de bienvenue",
        role: "Une séquence qui mérite la demande avant de la formuler.",
      },
      seo: {
        name: "Cluster de contenu",
        role: "Les sous-thèmes qui méritent chacun leur article, et comment les relier.",
      },
      social: {
        name: "Calendrier de contenu",
        role: "Un calendrier équilibré entre piliers, construit ici, avec une accroche par créneau.",
      },
      landing: {
        name: "Page d'atterrissage",
        role: "Des sections centrées sur les bénéfices, le traitement des objections et quoi tester en A/B.",
      },
      video: {
        name: "Script vidéo",
        role: "Un script accompagné d'un découpage visuel, pas seulement du texte.",
      },
      voice: {
        name: "Voix de marque",
        role: "Mesurée à partir de vos propres écrits. Aucun appel à l'IA, rien n'est envoyé.",
      },
      analytics: {
        name: "Lecture des statistiques",
        role: "Ce qui a bougé et quoi en faire. Les calculs se font ici.",
      },
      campaign: {
        name: "Campagne complète",
        role: "Tous les supports d'une campagne, alignés sur un seul indicateur de réussite.",
      },
      outreach: {
        name: "Prospection de partenariats",
        role: "Cinq messages d'approche qui commencent par quelque chose qui leur est propre.",
      },
      voc: {
        name: "Voix du client",
        role: "Les mots de vos clients, comptés ici et transformés en accroches.",
      },
    },

    vars: {
      product: "Produit ou service",
      audience: "À qui cela s'adresse",
      competitor: "Concurrent principal",
      theirAngle: "Comment il se positionne",
      platform: "Plateforme",
      characterLimit: "Limite de caractères par annonce",
      number: "Combien de courriels",
      business: "Nom de l'entreprise",
      goal: "Objectif de la séquence",
      keyword: "Mot-clé de départ",
      conversionPage: "Page vers laquelle diriger",
      startDate: "Date de début",
      days: "Combien de jours",
      pillar1: "Pilier de contenu 1",
      pillar2: "Pilier de contenu 2",
      pillar3: "Pilier de contenu 3",
      maxConsecutive: "Jours consécutifs maximum sur un pilier",
      offer: "Ce que vous proposez",
      lengthSeconds: "Durée en secondes",
      topic: "Sujet",
      writingSamples: "Des textes que vous avez écrits",
      data: "Vos lignes de statistiques",
      campaignSubject: "Objet de la campagne",
      timeframe: "Sur quelle période",
      partnerType: "Avec qui vous voulez vous associer",
      partnershipGoal: "Ce que vous en attendez",
      rawFeedback: "Retours clients",
    },

    varHints: {
      startDate: "AAAA-MM-JJ",
      days: "1 à 90",
      maxConsecutive: "2 est une bonne valeur par défaut",
      characterLimit: "par ex. 90",
      number: "par ex. 5",
      lengthSeconds: "par ex. 45",
      writingSamples:
        "Collez quelques paragraphes — articles, courriels, tout ce qui est écrit de votre main.",
      data:
        "Collez des lignes issues de n'importe quel export : un libellé, la période actuelle, la précédente. CSV ou séparé par des tabulations.",
      rawFeedback: "Un avis, un ticket ou une réponse d'enquête par ligne.",
    },
  },
  "de-CH": {
    hubTitle: "Marketing Studio",
    hubIntro:
      "Zwölf Briefings, die einige Angaben zu Ihrem Unternehmen in ein fertiges Marketingmittel verwandeln. Wählen Sie das passende für Ihre heutige Aufgabe.",
    hubPickPrompt: "Woran arbeiten Sie?",

    modeGenerate: "Für Sie geschrieben",
    modeHybrid: "Berechnet, dann geschrieben",
    modeHeuristic: "Auf diesem Server berechnet",
    modeHeuristicNote:
      "Kein KI-Aufruf. Alles wird aus dem berechnet, was Sie einfügen — und das verlässt diesen Server nie.",
    modeHybridNote:
      "Die Auswertung läuft hier. Nur die daraus entstehende Zusammenfassung wird zum Ausformulieren gesendet — nie Ihre eingefügten Daten.",

    backToStudio: "← Alle Briefings",
    requiredField: "Pflichtfeld",

    generateBtn: "Erstellen",
    generating: "Wird erstellt…",
    computeBtn: "Auswerten",
    computing: "Wird ausgewertet…",
    writeUpBtn: "Ausformulieren",
    writeUpHint:
      "Optional. Nur dieser Schritt kostet etwas, und er sendet die Zusammenfassung oben — sonst nichts.",

    resultTitle: "Ihr Entwurf",
    computedTitle: "Was die Auswertung ergeben hat",
    payloadTitle: "Genau das würde gesendet",
    payloadNote:
      "Das ist der vollständige Inhalt. Ihr eingefügter Text steht nicht darin, und es gibt keine zweite Anfrage, die ihn enthält.",
    copyBtn: "Kopieren",
    copied: "Kopiert",
    cachedNote:
      "Sie haben genau dieses Briefing heute schon erstellt — das ist Ihr gespeicherter Entwurf und hat nichts gekostet. Ändern Sie ein Feld für einen neuen.",

    usageLine: (used: string, limit: string) => `${used} von ${limit} Generierungs-Tokens diesen Monat genutzt`,
    usageUnlimited: (used: string) => `${used} Generierungs-Tokens diesen Monat genutzt`,
    usageResets: "Zurückgesetzt am 1.",
    usageFree: "Auswertungen sind kostenlos und zählen nicht mit.",

    lockedTitle: "Marketing Studio gibt es ab Starter",
    lockedBody:
      "Marketing Studio ist ab dem Starter-Abo enthalten. Ihr aktuelles Abo umfasst es nicht.",
    upgradeCta: "Abos vergleichen",

    voiceTitle: "Markenstimme",
    voiceIntro:
      "Fügen Sie einige Texte ein, die Sie bereits geschrieben haben. Wir messen Rhythmus, Wortschatz und Zeichensetzung und schreiben Ihnen daraus einen Styleguide — ohne KI-Aufruf, und die Textproben werden nie gespeichert.",
    voiceSaveBtn: "Diese Stimme überall verwenden",
    voiceSaved: "Gespeichert. Alle weiteren Briefings werden nun in dieser Stimme geschrieben.",
    voiceClearBtn: "Nicht mehr verwenden",
    voiceCleared: "Entfernt. Briefings verwenden wieder eine neutrale Stimme.",
    voiceActive: "Ihre gespeicherte Markenstimme wird auf dieses Briefing angewendet.",
    voiceNone: "Noch keine Markenstimme gespeichert.",
    voiceEditHint:
      "Passen Sie ihn vor dem Speichern an, falls etwas nicht stimmt — es ist reiner Text, und Ihre Änderungen bleiben genau so erhalten.",
    voiceSamplesNotStored: "Nur der Styleguide wird gespeichert. Die Textproben werden verworfen.",

    errRateLimited: "Zu viele Anfragen auf einmal — versuchen Sie es in einer Minute erneut.",
    errBudget:
      "Sie haben das Generierungsbudget dieses Monats aufgebraucht. Auswertungen funktionieren weiterhin, und das Budget wird am 1. zurückgesetzt.",
    errNotConfigured: "Die Inhaltserstellung ist auf dieser Installation noch nicht aktiviert.",
    errUpstream: "Das konnte gerade nicht erstellt werden. Versuchen Sie es in einer Minute erneut.",
    errGeneric: "Etwas ist schiefgelaufen. Versuchen Sie es erneut.",
    errTooShort: "Das ist zu kurz, um damit zu arbeiten. Ergänzen Sie ein paar Sätze.",

    loading: "Wird geladen…",

    categories: {
      positioning: {
        name: "Positionierungs-Ansätze",
        role: "Fünf Möglichkeiten, dort zu stehen, wo Ihre Konkurrenz nicht schon steht.",
      },
      ads: {
        name: "Anzeigenvarianten",
        role: "Zehn Ansätze für ein Produkt und die drei, die Sie zuerst testen sollten.",
      },
      email: {
        name: "Willkommensstrecke",
        role: "Eine Strecke, die sich die Bitte verdient, bevor sie sie ausspricht.",
      },
      seo: {
        name: "Themencluster",
        role: "Die Unterthemen, die je einen eigenen Artikel verdienen, und wie sie zurückverlinken.",
      },
      social: {
        name: "Redaktionsplan",
        role: "Ein hier erstellter Plan mit ausgewogenen Säulen und einem Aufhänger pro Slot.",
      },
      landing: {
        name: "Landingpage",
        role: "Nutzenorientierte Abschnitte, Einwandbehandlung und was Sie zuerst A/B-testen sollten.",
      },
      video: {
        name: "Videoskript",
        role: "Ein Skript mit Einstellungsliste, nicht nur der gesprochene Text.",
      },
      voice: {
        name: "Markenstimme",
        role: "Aus Ihren eigenen Texten gemessen. Kein KI-Aufruf, nichts wird gesendet.",
      },
      analytics: {
        name: "Auswertung der Kennzahlen",
        role: "Was sich bewegt hat und was zu tun ist. Gerechnet wird hier.",
      },
      campaign: {
        name: "Komplette Kampagne",
        role: "Alle Mittel einer Kampagne, ausgerichtet auf eine einzige Erfolgskennzahl.",
      },
      outreach: {
        name: "Partnerschaftsanfragen",
        role: "Fünf Erstkontakte, die mit etwas Konkretem über das Gegenüber beginnen.",
      },
      voc: {
        name: "Stimme der Kundschaft",
        role: "Die Worte Ihrer Kundschaft, hier ausgezählt und zu Texten gemacht.",
      },
    },

    vars: {
      product: "Produkt oder Dienstleistung",
      audience: "Für wen es gedacht ist",
      competitor: "Wichtigste Konkurrenz",
      theirAngle: "Wie sie sich positioniert",
      platform: "Plattform",
      characterLimit: "Zeichenlimit pro Anzeige",
      number: "Wie viele E-Mails",
      business: "Firmenname",
      goal: "Ziel der Strecke",
      keyword: "Ausgangs-Keyword",
      conversionPage: "Zielseite",
      startDate: "Startdatum",
      days: "Wie viele Tage",
      pillar1: "Inhaltssäule 1",
      pillar2: "Inhaltssäule 2",
      pillar3: "Inhaltssäule 3",
      maxConsecutive: "Maximale Tage am Stück auf einer Säule",
      offer: "Was Sie anbieten",
      lengthSeconds: "Länge in Sekunden",
      topic: "Thema",
      writingSamples: "Texte, die Sie geschrieben haben",
      data: "Ihre Kennzahlen-Zeilen",
      campaignSubject: "Worum es in der Kampagne geht",
      timeframe: "Über welchen Zeitraum",
      partnerType: "Mit wem Sie zusammenarbeiten möchten",
      partnershipGoal: "Was Sie sich davon versprechen",
      rawFeedback: "Kundenrückmeldungen",
    },

    varHints: {
      startDate: "JJJJ-MM-TT",
      days: "1 bis 90",
      maxConsecutive: "2 ist ein guter Standardwert",
      characterLimit: "z. B. 90",
      number: "z. B. 5",
      lengthSeconds: "z. B. 45",
      writingSamples:
        "Fügen Sie ein paar Absätze ein — Blogbeiträge, E-Mails, alles in Ihrer eigenen Sprache.",
      data:
        "Fügen Sie Zeilen aus einem beliebigen Export ein: Bezeichnung, aktueller Zeitraum, vorheriger. CSV oder tabgetrennt.",
      rawFeedback: "Eine Bewertung, ein Ticket oder eine Umfrageantwort pro Zeile.",
    },
  },
};

/**
 * Resolve a dotted key from marketing-templates.ts against a copy catalog.
 *
 * "marketing.positioning.name" -> categories.positioning.name
 * "marketing.voice.role"       -> categories.voice.role
 * "marketing.var.product"      -> vars.product
 *
 * An unresolved key returns the key itself rather than an empty string, so a
 * missing translation shows up as visible garbage in the UI instead of a blank
 * label nobody notices. tests/marketing-i18n.test.ts asserts none of the keys
 * the config actually declares takes that path, in any of the three locales.
 */
export function marketingLabel(copy: MarketingCopy, key: string): string {
  const parts = key.split(".");
  if (parts[0] !== "marketing" || parts.length < 3) return key;

  if (parts[1] === "var") {
    return copy.vars[parts[2] as keyof MarketingCopy["vars"]] ?? key;
  }

  const category = copy.categories[parts[1] as keyof MarketingCopy["categories"]];
  if (!category) return key;
  return parts[2] === "role" ? category.role : category.name;
}

/** Format hint for a variable, or null when the field speaks for itself. */
export function marketingVarHint(copy: MarketingCopy, labelKey: string): string | null {
  const name = labelKey.startsWith("marketing.var.") ? labelKey.slice("marketing.var.".length) : "";
  return copy.varHints[name] ?? null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Historical (tool page: /visibility/tools/historical)
   ═══════════════════════════════════════════════════════════════════════════ */

const historicalEn = {
  title: "Historical",
  intro:
    "How your search results and your pages have changed over time. SERP history reads checks you have already run — it costs nothing and makes no new call.",

  serpTitle: "SERP history",
  serpIntro:
    "Every completed SERP check is kept. Pick a keyword to see how the results moved between checks.",
  keywordLabel: "Keyword",
  domainLabel: "Track domain",
  noSerpTitle: "No SERP history yet",
  noSerpBody:
    "Run your first SERP check and it will appear here. Two checks of the same keyword are enough to see what moved.",
  runFirstCheck: "Run a SERP check",
  needTwoChecks:
    "One check so far. Run this keyword again — from a different day — and the movement between the two shows up here.",
  checksCounted: (n: number) => (n === 1 ? "1 check" : `${n} checks`),
  positionChartTitle: "Position over time",
  positionAxis: "Position",
  offChart: "Not in the top 100",
  deltaTitle: (a: string, b: string) => `What changed between ${a} and ${b}`,
  entered: "Entered",
  dropped: "Dropped out",
  moved: "Moved",
  held: "Held",
  colDomain: "Domain",
  colWas: "Was",
  colNow: "Now",
  colChange: "Change",
  noChange: "Nothing moved in the top 10 between these two checks.",
  runFresh: "Run a fresh check",
  freshNote: "A new check costs one from your monthly allowance. Reading history is free.",

  snapshotsTitle: "Page snapshots",
  snapshotsIntro:
    "A copy of the readable text of a page, kept so you can see exactly what changed and when.",
  captureLabel: "Page URL",
  capturePlaceholder: "any page — yours or a competitor's",
  captureAnyUrlNote:
    "Capture any public page. Scheme optional — \"cnn.com\" works.",
  captureNormalized: (url: string) => `Captured as ${url}`,
  errUrlScheme: "Only http:// and https:// pages can be captured.",
  errUrlCredentials: "Remove the username and password from that URL.",
  errUrlPort: "Only standard web ports (80 and 443) can be captured.",
  errUrlPrivate: "That address is not a public website.",
  captureBtn: "Capture now",
  capturing: "Capturing…",
  captureDuplicate: "No change since the last snapshot — nothing new was stored.",
  captureStored: "Snapshot stored.",
  noSnapshotsTitle: "No snapshots yet",
  noSnapshotsBody:
    "Capture a page above to start. Every AI Lens run also saves a snapshot automatically.",
  snapshotCount: (n: number) => (n === 1 ? "1 snapshot" : `${n} snapshots`),
  compareTitle: "Compare two snapshots",
  compareOlder: "Older",
  compareNewer: "Newer",
  compareBtn: "Compare",
  comparing: "Comparing…",
  pickTwo: "Pick two snapshots to compare.",
  wordsAdded: (n: number) => `${n} words added`,
  wordsRemoved: (n: number) => `${n} words removed`,
  noTextChange: "The readable text is identical between these two snapshots.",
  diffTruncated:
    "These pages are too long for a word-level diff, so they are shown whole.",
  sourceAiLens: "AI Lens",
  sourceManual: "Manual",
  sourceWayback: "Internet Archive",

  waybackTitle: "Import history",
  waybackIntro:
    "The Internet Archive may already hold older copies of this page. Import them to backfill history you never captured yourself.",
  waybackNote: "Source: Internet Archive — coverage varies.",
  waybackLookupBtn: "Find archived copies",
  waybackLooking: "Searching the archive…",
  waybackNone:
    "No archived copies found for that URL — the Internet Archive has never crawled it.",
  waybackUnreachable:
    "The Internet Archive did not respond, so we do not know what it has. Try again in a minute.",
  waybackFound: (n: number) => `${n} archived copies available`,
  waybackImportBtn: (n: number) => (n === 1 ? "Import 1 snapshot" : `Import ${n} snapshots`),
  waybackImporting: "Importing…",
  waybackMax: (n: number) => `Up to ${n} at a time.`,
  waybackResult: (ok: number, dup: number, failed: number) =>
    `Imported ${ok}. ${dup} already matched what you had. ${failed} could not be fetched.`,

  keywordHistoryTitle: "Keyword history",
  keywordHistoryIntro:
    "Search volume and ranking history from DataForSEO. Unlike the timeline above, this is a paid lookup and counts against your monthly allowance.",
  keywordHistoryBtn: "Look up keyword history",
  keywordHistoryLoading: "Looking up…",
  keywordHistoryEmpty: "No historical data returned for that keyword.",
  colMonth: "Month",
  colVolume: "Search volume",

  storageUnavailable:
    "Snapshot storage is temporarily unavailable. SERP history below is unaffected.",
  storageNotConfigured:
    "Snapshot storage is not configured on this deployment. SERP history still works.",
  errRateLimited: "Too many requests — try again in a minute.",
  errInvalidUrl: "That URL cannot be captured. Use a public http:// or https:// address.",
  errTooLarge: "That page is too long to snapshot.",
  errCapture: "Could not capture that page right now.",
  errCaptureBlocked:
    "That site blocks automated capture, so its text cannot be archived here.",
  errGeneric: "Something went wrong. Try again.",
  loading: "Loading…",
};

export type HistoricalCopy = typeof historicalEn;

export const HISTORICAL_COPY: Record<DashLocale, HistoricalCopy> = {
  en: historicalEn,
  fr: {
    title: "Historique",
    intro:
      "L'évolution de vos résultats de recherche et de vos pages. L'historique SERP relit des vérifications déjà effectuées — il ne coûte rien et ne lance aucun nouvel appel.",

    serpTitle: "Historique SERP",
    serpIntro:
      "Chaque vérification SERP terminée est conservée. Choisissez un mot-clé pour voir comment les résultats ont bougé.",
    keywordLabel: "Mot-clé",
    domainLabel: "Suivre le domaine",
    noSerpTitle: "Pas encore d'historique SERP",
    noSerpBody:
      "Lancez votre première vérification SERP et elle apparaîtra ici. Deux vérifications du même mot-clé suffisent pour voir ce qui a changé.",
    runFirstCheck: "Lancer une vérification SERP",
    needTwoChecks:
      "Une seule vérification pour l'instant. Relancez ce mot-clé un autre jour et l'écart entre les deux s'affichera ici.",
    checksCounted: (n: number) => (n === 1 ? "1 vérification" : `${n} vérifications`),
    positionChartTitle: "Position dans le temps",
    positionAxis: "Position",
    offChart: "Hors du top 100",
    deltaTitle: (a: string, b: string) => `Ce qui a changé entre le ${a} et le ${b}`,
    entered: "Entrés",
    dropped: "Sortis",
    moved: "Déplacés",
    held: "Stables",
    colDomain: "Domaine",
    colWas: "Avant",
    colNow: "Après",
    colChange: "Écart",
    noChange: "Rien n'a bougé dans le top 10 entre ces deux vérifications.",
    runFresh: "Lancer une nouvelle vérification",
    freshNote:
      "Une nouvelle vérification est décomptée de votre forfait mensuel. Consulter l'historique est gratuit.",

    snapshotsTitle: "Archives de pages",
    snapshotsIntro:
      "Une copie du texte lisible d'une page, conservée pour voir exactement ce qui a changé et quand.",
    captureLabel: "URL de la page",
    capturePlaceholder: "n'importe quelle page — la vôtre ou celle d'un concurrent",
    captureAnyUrlNote:
      "Capturez n'importe quelle page publique. Le protocole est facultatif — « cnn.com » suffit.",
    captureNormalized: (url: string) => `Capturé sous ${url}`,
    errUrlScheme: "Seules les pages en http:// ou https:// peuvent être capturées.",
    errUrlCredentials: "Retirez le nom d'utilisateur et le mot de passe de cette URL.",
    errUrlPort: "Seuls les ports web standards (80 et 443) peuvent être capturés.",
    errUrlPrivate: "Cette adresse n'est pas un site web public.",
    captureBtn: "Capturer maintenant",
    capturing: "Capture en cours…",
    captureDuplicate: "Aucun changement depuis la dernière archive — rien n'a été enregistré.",
    captureStored: "Archive enregistrée.",
    noSnapshotsTitle: "Pas encore d'archives",
    noSnapshotsBody:
      "Capturez une page ci-dessus pour commencer. Chaque analyse AI Lens enregistre aussi une archive automatiquement.",
    snapshotCount: (n: number) => (n === 1 ? "1 archive" : `${n} archives`),
    compareTitle: "Comparer deux archives",
    compareOlder: "Plus ancienne",
    compareNewer: "Plus récente",
    compareBtn: "Comparer",
    comparing: "Comparaison…",
    pickTwo: "Choisissez deux archives à comparer.",
    wordsAdded: (n: number) => `${n} mots ajoutés`,
    wordsRemoved: (n: number) => `${n} mots supprimés`,
    noTextChange: "Le texte lisible est identique entre ces deux archives.",
    diffTruncated:
      "Ces pages sont trop longues pour une comparaison mot à mot : elles sont affichées en entier.",
    sourceAiLens: "AI Lens",
    sourceManual: "Manuelle",
    sourceWayback: "Internet Archive",

    waybackTitle: "Importer l'historique",
    waybackIntro:
      "L'Internet Archive conserve peut-être déjà d'anciennes copies de cette page. Importez-les pour reconstituer un historique que vous n'avez jamais capturé.",
    waybackNote: "Source : Internet Archive — la couverture varie.",
    waybackLookupBtn: "Chercher des copies archivées",
    waybackLooking: "Recherche dans l'archive…",
    waybackNone:
      "Aucune copie archivée pour cette URL — Internet Archive ne l'a jamais explorée.",
    waybackUnreachable:
      "Internet Archive n'a pas répondu : impossible de savoir ce qu'il contient. Réessayez dans une minute.",
    waybackFound: (n: number) => `${n} copies archivées disponibles`,
    waybackImportBtn: (n: number) => (n === 1 ? "Importer 1 archive" : `Importer ${n} archives`),
    waybackImporting: "Importation…",
    waybackMax: (n: number) => `Jusqu'à ${n} à la fois.`,
    waybackResult: (ok: number, dup: number, failed: number) =>
      `${ok} importées. ${dup} correspondaient déjà à ce que vous aviez. ${failed} n'ont pas pu être récupérées.`,

    keywordHistoryTitle: "Historique du mot-clé",
    keywordHistoryIntro:
      "Volume de recherche et historique de positionnement depuis DataForSEO. Contrairement à la chronologie ci-dessus, il s'agit d'une requête payante décomptée de votre forfait mensuel.",
    keywordHistoryBtn: "Consulter l'historique du mot-clé",
    keywordHistoryLoading: "Consultation…",
    keywordHistoryEmpty: "Aucune donnée historique pour ce mot-clé.",
    colMonth: "Mois",
    colVolume: "Volume de recherche",

    storageUnavailable:
      "Le stockage des archives est momentanément indisponible. L'historique SERP ci-dessous n'est pas affecté.",
    storageNotConfigured:
      "Le stockage des archives n'est pas configuré sur ce déploiement. L'historique SERP fonctionne toujours.",
    errRateLimited: "Trop de requêtes — réessayez dans une minute.",
    errInvalidUrl:
      "Cette URL ne peut pas être capturée. Utilisez une adresse publique en http:// ou https://.",
    errTooLarge: "Cette page est trop longue pour être archivée.",
    errCapture: "Impossible de capturer cette page pour le moment.",
    errCaptureBlocked:
      "Ce site bloque la capture automatisée : son texte ne peut pas être archivé ici.",
    errGeneric: "Une erreur est survenue. Réessayez.",
    loading: "Chargement…",
  },
  "de-CH": {
    title: "Verlauf",
    intro:
      "Wie sich Ihre Suchergebnisse und Ihre Seiten über die Zeit verändert haben. Der SERP-Verlauf liest bereits durchgeführte Prüfungen — das kostet nichts und löst keinen neuen Aufruf aus.",

    serpTitle: "SERP-Verlauf",
    serpIntro:
      "Jede abgeschlossene SERP-Prüfung bleibt erhalten. Wählen Sie ein Keyword, um zu sehen, wie sich die Ergebnisse bewegt haben.",
    keywordLabel: "Keyword",
    domainLabel: "Domain verfolgen",
    noSerpTitle: "Noch kein SERP-Verlauf",
    noSerpBody:
      "Führen Sie Ihre erste SERP-Prüfung durch, dann erscheint sie hier. Zwei Prüfungen desselben Keywords genügen, um Bewegung zu sehen.",
    runFirstCheck: "SERP-Prüfung starten",
    needTwoChecks:
      "Bisher eine Prüfung. Prüfen Sie dieses Keyword an einem anderen Tag erneut, dann erscheint der Unterschied hier.",
    checksCounted: (n: number) => (n === 1 ? "1 Prüfung" : `${n} Prüfungen`),
    positionChartTitle: "Position im Zeitverlauf",
    positionAxis: "Position",
    offChart: "Nicht in den Top 100",
    deltaTitle: (a: string, b: string) => `Was sich zwischen ${a} und ${b} geändert hat`,
    entered: "Neu",
    dropped: "Herausgefallen",
    moved: "Verschoben",
    held: "Unverändert",
    colDomain: "Domain",
    colWas: "Vorher",
    colNow: "Jetzt",
    colChange: "Differenz",
    noChange: "In den Top 10 hat sich zwischen diesen beiden Prüfungen nichts bewegt.",
    runFresh: "Neue Prüfung starten",
    freshNote:
      "Eine neue Prüfung wird von Ihrem Monatskontingent abgezogen. Den Verlauf zu lesen ist gratis.",

    snapshotsTitle: "Seitenstände",
    snapshotsIntro:
      "Eine Kopie des lesbaren Textes einer Seite, aufbewahrt, damit Sie genau sehen, was sich wann geändert hat.",
    captureLabel: "Seiten-URL",
    capturePlaceholder: "eine beliebige Seite — Ihre oder die der Konkurrenz",
    captureAnyUrlNote:
      "Erfassen Sie jede öffentliche Seite. Das Protokoll ist optional — «cnn.com» genügt.",
    captureNormalized: (url: string) => `Erfasst als ${url}`,
    errUrlScheme: "Nur Seiten mit http:// oder https:// können erfasst werden.",
    errUrlCredentials: "Entfernen Sie Benutzername und Passwort aus dieser URL.",
    errUrlPort: "Nur die Standard-Webports (80 und 443) können erfasst werden.",
    errUrlPrivate: "Diese Adresse ist keine öffentliche Website.",
    captureBtn: "Jetzt erfassen",
    capturing: "Wird erfasst…",
    captureDuplicate: "Keine Änderung seit dem letzten Stand — es wurde nichts Neues gespeichert.",
    captureStored: "Stand gespeichert.",
    noSnapshotsTitle: "Noch keine Seitenstände",
    noSnapshotsBody:
      "Erfassen Sie oben eine Seite, um zu beginnen. Jede AI-Lens-Analyse speichert ebenfalls automatisch einen Stand.",
    snapshotCount: (n: number) => (n === 1 ? "1 Stand" : `${n} Stände`),
    compareTitle: "Zwei Stände vergleichen",
    compareOlder: "Älter",
    compareNewer: "Neuer",
    compareBtn: "Vergleichen",
    comparing: "Wird verglichen…",
    pickTwo: "Wählen Sie zwei Stände zum Vergleich.",
    wordsAdded: (n: number) => `${n} Wörter ergänzt`,
    wordsRemoved: (n: number) => `${n} Wörter entfernt`,
    noTextChange: "Der lesbare Text ist in beiden Ständen identisch.",
    diffTruncated:
      "Diese Seiten sind für einen wortweisen Vergleich zu lang und werden vollständig angezeigt.",
    sourceAiLens: "AI Lens",
    sourceManual: "Manuell",
    sourceWayback: "Internet Archive",

    waybackTitle: "Verlauf importieren",
    waybackIntro:
      "Das Internet Archive hat womöglich ältere Kopien dieser Seite. Importieren Sie sie, um Verlauf nachzutragen, den Sie nie selbst erfasst haben.",
    waybackNote: "Quelle: Internet Archive — die Abdeckung schwankt.",
    waybackLookupBtn: "Archivierte Kopien suchen",
    waybackLooking: "Archiv wird durchsucht…",
    waybackNone:
      "Keine archivierten Kopien für diese URL — das Internet Archive hat sie nie erfasst.",
    waybackUnreachable:
      "Das Internet Archive hat nicht geantwortet, wir wissen also nicht, was dort liegt. Versuchen Sie es in einer Minute erneut.",
    waybackFound: (n: number) => `${n} archivierte Kopien verfügbar`,
    waybackImportBtn: (n: number) => (n === 1 ? "1 Stand importieren" : `${n} Stände importieren`),
    waybackImporting: "Wird importiert…",
    waybackMax: (n: number) => `Bis zu ${n} auf einmal.`,
    waybackResult: (ok: number, dup: number, failed: number) =>
      `${ok} importiert. ${dup} entsprachen bereits Vorhandenem. ${failed} konnten nicht geladen werden.`,

    keywordHistoryTitle: "Keyword-Verlauf",
    keywordHistoryIntro:
      "Suchvolumen und Ranking-Verlauf von DataForSEO. Anders als die Zeitachse oben ist dies eine kostenpflichtige Abfrage und zählt gegen Ihr Monatskontingent.",
    keywordHistoryBtn: "Keyword-Verlauf abrufen",
    keywordHistoryLoading: "Wird abgerufen…",
    keywordHistoryEmpty: "Für dieses Keyword wurden keine historischen Daten geliefert.",
    colMonth: "Monat",
    colVolume: "Suchvolumen",

    storageUnavailable:
      "Der Speicher für Seitenstände ist vorübergehend nicht verfügbar. Der SERP-Verlauf unten ist nicht betroffen.",
    storageNotConfigured:
      "Der Speicher für Seitenstände ist auf dieser Installation nicht konfiguriert. Der SERP-Verlauf funktioniert weiterhin.",
    errRateLimited: "Zu viele Anfragen — versuchen Sie es in einer Minute erneut.",
    errInvalidUrl:
      "Diese URL kann nicht erfasst werden. Verwenden Sie eine öffentliche http://- oder https://-Adresse.",
    errTooLarge: "Diese Seite ist zu lang, um sie zu archivieren.",
    errCapture: "Diese Seite konnte gerade nicht erfasst werden.",
    errCaptureBlocked:
      "Diese Website blockiert automatisierte Erfassung, ihr Text kann hier nicht archiviert werden.",
    errGeneric: "Etwas ist schiefgelaufen. Versuchen Sie es erneut.",
    loading: "Wird geladen…",
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Reputation Tools hub (/reputation)
   ═══════════════════════════════════════════════════════════════════════════

   The eleven reputation surfaces, grouped. Every card points at the route that
   already existed — this is navigation copy, not a new product surface.
*/

const reputationEn = {
  hubTitle: "Reputation Tools",
  hubSubtitle:
    "Everything that turns customer experience into reviews, and reviews into something you can act on.",

  lockedBadge: "Not on your plan",
  lockedHint: (plan: string) => `Included from ${plan}`,
  upgradeCta: "Compare plans",

  groups: {
    customer_feedback: "Customer feedback",
    risk_recovery: "Risk and recovery",
    analytics: "Analytics",
    data: "Data",
  } as Record<string, string>,

  items: {
    customers: {
      name: "Customers",
      description: "Everyone you can ask for a review, and what you already know about them.",
    },
    feedback: {
      name: "Feedback",
      description: "What customers said, sentiment-scored and sorted by what needs a reply.",
    },
    campaigns: {
      name: "Campaigns",
      description: "Ask for reviews on a schedule, by email or SMS, without asking twice.",
    },
    review_links: {
      name: "Review links",
      description: "One short link per platform, so a happy customer lands where it counts.",
    },
    templates: {
      name: "Templates",
      description: "Reusable request and reply wording, per channel and per locale.",
    },
    recovery: {
      name: "Recovery",
      description: "Unhappy customers caught before they post, with the fix routed to someone.",
    },
    intelligence: {
      name: "Intelligence",
      description: "Competitor movement, escalation risk and review authenticity in one read.",
    },
    monitoring: {
      name: "Monitoring",
      description: "New reviews across every source you connect, alerted the day they land.",
    },
    reputation_analytics: {
      name: "Reputation analytics",
      description: "Rating, volume and response time over time — and what moved them.",
    },
    data_sources: {
      name: "Data sources",
      description: "Import customers and reviews, or connect a platform to keep them current.",
    },
    extension: {
      name: "Browser extension",
      description: "Capture reviews and customers from a platform tab, without an export.",
    },
  } as Record<string, { name: string; description: string }>,
};

export type ReputationCopy = typeof reputationEn;

export const REPUTATION_COPY: Record<DashLocale, ReputationCopy> = {
  en: reputationEn,
  fr: {
    hubTitle: "Outils de réputation",
    hubSubtitle:
      "Tout ce qui transforme l'expérience client en avis, et les avis en décisions concrètes.",

    lockedBadge: "Non inclus dans votre forfait",
    lockedHint: (plan: string) => `Inclus à partir de ${plan}`,
    upgradeCta: "Comparer les forfaits",

    groups: {
      customer_feedback: "Retours clients",
      risk_recovery: "Risque et rattrapage",
      analytics: "Analytique",
      data: "Données",
    },

    items: {
      customers: {
        name: "Clients",
        description: "Toutes les personnes à qui demander un avis, et ce que vous savez déjà d'elles.",
      },
      feedback: {
        name: "Retours",
        description: "Ce que vos clients ont dit, avec le sentiment analysé et les réponses à traiter en premier.",
      },
      campaigns: {
        name: "Campagnes",
        description: "Demandez des avis automatiquement, par courriel ou SMS, sans jamais relancer deux fois.",
      },
      review_links: {
        name: "Liens d'avis",
        description: "Un lien court par plateforme, pour que le client satisfait arrive au bon endroit.",
      },
      templates: {
        name: "Modèles",
        description: "Formulations réutilisables pour les demandes et les réponses, par canal et par langue.",
      },
      recovery: {
        name: "Rattrapage",
        description: "Les clients mécontents interceptés avant publication, avec un responsable assigné.",
      },
      intelligence: {
        name: "Intelligence",
        description: "Mouvements des concurrents, risque d'escalade et authenticité des avis, en une lecture.",
      },
      monitoring: {
        name: "Surveillance",
        description: "Les nouveaux avis de chaque source connectée, signalés le jour même.",
      },
      reputation_analytics: {
        name: "Analytique de réputation",
        description: "Note, volume et délai de réponse dans le temps — et ce qui les a fait bouger.",
      },
      data_sources: {
        name: "Sources de données",
        description: "Importez clients et avis, ou connectez une plateforme pour les tenir à jour.",
      },
      extension: {
        name: "Extension de navigateur",
        description: "Récupérez avis et clients depuis un onglet de plateforme, sans export.",
      },
    },
  },
  "de-CH": {
    hubTitle: "Reputations-Tools",
    hubSubtitle:
      "Alles, was Kundenerlebnisse in Bewertungen verwandelt — und Bewertungen in Entscheidungen.",

    lockedBadge: "Nicht in Ihrem Abo",
    lockedHint: (plan: string) => `Enthalten ab ${plan}`,
    upgradeCta: "Abos vergleichen",

    groups: {
      customer_feedback: "Kundenfeedback",
      risk_recovery: "Risiko und Rückgewinnung",
      analytics: "Auswertungen",
      data: "Daten",
    },

    items: {
      customers: {
        name: "Kundschaft",
        description: "Alle, die Sie um eine Bewertung bitten können — und was Sie über sie wissen.",
      },
      feedback: {
        name: "Rückmeldungen",
        description: "Was Ihre Kundschaft gesagt hat, mit Stimmungsanalyse und nach Antwortbedarf sortiert.",
      },
      campaigns: {
        name: "Kampagnen",
        description: "Bitten Sie planmässig um Bewertungen, per E-Mail oder SMS, ohne doppelt nachzufassen.",
      },
      review_links: {
        name: "Bewertungslinks",
        description: "Ein Kurzlink pro Plattform, damit zufriedene Kundschaft dort landet, wo es zählt.",
      },
      templates: {
        name: "Vorlagen",
        description: "Wiederverwendbare Texte für Anfragen und Antworten, pro Kanal und Sprache.",
      },
      recovery: {
        name: "Rückgewinnung",
        description: "Unzufriedene Kundschaft abgefangen, bevor sie postet — mit zuständiger Person.",
      },
      intelligence: {
        name: "Intelligence",
        description: "Bewegungen der Konkurrenz, Eskalationsrisiko und Echtheit von Bewertungen auf einen Blick.",
      },
      monitoring: {
        name: "Überwachung",
        description: "Neue Bewertungen aus jeder verbundenen Quelle, am selben Tag gemeldet.",
      },
      reputation_analytics: {
        name: "Reputations-Auswertung",
        description: "Bewertung, Menge und Antwortzeit im Verlauf — und was sie bewegt hat.",
      },
      data_sources: {
        name: "Datenquellen",
        description: "Importieren Sie Kundschaft und Bewertungen oder verbinden Sie eine Plattform.",
      },
      extension: {
        name: "Browser-Erweiterung",
        description: "Erfassen Sie Bewertungen und Kundschaft direkt aus einem Plattform-Tab, ohne Export.",
      },
    },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Reputation Tools help modal (/reputation)
   ═══════════════════════════════════════════════════════════════════════════

   Content describes what the page ACTUALLY renders: four groups, eleven cards
   linking to routes that already existed, and lock states mirroring each
   destination's own gate. Nothing here promises a feature the hub does not
   link to.
*/

const reputationHelpEn = {
  buttonLabel: "How this works",
  buttonAria: "Open help for Reputation Tools",
  title: "Reputation Tools",
  close: "Close",

  s1Heading: "One page instead of eleven menu rows",
  s1Text:
    "These eleven tools used to sit in the sidebar as eleven separate links. They are the same tools at the same addresses — only the way you reach them changed, so any link you had bookmarked still works.",
  s1Note:
    "Grouped by what you are trying to do: collect feedback, deal with risk, read the numbers, get data in.",

  s2Heading: "Customer feedback",
  s2Text:
    "Customers holds everyone you can ask for a review. Campaigns does the asking on a schedule by email or SMS, Review links send a happy customer to the platform that matters, and Templates keeps the wording reusable per channel and locale.",
  s2Note: "Feedback is where the replies land, sentiment-scored and sorted by what needs an answer.",

  s3Heading: "Risk and recovery",
  s3Text:
    "Recovery catches an unhappy customer before they post and routes it to a person. Monitoring watches every source you connect and flags new reviews the day they appear. Intelligence covers competitor movement, escalation risk and review authenticity.",

  s4Heading: "Analytics and data",
  s4Text:
    "Reputation analytics tracks rating, review volume and response time over time. Data sources imports customers and reviews or connects a platform to keep them current, and the browser extension captures both straight from a platform tab.",

  s5Heading: "Why some cards are locked",
  s5Text:
    "A greyed-out card means the tool behind it needs a higher plan — the card shows which one. Nothing is hidden from you: locking rather than hiding is deliberate, so you can see what exists before deciding whether it is worth upgrading for.",
  s5Note: "Monitoring is on Agency and above. Intelligence is on Growth and above.",
};

export type ReputationHelpCopy = typeof reputationHelpEn;

export const REPUTATION_HELP_COPY: Record<DashLocale, ReputationHelpCopy> = {
  en: reputationHelpEn,
  fr: {
    buttonLabel: "Comment ça marche",
    buttonAria: "Ouvrir l'aide des outils de réputation",
    title: "Outils de réputation",
    close: "Fermer",

    s1Heading: "Une page au lieu de onze entrées de menu",
    s1Text:
      "Ces onze outils occupaient autrefois onze liens distincts dans le menu latéral. Ce sont les mêmes outils aux mêmes adresses : seule la façon d'y accéder a changé, donc tous vos favoris continuent de fonctionner.",
    s1Note:
      "Regroupés selon votre objectif : recueillir des avis, gérer le risque, lire les chiffres, importer vos données.",

    s2Heading: "Retours clients",
    s2Text:
      "Clients regroupe toutes les personnes à qui demander un avis. Campagnes s'en charge automatiquement par courriel ou SMS, les Liens d'avis dirigent un client satisfait vers la bonne plateforme, et les Modèles gardent vos formulations réutilisables par canal et par langue.",
    s2Note:
      "Retours est l'endroit où arrivent les réponses, avec le sentiment analysé et le tri par urgence de réponse.",

    s3Heading: "Risque et rattrapage",
    s3Text:
      "Rattrapage intercepte un client mécontent avant publication et confie le dossier à une personne. Surveillance observe chaque source connectée et signale les nouveaux avis le jour même. Intelligence couvre les mouvements des concurrents, le risque d'escalade et l'authenticité des avis.",

    s4Heading: "Analytique et données",
    s4Text:
      "L'analytique de réputation suit la note, le volume d'avis et le délai de réponse dans le temps. Sources de données importe clients et avis ou connecte une plateforme pour les tenir à jour, et l'extension de navigateur récupère les deux directement depuis un onglet.",

    s5Heading: "Pourquoi certaines cartes sont verrouillées",
    s5Text:
      "Une carte grisée signifie que l'outil nécessite un forfait supérieur — la carte indique lequel. Rien ne vous est caché : verrouiller plutôt que masquer est volontaire, pour que vous voyiez ce qui existe avant de juger si cela vaut une mise à niveau.",
    s5Note: "Surveillance est disponible à partir d'Agency. Intelligence à partir de Growth.",
  },
  "de-CH": {
    buttonLabel: "So funktioniert es",
    buttonAria: "Hilfe zu den Reputations-Tools öffnen",
    title: "Reputations-Tools",
    close: "Schliessen",

    s1Heading: "Eine Seite statt elf Menüzeilen",
    s1Text:
      "Diese elf Werkzeuge waren früher elf einzelne Einträge in der Seitenleiste. Es sind dieselben Werkzeuge unter denselben Adressen — nur der Weg dorthin hat sich geändert, gespeicherte Links funktionieren also weiterhin.",
    s1Note:
      "Gruppiert nach Ihrem Ziel: Rückmeldungen sammeln, Risiken bearbeiten, Zahlen lesen, Daten hereinholen.",

    s2Heading: "Kundenfeedback",
    s2Text:
      "Kundschaft umfasst alle, die Sie um eine Bewertung bitten können. Kampagnen übernehmen das planmässig per E-Mail oder SMS, Bewertungslinks führen zufriedene Kundschaft zur richtigen Plattform, und Vorlagen halten Ihre Texte pro Kanal und Sprache wiederverwendbar.",
    s2Note:
      "Bei Rückmeldungen laufen die Antworten ein — mit Stimmungsanalyse und nach Antwortbedarf sortiert.",

    s3Heading: "Risiko und Rückgewinnung",
    s3Text:
      "Rückgewinnung fängt unzufriedene Kundschaft ab, bevor sie postet, und übergibt den Fall an eine zuständige Person. Überwachung beobachtet jede verbundene Quelle und meldet neue Bewertungen am selben Tag. Intelligence deckt Bewegungen der Konkurrenz, Eskalationsrisiko und die Echtheit von Bewertungen ab.",

    s4Heading: "Auswertungen und Daten",
    s4Text:
      "Die Reputations-Auswertung verfolgt Bewertung, Menge und Antwortzeit im Verlauf. Datenquellen importiert Kundschaft und Bewertungen oder verbindet eine Plattform, und die Browser-Erweiterung erfasst beides direkt aus einem Plattform-Tab.",

    s5Heading: "Warum manche Karten gesperrt sind",
    s5Text:
      "Eine ausgegraute Karte bedeutet, dass das Werkzeug ein höheres Abo braucht — die Karte nennt welches. Nichts wird Ihnen vorenthalten: Sperren statt Verbergen ist Absicht, damit Sie sehen, was es gibt, bevor Sie entscheiden, ob sich ein Wechsel lohnt.",
    s5Note: "Überwachung gibt es ab Agency, Intelligence ab Growth.",
  },
};

// ─── Help hub (/help) ──────────────────────────────────────────────────────
//
// CHROME ONLY. Article titles, descriptions and reading times come from
// src/lib/learn-content.ts via src/lib/help-content.ts — the same strings the
// public Knowledge Hub renders. What lives here is what the hub adds: group
// headings, the labels for the handful of cards that are not Knowledge Hub
// pages, and the two link labels the per-page Help modals reuse.
//
// Three locales, not five: dashboardLocale() folds fr* to fr, de* to de-CH and
// everything else (en-CA included) to en, so a fourth catalog is unreachable.
const helpEn = {
  hubTitle: "Help",
  hubSubtitle:
    "Every guide, chapter and definition behind Echorank — the same knowledge base that is public on the site, indexed here for the product.",

  groups: {
    getting_started: "Getting started",
    course: "The course",
    guides: "In-depth guides",
    reference: "Reference",
  },

  /** Cards that are not Knowledge Hub articles and so carry their own copy. */
  cards: {
    first_steps: {
      name: "Your first steps",
      description: "The setup checklist on your dashboard: connect a source, import history, ask for the first review.",
    },
    echopedia: {
      name: "Echopedia",
      description: "Every term used across the guides, defined in one place.",
    },
    pdf: {
      name: "The complete Echorank guide",
      description: "The whole field guide as a PDF — checklists, templates and case studies.",
    },
    ext_download: {
      name: "Extension download",
      description: "Get the extension and install it, on one page.",
    },
    ext_help: {
      name: "Extension help",
      description: "What each button does, and what to do when something looks wrong.",
    },
    ext_import: {
      name: "Importing reviews, step by step",
      description: "The operational walkthrough for bringing review history in.",
    },
    ext_reviews_in: {
      name: "All the ways to get reviews in",
      description: "Every import route compared, so you can pick the one that fits.",
    },
  } as Record<string, { name: string; description: string }>,

  minRead: (n: number) => `${n} min read`,
  videoBadge: "2-min video",
  /** Appended to a link's accessible name when it opens a new tab. */
  newTab: "opens in a new tab",
  closeLabel: "Close",

  /** Reused by the per-page Help modals — see components/help/. */
  readFullGuide: "Read the full guide →",
  browseAll: "Browse all help →",
} ;

export type HelpCopy = typeof helpEn;

export const HELP_COPY: Record<DashLocale, HelpCopy> = {
  en: helpEn,
  fr: {
    hubTitle: "Aide",
    hubSubtitle:
      "Tous les guides, chapitres et définitions qui sous-tendent Echorank — la même base de connaissances que celle publiée sur le site, rassemblée ici pour le produit.",

    groups: {
      getting_started: "Pour démarrer",
      course: "Le cours",
      guides: "Guides approfondis",
      reference: "Référence",
    },

    cards: {
      first_steps: {
        name: "Vos premières étapes",
        description: "La liste de mise en route de votre tableau de bord : connecter une source, importer l'historique, demander le premier avis.",
      },
      echopedia: {
        name: "Echopedia",
        description: "Tous les termes employés dans les guides, définis au même endroit.",
      },
      pdf: {
        name: "Le guide complet Echorank",
        description: "L'intégralité du guide de terrain en PDF — listes de contrôle, modèles et études de cas.",
      },
      ext_download: {
        name: "Télécharger l'extension",
        description: "Obtenir l'extension et l'installer, sur une seule page.",
      },
      ext_help: {
        name: "Aide sur l'extension",
        description: "Ce que fait chaque bouton, et quoi faire quand quelque chose cloche.",
      },
      ext_import: {
        name: "Importer des avis, étape par étape",
        description: "La marche à suivre concrète pour récupérer votre historique d'avis.",
      },
      ext_reviews_in: {
        name: "Toutes les façons d'importer vos avis",
        description: "Chaque méthode comparée, pour choisir celle qui vous convient.",
      },
    },

    minRead: (n: number) => `${n} min de lecture`,
    videoBadge: "Vidéo de 2 min",
    newTab: "s'ouvre dans un nouvel onglet",
    closeLabel: "Fermer",

    readFullGuide: "Lire le guide complet →",
    browseAll: "Voir toute l'aide →",
  },
  "de-CH": {
    hubTitle: "Hilfe",
    hubSubtitle:
      "Alle Anleitungen, Kapitel und Begriffe hinter Echorank — dieselbe Wissensdatenbank, die auf der Website öffentlich ist, hier für das Produkt gebündelt.",

    groups: {
      getting_started: "Erste Schritte",
      course: "Der Kurs",
      guides: "Vertiefende Anleitungen",
      reference: "Nachschlagen",
    },

    cards: {
      first_steps: {
        name: "Ihre ersten Schritte",
        description: "Die Einrichtungsliste auf Ihrem Dashboard: Quelle verbinden, Verlauf importieren, erste Bewertung anfragen.",
      },
      echopedia: {
        name: "Echopedia",
        description: "Alle in den Anleitungen verwendeten Begriffe, an einem Ort erklärt.",
      },
      pdf: {
        name: "Der vollständige Echorank-Leitfaden",
        description: "Der gesamte Praxisleitfaden als PDF — Checklisten, Vorlagen und Fallbeispiele.",
      },
      ext_download: {
        name: "Erweiterung herunterladen",
        description: "Die Erweiterung holen und installieren, auf einer Seite.",
      },
      ext_help: {
        name: "Hilfe zur Erweiterung",
        description: "Was jede Schaltfläche tut und was zu tun ist, wenn etwas nicht stimmt.",
      },
      ext_import: {
        name: "Bewertungen importieren, Schritt für Schritt",
        description: "Die praktische Anleitung, um Ihren Bewertungsverlauf hereinzuholen.",
      },
      ext_reviews_in: {
        name: "Alle Wege, Bewertungen zu importieren",
        description: "Jeder Importweg im Vergleich, damit Sie den passenden wählen.",
      },
    },

    minRead: (n: number) => `${n} Min. Lesezeit`,
    videoBadge: "2-Min-Video",
    newTab: "wird in einem neuen Tab geöffnet",
    closeLabel: "Schliessen",

    readFullGuide: "Vollständige Anleitung lesen →",
    browseAll: "Gesamte Hilfe durchsuchen →",
  },
};

// ─── Site Crawler (/visibility/tools/site-crawler) ──────────────────────────
//
// Three locales, not five: dashboardLocale() folds fr* to fr, de* to de-CH and
// everything else to en. Every string the page renders lives here — the known
// regression on this surface is a translated sidebar above an English body.
//
// Issue TYPE labels are keyed by the same strings checks.ts emits, so a new
// rule that ships without copy is a missing key the tests catch rather than a
// raw "META_DESC_TOO_LONG" shown to a customer.
const siteCrawlerEn = {
  title: "Site Crawler",
  subtitle:
    "Crawl every page on your site and see the on-page SEO issues, page by page. Raw HTML only — no JavaScript rendering in this version.",

  urlLabel: "Site URL",
  urlPlaceholder: "https://example.com",
  startCta: "Start crawl",
  starting: "Starting…",
  capNote: (cap: string) => `Up to ${cap} URLs per crawl on your plan.`,
  quotaNote: (used: string, limit: string) => `${used} of ${limit} crawls used this month.`,
  quotaUnlimited: (used: string) => `${used} crawls this month. No monthly limit on your plan.`,
  politeNote:
    "We identify ourselves as Echorank360Bot, obey robots.txt, and stay under 2 requests a second.",

  lockedTitle: "Site Crawler is not part of your plan",
  lockedBody:
    "Your current plan does not include classic-SEO crawling. Upgrade to crawl your site and get the full on-page issue list.",
  lockedCta: "Compare plans",

  statusQueued: "Queued",
  statusRunning: "Crawling",
  statusCompleted: "Completed",
  statusFailed: "Failed",
  statusCancelled: "Cancelled",

  progress: (done: string, cap: string) => `${done} of up to ${cap} pages`,
  cancelCta: "Stop crawl",
  cancelling: "Stopping…",
  crawlingNote: "This keeps running if you leave the page. Come back any time.",

  stoppedUrlCap: "Stopped at your plan's URL limit.",
  stoppedTimeCap: "Stopped at the one-hour limit.",
  stoppedCancelled: "Stopped by you.",

  summaryPages: "Pages crawled",
  summaryErrors: "Errors",
  summaryWarnings: "Warnings",
  summaryNotices: "Notices",

  issuesTitle: "Issues",
  filterSeverity: "Severity",
  filterType: "Issue type",
  filterAll: "All",
  exportCsv: "Export CSV",
  colSeverity: "Severity",
  colType: "Issue",
  colUrl: "URL",
  colDetail: "Detail",
  noIssues: "No issues found. Every page crawled passed all checks.",
  noIssuesFiltered: "No issues match this filter.",

  pastTitle: "Past crawls",
  noCrawls: "No crawls yet. Enter your site URL above to run the first one.",

  prevPage: "Previous",
  nextPage: "Next",
  pageOf: (page: string, total: string) => `Page ${page} of ${total}`,

  errInvalidUrl: "Enter a public URL starting with http:// or https://",
  errQuota: "You have used all the crawls included in your plan this month.",
  errGeneric: "Something went wrong. Try again.",

  severityError: "Error",
  severityWarning: "Warning",
  severityNotice: "Notice",


  // ── Phase 2: site-wide analysis ─────────────────────────────────────────
  tabOverview: "Overview",
  tabIssues: "Issues",
  tabDuplicates: "Duplicates",
  tabRedirects: "Redirects",
  tabPages: "Pages",

  ovStatusCodes: "Status codes",
  ovDepth: "Depth from the homepage",
  ovSeverity: "Issues by severity",
  ovSitemap: "Sitemap",
  ovInlinks: "Internal links",
  ovDeepest: "Deepest pages",
  ovSitemapFound: (n: string) => `${n} URLs listed`,
  ovSitemapNone: "No sitemap found for this site.",
  ovSitemapNotCrawled: (n: string) => `${n} sitemap URLs were not reached`,
  ovSitemapTruncated: "Only part of the sitemap was read.",
  ovInlinkAverage: "Average per page",
  ovInlinkZero: "Pages with none",
  ovInlinkMax: "Most linked page",
  ovAggregationMs: (ms: string) => `Analysed in ${ms} ms`,
  ovAggregationFailed:
    "The page data is complete, but the site-wide analysis did not finish. The issue list below is still accurate.",
  ovNoSummary: "No site-wide analysis for this crawl.",

  dupTitle: "Same title",
  dupMeta: "Same meta description",
  dupContent: "Same content",
  dupGroupMembers: (n: string) => `${n} pages`,
  dupNone: "No duplicate pages found.",
  dupTruncated: "Showing the first pages in this group.",

  redChains: "Chains",
  redLoops: "Loops",
  redNone: "No redirect chains or loops found.",
  redHops: (n: string) => `${n} hops`,

  filterSitemap: "In sitemap",
  filterDepth: "Depth",
  filterInlinks: "Min. inlinks",
  filterYes: "Yes",
  filterNo: "No",
  filterClear: "Clear filters",
  colInlinks: "Inlinks",
  colDepth: "Depth",
  colSitemap: "Sitemap",
  noPages: "No pages match these filters.",

  issueTypes: {
    HTTP_4XX: "Page not found or refused (4xx)",
    HTTP_5XX: "Server error (5xx)",
    TITLE_MISSING: "Missing title",
    H1_MISSING: "Missing H1",
    NOINDEX: "Blocked from indexing (noindex)",
    TITLE_TOO_LONG: "Title too long",
    TITLE_TOO_SHORT: "Title too short",
    META_DESC_MISSING: "Missing meta description",
    META_DESC_TOO_LONG: "Meta description too long",
    MULTIPLE_H1: "More than one H1",
    CANONICAL_MISMATCH: "Canonical points elsewhere",
    REDIRECT_CHAIN: "Redirect chain",
    THIN_CONTENT: "Thin content",
    BLOCKED_BY_ROBOTS: "Blocked by robots.txt",
    CANONICAL_MISSING: "No canonical tag",
    DUPLICATE_CONTENT: "Duplicate content",
    DUPLICATE_TITLE: "Duplicate title",
    DUPLICATE_META_DESC: "Duplicate meta description",
    REDIRECT_LOOP: "Redirect loop",
    NO_INLINKS: "No internal links point here",
    ORPHAN_PAGE: "Orphan page",
  } as Record<string, string>,
};

export type SiteCrawlerCopy = typeof siteCrawlerEn;

export const SITE_CRAWLER_COPY: Record<DashLocale, SiteCrawlerCopy> = {
  en: siteCrawlerEn,
  fr: {
    title: "Explorateur de site",
    subtitle:
      "Parcourez chaque page de votre site et consultez les problèmes SEO on-page, page par page. HTML brut uniquement — pas de rendu JavaScript dans cette version.",

    urlLabel: "URL du site",
    urlPlaceholder: "https://exemple.com",
    startCta: "Lancer l'exploration",
    starting: "Lancement…",
    capNote: (cap: string) => `Jusqu'à ${cap} URL par exploration avec votre forfait.`,
    quotaNote: (used: string, limit: string) =>
      `${used} exploration(s) sur ${limit} utilisée(s) ce mois-ci.`,
    quotaUnlimited: (used: string) =>
      `${used} exploration(s) ce mois-ci. Aucune limite mensuelle avec votre forfait.`,
    politeNote:
      "Nous nous identifions comme Echorank360Bot, respectons robots.txt et restons sous 2 requêtes par seconde.",

    lockedTitle: "L'explorateur de site n'est pas inclus dans votre forfait",
    lockedBody:
      "Votre forfait actuel n'inclut pas l'exploration SEO classique. Passez à un forfait supérieur pour explorer votre site et obtenir la liste complète des problèmes on-page.",
    lockedCta: "Comparer les forfaits",

    statusQueued: "En attente",
    statusRunning: "Exploration en cours",
    statusCompleted: "Terminée",
    statusFailed: "Échec",
    statusCancelled: "Annulée",

    progress: (done: string, cap: string) => `${done} pages sur ${cap} maximum`,
    cancelCta: "Arrêter l'exploration",
    cancelling: "Arrêt…",
    crawlingNote: "L'exploration continue même si vous quittez la page. Revenez quand vous voulez.",

    stoppedUrlCap: "Arrêtée à la limite d'URL de votre forfait.",
    stoppedTimeCap: "Arrêtée à la limite d'une heure.",
    stoppedCancelled: "Arrêtée par vous.",

    summaryPages: "Pages explorées",
    summaryErrors: "Erreurs",
    summaryWarnings: "Avertissements",
    summaryNotices: "Remarques",

    issuesTitle: "Problèmes",
    filterSeverity: "Gravité",
    filterType: "Type de problème",
    filterAll: "Tous",
    exportCsv: "Exporter en CSV",
    colSeverity: "Gravité",
    colType: "Problème",
    colUrl: "URL",
    colDetail: "Détail",
    noIssues: "Aucun problème détecté. Toutes les pages explorées ont passé les contrôles.",
    noIssuesFiltered: "Aucun problème ne correspond à ce filtre.",

    pastTitle: "Explorations précédentes",
    noCrawls: "Aucune exploration pour l'instant. Saisissez l'URL de votre site ci-dessus.",

    prevPage: "Précédent",
    nextPage: "Suivant",
    pageOf: (page: string, total: string) => `Page ${page} sur ${total}`,

    errInvalidUrl: "Saisissez une URL publique commençant par http:// ou https://",
    errQuota: "Vous avez utilisé toutes les explorations incluses dans votre forfait ce mois-ci.",
    errGeneric: "Une erreur est survenue. Réessayez.",

    severityError: "Erreur",
    severityWarning: "Avertissement",
    severityNotice: "Remarque",


  tabOverview: "Vue d'ensemble",
  tabIssues: "Problèmes",
  tabDuplicates: "Doublons",
  tabRedirects: "Redirections",
  tabPages: "Pages",

  ovStatusCodes: "Codes de statut",
  ovDepth: "Profondeur depuis l'accueil",
  ovSeverity: "Problèmes par gravité",
  ovSitemap: "Plan du site",
  ovInlinks: "Liens internes",
  ovDeepest: "Pages les plus profondes",
  ovSitemapFound: (n: string) => `${n} URL référencées`,
  ovSitemapNone: "Aucun plan de site trouvé pour ce site.",
  ovSitemapNotCrawled: (n: string) => `${n} URL du plan de site n'ont pas été atteintes`,
  ovSitemapTruncated: "Le plan du site n'a été lu que partiellement.",
  ovInlinkAverage: "Moyenne par page",
  ovInlinkZero: "Pages sans lien entrant",
  ovInlinkMax: "Page la plus liée",
  ovAggregationMs: (ms: string) => `Analysé en ${ms} ms`,
  ovAggregationFailed:
    "Les données des pages sont complètes, mais l'analyse globale du site n'a pas abouti. La liste des problèmes ci-dessous reste exacte.",
  ovNoSummary: "Aucune analyse globale pour cette exploration.",

  dupTitle: "Même titre",
  dupMeta: "Même méta description",
  dupContent: "Même contenu",
  dupGroupMembers: (n: string) => `${n} pages`,
  dupNone: "Aucune page en double trouvée.",
  dupTruncated: "Affichage des premières pages de ce groupe.",

  redChains: "Chaînes",
  redLoops: "Boucles",
  redNone: "Aucune chaîne ni boucle de redirection trouvée.",
  redHops: (n: string) => `${n} sauts`,

  filterSitemap: "Dans le plan du site",
  filterDepth: "Profondeur",
  filterInlinks: "Liens entrants min.",
  filterYes: "Oui",
  filterNo: "Non",
  filterClear: "Effacer les filtres",
  colInlinks: "Liens entrants",
  colDepth: "Profondeur",
  colSitemap: "Plan du site",
  noPages: "Aucune page ne correspond à ces filtres.",

    issueTypes: {
      HTTP_4XX: "Page introuvable ou refusée (4xx)",
      HTTP_5XX: "Erreur serveur (5xx)",
      TITLE_MISSING: "Balise title manquante",
      H1_MISSING: "H1 manquant",
      NOINDEX: "Indexation bloquée (noindex)",
      TITLE_TOO_LONG: "Title trop long",
      TITLE_TOO_SHORT: "Title trop court",
      META_DESC_MISSING: "Méta description manquante",
      META_DESC_TOO_LONG: "Méta description trop longue",
      MULTIPLE_H1: "Plusieurs H1",
      CANONICAL_MISMATCH: "La canonique pointe ailleurs",
      REDIRECT_CHAIN: "Chaîne de redirections",
      THIN_CONTENT: "Contenu trop léger",
      BLOCKED_BY_ROBOTS: "Bloquée par robots.txt",
      CANONICAL_MISSING: "Pas de balise canonique",
      DUPLICATE_CONTENT: "Contenu dupliqué",
      DUPLICATE_TITLE: "Titre en double",
      DUPLICATE_META_DESC: "Méta description en double",
      REDIRECT_LOOP: "Boucle de redirection",
      NO_INLINKS: "Aucun lien interne ne pointe ici",
      ORPHAN_PAGE: "Page orpheline",
    },
  },
  "de-CH": {
    title: "Site Crawler",
    subtitle:
      "Crawlen Sie jede Seite Ihrer Website und sehen Sie die On-Page-SEO-Probleme Seite für Seite. Nur rohes HTML — kein JavaScript-Rendering in dieser Version.",

    urlLabel: "Website-URL",
    urlPlaceholder: "https://beispiel.ch",
    startCta: "Crawl starten",
    starting: "Wird gestartet…",
    capNote: (cap: string) => `Bis zu ${cap} URLs pro Crawl in Ihrem Abo.`,
    quotaNote: (used: string, limit: string) => `${used} von ${limit} Crawls diesen Monat genutzt.`,
    quotaUnlimited: (used: string) =>
      `${used} Crawls diesen Monat. Keine monatliche Begrenzung in Ihrem Abo.`,
    politeNote:
      "Wir weisen uns als Echorank360Bot aus, beachten robots.txt und bleiben unter 2 Anfragen pro Sekunde.",

    lockedTitle: "Site Crawler ist nicht Teil Ihres Abos",
    lockedBody:
      "Ihr aktuelles Abo umfasst kein klassisches SEO-Crawling. Wechseln Sie das Abo, um Ihre Website zu crawlen und die vollständige Liste der On-Page-Probleme zu erhalten.",
    lockedCta: "Abos vergleichen",

    statusQueued: "In Warteschlange",
    statusRunning: "Crawlt",
    statusCompleted: "Abgeschlossen",
    statusFailed: "Fehlgeschlagen",
    statusCancelled: "Abgebrochen",

    progress: (done: string, cap: string) => `${done} von maximal ${cap} Seiten`,
    cancelCta: "Crawl stoppen",
    cancelling: "Wird gestoppt…",
    crawlingNote: "Der Crawl läuft weiter, wenn Sie die Seite verlassen. Kommen Sie jederzeit zurück.",

    stoppedUrlCap: "Beim URL-Limit Ihres Abos gestoppt.",
    stoppedTimeCap: "Bei der Ein-Stunden-Grenze gestoppt.",
    stoppedCancelled: "Von Ihnen gestoppt.",

    summaryPages: "Gecrawlte Seiten",
    summaryErrors: "Fehler",
    summaryWarnings: "Warnungen",
    summaryNotices: "Hinweise",

    issuesTitle: "Probleme",
    filterSeverity: "Schweregrad",
    filterType: "Problemtyp",
    filterAll: "Alle",
    exportCsv: "CSV exportieren",
    colSeverity: "Schweregrad",
    colType: "Problem",
    colUrl: "URL",
    colDetail: "Detail",
    noIssues: "Keine Probleme gefunden. Alle gecrawlten Seiten haben die Prüfungen bestanden.",
    noIssuesFiltered: "Keine Probleme entsprechen diesem Filter.",

    pastTitle: "Frühere Crawls",
    noCrawls: "Noch keine Crawls. Geben Sie oben die URL Ihrer Website ein.",

    prevPage: "Zurück",
    nextPage: "Weiter",
    pageOf: (page: string, total: string) => `Seite ${page} von ${total}`,

    errInvalidUrl: "Geben Sie eine öffentliche URL ein, die mit http:// oder https:// beginnt",
    errQuota: "Sie haben alle in Ihrem Abo enthaltenen Crawls diesen Monat aufgebraucht.",
    errGeneric: "Etwas ist schiefgelaufen. Versuchen Sie es erneut.",

    severityError: "Fehler",
    severityWarning: "Warnung",
    severityNotice: "Hinweis",


  tabOverview: "Übersicht",
  tabIssues: "Probleme",
  tabDuplicates: "Duplikate",
  tabRedirects: "Weiterleitungen",
  tabPages: "Seiten",

  ovStatusCodes: "Statuscodes",
  ovDepth: "Tiefe ab der Startseite",
  ovSeverity: "Probleme nach Schweregrad",
  ovSitemap: "Sitemap",
  ovInlinks: "Interne Links",
  ovDeepest: "Tiefste Seiten",
  ovSitemapFound: (n: string) => `${n} URLs aufgeführt`,
  ovSitemapNone: "Für diese Website wurde keine Sitemap gefunden.",
  ovSitemapNotCrawled: (n: string) => `${n} Sitemap-URLs wurden nicht erreicht`,
  ovSitemapTruncated: "Die Sitemap wurde nur teilweise gelesen.",
  ovInlinkAverage: "Durchschnitt pro Seite",
  ovInlinkZero: "Seiten ohne eingehende Links",
  ovInlinkMax: "Meistverlinkte Seite",
  ovAggregationMs: (ms: string) => `In ${ms} ms ausgewertet`,
  ovAggregationFailed:
    "Die Seitendaten sind vollständig, aber die seitenweite Auswertung wurde nicht beendet. Die Problemliste unten stimmt weiterhin.",
  ovNoSummary: "Keine seitenweite Auswertung für diesen Crawl.",

  dupTitle: "Gleicher Title",
  dupMeta: "Gleiche Meta-Description",
  dupContent: "Gleicher Inhalt",
  dupGroupMembers: (n: string) => `${n} Seiten`,
  dupNone: "Keine doppelten Seiten gefunden.",
  dupTruncated: "Es werden die ersten Seiten dieser Gruppe angezeigt.",

  redChains: "Ketten",
  redLoops: "Schleifen",
  redNone: "Keine Weiterleitungsketten oder -schleifen gefunden.",
  redHops: (n: string) => `${n} Sprünge`,

  filterSitemap: "In der Sitemap",
  filterDepth: "Tiefe",
  filterInlinks: "Min. eingehende Links",
  filterYes: "Ja",
  filterNo: "Nein",
  filterClear: "Filter zurücksetzen",
  colInlinks: "Eingehende Links",
  colDepth: "Tiefe",
  colSitemap: "Sitemap",
  noPages: "Keine Seite entspricht diesen Filtern.",

    issueTypes: {
      HTTP_4XX: "Seite nicht gefunden oder abgelehnt (4xx)",
      HTTP_5XX: "Serverfehler (5xx)",
      TITLE_MISSING: "Title fehlt",
      H1_MISSING: "H1 fehlt",
      NOINDEX: "Indexierung blockiert (noindex)",
      TITLE_TOO_LONG: "Title zu lang",
      TITLE_TOO_SHORT: "Title zu kurz",
      META_DESC_MISSING: "Meta-Description fehlt",
      META_DESC_TOO_LONG: "Meta-Description zu lang",
      MULTIPLE_H1: "Mehr als ein H1",
      CANONICAL_MISMATCH: "Canonical zeigt woanders hin",
      REDIRECT_CHAIN: "Weiterleitungskette",
      THIN_CONTENT: "Zu wenig Inhalt",
      BLOCKED_BY_ROBOTS: "Durch robots.txt blockiert",
      CANONICAL_MISSING: "Kein Canonical-Tag",
      DUPLICATE_CONTENT: "Doppelter Inhalt",
      DUPLICATE_TITLE: "Doppelter Title",
      DUPLICATE_META_DESC: "Doppelte Meta-Description",
      REDIRECT_LOOP: "Weiterleitungsschleife",
      NO_INLINKS: "Keine internen Links zeigen hierher",
      ORPHAN_PAGE: "Verwaiste Seite",
    },
  },
};

/**
 * Copy shared by every exportable data table.
 *
 * ONE KEY, NOT ONE PER TOOL. The Export CSV button is a single shared
 * component (components/seo-tools/export-csv-button.tsx), so its label is a
 * single shared string rather than an `exportCsv` added to a dozen per-tool
 * copy interfaces. SITE_CRAWLER_COPY keeps its own `exportCsv` because that
 * button predates this and its markup is the crawler's own.
 *
 * de-CH uses ss, never ß — see CLAUDE.md.
 */
export interface TableCopy {
  exportCsv: string;
}

export const TABLE_COPY: Record<DashLocale, TableCopy> = {
  en: { exportCsv: "Export CSV" },
  fr: { exportCsv: "Exporter en CSV" },
  "de-CH": { exportCsv: "CSV exportieren" },
};

// ─── /notifications ──────────────────────────────────────────────────────────
//
// `types` carries BOTH the filter label and the rendered title/body for each
// notification type. The rows on that page are rendered from the stored `type`
// and payload against this catalog — the English title the emitting worker
// wrote is a fallback for unknown types only. That is the whole point: without
// it a French user reads a translated page frame wrapped around English alert
// text, which is the bug this catalog exists to prevent.
//
// {placeholders} are interpolated from the notification payload. A value the
// payload does not carry renders as an em dash rather than "undefined".

const notificationsEn = {
  subtitle: "Everything Echorank has flagged for your team, newest first.",
  empty: "Nothing yet. Alerts from monitoring, risk and AI visibility land here.",
  emptyFiltered: "No notifications match these filters.",
  markAllRead: "Mark all as read",
  markRead: "Mark as read",
  loadMore: "Load more",
  loading: "Loading…",
  allTypes: "All types",
  allSeverities: "All severities",
  unreadOnly: "Unread only",
  unreadBadge: "{count} unread",
  error: "Could not load notifications. Try again.",
  severities: { info: "Info", warning: "Warning", critical: "Critical" },
  types: {
    visibility_lost: {
      label: "No longer recommended",
      title: "AI stopped recommending you for “{promptText}”",
      body: "Previous rank: #{prevRank}.",
    },
    visibility_rank_drop: {
      label: "Recommendation rank dropped",
      title: "Rank dropped for “{promptText}”",
      body: "#{prevRank} → #{newRank}.",
    },
    visibility_regained: {
      label: "Recommended again",
      title: "AI is recommending you again for “{promptText}”",
      body: "Current rank: #{newRank}.",
    },
    risk_threshold: {
      label: "Risk threshold crossed",
      title: "Reputation risk score reached {score}",
      body: "Grade {grade}.",
    },
    risk_spike: {
      label: "Risk spike",
      title: "Risk score jumped {delta} points to {score}",
      body: "Previous score: {previousScore}.",
    },
    critical_signal: {
      label: "Critical signal",
      title: "Critical signal: {signalTitle}",
      body: "Source: {source}.",
    },
    escalation_risk: {
      label: "Escalation risk",
      title: "{riskLevel} escalation risk detected",
      body: "Estimated probability {probability}.",
    },
    ai_risk: {
      label: "AI risk detection",
      title: "AI flagged {riskLevel} risk",
      body: "Estimated probability {probability}.",
    },
    visibility_score_drop: {
      label: "AI visibility dropped",
      title: "AI visibility score fell from {prevScore} to {newScore}",
      body: "{url} — grade {grade}.",
    },
    visibility_crawler_blocked: {
      label: "AI crawler blocked",
      title: "AI crawlers are blocked on {url}",
      body: "Blocked: {bots}. Check your CDN settings.",
    },
    reputation_score_change: {
      label: "Reputation score moved",
      title: "Reputation score moved from {previousScore} to {newScore}",
      body: "Location: {location}.",
    },
    sov_share_drop: {
      label: "AI share of voice dropped",
      title: "Your share of {engine} answers fell from {before}% to {after}%",
      body: "Measured week over week across your tracked prompts.",
    },
    // No {priority}. The score is ordinal and unitless — see
    // NotificationPayloads.citation_opportunity — so printing it would be a
    // number the reader cannot act on. The domain is the actionable half.
    citation_opportunity: {
      label: "New citation opportunity",
      title: "{domain} cites your competitors and has never named you",
      body: "One of this week's best chances to get listed. Open the worklist for how.",
    },
    // {done} COUNTS FAILED ROWS — see NotificationPayloads.scan_complete. So
    // the title says "scanned", never "succeeded": on a batch where every
    // prospect was unreachable, done still equals total, and copy claiming
    // success would be a lie the table immediately contradicts.
    scan_complete: {
      label: "Prospect scan finished",
      title: "Your prospect scan finished — {done} of {total} domains scanned",
      body: "Sorted worst first, so the best prospects to call are at the top.",
    },
    // NO EMAIL ADDRESS IN THIS COPY, because there is none in the payload —
    // see NotificationPayloads.funnel_lead. The body points at the table
    // instead. {score} renders as "—" when the audit did not complete, so the
    // sentence is written to stay true either way: "scored {score}" would read
    // "scored —", which is odd, while "Audit score: {score}" reads as an
    // absence, which is what it is.
    funnel_lead: {
      label: "New funnel lead",
      title: "New lead from {domain}",
      body: "Audit score: {score}. Open the funnel to see who left it.",
    },
    // LOOKUPS, NEVER DOLLARS — the rule the whole credits feature follows. What
    // the customer bought is a number of lookups; what they paid is on the
    // Stripe receipt and in the ledger, and repeating it here would date badly
    // the first time a pack is repriced.
    credits_purchased: {
      label: "Lookups added",
      title: "{credits} prospect lookups added",
      body: "You now have {balance} lookups available for the Opportunity Scanner.",
    },
    // NO {kind} PLACEHOLDER, though the payload carries one — see
    // NotificationPayloads.action_draft_ready. render.ts substitutes payload
    // values verbatim and has no locale in hand, so {kind} would print
    // "review_reply" into a French tray.
    //
    // "Waiting for you" IS THE POINT OF THE SENTENCE. Nothing was published and
    // nothing will be: the draft sits until a human approves it. Copy that read
    // "Echorank fixed your schema" would be false in a way the customer only
    // discovers when the fix never appears on their site.
    action_draft_ready: {
      label: "AI draft ready",
      title: "An AI draft is ready for your review",
      body: "Nothing has been published. Open it to edit, approve or reject it.",
    },
  },
};

export type NotificationsCopy = typeof notificationsEn;

export const NOTIFICATIONS_COPY: Record<DashLocale, NotificationsCopy> = {
  en: notificationsEn,
  fr: {
    subtitle: "Tout ce qu'Echorank a signalé à votre équipe, du plus récent au plus ancien.",
    empty:
      "Rien pour l'instant. Les alertes de surveillance, de risque et de visibilité IA apparaissent ici.",
    emptyFiltered: "Aucune notification ne correspond à ces filtres.",
    markAllRead: "Tout marquer comme lu",
    markRead: "Marquer comme lu",
    loadMore: "Afficher plus",
    loading: "Chargement…",
    allTypes: "Tous les types",
    allSeverities: "Toutes les gravités",
    unreadOnly: "Non lues uniquement",
    unreadBadge: "{count} non lues",
    error: "Impossible de charger les notifications. Réessayez.",
    severities: { info: "Information", warning: "Avertissement", critical: "Critique" },
    types: {
      visibility_lost: {
        label: "Plus recommandé",
        title: "L'IA ne vous recommande plus pour « {promptText} »",
        body: "Rang précédent : n° {prevRank}.",
      },
      visibility_rank_drop: {
        label: "Rang en baisse",
        title: "Le rang a baissé pour « {promptText} »",
        body: "N° {prevRank} → n° {newRank}.",
      },
      visibility_regained: {
        label: "De nouveau recommandé",
        title: "L'IA vous recommande à nouveau pour « {promptText} »",
        body: "Rang actuel : n° {newRank}.",
      },
      risk_threshold: {
        label: "Seuil de risque franchi",
        title: "Le score de risque a atteint {score}",
        body: "Note {grade}.",
      },
      risk_spike: {
        label: "Pic de risque",
        title: "Le score de risque a bondi de {delta} points, à {score}",
        body: "Score précédent : {previousScore}.",
      },
      critical_signal: {
        label: "Signal critique",
        title: "Signal critique : {signalTitle}",
        body: "Source : {source}.",
      },
      escalation_risk: {
        label: "Risque d'escalade",
        title: "Risque d'escalade {riskLevel} détecté",
        body: "Probabilité estimée : {probability}.",
      },
      ai_risk: {
        label: "Risque détecté par l'IA",
        title: "L'IA a signalé un risque {riskLevel}",
        body: "Probabilité estimée : {probability}.",
      },
      visibility_score_drop: {
        label: "Visibilité IA en baisse",
        title: "Le score de visibilité IA est passé de {prevScore} à {newScore}",
        body: "{url} — note {grade}.",
      },
      visibility_crawler_blocked: {
        label: "Robot d'IA bloqué",
        title: "Les robots d'IA sont bloqués sur {url}",
        body: "Bloqués : {bots}. Vérifiez les réglages de votre CDN.",
      },
      reputation_score_change: {
        label: "Score de réputation modifié",
        title: "Le score de réputation est passé de {previousScore} à {newScore}",
        body: "Établissement : {location}.",
      },
      sov_share_drop: {
        label: "Part de voix IA en baisse",
        title: "Votre part des réponses de {engine} est passée de {before} % à {after} %",
        body: "Mesurée d'une semaine sur l'autre, sur l'ensemble de vos requêtes suivies.",
      },
      citation_opportunity: {
        label: "Nouvelle source à conquérir",
        title: "{domain} cite vos concurrents et ne vous a jamais nommé",
        body: "L'une des meilleures occasions de la semaine de vous y faire référencer. Ouvrez la liste pour savoir comment.",
      },
      scan_complete: {
        label: "Analyse de prospects terminée",
        title: "Votre analyse de prospects est terminée — {done} domaines sur {total} analysés",
        body: "Classés du plus faible au plus solide : les meilleurs prospects à appeler sont en haut.",
      },
      funnel_lead: {
        label: "Nouveau contact via le formulaire",
        title: "Nouveau contact venu de {domain}",
        body: "Score de l'audit : {score}. Ouvrez le formulaire pour voir qui l'a laissé.",
      },
      credits_purchased: {
        label: "Recherches ajoutées",
        title: "{credits} recherches de prospects ajoutées",
        body: "Vous disposez maintenant de {balance} recherches pour le Scanner d'opportunités.",
      },
      action_draft_ready: {
        label: "Proposition IA prête",
        title: "Une proposition rédigée par l'IA attend votre relecture",
        body: "Rien n'a été publié. Ouvrez-la pour la modifier, l'approuver ou la refuser.",
      },
    },
  },
  "de-CH": {
    subtitle: "Alles, was Echorank für Ihr Team gemeldet hat, neueste zuerst.",
    empty:
      "Noch nichts vorhanden. Meldungen aus Monitoring, Risiko und KI-Sichtbarkeit erscheinen hier.",
    emptyFiltered: "Keine Benachrichtigungen entsprechen diesen Filtern.",
    markAllRead: "Alle als gelesen markieren",
    markRead: "Als gelesen markieren",
    loadMore: "Mehr laden",
    loading: "Wird geladen…",
    allTypes: "Alle Typen",
    allSeverities: "Alle Stufen",
    unreadOnly: "Nur ungelesene",
    unreadBadge: "{count} ungelesen",
    error: "Benachrichtigungen konnten nicht geladen werden. Bitte erneut versuchen.",
    severities: { info: "Info", warning: "Warnung", critical: "Kritisch" },
    types: {
      visibility_lost: {
        label: "Nicht mehr empfohlen",
        title: "Die KI empfiehlt Sie nicht mehr für «{promptText}»",
        body: "Vorheriger Rang: Nr. {prevRank}.",
      },
      visibility_rank_drop: {
        label: "Rang gefallen",
        title: "Der Rang ist für «{promptText}» gefallen",
        body: "Nr. {prevRank} → Nr. {newRank}.",
      },
      visibility_regained: {
        label: "Wieder empfohlen",
        title: "Die KI empfiehlt Sie wieder für «{promptText}»",
        body: "Aktueller Rang: Nr. {newRank}.",
      },
      risk_threshold: {
        label: "Risikoschwelle überschritten",
        title: "Der Risikowert hat {score} erreicht",
        body: "Note {grade}.",
      },
      risk_spike: {
        label: "Risikosprung",
        title: "Der Risikowert stieg um {delta} Punkte auf {score}",
        body: "Vorheriger Wert: {previousScore}.",
      },
      critical_signal: {
        label: "Kritisches Signal",
        title: "Kritisches Signal: {signalTitle}",
        body: "Quelle: {source}.",
      },
      escalation_risk: {
        label: "Eskalationsrisiko",
        title: "Eskalationsrisiko {riskLevel} erkannt",
        body: "Geschätzte Wahrscheinlichkeit: {probability}.",
      },
      ai_risk: {
        label: "KI-Risikoerkennung",
        title: "Die KI meldet ein Risiko der Stufe {riskLevel}",
        body: "Geschätzte Wahrscheinlichkeit: {probability}.",
      },
      visibility_score_drop: {
        label: "KI-Sichtbarkeit gefallen",
        title: "Der KI-Sichtbarkeitswert fiel von {prevScore} auf {newScore}",
        body: "{url} — Note {grade}.",
      },
      visibility_crawler_blocked: {
        label: "KI-Crawler blockiert",
        title: "KI-Crawler werden auf {url} blockiert",
        body: "Blockiert: {bots}. Prüfen Sie Ihre CDN-Einstellungen.",
      },
      reputation_score_change: {
        label: "Reputationswert verändert",
        title: "Der Reputationswert ging von {previousScore} auf {newScore}",
        body: "Standort: {location}.",
      },
      sov_share_drop: {
        label: "KI-Stimmanteil gesunken",
        title: "Ihr Anteil an den Antworten von {engine} sank von {before} % auf {after} %",
        body: "Woche für Woche gemessen, über alle Ihre verfolgten Prompts.",
      },
      citation_opportunity: {
        label: "Neue Quelle zum Erschliessen",
        title: "{domain} zitiert Ihre Mitbewerber und hat Sie nie genannt",
        body: "Eine der besten Gelegenheiten dieser Woche, dort gelistet zu werden. Öffnen Sie die Arbeitsliste für das Wie.",
      },
      scan_complete: {
        label: "Interessenten-Scan abgeschlossen",
        title: "Ihr Interessenten-Scan ist fertig — {done} von {total} Domains geprüft",
        body: "Schwächste zuerst sortiert: die lohnendsten Interessenten stehen zuoberst.",
      },
      funnel_lead: {
        label: "Neuer Kontakt aus dem Funnel",
        title: "Neuer Kontakt von {domain}",
        body: "Audit-Score: {score}. Öffnen Sie den Funnel, um zu sehen, wer ihn hinterlassen hat.",
      },
      credits_purchased: {
        label: "Abfragen hinzugefügt",
        title: "{credits} Prospect-Abfragen hinzugefügt",
        body: "Sie haben jetzt {balance} Abfragen für den Opportunity Scanner zur Verfügung.",
      },
      action_draft_ready: {
        label: "KI-Entwurf bereit",
        title: "Ein KI-Entwurf wartet auf Ihre Durchsicht",
        body: "Es wurde nichts veröffentlicht. Öffnen Sie ihn, um ihn zu bearbeiten, freizugeben oder abzulehnen.",
      },
    },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   AI Attribution (tool page: /visibility/tools/ai-attribution)
   ═══════════════════════════════════════════════════════════════════════════

   Phase 1 measures ARRIVALS ONLY. Every string below is written to say
   "visitors", never "leads", "conversions" or "revenue" — those are P2/P3 and
   promising them in copy before they exist is how a dashboard starts lying.

   The unit is a DISTINCT VISITOR per landing page, not a page view, because
   that is what the ai_visits row actually is. `repeat` is the only place a
   page-view-shaped number appears and it is labelled as one.
*/
const aiAttributionEn = {
  intro:
    "Which AI assistants send people to your site. Add one script tag and every visit arriving from ChatGPT, Perplexity, Gemini, Copilot or Claude is classified on arrival — server-side, from the referrer, not from anything the page can be told to claim.",

  // ── Install ──────────────────────────────────────────────────────────
  installTitle: "Install the tag",
  installIntro:
    "Paste this into the <head> of every page you want measured. It is about 2 KB, loads asynchronously, sets one first-party cookie, and sends nothing at all for visits that did not come from an AI assistant.",
  installNoKey: "Create a site key to get your tag.",
  createTitle: "Create a site key",
  labelLabel: "Label",
  labelPlaceholder: "example.com",
  createButton: "Create site key",
  creating: "Creating…",
  keyOnce:
    "Copy your tag now. The key is stored only as a hash, so we cannot show it again — though it is also in the page source of every site you install it on.",
  publishableNote:
    "This key is publishable: it is visible to anyone who views the source of your site. It can do exactly one thing — record a visit against this workspace. It grants no read access to anything.",
  copy: "Copy",
  copied: "Copied",
  copyTag: "Copy tag",
  done: "Done",

  // ── Keys ─────────────────────────────────────────────────────────────
  yourKeys: "Site keys",
  emptyKeys: "No site key yet. Create one above to start measuring.",
  statusActive: "Active",
  statusRevoked: "Revoked",
  createdLabel: "Created",
  lastUsedLabel: "Last received",
  neverUsed: "never",
  revoke: "Revoke",
  revokeConfirm:
    "Revoke this key? Any page still carrying it stops being measured within a minute.",
  loading: "Loading…",
  loadFailed: "Failed to load site keys",
  actionFailed: "Action failed",

  // ── Results ──────────────────────────────────────────────────────────
  windowLabel: (days: number) => `Last ${days} days`,
  totalTitle: "AI-referred visitors",
  totalHint: "Distinct visitors whose first arrival on a page came from an AI assistant.",
  bySourceTitle: "By assistant",
  trendTitle: "New AI-referred visitors per day",
  landingTitle: "Landing pages",
  colPage: "Page",
  colVisitors: "Visitors",
  colRepeat: "Repeat arrivals",
  colSources: "From",
  emptyResults:
    "Nothing yet. Once the tag is live and someone reaches you from an AI assistant, they appear here — usually within a minute.",
  emptyWindow: (days: number) =>
    `No AI-referred visitors in the last ${days} days. Earlier visits are still counted in your totals.`,

  sourceNames: {
    chatgpt: "ChatGPT",
    perplexity: "Perplexity",
    gemini: "Gemini",
    copilot: "Copilot",
    claude: "Claude",
    dark_ai: "Other AI",
  } as Record<string, string>,
  darkAiHint:
    "“Other AI” is a visit we proved came from an assistant — You.com, Poe, Meta AI and similar — but not from one of the five reported separately. It is never a guess: traffic we cannot prove is AI is not counted at all.",
  // ALWAYS RENDERED. Every number on this page is a floor, not a census: a
  // share of AI-referred visits never reaches us because a blocker dropped the
  // tag. Undercounting is acceptable and honest; presenting the total without
  // saying so would not be.
  blockedHint:
    "Counts are conservative. Visits where an ad or tracker blocker stopped the tag are not recorded, so your real number is this one or higher — never lower.",
};
export type AiAttributionCopy = typeof aiAttributionEn;

export const AI_ATTRIBUTION_COPY: Record<DashLocale, AiAttributionCopy> = {
  en: aiAttributionEn,
  fr: {
    intro:
      "Quels assistants IA vous envoient des visiteurs. Ajoutez une seule balise de script et chaque visite venant de ChatGPT, Perplexity, Gemini, Copilot ou Claude est classée à l'arrivée — côté serveur, à partir du référent, et non de ce que la page pourrait prétendre.",

    installTitle: "Installer la balise",
    installIntro:
      "Collez ceci dans le <head> de chaque page à mesurer. Environ 2 Ko, chargement asynchrone, un seul témoin propriétaire, et rien n'est envoyé pour les visites qui ne proviennent pas d'un assistant IA.",
    installNoKey: "Créez une clé de site pour obtenir votre balise.",
    createTitle: "Créer une clé de site",
    labelLabel: "Étiquette",
    labelPlaceholder: "exemple.com",
    createButton: "Créer la clé de site",
    creating: "Création…",
    keyOnce:
      "Copiez votre balise maintenant. La clé n'est conservée que sous forme de hachage, nous ne pouvons donc pas l'afficher à nouveau — elle figure toutefois dans le code source de chaque site où vous l'installez.",
    publishableNote:
      "Cette clé est publiable : elle est visible par quiconque consulte le code source de votre site. Elle ne permet qu'une seule chose — enregistrer une visite dans cet espace de travail. Elle ne donne accès en lecture à rien.",
    copy: "Copier",
    copied: "Copié",
    copyTag: "Copier la balise",
    done: "Terminé",

    yourKeys: "Clés de site",
    emptyKeys: "Aucune clé de site. Créez-en une ci-dessus pour commencer à mesurer.",
    statusActive: "Active",
    statusRevoked: "Révoquée",
    createdLabel: "Créée",
    lastUsedLabel: "Dernière réception",
    neverUsed: "jamais",
    revoke: "Révoquer",
    revokeConfirm:
      "Révoquer cette clé ? Toute page qui la porte encore cesse d'être mesurée en moins d'une minute.",
    loading: "Chargement…",
    loadFailed: "Impossible de charger les clés de site",
    actionFailed: "Échec de l'action",

    windowLabel: (days: number) => `${days} derniers jours`,
    totalTitle: "Visiteurs venus d'une IA",
    totalHint:
      "Visiteurs distincts dont la première arrivée sur une page provenait d'un assistant IA.",
    bySourceTitle: "Par assistant",
    trendTitle: "Nouveaux visiteurs venus d'une IA par jour",
    landingTitle: "Pages d'arrivée",
    colPage: "Page",
    colVisitors: "Visiteurs",
    colRepeat: "Retours",
    colSources: "Provenance",
    emptyResults:
      "Rien pour l'instant. Dès que la balise est en ligne et qu'une personne vous rejoint depuis un assistant IA, elle apparaît ici — généralement en moins d'une minute.",
    emptyWindow: (days: number) =>
      `Aucun visiteur venu d'une IA au cours des ${days} derniers jours. Les visites antérieures restent comptées dans vos totaux.`,

    sourceNames: {
      chatgpt: "ChatGPT",
      perplexity: "Perplexity",
      gemini: "Gemini",
      copilot: "Copilot",
      claude: "Claude",
      dark_ai: "Autre IA",
    },
    darkAiHint:
      "« Autre IA » désigne une visite dont nous avons établi qu'elle vient d'un assistant — You.com, Poe, Meta AI et consorts — mais pas de l'un des cinq présentés séparément. Ce n'est jamais une supposition : un trafic dont nous ne pouvons pas prouver l'origine IA n'est pas compté.",
    blockedHint:
      "Les chiffres sont prudents. Les visites où un bloqueur de publicités ou de traqueurs a empêché le script ne sont pas enregistrées : votre chiffre réel est donc égal ou supérieur à celui-ci, jamais inférieur.",
  },
  "de-CH": {
    intro:
      "Welche KI-Assistenten Ihnen Besucher schicken. Fügen Sie ein einziges Skript-Tag ein, und jeder Besuch aus ChatGPT, Perplexity, Gemini, Copilot oder Claude wird beim Eintreffen klassifiziert — serverseitig, anhand des Referrers und nicht anhand dessen, was die Seite behaupten könnte.",

    installTitle: "Tag einbauen",
    installIntro:
      "Fügen Sie dies in den <head> jeder Seite ein, die gemessen werden soll. Rund 2 KB, asynchron geladen, ein einziges Erstanbieter-Cookie — und für Besuche ohne KI-Assistenten wird gar nichts gesendet.",
    installNoKey: "Erstellen Sie einen Site-Schlüssel, um Ihr Tag zu erhalten.",
    createTitle: "Site-Schlüssel erstellen",
    labelLabel: "Bezeichnung",
    labelPlaceholder: "beispiel.ch",
    createButton: "Site-Schlüssel erstellen",
    creating: "Wird erstellt…",
    keyOnce:
      "Kopieren Sie Ihr Tag jetzt. Der Schlüssel wird nur als Hash gespeichert, wir können ihn also nicht erneut anzeigen — er steht allerdings im Quelltext jeder Site, auf der Sie ihn einbauen.",
    publishableNote:
      "Dieser Schlüssel ist veröffentlichbar: Er ist für alle sichtbar, die den Quelltext Ihrer Site ansehen. Er kann genau eines — einen Besuch für diesen Arbeitsbereich erfassen. Lesezugriff gewährt er auf nichts.",
    copy: "Kopieren",
    copied: "Kopiert",
    copyTag: "Tag kopieren",
    done: "Fertig",

    yourKeys: "Site-Schlüssel",
    emptyKeys: "Noch kein Site-Schlüssel. Erstellen Sie oben einen, um mit dem Messen zu beginnen.",
    statusActive: "Aktiv",
    statusRevoked: "Widerrufen",
    createdLabel: "Erstellt",
    lastUsedLabel: "Zuletzt empfangen",
    neverUsed: "nie",
    revoke: "Widerrufen",
    revokeConfirm:
      "Diesen Schlüssel widerrufen? Jede Seite, die ihn noch trägt, wird binnen einer Minute nicht mehr gemessen.",
    loading: "Wird geladen…",
    loadFailed: "Site-Schlüssel konnten nicht geladen werden",
    actionFailed: "Aktion fehlgeschlagen",

    windowLabel: (days: number) => `Letzte ${days} Tage`,
    totalTitle: "Besucher aus KI-Assistenten",
    totalHint:
      "Eindeutige Besucher, deren erste Ankunft auf einer Seite aus einem KI-Assistenten kam.",
    bySourceTitle: "Nach Assistent",
    trendTitle: "Neue Besucher aus KI-Assistenten pro Tag",
    landingTitle: "Einstiegsseiten",
    colPage: "Seite",
    colVisitors: "Besucher",
    colRepeat: "Wiederkehr",
    colSources: "Herkunft",
    emptyResults:
      "Noch nichts. Sobald das Tag live ist und jemand über einen KI-Assistenten zu Ihnen kommt, erscheint das hier — meist innerhalb einer Minute.",
    emptyWindow: (days: number) =>
      `Keine Besucher aus KI-Assistenten in den letzten ${days} Tagen. Frühere Besuche zählen weiterhin zu Ihren Gesamtwerten.`,

    sourceNames: {
      chatgpt: "ChatGPT",
      perplexity: "Perplexity",
      gemini: "Gemini",
      copilot: "Copilot",
      claude: "Claude",
      dark_ai: "Andere KI",
    },
    darkAiHint:
      "«Andere KI» bezeichnet einen Besuch, bei dem wir nachweisen konnten, dass er aus einem Assistenten kam — You.com, Poe, Meta AI und ähnliche — aber nicht aus einem der fünf einzeln ausgewiesenen. Das ist nie geraten: Traffic, dessen KI-Herkunft wir nicht belegen können, wird gar nicht gezählt.",
    blockedHint:
      "Die Zahlen sind zurückhaltend. Besuche, bei denen ein Werbe- oder Tracker-Blocker das Skript verhindert hat, werden nicht erfasst — Ihre tatsächliche Zahl ist also gleich hoch oder höher, nie tiefer.",
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   AI hub (/ai)
   ═══════════════════════════════════════════════════════════════════════════

   Card copy for the AI hub. Same shape as REPUTATION_COPY minus the lock
   strings: this hub HIDES a card its rollout switch has not reached rather
   than locking it, so there is no "not on your plan" state to describe.
   See src/lib/ai-tools.ts for why those are different questions.

   Descriptions say what the surface DOES, in the same register as the
   reputation cards — a card that reads like a feature name teaches nobody
   which of four AI surfaces they actually want.
*/
const aiHubEn = {
  hubTitle: "AI",
  hubSubtitle:
    "Whether AI assistants know about you, what they say, and who they send. Nine surfaces, one place.",

  groups: {
    answers: "In the answers",
    traffic: "From the answers",
  } as Record<string, string>,

  items: {
    ai_visibility: {
      name: "AI Visibility",
      description:
        "Audit any page for how readable it is to AI engines, and watch the score on a schedule.",
    },
    ai_search: {
      name: "AI Search Intelligence",
      description:
        "How assistants answer the questions your buyers ask — who gets named, cited and recommended.",
    },
    share_of_voice: {
      name: "Share of Voice",
      description:
        "How much of each engine's answers you own, who takes the rest, and how it is moving.",
    },
    custom_prompts: {
      name: "Custom Prompts",
      description: "Track the exact questions that matter to you, and what the answers say over time.",
    },
    ai_attribution: {
      name: "AI Attribution",
      description:
        "Which assistants actually send visitors to your site, and which pages they land on.",
    },
    citation_finder: {
      name: "Citation Finder",
      description:
        "The sources the engines read to answer about your market, and which cite your rivals but never you.",
    },
    citation_opportunities: {
      name: "Citation Opportunities",
      description:
        "The same sources, turned into a ranked worklist: where to get listed next, and what to do there.",
    },
    opportunity_scanner: {
      name: "Agency Opportunity Scanner",
      description:
        "Grade prospect lists by AI visibility and export outreach-ready results.",
    },
    ai_revenue: {
      name: "AI Revenue",
      description:
        "What the answers earned you last month, and what the gap to your top rival costs.",
    },
  },
};
export type AiHubCopy = typeof aiHubEn;

export const AI_HUB_COPY: Record<DashLocale, AiHubCopy> = {
  en: aiHubEn,
  fr: {
    hubTitle: "IA",
    hubSubtitle:
      "Si les assistants IA vous connaissent, ce qu'ils disent de vous et qui ils vous envoient. Neuf surfaces, un seul endroit.",

    groups: {
      answers: "Dans les réponses",
      traffic: "Depuis les réponses",
    },

    items: {
      ai_visibility: {
        name: "Visibilité IA",
        description:
          "Analysez la lisibilité d'une page pour les moteurs IA et suivez le score de façon planifiée.",
      },
      ai_search: {
        name: "Veille des recherches IA",
        description:
          "Comment les assistants répondent aux questions de vos acheteurs — qui est nommé, cité et recommandé.",
      },
      share_of_voice: {
        name: "Part de voix",
        description:
          "Quelle part des réponses de chaque moteur vous revient, qui prend le reste, et comment cela évolue.",
      },
      custom_prompts: {
        name: "Requêtes personnalisées",
        description:
          "Suivez les questions qui comptent pour vous et l'évolution des réponses dans le temps.",
      },
      ai_attribution: {
        name: "Attribution IA",
        description:
          "Quels assistants envoient réellement des visiteurs sur votre site, et sur quelles pages ils arrivent.",
      },
      citation_finder: {
        name: "Détecteur de sources",
        description:
          "Les sources que les moteurs lisent pour parler de votre marché, et celles qui citent vos concurrents sans jamais vous nommer.",
      },
      citation_opportunities: {
        name: "Opportunités de citation",
        description:
          "Les mêmes sources, transformées en liste de travail classée : où se faire référencer ensuite, et comment.",
      },
      opportunity_scanner: {
        name: "Scanner d'opportunités",
        description:
          "Évaluez des listes de prospects selon leur visibilité IA et exportez des résultats prêts pour la prospection.",
      },
      ai_revenue: {
        name: "Revenus IA",
        description:
          "Ce que les réponses vous ont rapporté le mois dernier, et ce que coûte l'écart avec votre principal concurrent.",
      },
    },
  },
  "de-CH": {
    hubTitle: "KI",
    hubSubtitle:
      "Ob KI-Assistenten Sie kennen, was sie sagen und wen sie schicken. Neun Oberflächen, ein Ort.",

    groups: {
      answers: "In den Antworten",
      traffic: "Aus den Antworten",
    },

    items: {
      ai_visibility: {
        name: "KI-Sichtbarkeit",
        description:
          "Prüfen Sie, wie gut KI-Engines eine Seite lesen können, und verfolgen Sie den Wert nach Zeitplan.",
      },
      ai_search: {
        name: "KI-Suchanalyse",
        description:
          "Wie Assistenten die Fragen Ihrer Kundschaft beantworten — wer genannt, zitiert und empfohlen wird.",
      },
      share_of_voice: {
        name: "Stimmanteil",
        description:
          "Welchen Anteil der Antworten jeder Maschine Sie halten, wer den Rest nimmt und wohin es sich bewegt.",
      },
      custom_prompts: {
        name: "Eigene Prompts",
        description:
          "Verfolgen Sie genau die Fragen, die für Sie zählen, und wie sich die Antworten entwickeln.",
      },
      ai_attribution: {
        name: "KI-Attribution",
        description:
          "Welche Assistenten tatsächlich Besucher auf Ihre Website schicken und wo diese landen.",
      },
      citation_finder: {
        name: "Quellenfinder",
        description:
          "Die Quellen, welche die Maschinen zu Ihrem Markt lesen, und welche davon Ihre Mitbewerber nennen, Sie aber nie.",
      },
      citation_opportunities: {
        name: "Zitat-Chancen",
        description:
          "Dieselben Quellen als sortierte Arbeitsliste: wo Sie als Nächstes gelistet werden sollten und wie.",
      },
      opportunity_scanner: {
        name: "Opportunitäten-Scanner",
        description:
          "Bewerten Sie Interessentenlisten nach KI-Sichtbarkeit und exportieren Sie kontaktfertige Ergebnisse.",
      },
      ai_revenue: {
        name: "KI-Umsatz",
        description:
          "Was die Antworten letzten Monat eingebracht haben und was der Abstand zur stärksten Konkurrenz kostet.",
      },
    },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   AI Share of Voice (/visibility/tools/share-of-voice)
   ═══════════════════════════════════════════════════════════════════════════

   Every number this page shows is a PERCENTAGE OF ONE ENGINE'S ANSWERS, and the
   copy says so in as many places as it reasonably can. "You own 22%" with no
   denominator is the single easiest thing to misread on the page — a customer
   who thinks it means 22% of the market rather than 22% of the weighted
   mentions on one engine has been misled by us, not by themselves.

   {placeholders} are interpolated by the client, not by the notification
   renderer, so they may carry any type the component formats.
*/

const shareOfVoiceEn = {
  lockedTitle: "Share of Voice is on Growth and above",
  lockedBody:
    "See how much of each AI engine's answers you own, who is taking the rest, and how that has moved. Upgrade to Growth to switch it on for your tracked prompts.",
  lockedCta: "See plans",

  emptyTitle: "No share of voice yet",
  emptyBody:
    "This report is built from your tracked prompts' answers. Once a checkup has run and the nightly rollup has passed, your share on each engine appears here.",
  emptySetupCta: "Set up prompt tracking",
  // Shown INSTEAD of the CTA when answer tracking is not yet on for this
  // tenant. There is deliberately nothing to click: without the rollout no
  // checkup runs, so no amount of setup would fill this page. Saying so is the
  // honest answer, and it is better than a link to a 404 or a link to a page
  // that cannot help.
  emptyRolloutNote:
    "Answer tracking is still rolling out to accounts. This fills in on its own once it is switched on for yours — there is nothing to set up in the meantime.",

  // ── Headline ──
  youOwn: "You own {share}",
  rivalOwns: "{rival} owns {share}",
  noRival: "No competitor was named beside you.",
  deltaUp: "up {points} pts in {days} days",
  deltaDown: "down {points} pts in {days} days",
  deltaFlat: "unchanged over {days} days",
  deltaUnavailable: "Not enough history for a trend yet",

  // ── Filters ──
  promptSetLabel: "Prompt set",
  engineLabel: "Engine",
  allEngines: "All engines",

  // ── Charts ──
  stackTitle: "Share by engine",
  stackSubtitle:
    "Each bar is one engine's answers over the last {days} days, split by who was named and how highly.",
  trendTitle: "Your share over time",
  trendSubtitle: "Your own share of {scope}, one point per nightly rollup.",
  trendScopeAll: "all engines",
  everyoneElse: "Everyone else",
  promptCount: "{count} prompts",
  asOf: "{days}-day window, as of {date}",

  // ── Method note ──
  methodTitle: "How this is counted",
  methodBody:
    "One answer names you once, however often it repeats you. A first-place recommendation counts for a full point, second for a half, third for a third, and fourth place and below for a fifth. Being named without a ranked list counts for 0.3 — we know you were there, not where. Your share is your points divided by everyone's.",
};
export type ShareOfVoiceCopy = typeof shareOfVoiceEn;

export const SHARE_OF_VOICE_COPY: Record<DashLocale, ShareOfVoiceCopy> = {
  en: shareOfVoiceEn,
  fr: {
    lockedTitle: "La part de voix est incluse à partir de Growth",
    lockedBody:
      "Voyez quelle part des réponses de chaque moteur d'IA vous revient, qui prend le reste, et comment cela a évolué. Passez à Growth pour l'activer sur vos requêtes suivies.",
    lockedCta: "Voir les forfaits",

    emptyTitle: "Pas encore de part de voix",
    emptyBody:
      "Ce rapport est construit à partir des réponses à vos requêtes suivies. Dès qu'un contrôle aura été exécuté et que la consolidation nocturne sera passée, votre part sur chaque moteur apparaîtra ici.",
    emptySetupCta: "Configurer le suivi des requêtes",
    emptyRolloutNote:
      "Le suivi des réponses est encore en cours de déploiement. Cette page se remplira d'elle-même dès qu'il sera activé pour votre compte — il n'y a rien à configurer d'ici là.",

    youOwn: "Vous détenez {share}",
    rivalOwns: "{rival} détient {share}",
    noRival: "Aucun concurrent n'a été cité à vos côtés.",
    deltaUp: "+{points} pts en {days} jours",
    deltaDown: "−{points} pts en {days} jours",
    deltaFlat: "stable sur {days} jours",
    deltaUnavailable: "Historique encore insuffisant pour une tendance",

    promptSetLabel: "Jeu de requêtes",
    engineLabel: "Moteur",
    allEngines: "Tous les moteurs",

    stackTitle: "Part par moteur",
    stackSubtitle:
      "Chaque barre représente les réponses d'un moteur sur les {days} derniers jours, réparties selon qui a été cité et à quelle place.",
    trendTitle: "Votre part au fil du temps",
    trendSubtitle: "Votre part de {scope}, un point par consolidation nocturne.",
    trendScopeAll: "tous les moteurs",
    everyoneElse: "Tous les autres",
    promptCount: "{count} requêtes",
    asOf: "Fenêtre de {days} jours, au {date}",

    methodTitle: "Comment le calcul est fait",
    methodBody:
      "Une réponse vous cite une fois, quel que soit le nombre de répétitions. Une recommandation en première place vaut un point entier, la deuxième un demi, la troisième un tiers, et la quatrième et au-delà un cinquième. Être cité sans classement vaut 0,3 — nous savons que vous y étiez, pas à quelle place. Votre part, c'est vos points divisés par ceux de tout le monde.",
  },
  "de-CH": {
    lockedTitle: "Stimmanteil gibt es ab Growth",
    lockedBody:
      "Sehen Sie, welchen Anteil der Antworten jeder KI-Maschine Sie halten, wer sich den Rest nimmt und wie sich das entwickelt hat. Wechseln Sie zu Growth, um es für Ihre verfolgten Prompts einzuschalten.",
    lockedCta: "Abos ansehen",

    emptyTitle: "Noch kein Stimmanteil",
    emptyBody:
      "Dieser Bericht entsteht aus den Antworten auf Ihre verfolgten Prompts. Sobald eine Prüfung gelaufen und die nächtliche Konsolidierung durch ist, erscheint hier Ihr Anteil pro Maschine.",
    emptySetupCta: "Prompt-Tracking einrichten",
    emptyRolloutNote:
      "Die Antwortverfolgung wird noch für die Konten ausgerollt. Diese Seite füllt sich von selbst, sobald sie für Ihres eingeschaltet ist — bis dahin gibt es nichts einzurichten.",

    youOwn: "Sie halten {share}",
    rivalOwns: "{rival} hält {share}",
    noRival: "Neben Ihnen wurde kein Mitbewerber genannt.",
    deltaUp: "+{points} Pkt. in {days} Tagen",
    deltaDown: "−{points} Pkt. in {days} Tagen",
    deltaFlat: "unverändert über {days} Tage",
    deltaUnavailable: "Noch zu wenig Verlauf für einen Trend",

    promptSetLabel: "Prompt-Satz",
    engineLabel: "Maschine",
    allEngines: "Alle Maschinen",

    stackTitle: "Anteil pro Maschine",
    stackSubtitle:
      "Jeder Balken steht für die Antworten einer Maschine der letzten {days} Tage, aufgeteilt danach, wer genannt wurde und wie weit oben.",
    trendTitle: "Ihr Anteil im Zeitverlauf",
    trendSubtitle: "Ihr Anteil an {scope}, ein Punkt pro nächtlicher Konsolidierung.",
    trendScopeAll: "allen Maschinen",
    everyoneElse: "Alle anderen",
    promptCount: "{count} Prompts",
    asOf: "{days}-Tage-Fenster, Stand {date}",

    methodTitle: "Wie gezählt wird",
    methodBody:
      "Eine Antwort nennt Sie einmal, so oft sie Sie auch wiederholt. Eine Empfehlung auf Platz eins zählt einen ganzen Punkt, Platz zwei einen halben, Platz drei einen Drittel, Platz vier und tiefer einen Fünftel. Genannt zu werden ohne Rangliste zählt 0,3 — wir wissen, dass Sie dabei waren, nicht wo. Ihr Anteil sind Ihre Punkte geteilt durch die aller.",
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   AI Citation Finder (/visibility/tools/citation-finder)
   ═══════════════════════════════════════════════════════════════════════════

   THE COPY NEVER PROMISES A RANKING FACTOR. A source an engine cites is a
   source an engine read; it is not a slot you can buy and it is not a backlink.
   The method note says so, because the single most likely misreading of this
   table is "get listed on these and you will be recommended" — which is a claim
   we cannot support and would be selling if we implied it.

   "Cites you" is measured on the ANSWER, not the sentence, and the method note
   says that too: a customer comparing this count against the citation drilldown
   in AI Search will otherwise find two numbers that disagree and conclude one
   of them is broken.

   {placeholders} are interpolated by the client, not by the notification
   renderer, so they may carry any type the component formats.
*/

const citationFinderEn = {
  lockedTitle: "Citation Finder is on Growth and above",
  lockedBody:
    "See every source the AI engines cite when they answer about your market, and which of them recommend your competitors without ever naming you. Upgrade to Growth to switch it on for your tracked prompts.",
  lockedCta: "See plans",

  emptyTitle: "No sources yet",
  emptyBody:
    "This table is built from the links your tracked prompts' answers cited. Once a checkup has run and the nightly rollup has passed, every source the engines used appears here.",
  emptySetupCta: "Set up prompt tracking",
  // Shown INSTEAD of the CTA when answer tracking is not yet on for this
  // tenant. Nothing to click, deliberately: citations are written only on the
  // checkup path, and the checkup sweep skips tenants without the rollout, so
  // no amount of prompt setup would produce a single row here.
  emptyRolloutNote:
    "Answer tracking is still rolling out to accounts. Sources appear here on their own once it is switched on for yours — there is nothing to set up in the meantime.",

  noMatches: "No sources match this filter.",

  // ── Filters ──
  brandLabel: "Brand",
  kindLabel: "Source type",
  allKinds: "All types",
  presetOpportunity: "Trusted sources that never mention you ({count})",
  presetExplainer:
    "Sources the engines cite for your competitors, in answers where you were never named. These are the pages worth getting onto.",

  // ── Table ──
  tableCaption: "Sources cited by AI engines in answers about {brand}",
  columns: {
    domain: "Source",
    kind: "Type",
    engines: "Engines",
    seen: "Citations",
    citesYou: "Cites you",
    rivals: "Cites instead",
    lastSeen: "Last seen",
  },
  citesYouYes: "Yes ({count})",
  citesYouNo: "Never",

  kinds: {
    DIRECTORY: "Directory",
    REVIEW_SITE: "Review site",
    NEWS: "News",
    BLOG: "Blog",
    GOV: "Government",
    SOCIAL: "Social",
    OTHER: "Other",
  },

  // ── Pagination ──
  pageOf: "Page {page} of {pages} — {total} sources",
  previous: "Previous",
  next: "Next",

  methodNote:
    "A source is counted once per answer that cited it. “Cites you” means the answer named your brand somewhere, not that the link itself was about you. Being cited is evidence an engine read a page — it is not a ranking factor, and getting listed somewhere is no guarantee of being recommended.",
};
export type CitationFinderCopy = typeof citationFinderEn;

export const CITATION_FINDER_COPY: Record<DashLocale, CitationFinderCopy> = {
  en: citationFinderEn,
  fr: {
    lockedTitle: "Le détecteur de sources est inclus à partir de Growth",
    lockedBody:
      "Découvrez toutes les sources que les moteurs d'IA citent lorsqu'ils parlent de votre marché, et lesquelles recommandent vos concurrents sans jamais vous nommer. Passez à Growth pour l'activer sur vos requêtes suivies.",
    lockedCta: "Voir les forfaits",

    emptyTitle: "Pas encore de sources",
    emptyBody:
      "Ce tableau est construit à partir des liens cités dans les réponses à vos requêtes suivies. Dès qu'un contrôle aura été exécuté et que la consolidation nocturne sera passée, toutes les sources utilisées par les moteurs apparaîtront ici.",
    emptySetupCta: "Configurer le suivi des requêtes",
    emptyRolloutNote:
      "Le suivi des réponses est encore en cours de déploiement. Les sources apparaîtront d'elles-mêmes dès qu'il sera activé pour votre compte — il n'y a rien à configurer d'ici là.",

    noMatches: "Aucune source ne correspond à ce filtre.",

    brandLabel: "Marque",
    kindLabel: "Type de source",
    allKinds: "Tous les types",
    presetOpportunity: "Sources fiables qui ne vous mentionnent jamais ({count})",
    presetExplainer:
      "Les sources que les moteurs citent pour vos concurrents, dans des réponses où vous n'avez jamais été nommé. Ce sont les pages sur lesquelles il vaut la peine de figurer.",

    tableCaption: "Sources citées par les moteurs d'IA dans les réponses concernant {brand}",
    columns: {
      domain: "Source",
      kind: "Type",
      engines: "Moteurs",
      seen: "Citations",
      citesYou: "Vous cite",
      rivals: "Cite à la place",
      lastSeen: "Vue le",
    },
    citesYouYes: "Oui ({count})",
    citesYouNo: "Jamais",

    kinds: {
      DIRECTORY: "Annuaire",
      REVIEW_SITE: "Site d'avis",
      NEWS: "Presse",
      BLOG: "Blogue",
      GOV: "Administration",
      SOCIAL: "Réseau social",
      OTHER: "Autre",
    },

    pageOf: "Page {page} sur {pages} — {total} sources",
    previous: "Précédent",
    next: "Suivant",

    methodNote:
      "Une source est comptée une fois par réponse qui la cite. « Vous cite » signifie que la réponse a nommé votre marque quelque part, et non que le lien lui-même vous concernait. Être cité prouve qu'un moteur a lu une page : ce n'est pas un facteur de classement, et figurer quelque part ne garantit pas d'être recommandé.",
  },
  "de-CH": {
    lockedTitle: "Der Quellenfinder ist ab Growth enthalten",
    lockedBody:
      "Sehen Sie jede Quelle, die KI-Maschinen zu Ihrem Markt zitieren, und welche davon Ihre Mitbewerber empfehlen, ohne Sie je zu nennen. Wechseln Sie zu Growth, um ihn für Ihre verfolgten Prompts einzuschalten.",
    lockedCta: "Pläne ansehen",

    emptyTitle: "Noch keine Quellen",
    emptyBody:
      "Diese Tabelle entsteht aus den Links, welche die Antworten auf Ihre verfolgten Prompts zitiert haben. Sobald ein Checkup gelaufen und die nächtliche Konsolidierung durch ist, erscheint hier jede Quelle, welche die Maschinen genutzt haben.",
    emptySetupCta: "Prompt-Verfolgung einrichten",
    emptyRolloutNote:
      "Die Antwortverfolgung wird noch für die Konten ausgerollt. Quellen erscheinen hier von selbst, sobald sie für Ihres eingeschaltet ist — bis dahin gibt es nichts einzurichten.",

    noMatches: "Keine Quelle entspricht diesem Filter.",

    brandLabel: "Marke",
    kindLabel: "Quellenart",
    allKinds: "Alle Arten",
    presetOpportunity: "Vertrauenswürdige Quellen, die Sie nie nennen ({count})",
    presetExplainer:
      "Quellen, welche die Maschinen für Ihre Mitbewerber zitieren, in Antworten, in denen Sie nie genannt wurden. Das sind die Seiten, auf die zu kommen sich lohnt.",

    tableCaption: "Von KI-Maschinen zitierte Quellen in Antworten zu {brand}",
    columns: {
      domain: "Quelle",
      kind: "Art",
      engines: "Maschinen",
      seen: "Zitate",
      citesYou: "Nennt Sie",
      rivals: "Nennt stattdessen",
      lastSeen: "Zuletzt",
    },
    citesYouYes: "Ja ({count})",
    citesYouNo: "Nie",

    kinds: {
      DIRECTORY: "Verzeichnis",
      REVIEW_SITE: "Bewertungsseite",
      NEWS: "Presse",
      BLOG: "Blog",
      GOV: "Behörde",
      SOCIAL: "Soziales Netz",
      OTHER: "Anderes",
    },

    pageOf: "Seite {page} von {pages} — {total} Quellen",
    previous: "Zurück",
    next: "Weiter",

    methodNote:
      "Eine Quelle wird einmal pro Antwort gezählt, die sie zitiert. «Nennt Sie» heisst, dass die Antwort Ihre Marke irgendwo genannt hat, nicht dass der Link selbst von Ihnen handelte. Zitiert zu werden belegt, dass eine Maschine eine Seite gelesen hat — es ist kein Rankingfaktor, und irgendwo gelistet zu sein garantiert keine Empfehlung.",
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Citation Opportunity Engine (/visibility/tools/citation-opportunities)
   ═══════════════════════════════════════════════════════════════════════════

   THE HOW-TOS LIVE HERE, NOT IN THE DATABASE. CitationOpportunity.howTo stores
   the English prose the weekly job wrote, for the same reason Notification
   stores an English title: it is the durable record and the fallback for a row
   whose `kind` this catalog does not know. What the dashboard RENDERS is the
   template below, keyed on that same `kind` — otherwise a French customer would
   read English advice forever, because the job that wrote it has no locale.

   THE COPY NEVER PROMISES A RANKING FACTOR, and this tool is the one where the
   temptation is strongest: it is a list of things to go and do, so it would be
   very easy to imply that doing them causes a recommendation. Getting listed
   makes you eligible to be read. That is all it does, and the method note says
   so in every locale.

   THE SCORE IS NEVER PRINTED. It has no unit (see
   src/lib/citation-opportunities/score.ts) — the list is ranked by it and the
   effort badge is the only number-adjacent thing on a card.
*/

const citationOpportunitiesEn = {
  lockedTitle: "Citation Opportunities is on Growth and above",
  lockedBody:
    "Turn the sources that cite your competitors into a ranked list of places to get listed, with what to do on each one. Upgrade to Growth to switch it on for your tracked prompts.",
  lockedCta: "See plans",

  emptyTitle: "No opportunities yet",
  emptyBody:
    "This list is built from the sources the AI engines cite about your market. Once a checkup has run, the nightly rollup has passed and the weekly scoring job has scored them, every source that cites your rivals but never you appears here.",
  emptyFinderCta: "See every source in Citation Finder",

  // ── Header ──
  sourcesCount: "{count} sources",
  openCount: "{count} still to do",
  provenCount: "{count} now citing you",

  // ── Card ──
  howToTitle: "What to do",
  effortLabel: "Effort",
  efforts: {
    LOW: "Low",
    MED: "Medium",
    HIGH: "High",
  },
  kinds: {
    DIRECTORY: "Directory",
    REVIEW_SITE: "Review site",
    NEWS: "News",
    BLOG: "Blog",
    GOV: "Government",
    SOCIAL: "Social",
    OTHER: "Other",
  },
  statuses: {
    OPEN: "To do",
    IN_PROGRESS: "In progress",
    DONE: "Done",
    DISMISSED: "Dismissed",
  },
  /** The buttons. Imperative, because clicking one is an act. */
  actions: {
    OPEN: "Reopen",
    IN_PROGRESS: "Start",
    DONE: "Mark done",
    DISMISSED: "Dismiss",
  },
  statusSaving: "Saving…",
  statusError: "Could not save that. Try again.",

  provenBadge: "Now cites you",
  provenTitle: "Confirmed: since you marked this done, this source has cited an answer that names you.",

  // ── The how-tos. Keyed on CitationKind, same keys the job uses. ──
  howTo: {
    DIRECTORY:
      "Claim or create your listing on {domain}. Use exactly the same name, address and phone number as your other listings — a directory that disagrees with the rest of the web is worse than no listing, because it splits the record of who you are.",
    REVIEW_SITE:
      "Claim your profile on {domain}, then ask recent customers to review you there. A profile with no reviews is rarely quoted.",
    NEWS:
      "Pitch {domain} a story, not a company. The angle with the best odds is the one your buyers already ask about — {theme} — told with a number or a case only you have. Find the reporter who covers that beat and mail them directly.",
    BLOG:
      "Offer {domain} a guest post or a contribution on {theme}. Independent blogs answer email far more often than newsrooms do, and a single post that genuinely answers the question is enough to become the page an engine reads.",
    GOV:
      "Check whether you qualify for a listing or register on {domain}. Public-sector sources are eligibility, not outreach: if you meet the criteria the listing is close to automatic, and if you do not, no amount of pitching will change it.",
    SOCIAL:
      "Create or complete your presence on {domain}, and make sure it describes what you actually sell. Engines quote these because they are public and current, so a profile that is three years stale is a source arguing against you.",
    OTHER:
      "Work out what {domain} is before you act on it. Open the page the engines cited, see whether it accepts submissions, listings, guest posts or corrections, and treat it as whichever of those it turns out to be.",
  },
  /** Appended to the REVIEW_SITE how-to, as a real link. */
  campaignsCta: "Ask your customers for reviews",
  /** Fallback for {theme} when the brand has no topics configured. */
  themeFallback: "the questions your buyers ask",

  methodNote:
    "Ranked by how much this source is worth getting onto — how often the engines cite it, how many of them do, and how much of that goes to your competitors — divided by how hard it is. Sources that already link to your site are left out. Getting listed makes you eligible to be read; it is not a ranking factor and it is not a guarantee of being recommended.",
};
export type CitationOpportunitiesCopy = typeof citationOpportunitiesEn;

export const CITATION_OPPORTUNITIES_COPY: Record<DashLocale, CitationOpportunitiesCopy> = {
  en: citationOpportunitiesEn,
  fr: {
    lockedTitle: "Les opportunités de citation sont incluses à partir de Growth",
    lockedBody:
      "Transformez les sources qui citent vos concurrents en une liste classée d'endroits où vous faire référencer, avec la marche à suivre pour chacun. Passez à Growth pour l'activer sur vos requêtes suivies.",
    lockedCta: "Voir les forfaits",

    emptyTitle: "Pas encore d'opportunités",
    emptyBody:
      "Cette liste est construite à partir des sources que les moteurs d'IA citent au sujet de votre marché. Dès qu'un contrôle aura été exécuté, que la consolidation nocturne sera passée et que le calcul hebdomadaire les aura évaluées, toutes les sources qui citent vos concurrents sans jamais vous nommer apparaîtront ici.",
    emptyFinderCta: "Voir toutes les sources dans le détecteur de sources",

    sourcesCount: "{count} sources",
    openCount: "{count} restent à traiter",
    provenCount: "{count} vous citent désormais",

    howToTitle: "Marche à suivre",
    effortLabel: "Effort",
    efforts: {
      LOW: "Faible",
      MED: "Moyen",
      HIGH: "Élevé",
    },
    kinds: {
      DIRECTORY: "Annuaire",
      REVIEW_SITE: "Site d'avis",
      NEWS: "Presse",
      BLOG: "Blog",
      GOV: "Administration",
      SOCIAL: "Réseau social",
      OTHER: "Autre",
    },
    statuses: {
      OPEN: "À faire",
      IN_PROGRESS: "En cours",
      DONE: "Terminé",
      DISMISSED: "Écarté",
    },
    actions: {
      OPEN: "Rouvrir",
      IN_PROGRESS: "Commencer",
      DONE: "Marquer terminé",
      DISMISSED: "Écarter",
    },
    statusSaving: "Enregistrement…",
    statusError: "Impossible d'enregistrer. Réessayez.",

    provenBadge: "Vous cite désormais",
    provenTitle:
      "Confirmé : depuis que vous avez marqué cette tâche terminée, cette source a cité une réponse qui vous nomme.",

    howTo: {
      DIRECTORY:
        "Revendiquez ou créez votre fiche sur {domain}. Utilisez exactement les mêmes nom, adresse et téléphone que sur vos autres fiches — un annuaire qui contredit le reste du web est pire que pas de fiche du tout, car il divise la trace de qui vous êtes.",
      REVIEW_SITE:
        "Revendiquez votre profil sur {domain}, puis demandez à vos clients récents d'y laisser un avis. Un profil sans avis est rarement cité.",
      NEWS:
        "Proposez à {domain} un sujet, pas une entreprise. L'angle le plus prometteur est celui que vos acheteurs posent déjà — {theme} — raconté avec un chiffre ou un cas que vous seul détenez. Trouvez le journaliste qui couvre ce sujet et écrivez-lui directement.",
      BLOG:
        "Proposez à {domain} un article invité ou une contribution sur {theme}. Les blogs indépendants répondent aux courriels bien plus souvent que les rédactions, et un seul article qui répond vraiment à la question suffit à devenir la page qu'un moteur lit.",
      GOV:
        "Vérifiez si vous êtes éligible à une inscription ou à un enregistrement sur {domain}. Les sources publiques relèvent de l'éligibilité, pas de la prospection : si vous remplissez les critères, l'inscription est quasi automatique ; sinon, aucune relance n'y changera rien.",
      SOCIAL:
        "Créez ou complétez votre présence sur {domain}, et assurez-vous qu'elle décrive ce que vous vendez réellement. Les moteurs les citent parce qu'elles sont publiques et à jour ; un profil vieux de trois ans est donc une source qui plaide contre vous.",
      OTHER:
        "Déterminez ce qu'est {domain} avant d'agir. Ouvrez la page que les moteurs ont citée, voyez si elle accepte des soumissions, des inscriptions, des articles invités ou des corrections, et traitez-la en conséquence.",
    },
    campaignsCta: "Demander des avis à vos clients",
    themeFallback: "les questions que posent vos acheteurs",

    methodNote:
      "Classées selon l'intérêt d'y figurer — la fréquence à laquelle les moteurs citent cette source, le nombre de moteurs concernés et la part qui profite à vos concurrents — divisé par la difficulté. Les sources qui pointent déjà vers votre site sont exclues. Être référencé vous rend éligible à la lecture ; ce n'est pas un facteur de classement, ni une garantie d'être recommandé.",
  },
  "de-CH": {
    lockedTitle: "Zitat-Chancen gibt es ab Growth",
    lockedBody:
      "Machen Sie aus den Quellen, die Ihre Mitbewerber zitieren, eine sortierte Liste von Orten, an denen Sie gelistet werden sollten — samt Anleitung für jeden einzelnen. Wechseln Sie zu Growth, um das für Ihre verfolgten Prompts einzuschalten.",
    lockedCta: "Pläne ansehen",

    emptyTitle: "Noch keine Chancen",
    emptyBody:
      "Diese Liste entsteht aus den Quellen, die KI-Maschinen zu Ihrem Markt zitieren. Sobald eine Prüfung gelaufen ist, die nächtliche Verdichtung durch ist und der wöchentliche Lauf sie bewertet hat, erscheint hier jede Quelle, die Ihre Mitbewerber zitiert, Sie aber nie.",
    emptyFinderCta: "Alle Quellen im Quellenfinder ansehen",

    sourcesCount: "{count} Quellen",
    openCount: "{count} noch offen",
    provenCount: "{count} zitieren Sie jetzt",

    howToTitle: "Was zu tun ist",
    effortLabel: "Aufwand",
    efforts: {
      LOW: "Gering",
      MED: "Mittel",
      HIGH: "Hoch",
    },
    kinds: {
      DIRECTORY: "Verzeichnis",
      REVIEW_SITE: "Bewertungsseite",
      NEWS: "Presse",
      BLOG: "Blog",
      GOV: "Behörde",
      SOCIAL: "Soziales Netz",
      OTHER: "Anderes",
    },
    statuses: {
      OPEN: "Offen",
      IN_PROGRESS: "In Arbeit",
      DONE: "Erledigt",
      DISMISSED: "Verworfen",
    },
    actions: {
      OPEN: "Wieder öffnen",
      IN_PROGRESS: "Beginnen",
      DONE: "Als erledigt markieren",
      DISMISSED: "Verwerfen",
    },
    statusSaving: "Wird gespeichert…",
    statusError: "Konnte nicht gespeichert werden. Bitte nochmals versuchen.",

    provenBadge: "Zitiert Sie jetzt",
    provenTitle:
      "Bestätigt: Seit Sie das als erledigt markiert haben, hat diese Quelle eine Antwort zitiert, die Sie nennt.",

    howTo: {
      DIRECTORY:
        "Übernehmen oder erstellen Sie Ihren Eintrag auf {domain}. Verwenden Sie genau dieselben Angaben zu Name, Adresse und Telefon wie in Ihren anderen Einträgen — ein Verzeichnis, das dem übrigen Web widerspricht, ist schlechter als gar kein Eintrag, weil es die Spur dessen zerteilt, wer Sie sind.",
      REVIEW_SITE:
        "Übernehmen Sie Ihr Profil auf {domain} und bitten Sie danach Ihre jüngsten Kundinnen und Kunden um eine Bewertung dort. Ein Profil ohne Bewertungen wird selten zitiert.",
      NEWS:
        "Bieten Sie {domain} eine Geschichte an, keine Firma. Der aussichtsreichste Aufhänger ist der, nach dem Ihre Käufer ohnehin fragen — {theme} — erzählt mit einer Zahl oder einem Fall, den nur Sie haben. Finden Sie die Person, die dieses Thema betreut, und schreiben Sie ihr direkt.",
      BLOG:
        "Bieten Sie {domain} einen Gastbeitrag oder einen Beitrag zu {theme} an. Unabhängige Blogs antworten weit häufiger auf E-Mails als Redaktionen, und ein einziger Beitrag, der die Frage wirklich beantwortet, genügt, um die Seite zu werden, die eine Maschine liest.",
      GOV:
        "Prüfen Sie, ob Sie für einen Eintrag oder eine Registrierung auf {domain} in Frage kommen. Behördliche Quellen sind eine Frage der Berechtigung, nicht der Ansprache: Erfüllen Sie die Kriterien, ist der Eintrag fast automatisch; erfüllen Sie sie nicht, ändert auch Nachfassen nichts.",
      SOCIAL:
        "Legen Sie Ihre Präsenz auf {domain} an oder vervollständigen Sie sie, und achten Sie darauf, dass sie beschreibt, was Sie tatsächlich verkaufen. Maschinen zitieren diese Seiten, weil sie öffentlich und aktuell sind — ein drei Jahre altes Profil ist deshalb eine Quelle, die gegen Sie spricht.",
      OTHER:
        "Finden Sie zuerst heraus, was {domain} überhaupt ist. Öffnen Sie die Seite, welche die Maschinen zitiert haben, prüfen Sie, ob sie Einreichungen, Einträge, Gastbeiträge oder Korrekturen annimmt, und behandeln Sie sie als das, was sie tatsächlich ist.",
    },
    campaignsCta: "Kundinnen und Kunden um Bewertungen bitten",
    themeFallback: "die Fragen, die Ihre Käufer stellen",

    methodNote:
      "Sortiert danach, wie viel es bringt, dort aufzutauchen — wie oft die Maschinen diese Quelle zitieren, wie viele davon es tun und wie viel davon Ihren Mitbewerbern zugutekommt — geteilt durch den Aufwand. Quellen, die bereits auf Ihre Website verlinken, bleiben aussen vor. Gelistet zu sein macht Sie lesbar; es ist kein Rankingfaktor und keine Garantie für eine Empfehlung.",
  },
};

// ─── AI Competitor Reverse Engineer ──────────────────────────────────────────
// "Why are they winning?" — the confirm dialog, the report view, and the copy
// for every factor including the ones that could not be measured. The
// unavailable reasons are separate strings rather than one "no data" because
// they call for different customer action: waiting for tonight's rollup and
// raising a spent budget are not the same instruction.

const explainEn = {
  // ── Entry point ──
  buttonLabel: "Why are they winning?",
  buttonHint: "Reverse-engineer what puts {rival} ahead of you",

  // ── Confirm dialog ──
  confirmTitle: "Reverse-engineer {rival}",
  confirmBody:
    "We compare them to you on six factors: share of voice, the sources AI engines cite, backlink authority, knowledge-graph presence, site AI-readiness and reviews. Two of those buy live data.",
  confirmDomainLabel: "Their domain",
  confirmDomainHint:
    "Used for the backlink and site checks. We suggest one from your own citation data where we can.",
  confirmCostLabel: "Estimated data cost",
  confirmCostNote:
    "Charged to your workspace's monthly data budget. The report is kept for {days} days — asking again inside that window costs nothing.",
  confirmRun: "Run the report",
  confirmCancel: "Cancel",
  running: "Working through six checks…",

  // ── Report ──
  reportTitle: "{rival} vs you",
  cachedNote: "Stored report from {date}. A fresh run is available from {rerun}.",
  freshNote: "Generated just now, from {cost} of live data.",
  columnFactor: "Factor",
  columnThem: "Them",
  columnYou: "You",
  columnGap: "Gap",
  verdictBehind: "They lead you on {behind} of {measured} measured factors.",
  verdictLevel: "They do not lead you on any factor we could measure.",
  verdictNothing: "Nothing could be measured for this comparison yet.",
  fixLabel: "Fix",
  notMeasuredTitle: "Not measured",
  notMeasuredBody: "These factors carry no numbers. Each says why.",
  downloadPdf: "Download PDF",
  error: "The report could not be generated. Nothing was charged.",

  // ── The six factors ──
  factor: {
    share_of_voice: "Share of voice",
    cited_sources: "Cited sources",
    authority: "Backlink authority",
    entities: "Knowledge-graph presence",
    site_readiness: "Site AI-readiness",
    reviews: "Reviews",
  },

  // ── Why a factor has no numbers ──
  unavailable: {
    awaiting_first_aggregation:
      "Waiting on the first nightly share-of-voice rollup for this project.",
    awaiting_first_sweep: "Waiting on the first weekly citation-opportunity sweep.",
    no_place_id: "This competitor has no Google Business listing to compare against.",
    not_configured: "This check is not configured for this workspace.",
    cap_reached: "Your monthly data budget is spent, so this was not bought.",
    upstream_failed: "The data source could not be reached.",
  },
};
export type ExplainCopy = typeof explainEn;

export const EXPLAIN_COPY: Record<DashLocale, ExplainCopy> = {
  en: explainEn,
  fr: {
    buttonLabel: "Pourquoi sont-ils devant ?",
    buttonHint: "Comprendre ce qui place {rival} devant vous",

    confirmTitle: "Analyser {rival}",
    confirmBody:
      "Nous les comparons à vous sur six facteurs : la part de voix, les sources que citent les moteurs d'IA, l'autorité des liens entrants, la présence dans les graphes de connaissances, la lisibilité de votre site pour l'IA et les avis. Deux de ces facteurs nécessitent l'achat de données en direct.",
    confirmDomainLabel: "Leur domaine",
    confirmDomainHint:
      "Utilisé pour l'analyse des liens et du site. Nous en proposons un à partir de vos propres citations lorsque c'est possible.",
    confirmCostLabel: "Coût estimé des données",
    confirmCostNote:
      "Imputé au budget de données mensuel de votre espace de travail. Le rapport est conservé {days} jours — le redemander pendant cette période ne coûte rien.",
    confirmRun: "Lancer le rapport",
    confirmCancel: "Annuler",
    running: "Six vérifications en cours…",

    reportTitle: "{rival} face à vous",
    cachedNote: "Rapport enregistré le {date}. Une nouvelle analyse sera possible à partir du {rerun}.",
    freshNote: "Généré à l'instant, à partir de {cost} de données en direct.",
    columnFactor: "Facteur",
    columnThem: "Eux",
    columnYou: "Vous",
    columnGap: "Écart",
    verdictBehind: "Ils vous devancent sur {behind} des {measured} facteurs mesurés.",
    verdictLevel: "Ils ne vous devancent sur aucun des facteurs que nous avons pu mesurer.",
    verdictNothing: "Aucun facteur n'a encore pu être mesuré pour cette comparaison.",
    fixLabel: "À faire",
    notMeasuredTitle: "Non mesuré",
    notMeasuredBody: "Ces facteurs ne portent aucun chiffre. Chacun en explique la raison.",
    downloadPdf: "Télécharger le PDF",
    error: "Le rapport n'a pas pu être généré. Rien ne vous a été facturé.",

    factor: {
      share_of_voice: "Part de voix",
      cited_sources: "Sources citées",
      authority: "Autorité des liens entrants",
      entities: "Présence dans les graphes de connaissances",
      site_readiness: "Lisibilité du site pour l'IA",
      reviews: "Avis",
    },

    unavailable: {
      awaiting_first_aggregation:
        "En attente de la première consolidation nocturne de la part de voix pour ce projet.",
      awaiting_first_sweep:
        "En attente du premier balayage hebdomadaire des opportunités de citation.",
      no_place_id: "Ce concurrent n'a pas de fiche Google Business à comparer.",
      not_configured: "Cette vérification n'est pas configurée pour cet espace de travail.",
      cap_reached: "Votre budget de données mensuel est épuisé : cette donnée n'a pas été achetée.",
      upstream_failed: "La source de données n'a pas pu être jointe.",
    },
  },
  "de-CH": {
    buttonLabel: "Warum liegen sie vorne?",
    buttonHint: "Nachvollziehen, was {rival} vor Sie bringt",

    confirmTitle: "{rival} analysieren",
    confirmBody:
      "Wir vergleichen sie mit Ihnen anhand von sechs Faktoren: Anteil an den Antworten, die von KI-Maschinen zitierten Quellen, Backlink-Autorität, Präsenz in Wissensgraphen, KI-Lesbarkeit Ihrer Website und Bewertungen. Zwei davon kaufen Live-Daten ein.",
    confirmDomainLabel: "Ihre Domain",
    confirmDomainHint:
      "Wird für die Backlink- und Website-Prüfung verwendet. Wo möglich schlagen wir eine aus Ihren eigenen Zitationsdaten vor.",
    confirmCostLabel: "Geschätzte Datenkosten",
    confirmCostNote:
      "Wird dem monatlichen Datenbudget Ihres Arbeitsbereichs belastet. Der Bericht wird {days} Tage aufbewahrt — eine erneute Abfrage innerhalb dieser Frist kostet nichts.",
    confirmRun: "Bericht erstellen",
    confirmCancel: "Abbrechen",
    running: "Sechs Prüfungen laufen…",

    reportTitle: "{rival} gegen Sie",
    cachedNote: "Gespeicherter Bericht vom {date}. Ein neuer Lauf ist ab {rerun} möglich.",
    freshNote: "Soeben erstellt, aus {cost} an Live-Daten.",
    columnFactor: "Faktor",
    columnThem: "Sie (Mitbewerber)",
    columnYou: "Sie selbst",
    columnGap: "Abstand",
    verdictBehind: "Sie liegen bei {behind} von {measured} gemessenen Faktoren vor Ihnen.",
    verdictLevel: "Bei keinem messbaren Faktor liegen sie vor Ihnen.",
    verdictNothing: "Für diesen Vergleich konnte noch nichts gemessen werden.",
    fixLabel: "Massnahme",
    notMeasuredTitle: "Nicht gemessen",
    notMeasuredBody: "Diese Faktoren tragen keine Zahlen. Jeder nennt den Grund.",
    downloadPdf: "PDF herunterladen",
    error: "Der Bericht konnte nicht erstellt werden. Es wurde nichts verrechnet.",

    factor: {
      share_of_voice: "Anteil an den Antworten",
      cited_sources: "Zitierte Quellen",
      authority: "Backlink-Autorität",
      entities: "Präsenz in Wissensgraphen",
      site_readiness: "KI-Lesbarkeit der Website",
      reviews: "Bewertungen",
    },

    unavailable: {
      awaiting_first_aggregation:
        "Wartet auf die erste nächtliche Auswertung des Antwortanteils für dieses Projekt.",
      awaiting_first_sweep:
        "Wartet auf den ersten wöchentlichen Durchlauf der Zitations-Chancen.",
      no_place_id: "Dieser Mitbewerber hat keinen Google-Business-Eintrag zum Vergleich.",
      not_configured: "Diese Prüfung ist für diesen Arbeitsbereich nicht eingerichtet.",
      cap_reached: "Ihr monatliches Datenbudget ist aufgebraucht, daher wurde dies nicht gekauft.",
      upstream_failed: "Die Datenquelle war nicht erreichbar.",
    },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Agency Opportunity Scanner (/visibility/tools/opportunity-scanner)
   ═══════════════════════════════════════════════════════════════════════════

   THE ONLY TOOL IN THIS CATALOG WHOSE SUBJECT IS NOT THE CUSTOMER. Every other
   copy block here says "your score", "your prompts", "your competitors". This
   one is about strangers, so it says "these sites" and "this prospect" — and
   the difference is not cosmetic. A string that reads "your visibility dropped"
   on a page listing a thousand other companies is simply wrong.

   NO PLAN NUMBERS IN COPY. The monthly batch allowance and the row ceiling both
   interpolate from the API response ({used}, {limit}, {max}), per CLAUDE.md.
   BATCH_LIMITS lives in quota.ts and is the only place those numbers exist.

   THE DOLLAR ESTIMATE IS ALWAYS SHOWN BEFORE THE SUBMIT BUTTON, never after,
   and it is the only place in the dashboard where a customer is quoted a price
   for an action they are about to take. estimatePrefix below is deliberately
   plain about the fact that it is an estimate for an optional extra.
*/

const opportunityScannerEn = {
  lockedTitle: "Opportunity Scanner is on Agency and above",
  lockedBody:
    "Paste a list of prospects and get every one of them graded for AI visibility, worst first, with a white-labeled report you can attach to an email. Upgrade to Agency to switch it on.",
  lockedCta: "See plans",

  emptyTitle: "No scans yet",
  emptyBody:
    "Paste up to {max} prospect domains, or upload a one-column CSV. Each one gets a passive AI-visibility audit — no crawling, nothing submitted — and a grade from A to F.",

  // ── Submit form ──
  submitTitle: "New scan",
  submitLabel: "Prospect domains",
  submitPlaceholder: "acme-dental.com\nnorthside-legal.co.uk\nexample.com",
  submitHelp: "One per line, or comma-separated. A pasted CSV column works too.",
  uploadCta: "Upload CSV",
  submitCta: "Start scan",
  submitting: "Starting…",
  quotaLine: "{used} of {limit} scans used this month",
  quotaExhausted: "You have used all {limit} scans this month.",
  rowCount: "{count} domains ready",
  rowCountOver: "{count} domains — only the first {max} will be scanned",

  // ── Places opt-in ──
  placesLabel: "Also look up each prospect's Google Business listing",
  placesHelp:
    "Adds their star rating and review count to the report. Costs extra and is off by default.",
  estimatePrefix: "This batch uses:",
  estimateFree: "No lookups — this batch is free",
  // Kept for the {locale} parity test and any consumer still reading it. The
  // client no longer renders it: the estimate is counted in lookups now.
  estimateNote: "Charged to your monthly data budget as the scan runs.",
  // COUNTS, NEVER DOLLARS. The customer prepaid in lookups; pricing the batch
  // in dollars would quote them a rate they may not have paid.
  estimateLookups: "{count} lookups from your balance ({remaining} remaining after)",
  balanceChip: "{count} lookups available",
  insufficientBody:
    "This batch needs {needed} lookups and you have {balance}. You can buy more, or run the scan without Google listings — everything else in the report is unaffected.",
  buyLookups: "Buy lookups",
  runWithoutPlaces: "Run without listings",

  // ── Rejections ──
  rejectedTitle: "{count} lines were skipped",
  rejectedShowAll: "Show all",
  rejectedHide: "Hide",
  reasons: {
    duplicate: "Already in this list",
    not_a_domain: "Not a domain",
    not_a_url: "Could not be read",
    bad_scheme: "Not a web address",
    has_credentials: "Contains a username or password",
    bad_port: "Unusual port",
    ip_literal: "IP address, not a domain",
    private_host: "Private or internal address",
    domain_mismatch: "Wrong domain",
    over_limit: "Past the {max}-domain limit",
  },

  // ── Batch list ──
  batchesTitle: "Your scans",
  batchProgress: "{done} of {total}",
  batchRunning: "Scanning…",
  batchComplete: "Complete",
  batchPlaces: "with Google listings",
  openBatch: "Open",

  // ── Results table ──
  colDomain: "Domain",
  colGrade: "Grade",
  colScore: "Score",
  colGaps: "Biggest gaps",
  colGoogle: "Google",
  colActions: "",
  exportCsv: "Export CSV",
  outreachPdf: "Outreach PDF",
  buildingPdf: "Building…",
  /** Shown on a row that has not finished. The PDF button is disabled. */
  rowPending: "Scanning",
  rowFailed: "Could not reach",
  noGoogleListing: "—",
  reviewsSuffix: "reviews",

  // ── Errors ──
  errorLoad: "Could not load your scans. Try again.",
  errorSubmit: "Could not start that scan.",
  errorNoDomains: "No usable domains in that list.",
  errorPdf: "Could not build that report.",

  methodNote:
    "Each prospect gets a passive audit of what their site already publishes — robots.txt, the HTML served to a crawler, structured data, metadata and sitemaps. Nothing is submitted and no page is crawled beyond the homepage. Grades use the same A-F bands as the AI Search Grader, so a prospect who runs the free tool themselves sees the same letter.",
};
export type OpportunityScannerCopy = typeof opportunityScannerEn;

export const OPPORTUNITY_SCANNER_COPY: Record<DashLocale, OpportunityScannerCopy> = {
  en: opportunityScannerEn,
  fr: {
    lockedTitle: "Le scanner d'opportunités est inclus à partir d'Agency",
    lockedBody:
      "Collez une liste de prospects et obtenez pour chacun une note de visibilité IA, les plus faibles en tête, avec un rapport en marque blanche à joindre à un courriel. Passez à Agency pour l'activer.",
    lockedCta: "Voir les forfaits",

    emptyTitle: "Aucune analyse pour l'instant",
    emptyBody:
      "Collez jusqu'à {max} domaines de prospects, ou téléversez un CSV d'une colonne. Chacun reçoit un audit passif de visibilité IA — sans exploration, sans rien soumettre — et une note de A à F.",

    submitTitle: "Nouvelle analyse",
    submitLabel: "Domaines des prospects",
    submitPlaceholder: "cabinet-dentaire.fr\nnotaire-lyon.fr\nexemple.com",
    submitHelp: "Un par ligne, ou séparés par des virgules. Une colonne de CSV collée fonctionne aussi.",
    uploadCta: "Téléverser un CSV",
    submitCta: "Lancer l'analyse",
    submitting: "Lancement…",
    quotaLine: "{used} analyses sur {limit} utilisées ce mois-ci",
    quotaExhausted: "Vous avez utilisé vos {limit} analyses ce mois-ci.",
    rowCount: "{count} domaines prêts",
    rowCountOver: "{count} domaines — seuls les {max} premiers seront analysés",

    placesLabel: "Consulter aussi la fiche Google Business de chaque prospect",
    placesHelp:
      "Ajoute au rapport leur note et leur nombre d'avis. Payant, et désactivé par défaut.",
    estimatePrefix: "Ce lot utilise :",
    estimateFree: "Aucune recherche — ce lot est gratuit",
    estimateNote: "Imputé à votre budget de données mensuel au fil de l'analyse.",
    estimateLookups: "{count} recherches sur votre solde ({remaining} restantes ensuite)",
    balanceChip: "{count} recherches disponibles",
    insufficientBody:
      "Ce lot nécessite {needed} recherches et vous en avez {balance}. Vous pouvez en acheter, ou lancer l'analyse sans les fiches Google — le reste du rapport est inchangé.",
    buyLookups: "Acheter des recherches",
    runWithoutPlaces: "Lancer sans les fiches",

    rejectedTitle: "{count} lignes ont été ignorées",
    rejectedShowAll: "Tout afficher",
    rejectedHide: "Masquer",
    reasons: {
      duplicate: "Déjà dans cette liste",
      not_a_domain: "Pas un domaine",
      not_a_url: "Illisible",
      bad_scheme: "Pas une adresse web",
      has_credentials: "Contient un identifiant ou un mot de passe",
      bad_port: "Port inhabituel",
      ip_literal: "Adresse IP, pas un domaine",
      private_host: "Adresse privée ou interne",
      domain_mismatch: "Mauvais domaine",
      over_limit: "Au-delà de la limite de {max} domaines",
    },

    batchesTitle: "Vos analyses",
    batchProgress: "{done} sur {total}",
    batchRunning: "Analyse en cours…",
    batchComplete: "Terminée",
    batchPlaces: "avec fiches Google",
    openBatch: "Ouvrir",

    colDomain: "Domaine",
    colGrade: "Note",
    colScore: "Score",
    colGaps: "Principales lacunes",
    colGoogle: "Google",
    colActions: "",
    exportCsv: "Exporter en CSV",
    outreachPdf: "Rapport de prospection",
    buildingPdf: "Génération…",
    rowPending: "En cours",
    rowFailed: "Injoignable",
    noGoogleListing: "—",
    reviewsSuffix: "avis",

    errorLoad: "Impossible de charger vos analyses. Réessayez.",
    errorSubmit: "Impossible de lancer cette analyse.",
    errorNoDomains: "Aucun domaine exploitable dans cette liste.",
    errorPdf: "Impossible de générer ce rapport.",

    methodNote:
      "Chaque prospect fait l'objet d'un audit passif de ce que son site publie déjà — robots.txt, le HTML servi à un robot, les données structurées, les métadonnées et les sitemaps. Rien n'est soumis et aucune page n'est explorée au-delà de la page d'accueil. Les notes utilisent les mêmes tranches A-F que l'évaluateur de recherche IA : un prospect qui teste l'outil gratuit lui-même verra la même lettre.",
  },
  "de-CH": {
    lockedTitle: "Der Chancen-Scanner ist ab Agency enthalten",
    lockedBody:
      "Fügen Sie eine Liste von Interessenten ein und erhalten Sie für jeden eine Note zur KI-Sichtbarkeit — die schwächsten zuoberst, mit einem Bericht im eigenen Label zum Anhängen an eine E-Mail. Wechseln Sie zu Agency, um ihn freizuschalten.",
    lockedCta: "Pläne ansehen",

    emptyTitle: "Noch keine Scans",
    emptyBody:
      "Fügen Sie bis zu {max} Interessenten-Domains ein oder laden Sie ein einspaltiges CSV hoch. Jede erhält einen passiven KI-Sichtbarkeits-Audit — ohne Crawling, ohne etwas zu übermitteln — und eine Note von A bis F.",

    submitTitle: "Neuer Scan",
    submitLabel: "Interessenten-Domains",
    submitPlaceholder: "zahnarzt-bern.ch\nanwalt-zuerich.ch\nbeispiel.com",
    submitHelp: "Eine pro Zeile oder kommagetrennt. Eine eingefügte CSV-Spalte funktioniert ebenfalls.",
    uploadCta: "CSV hochladen",
    submitCta: "Scan starten",
    submitting: "Wird gestartet…",
    quotaLine: "{used} von {limit} Scans diesen Monat genutzt",
    quotaExhausted: "Sie haben diesen Monat alle {limit} Scans genutzt.",
    rowCount: "{count} Domains bereit",
    rowCountOver: "{count} Domains — nur die ersten {max} werden geprüft",

    placesLabel: "Auch den Google-Business-Eintrag jedes Interessenten abfragen",
    placesHelp:
      "Ergänzt den Bericht um Bewertung und Anzahl Rezensionen. Kostet zusätzlich und ist standardmässig aus.",
    estimatePrefix: "Dieser Stapel benötigt:",
    estimateFree: "Keine Abfragen — dieser Stapel ist gratis",
    estimateNote: "Wird während des Scans Ihrem monatlichen Datenbudget belastet.",
    estimateLookups: "{count} Abfragen von Ihrem Guthaben ({remaining} danach übrig)",
    balanceChip: "{count} Abfragen verfügbar",
    insufficientBody:
      "Dieser Stapel benötigt {needed} Abfragen und Sie haben {balance}. Sie können weitere kaufen oder den Scan ohne Google-Einträge starten — der Rest des Berichts bleibt unverändert.",
    buyLookups: "Abfragen kaufen",
    runWithoutPlaces: "Ohne Einträge starten",

    rejectedTitle: "{count} Zeilen wurden übersprungen",
    rejectedShowAll: "Alle anzeigen",
    rejectedHide: "Ausblenden",
    reasons: {
      duplicate: "Bereits in dieser Liste",
      not_a_domain: "Keine Domain",
      not_a_url: "Nicht lesbar",
      bad_scheme: "Keine Web-Adresse",
      has_credentials: "Enthält Benutzername oder Passwort",
      bad_port: "Ungewöhnlicher Port",
      ip_literal: "IP-Adresse statt Domain",
      private_host: "Private oder interne Adresse",
      domain_mismatch: "Falsche Domain",
      over_limit: "Über der Grenze von {max} Domains",
    },

    batchesTitle: "Ihre Scans",
    batchProgress: "{done} von {total}",
    batchRunning: "Wird geprüft…",
    batchComplete: "Abgeschlossen",
    batchPlaces: "mit Google-Einträgen",
    openBatch: "Öffnen",

    colDomain: "Domain",
    colGrade: "Note",
    colScore: "Punkte",
    colGaps: "Grösste Lücken",
    colGoogle: "Google",
    colActions: "",
    exportCsv: "CSV exportieren",
    outreachPdf: "Akquise-Bericht",
    buildingPdf: "Wird erstellt…",
    rowPending: "Läuft",
    rowFailed: "Nicht erreichbar",
    noGoogleListing: "—",
    reviewsSuffix: "Rezensionen",

    errorLoad: "Ihre Scans konnten nicht geladen werden. Versuchen Sie es erneut.",
    errorSubmit: "Dieser Scan konnte nicht gestartet werden.",
    errorNoDomains: "Keine brauchbaren Domains in dieser Liste.",
    errorPdf: "Dieser Bericht konnte nicht erstellt werden.",

    methodNote:
      "Jeder Interessent erhält einen passiven Audit dessen, was seine Website bereits veröffentlicht — robots.txt, das an einen Crawler ausgelieferte HTML, strukturierte Daten, Metadaten und Sitemaps. Es wird nichts übermittelt und keine Seite über die Startseite hinaus gecrawlt. Die Noten verwenden dieselben A-F-Stufen wie der KI-Suchbewerter, damit ein Interessent, der das kostenlose Werkzeug selbst nutzt, denselben Buchstaben sieht.",
  },
};

/* ── Opportunity Scanner help modal ──────────────────────────────────────────
   Four steps and two caveats. The caveats are the reason this modal is longer
   than most: this is the one tool that touches sites belonging to people who
   are not customers, and it is the one tool that can spend money per row. An
   agency that does not understand either of those before their first batch will
   find out from an invoice or from a prospect. */
const opportunityScannerHelpEn = {
  button: "Help",
  buttonAria: "How the Opportunity Scanner works",
  title: "How the Opportunity Scanner works",
  close: "Close",

  intro:
    "Paste a list of prospect domains and get every one of them graded for AI visibility, worst first, with a report you can send.",

  listTitle: "Give it a list",
  listBody:
    "One domain per line, or a comma-separated paste, or a one-column CSV — all three are read the same way. Duplicates are removed and anything that is not a public domain is skipped and reported back to you, so you can see exactly what went in.",

  scanTitle: "Each site gets a passive audit",
  scanBody:
    "We read what the site already publishes: robots.txt, the HTML served to a crawler, structured data, metadata and sitemaps. Nothing is submitted and no page beyond the homepage is fetched. Four checks per site, and they run in parallel — a large list takes minutes, not hours.",

  gradeTitle: "Read the table worst first",
  gradeBody:
    "Grades run A to F on the same bands as the free AI Search Grader, and the table opens sorted with F at the top. That is the order you want: the sites that score worst are the ones with something to fix, which are the ones worth a call. Sites we could not reach sort to the bottom.",

  reportTitle: "Send the report",
  reportBody:
    "Every finished row has an Outreach PDF: two pages, the grade, and the three biggest gaps with what it takes to fix each one. It carries your branding, not ours — your name, your colours, your logo, right down to the file name and the PDF's own properties. Export the whole table as CSV for a mail merge.",

  googleTitle: "The Google lookup is optional and costs extra",
  googleBody:
    "Ticking the Google box adds each prospect's star rating and review count, and buys one lookup per domain from your monthly data budget. The estimate is shown before you submit. It is off by default and worth leaving off for a list of software companies — most of them have no listing to find.",

  etiquetteTitle: "About scanning other people's sites",
  etiquetteBody:
    "This only reads pages that are already public to any crawler, and it identifies itself honestly while doing it. It is not a crawl, a scrape, or a penetration test. Still, the report is a sales document about someone who has not asked for it — the grade is a technical reading of a website, not a verdict on a business, and the copy is written to say so.",
};
export type OpportunityScannerHelpCopy = typeof opportunityScannerHelpEn;

export const OPPORTUNITY_SCANNER_HELP_COPY: Record<DashLocale, OpportunityScannerHelpCopy> = {
  en: opportunityScannerHelpEn,
  fr: {
    button: "Aide",
    buttonAria: "Comment fonctionne le scanner d'opportunités",
    title: "Comment fonctionne le scanner d'opportunités",
    close: "Fermer",

    intro:
      "Collez une liste de domaines de prospects et obtenez pour chacun une note de visibilité IA, les plus faibles en tête, avec un rapport prêt à envoyer.",

    listTitle: "Donnez-lui une liste",
    listBody:
      "Un domaine par ligne, un collage séparé par des virgules, ou un CSV d'une colonne — les trois sont lus de la même façon. Les doublons sont retirés et tout ce qui n'est pas un domaine public est écarté puis signalé, pour que vous voyiez exactement ce qui est entré.",

    scanTitle: "Chaque site reçoit un audit passif",
    scanBody:
      "Nous lisons ce que le site publie déjà : robots.txt, le HTML servi à un robot, les données structurées, les métadonnées et les sitemaps. Rien n'est soumis et aucune page au-delà de l'accueil n'est récupérée. Quatre vérifications par site, exécutées en parallèle : une longue liste prend des minutes, pas des heures.",

    gradeTitle: "Lisez le tableau en commençant par les pires",
    gradeBody:
      "Les notes vont de A à F, sur les mêmes tranches que l'évaluateur de recherche IA gratuit, et le tableau s'ouvre avec les F en haut. C'est l'ordre utile : les sites les plus faibles sont ceux qui ont quelque chose à corriger, donc ceux qui méritent un appel. Les sites injoignables passent en bas.",

    reportTitle: "Envoyez le rapport",
    reportBody:
      "Chaque ligne terminée dispose d'un rapport de prospection : deux pages, la note, et les trois principales lacunes avec ce qu'il faut pour les corriger. Il porte votre marque, pas la nôtre — votre nom, vos couleurs, votre logo, jusqu'au nom du fichier et aux propriétés du PDF. Exportez tout le tableau en CSV pour un publipostage.",

    googleTitle: "La recherche Google est facultative et payante",
    googleBody:
      "Cocher la case Google ajoute la note et le nombre d'avis de chaque prospect, et achète une recherche par domaine sur votre budget de données mensuel. L'estimation est affichée avant l'envoi. Cette option est désactivée par défaut et vaut la peine de le rester pour une liste d'éditeurs de logiciels : la plupart n'ont aucune fiche.",

    etiquetteTitle: "À propos de l'analyse des sites d'autrui",
    etiquetteBody:
      "L'outil ne lit que des pages déjà publiques pour n'importe quel robot, et il s'identifie honnêtement en le faisant. Ce n'est ni une exploration, ni un moissonnage, ni un test d'intrusion. Reste que le rapport est un document commercial au sujet de quelqu'un qui n'a rien demandé : la note est une lecture technique d'un site web, pas un jugement sur une entreprise, et le texte est rédigé pour le dire.",
  },
  "de-CH": {
    button: "Hilfe",
    buttonAria: "So funktioniert der Chancen-Scanner",
    title: "So funktioniert der Chancen-Scanner",
    close: "Schliessen",

    intro:
      "Fügen Sie eine Liste von Interessenten-Domains ein und erhalten Sie für jede eine Note zur KI-Sichtbarkeit — die schwächsten zuoberst, mit einem versandfertigen Bericht.",

    listTitle: "Geben Sie ihm eine Liste",
    listBody:
      "Eine Domain pro Zeile, kommagetrennt eingefügt oder als einspaltiges CSV — alle drei werden gleich gelesen. Duplikate werden entfernt, und alles, was keine öffentliche Domain ist, wird übersprungen und zurückgemeldet, damit Sie genau sehen, was eingegangen ist.",

    scanTitle: "Jede Website erhält einen passiven Audit",
    scanBody:
      "Wir lesen, was die Website ohnehin veröffentlicht: robots.txt, das an einen Crawler ausgelieferte HTML, strukturierte Daten, Metadaten und Sitemaps. Es wird nichts übermittelt und keine Seite über die Startseite hinaus abgerufen. Vier Prüfungen pro Website, parallel ausgeführt — eine grosse Liste dauert Minuten, nicht Stunden.",

    gradeTitle: "Lesen Sie die Tabelle von unten nach oben",
    gradeBody:
      "Die Noten reichen von A bis F, auf denselben Stufen wie der kostenlose KI-Suchbewerter, und die Tabelle öffnet mit den F zuoberst. Das ist die nützliche Reihenfolge: die schwächsten Websites haben etwas zu beheben und sind damit einen Anruf wert. Nicht erreichbare Websites stehen zuunterst.",

    reportTitle: "Verschicken Sie den Bericht",
    reportBody:
      "Jede fertige Zeile hat einen Akquise-Bericht: zwei Seiten, die Note und die drei grössten Lücken samt dem, was ihre Behebung erfordert. Er trägt Ihre Marke, nicht unsere — Ihren Namen, Ihre Farben, Ihr Logo, bis hin zum Dateinamen und den PDF-Eigenschaften. Exportieren Sie die ganze Tabelle als CSV für einen Serienbrief.",

    googleTitle: "Die Google-Abfrage ist freiwillig und kostet extra",
    googleBody:
      "Das Google-Kästchen ergänzt Bewertung und Anzahl Rezensionen jedes Interessenten und kauft eine Abfrage pro Domain aus Ihrem monatlichen Datenbudget. Die Schätzung erscheint vor dem Absenden. Standardmässig ist die Option aus — und bei einer Liste von Softwarefirmen lohnt es sich, sie aus zu lassen: die meisten haben gar keinen Eintrag.",

    etiquetteTitle: "Zum Prüfen fremder Websites",
    etiquetteBody:
      "Gelesen wird nur, was für jeden Crawler ohnehin öffentlich ist, und der Scanner gibt sich dabei ehrlich zu erkennen. Es ist kein Crawling, kein Scraping und kein Penetrationstest. Dennoch ist der Bericht ein Verkaufsdokument über jemanden, der nicht darum gebeten hat: die Note ist eine technische Lesung einer Website, kein Urteil über ein Unternehmen — und der Text sagt das auch so.",
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   White-Label Audit Funnel — the EMBEDDED WIDGET (/embed/audit)
   ═══════════════════════════════════════════════════════════════════════════

   THE ONLY COPY IN THIS FILE A CUSTOMER OF OURS NEVER READS. It renders inside
   an iframe on an AGENCY's marketing site and is read by THEIR visitors, so it
   speaks to a stranger about their own website and never mentions us, our
   plans, or our dashboard. Every other block here can say "your workspace";
   this one cannot say anything that implies the reader has an account.

   NOT A FOURTH LOCALE MODEL. CLAUDE.md is explicit that writing a fourth
   catalog against DashLocale produces unreachable code, so this reuses the
   dashboard's three and picks between them with dashboardLocale() applied to
   the owning tenant's defaultLanguage — the agency chooses the language its
   visitors read, which is the only party in the exchange who knows it. The
   visitor's own Accept-Language is deliberately NOT consulted: a Swiss agency
   running a German funnel does not want it flipping to English for a visitor
   who happens to be travelling.

   NO BRAND STRING ANYWHERE BELOW, in any locale. The absence is asserted in
   tests/funnel.test.ts, which greps the rendered page. */

const embedAuditEn = {
  heading: "How visible is your website to AI?",
  intro:
    "Assistants like ChatGPT and Perplexity answer questions about businesses every day. See what they can find about yours.",

  domainLabel: "Your website",
  domainPlaceholder: "yourcompany.com",
  emailLabel: "Where should we send the result?",
  emailPlaceholder: "you@yourcompany.com",
  /** The honest reason the address is required, stated before it is asked for. */
  emailNote: "We'll email you the full breakdown.",

  submitIdle: "Check my website",
  submitBusy: "Checking…",

  errDomain: "That doesn't look like a website address.",
  errEmail: "Please enter a valid email address.",
  errLimit: "You've run this a few times today. Try again tomorrow.",
  errAudit: "We couldn't reach that website just now. Your details were saved and we'll follow up.",
  errGeneric: "Something went wrong. Please try again.",

  resultHeading: "{domain} scores {score} out of 100",
  gradeLabel: "Grade",
  gapsHeading: "The biggest things holding it back",
  /** Points recoverable, from the audit. Never a promise about ranking. */
  gapsSuffix: "points",
  noGaps: "Nothing major stood out — a strong result.",
  again: "Check another website",
};
export type EmbedAuditCopy = typeof embedAuditEn;

export const EMBED_AUDIT_COPY: Record<DashLocale, EmbedAuditCopy> = {
  en: embedAuditEn,
  fr: {
    heading: "Quelle est la visibilité de votre site auprès des IA ?",
    intro:
      "Chaque jour, des assistants comme ChatGPT et Perplexity répondent à des questions sur des entreprises. Découvrez ce qu'ils trouvent sur la vôtre.",

    domainLabel: "Votre site web",
    domainPlaceholder: "votreentreprise.com",
    emailLabel: "Où devons-nous envoyer le résultat ?",
    emailPlaceholder: "vous@votreentreprise.com",
    emailNote: "Nous vous enverrons l'analyse complète par courriel.",

    submitIdle: "Analyser mon site",
    submitBusy: "Analyse en cours…",

    errDomain: "Cette adresse de site ne semble pas valide.",
    errEmail: "Veuillez saisir une adresse courriel valide.",
    errLimit: "Vous avez déjà lancé plusieurs analyses aujourd'hui. Réessayez demain.",
    errAudit:
      "Nous n'avons pas pu joindre ce site pour le moment. Vos coordonnées ont été enregistrées et nous reviendrons vers vous.",
    errGeneric: "Une erreur est survenue. Veuillez réessayer.",

    resultHeading: "{domain} obtient {score} sur 100",
    gradeLabel: "Note",
    gapsHeading: "Les principaux freins",
    gapsSuffix: "points",
    noGaps: "Rien de majeur à signaler — un bon résultat.",
    again: "Analyser un autre site",
  },
  "de-CH": {
    heading: "Wie sichtbar ist Ihre Website für KI?",
    intro:
      "Assistenten wie ChatGPT und Perplexity beantworten täglich Fragen zu Unternehmen. Sehen Sie, was sie über Ihres finden.",

    domainLabel: "Ihre Website",
    domainPlaceholder: "ihrunternehmen.ch",
    emailLabel: "Wohin sollen wir das Ergebnis senden?",
    emailPlaceholder: "sie@ihrunternehmen.ch",
    emailNote: "Wir senden Ihnen die vollständige Auswertung per E-Mail.",

    submitIdle: "Website prüfen",
    submitBusy: "Wird geprüft…",

    errDomain: "Das sieht nicht nach einer Website-Adresse aus.",
    errEmail: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    errLimit: "Sie haben das heute schon mehrfach ausgeführt. Versuchen Sie es morgen erneut.",
    errAudit:
      "Wir konnten diese Website gerade nicht erreichen. Ihre Angaben wurden gespeichert und wir melden uns.",
    errGeneric: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",

    resultHeading: "{domain} erreicht {score} von 100",
    gradeLabel: "Note",
    gapsHeading: "Die grössten Bremsen",
    gapsSuffix: "Punkte",
    noGaps: "Nichts Gravierendes aufgefallen — ein starkes Ergebnis.",
    again: "Weitere Website prüfen",
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   White-Label Audit Funnels (tool page: /visibility/tools/funnels)
   ═══════════════════════════════════════════════════════════════════════════

   The agency-facing half. Unlike EMBED_AUDIT_COPY above, this one DOES speak to
   a customer of ours, so it says "your funnels" and "your leads" normally.

   NO PLAN NUMBERS IN COPY, per CLAUDE.md: the monthly audit allowance
   interpolates as {used}/{limit} from the API response, and the only place
   those numbers exist is FUNNEL_AUDIT_LIMITS in src/lib/funnel/quota.ts. */

const funnelsEn = {
  lockedTitle: "Audit Funnels are on Agency and above",
  lockedBody:
    "Put a lead-capturing AI visibility audit on your own site, under your own brand. Visitors enter their website and their email to see a score; you get the lead. Upgrade to Agency to switch it on.",
  lockedCta: "See plans",

  emptyTitle: "No funnels yet",
  emptyBody:
    "Create a funnel, list the sites it may run on, and paste one line of JavaScript. Every visitor who asks for a score leaves you an email address.",

  // ── Config form ──
  createTitle: "New funnel",
  labelLabel: "Name",
  labelHint: "For your list only. Visitors never see it.",
  originsLabel: "Sites it may run on",
  originsHint:
    "One https address per line, e.g. https://acme.com. No wildcards — list each site. A funnel with no sites listed will not run anywhere.",
  notifyLabel: "Email new leads to",
  notifyHint: "Optional. Leads always appear in your notifications regardless.",

  brandingTitle: "Branding",
  brandingHint: "This is all a visitor sees. Leave it blank to inherit your workspace settings.",
  brandNameLabel: "Display name",
  brandLogoLabel: "Logo URL",
  brandLogoHint: "An SVG served over https. We fetch it once and inline it.",
  brandAccentLabel: "Accent colour",

  save: "Save funnel",
  saving: "Saving…",
  create: "Create funnel",
  creating: "Creating…",
  cancel: "Cancel",
  edit: "Edit",
  remove: "Delete",
  removeConfirm: "Delete this funnel and every lead it captured? This cannot be undone.",

  activeLabel: "Active",
  inactiveLabel: "Paused",
  toggleActivate: "Activate",
  togglePause: "Pause",

  // ── Embed snippet ──
  snippetTitle: "Embed code",
  snippetHint:
    "Paste this where the widget should appear. It carries no branding of ours and loads nothing else.",
  snippetCopy: "Copy",
  snippetCopied: "Copied",

  // ── Leads ──
  leadsTitle: "Leads",
  leadsEmpty: "No leads captured yet.",
  colEmail: "Email",
  colDomain: "Website",
  colScore: "Score",
  colCaptured: "Captured",
  noScore: "—",
  noScoreHint: "The audit did not complete, but the email was captured.",
  exportCsv: "Export CSV",
  loadMore: "Show more",
  loading: "Loading…",
  leadCountLabel: "leads",

  // ── Quota ──
  quotaLine: "{used} of {limit} funnel audits used this month",

  // ── Errors ──
  errorLoad: "Could not load your funnels. Try again.",
  errorSave: "Could not save that funnel.",
  errorOrigins: "Every site must be an https address with no wildcards and no path.",
  errorNoOrigins: "List at least one site before activating this funnel.",
  errorDelete: "Could not delete that funnel.",

  methodNote:
    "The widget runs the same passive audit as our own free tool: robots.txt, the HTML served to a crawler, structured data, metadata and sitemaps. Nothing is submitted and no page beyond the homepage is fetched. The visitor's email is required before the score is shown — that is the capture — and it is stored against your workspace only.",
};
export type FunnelsCopy = typeof funnelsEn;

export const FUNNELS_COPY: Record<DashLocale, FunnelsCopy> = {
  en: funnelsEn,
  fr: {
    lockedTitle: "Les formulaires d'audit sont inclus à partir d'Agency",
    lockedBody:
      "Placez sur votre propre site un audit de visibilité IA qui capte des contacts, sous votre marque. Le visiteur saisit son site et son courriel pour voir sa note ; le contact vous revient. Passez à Agency pour l'activer.",
    lockedCta: "Voir les forfaits",

    emptyTitle: "Aucun formulaire pour l'instant",
    emptyBody:
      "Créez un formulaire, indiquez les sites autorisés à l'afficher, puis collez une ligne de JavaScript. Chaque visiteur qui demande sa note vous laisse une adresse courriel.",

    createTitle: "Nouveau formulaire",
    labelLabel: "Nom",
    labelHint: "Pour votre liste uniquement. Les visiteurs ne le voient jamais.",
    originsLabel: "Sites autorisés",
    originsHint:
      "Une adresse https par ligne, par exemple https://acme.com. Pas de joker — indiquez chaque site. Un formulaire sans site listé ne s'affichera nulle part.",
    notifyLabel: "Envoyer les nouveaux contacts à",
    notifyHint: "Facultatif. Les contacts apparaissent de toute façon dans vos notifications.",

    brandingTitle: "Identité visuelle",
    brandingHint:
      "C'est tout ce que voit un visiteur. Laissez vide pour reprendre les réglages de votre espace.",
    brandNameLabel: "Nom affiché",
    brandLogoLabel: "URL du logo",
    brandLogoHint: "Un SVG servi en https. Nous le récupérons une fois et l'intégrons.",
    brandAccentLabel: "Couleur d'accent",

    save: "Enregistrer",
    saving: "Enregistrement…",
    create: "Créer le formulaire",
    creating: "Création…",
    cancel: "Annuler",
    edit: "Modifier",
    remove: "Supprimer",
    removeConfirm:
      "Supprimer ce formulaire et tous les contacts captés ? Cette action est irréversible.",

    activeLabel: "Actif",
    inactiveLabel: "En pause",
    toggleActivate: "Activer",
    togglePause: "Mettre en pause",

    snippetTitle: "Code d'intégration",
    snippetHint:
      "Collez ceci à l'endroit où le widget doit apparaître. Il ne porte aucune de nos marques et ne charge rien d'autre.",
    snippetCopy: "Copier",
    snippetCopied: "Copié",

    leadsTitle: "Contacts",
    leadsEmpty: "Aucun contact capté pour l'instant.",
    colEmail: "Courriel",
    colDomain: "Site web",
    colScore: "Note",
    colCaptured: "Capté le",
    noScore: "—",
    noScoreHint: "L'audit n'a pas abouti, mais le courriel a bien été capté.",
    exportCsv: "Exporter en CSV",
    loadMore: "Afficher plus",
    loading: "Chargement…",
    leadCountLabel: "contacts",

    quotaLine: "{used} audits sur {limit} utilisés ce mois-ci",

    errorLoad: "Impossible de charger vos formulaires. Réessayez.",
    errorSave: "Impossible d'enregistrer ce formulaire.",
    errorOrigins:
      "Chaque site doit être une adresse https, sans joker et sans chemin.",
    errorNoOrigins: "Indiquez au moins un site avant d'activer ce formulaire.",
    errorDelete: "Impossible de supprimer ce formulaire.",

    methodNote:
      "Le widget exécute le même audit passif que notre outil gratuit : robots.txt, le HTML servi à un robot, les données structurées, les métadonnées et les sitemaps. Rien n'est soumis et aucune page au-delà de la page d'accueil n'est récupérée. Le courriel du visiteur est exigé avant l'affichage de la note — c'est là que se fait la captation — et il n'est enregistré que dans votre espace.",
  },
  "de-CH": {
    lockedTitle: "Audit-Funnels sind ab Agency enthalten",
    lockedBody:
      "Stellen Sie einen KI-Sichtbarkeits-Audit mit Kontakterfassung auf Ihre eigene Website, unter Ihrer Marke. Besucher geben ihre Website und ihre E-Mail-Adresse ein, um eine Note zu sehen; der Kontakt gehört Ihnen. Wechseln Sie zu Agency, um das freizuschalten.",
    lockedCta: "Pläne ansehen",

    emptyTitle: "Noch keine Funnels",
    emptyBody:
      "Legen Sie einen Funnel an, tragen Sie die erlaubten Websites ein und fügen Sie eine Zeile JavaScript ein. Jeder Besucher, der seine Note möchte, hinterlässt Ihnen eine E-Mail-Adresse.",

    createTitle: "Neuer Funnel",
    labelLabel: "Name",
    labelHint: "Nur für Ihre Liste. Besucher sehen ihn nie.",
    originsLabel: "Erlaubte Websites",
    originsHint:
      "Eine https-Adresse pro Zeile, z. B. https://acme.ch. Keine Platzhalter — tragen Sie jede Website einzeln ein. Ein Funnel ohne eingetragene Website läuft nirgends.",
    notifyLabel: "Neue Kontakte senden an",
    notifyHint: "Optional. Kontakte erscheinen ohnehin in Ihren Benachrichtigungen.",

    brandingTitle: "Markenauftritt",
    brandingHint:
      "Mehr sieht ein Besucher nicht. Leer lassen, um die Einstellungen Ihres Arbeitsbereichs zu übernehmen.",
    brandNameLabel: "Anzeigename",
    brandLogoLabel: "Logo-URL",
    brandLogoHint: "Ein SVG über https. Wir holen es einmal und binden es ein.",
    brandAccentLabel: "Akzentfarbe",

    save: "Funnel speichern",
    saving: "Wird gespeichert…",
    create: "Funnel erstellen",
    creating: "Wird erstellt…",
    cancel: "Abbrechen",
    edit: "Bearbeiten",
    remove: "Löschen",
    removeConfirm:
      "Diesen Funnel und alle erfassten Kontakte löschen? Das lässt sich nicht rückgängig machen.",

    activeLabel: "Aktiv",
    inactiveLabel: "Pausiert",
    toggleActivate: "Aktivieren",
    togglePause: "Pausieren",

    snippetTitle: "Einbettungscode",
    snippetHint:
      "Fügen Sie dies dort ein, wo das Widget erscheinen soll. Es trägt keine unserer Marken und lädt nichts weiter.",
    snippetCopy: "Kopieren",
    snippetCopied: "Kopiert",

    leadsTitle: "Kontakte",
    leadsEmpty: "Noch keine Kontakte erfasst.",
    colEmail: "E-Mail",
    colDomain: "Website",
    colScore: "Note",
    colCaptured: "Erfasst am",
    noScore: "—",
    noScoreHint: "Der Audit kam nicht zustande, die E-Mail-Adresse wurde aber erfasst.",
    exportCsv: "CSV exportieren",
    loadMore: "Mehr laden",
    loading: "Wird geladen…",
    leadCountLabel: "Kontakte",

    quotaLine: "{used} von {limit} Funnel-Audits diesen Monat genutzt",

    errorLoad: "Ihre Funnels konnten nicht geladen werden. Versuchen Sie es erneut.",
    errorSave: "Dieser Funnel konnte nicht gespeichert werden.",
    errorOrigins:
      "Jede Website muss eine https-Adresse ohne Platzhalter und ohne Pfad sein.",
    errorNoOrigins: "Tragen Sie mindestens eine Website ein, bevor Sie den Funnel aktivieren.",
    errorDelete: "Dieser Funnel konnte nicht gelöscht werden.",

    methodNote:
      "Das Widget führt denselben passiven Audit aus wie unser kostenloses Werkzeug: robots.txt, das an einen Crawler ausgelieferte HTML, strukturierte Daten, Metadaten und Sitemaps. Es wird nichts übermittelt und keine Seite über die Startseite hinaus abgerufen. Die E-Mail-Adresse des Besuchers ist vor der Anzeige der Note erforderlich — das ist die Erfassung — und sie wird ausschliesslich in Ihrem Arbeitsbereich gespeichert.",
  },
};

// ── AI Revenue Dashboard (/visibility/tools/revenue) ─────────────────────────
//
// THE MODE LABEL IS NOT DECORATION. `modeMeasured` / `modeProxy` sit inline
// beside every figure — not in a footnote, not in a tooltip — because a reader
// who does not know whether a number was counted or inferred has been told
// nothing useful. Both strings are short for that reason: they have to fit
// beside a number without becoming the sentence.
//
// The disclaimer is the homepage ROI calculator's, lifted to
// src/lib/revenue/disclaimer.ts and READ here rather than retyped, so the two
// surfaces cannot drift. Only the promise travels; the calculator's hard-coded
// "~35% / 30%" assumptions stay on the homepage, where they are true. This page
// runs on the tenant's own convRate and avgSaleValue.
const revenueEn = {
  title: "AI Revenue",
  subtitle:
    "What being recommended was worth last month, and what the gap to your top rival costs.",

  monthLabel: "Month",
  modelLabel: "Attribution model",
  modelFirst: "First touch",
  modelLast: "Last touch",
  modelLinear: "Linear",
  modelInfluenced: "Influenced",
  modelHintFirst: "Credit to the assistant that first sent this visitor.",
  modelHintLast: "Credit to the assistant that sent them most recently.",
  modelHintLinear: "Credit split evenly across every assistant that touched them.",
  modelHintInfluenced:
    "Full credit to every assistant that touched them, so the breakdown sums to more than the lead count.",

  wonTitle: "Revenue won",
  wonHint: "Leads from AI assistants this month, at your close rate and average sale value.",
  lostTitle: "Lost to rivals, est.",
  lostHint:
    "What the same leads would have been worth at your top rival's share of the answers, minus your own.",

  // The mode label. Rendered next to the number it describes.
  modeMeasured: "measured",
  modeProxy: "estimated from visits",
  modeProxyHint:
    "We can see who arrives from an AI assistant, not what they buy. Leads here are distinct AI-referred visitors — the count becomes measured conversions once conversion tracking is on.",
  modeMeasuredHint: "Counted AI-source conversions, not inferred from visits.",
  alsoHasProxyNote:
    "This month also has an earlier visit-based estimate, kept as history. The measured figure is the one shown.",

  leadsLabel: "Leads",
  addressableLabel: "Leads at your rival's share",
  addressableHint:
    "Your leads divided by your share of the answers — what the same visibility gap would be worth if you owned as much of it as they do.",

  bySourceTitle: "By assistant",
  colSource: "Assistant",
  colLeads: "Leads",
  colWon: "Revenue won",

  byEngineTitle: "By engine",
  colEngine: "Engine",
  colYourShare: "Your share",
  colRivalShare: "Top rival",
  colLost: "Lost, est.",
  byEngineHint:
    "Lost revenue is per engine because share of voice is measured per engine. Revenue won is per assistant because that is what the referral tells us. They are different measurements and are not split across each other.",

  assumptionsTitle: "Your assumptions",
  convRateLabel: "Close rate",
  avgSaleValueLabel: "Average sale",
  editAssumptions: "Edit in account settings →",

  staleNote:
    "Your assumptions changed since last night's rollup. Tonight's run will restate this month.",
  liveNote: "Not rolled up yet — computed live from this month's visits.",

  shareAsOf: (date: string) => `Share of voice as of ${date}`,
  noShare: "No share-of-voice snapshot for this month, so the lost estimate is not available.",

  emptyTitle: "Nothing to price yet",
  emptyBody:
    "This page needs two things: the attribution tag live on your site, and a share-of-voice snapshot. Once both are in place, last month's numbers appear here.",
  emptyAttribution: "Set up AI Attribution →",
  emptyShare: "Set up Share of Voice →",

  sourceNames: {
    chatgpt: "ChatGPT",
    perplexity: "Perplexity",
    gemini: "Gemini",
    copilot: "Copilot",
    claude: "Claude",
    dark_ai: "Other AI",
  } as Record<string, string>,

  // Widened: ESTIMATE_DISCLAIMER is `as const`, so without this the inferred
  // RevenueCopy would pin `disclaimer` to the English literal and reject the
  // other two catalogs.
  disclaimer: ESTIMATE_DISCLAIMER.en as string,
};
export type RevenueCopy = typeof revenueEn;

export const REVENUE_COPY: Record<DashLocale, RevenueCopy> = {
  en: revenueEn,
  fr: {
    title: "Revenus IA",
    subtitle:
      "Ce que valait le fait d'être recommandé le mois dernier, et ce que coûte l'écart avec votre principal concurrent.",

    monthLabel: "Mois",
    modelLabel: "Modèle d'attribution",
    modelFirst: "Premier contact",
    modelLast: "Dernier contact",
    modelLinear: "Linéaire",
    modelInfluenced: "Influencé",
    modelHintFirst: "Crédit à l'assistant qui a envoyé ce visiteur en premier.",
    modelHintLast: "Crédit à l'assistant qui l'a envoyé le plus récemment.",
    modelHintLinear: "Crédit réparti également entre tous les assistants concernés.",
    modelHintInfluenced:
      "Crédit entier à chaque assistant concerné : la répartition dépasse donc le nombre de prospects.",

    wonTitle: "Revenus acquis",
    wonHint:
      "Prospects venus d'assistants IA ce mois-ci, à votre taux de conversion et votre valeur moyenne de vente.",
    lostTitle: "Perdu au profit des concurrents, est.",
    lostHint:
      "Ce que les mêmes prospects auraient valu à la part de réponses de votre principal concurrent, moins la vôtre.",

    modeMeasured: "mesuré",
    modeProxy: "estimé d'après les visites",
    modeProxyHint:
      "Nous voyons qui arrive depuis un assistant IA, pas ce qu'il achète. Les prospects comptés ici sont des visiteurs distincts venus d'une IA ; ce comptage deviendra celui des conversions dès que leur suivi sera actif.",
    modeMeasuredHint: "Conversions venues d'une IA réellement comptées, non déduites des visites.",
    alsoHasProxyNote:
      "Ce mois comporte aussi une estimation antérieure fondée sur les visites, conservée comme historique. Le chiffre affiché est le chiffre mesuré.",

    leadsLabel: "Prospects",
    addressableLabel: "Prospects à la part de votre concurrent",
    addressableHint:
      "Vos prospects divisés par votre part des réponses — ce que vaudrait le même écart de visibilité si vous en déteniez autant que lui.",

    bySourceTitle: "Par assistant",
    colSource: "Assistant",
    colLeads: "Prospects",
    colWon: "Revenus acquis",

    byEngineTitle: "Par moteur",
    colEngine: "Moteur",
    colYourShare: "Votre part",
    colRivalShare: "Principal concurrent",
    colLost: "Perdu, est.",
    byEngineHint:
      "Le revenu perdu est calculé par moteur parce que la part de voix se mesure par moteur. Le revenu acquis est calculé par assistant parce que c'est ce que le référencement nous indique. Ce sont deux mesures distinctes, jamais réparties l'une sur l'autre.",

    assumptionsTitle: "Vos hypothèses",
    convRateLabel: "Taux de conversion",
    avgSaleValueLabel: "Vente moyenne",
    editAssumptions: "Modifier dans les paramètres du compte →",

    staleNote:
      "Vos hypothèses ont changé depuis le calcul de la nuit dernière. Le calcul de cette nuit mettra ce mois à jour.",
    liveNote: "Pas encore consolidé — calculé en direct à partir des visites de ce mois.",

    shareAsOf: (date: string) => `Part de voix au ${date}`,
    noShare:
      "Aucun instantané de part de voix pour ce mois : l'estimation des pertes n'est pas disponible.",

    emptyTitle: "Rien à chiffrer pour l'instant",
    emptyBody:
      "Cette page a besoin de deux choses : la balise d'attribution active sur votre site, et un instantané de part de voix. Dès que les deux sont en place, les chiffres du mois dernier apparaissent ici.",
    emptyAttribution: "Configurer l'attribution IA →",
    emptyShare: "Configurer la part de voix →",

    sourceNames: {
      chatgpt: "ChatGPT",
      perplexity: "Perplexity",
      gemini: "Gemini",
      copilot: "Copilot",
      claude: "Claude",
      dark_ai: "Autre IA",
    },

    disclaimer: ESTIMATE_DISCLAIMER.fr,
  },
  "de-CH": {
    title: "KI-Umsatz",
    subtitle:
      "Was es letzten Monat wert war, empfohlen zu werden — und was der Abstand zur stärksten Konkurrenz kostet.",

    monthLabel: "Monat",
    modelLabel: "Attributionsmodell",
    modelFirst: "Erster Kontakt",
    modelLast: "Letzter Kontakt",
    modelLinear: "Linear",
    modelInfluenced: "Beteiligt",
    modelHintFirst: "Gutschrift an den Assistenten, der diese Person zuerst geschickt hat.",
    modelHintLast: "Gutschrift an den Assistenten, der sie zuletzt geschickt hat.",
    modelHintLinear: "Gutschrift gleichmässig auf alle beteiligten Assistenten verteilt.",
    modelHintInfluenced:
      "Volle Gutschrift an jeden beteiligten Assistenten — die Aufschlüsselung übersteigt daher die Zahl der Leads.",

    wonTitle: "Erzielter Umsatz",
    wonHint:
      "Leads aus KI-Assistenten in diesem Monat, zu Ihrer Abschlussquote und Ihrem durchschnittlichen Verkaufswert.",
    lostTitle: "An Konkurrenz verloren, gesch.",
    lostHint:
      "Was dieselben Leads bei der Antwortanteil der stärksten Konkurrenz wert gewesen wären, abzüglich Ihres eigenen.",

    modeMeasured: "gemessen",
    modeProxy: "aus Besuchen geschätzt",
    modeProxyHint:
      "Wir sehen, wer über einen KI-Assistenten kommt, nicht was diese Person kauft. Leads sind hier eindeutige Besucher aus KI-Assistenten; sobald die Conversion-Messung aktiv ist, wird daraus die Zahl gemessener Abschlüsse.",
    modeMeasuredHint: "Tatsächlich gezählte Abschlüsse aus KI-Quellen, nicht aus Besuchen abgeleitet.",
    alsoHasProxyNote:
      "Für diesen Monat gibt es zusätzlich eine frühere, besuchsbasierte Schätzung; sie bleibt als Historie erhalten. Angezeigt wird der gemessene Wert.",

    leadsLabel: "Leads",
    addressableLabel: "Leads beim Anteil der Konkurrenz",
    addressableHint:
      "Ihre Leads geteilt durch Ihren Antwortanteil — was derselbe Sichtbarkeitsabstand wert wäre, wenn Sie so viel davon hielten wie die Konkurrenz.",

    bySourceTitle: "Nach Assistent",
    colSource: "Assistent",
    colLeads: "Leads",
    colWon: "Erzielter Umsatz",

    byEngineTitle: "Nach Engine",
    colEngine: "Engine",
    colYourShare: "Ihr Anteil",
    colRivalShare: "Stärkste Konkurrenz",
    colLost: "Verloren, gesch.",
    byEngineHint:
      "Der verlorene Umsatz wird pro Engine ausgewiesen, weil der Antwortanteil pro Engine gemessen wird. Der erzielte Umsatz wird pro Assistent ausgewiesen, weil die Verweisung genau das sagt. Das sind zwei verschiedene Messungen und werden nie aufeinander verteilt.",

    assumptionsTitle: "Ihre Annahmen",
    convRateLabel: "Abschlussquote",
    avgSaleValueLabel: "Durchschnittlicher Verkauf",
    editAssumptions: "In den Kontoeinstellungen ändern →",

    staleNote:
      "Ihre Annahmen haben sich seit der Auswertung der letzten Nacht geändert. Die Auswertung dieser Nacht schreibt den Monat neu.",
    liveNote: "Noch nicht ausgewertet — live aus den Besuchen dieses Monats berechnet.",

    shareAsOf: (date: string) => `Antwortanteil per ${date}`,
    noShare:
      "Für diesen Monat liegt kein Antwortanteil-Snapshot vor, die Verlustschätzung ist deshalb nicht verfügbar.",

    emptyTitle: "Noch nichts zu beziffern",
    emptyBody:
      "Diese Seite braucht zweierlei: das Attributions-Tag live auf Ihrer Website und einen Antwortanteil-Snapshot. Sobald beides vorliegt, erscheinen hier die Zahlen des letzten Monats.",
    emptyAttribution: "KI-Attribution einrichten →",
    emptyShare: "Antwortanteil einrichten →",

    sourceNames: {
      chatgpt: "ChatGPT",
      perplexity: "Perplexity",
      gemini: "Gemini",
      copilot: "Copilot",
      claude: "Claude",
      dark_ai: "Andere KI",
    },

    disclaimer: ESTIMATE_DISCLAIMER["de-CH"],
  },
};

// ── AI Revenue help modal ────────────────────────────────────────────────────
const revenueHelpEn = {
  button: "How this works",
  buttonAria: "How the AI Revenue page works",
  title: "How AI Revenue works",
  close: "Close",
  intro:
    "Two numbers: what the answers earned you, and what the gap to your top rival is costing. Both are built from your own close rate and average sale value — we can see who arrives from an AI assistant, never what they buy.",
  leadsTitle: "1. Count the leads",
  leadsBody:
    "Every distinct visitor an AI assistant sent you this month. When conversion tracking is on, this becomes counted conversions instead and the label beside each figure changes from “estimated from visits” to “measured”. The two are never mixed in one number.",
  modelTitle: "2. Decide who gets the credit",
  modelBody:
    "A visitor who arrived from Perplexity and came back via ChatGPT is one lead, and four models disagree about which assistant earned it. First and last touch pick one; linear splits it; influenced credits both in full, which is why that breakdown sums to more than the lead count.",
  wonTitle: "3. Price what you won",
  wonBody:
    "Leads × your close rate × your average sale value. Change either assumption in account settings and tonight's rollup restates this month — months already stored keep the numbers they were read with.",
  lostTitle: "4. Price the gap",
  lostBody:
    "Your leads divided by your share of the answers gives what the whole question is worth. The share your top rival holds above yours, applied to that, is what their lead is costing you. A share we cannot measure is floored at 1% rather than dividing by zero.",
  splitTitle: "Why won is per assistant and lost is per engine",
  splitBody:
    "A referral tells us which assistant sent someone. A share-of-voice snapshot tells us how much of an engine's answers you own. Those are different measurements that happen to share some names, so neither number is split across the other's axis.",
};
export type RevenueHelpCopy = typeof revenueHelpEn;

export const REVENUE_HELP_COPY: Record<DashLocale, RevenueHelpCopy> = {
  en: revenueHelpEn,
  fr: {
    button: "Comment ça marche",
    buttonAria: "Fonctionnement de la page Revenus IA",
    title: "Fonctionnement des Revenus IA",
    close: "Fermer",
    intro:
      "Deux chiffres : ce que les réponses vous ont rapporté, et ce que l'écart avec votre principal concurrent vous coûte. Les deux reposent sur votre propre taux de conversion et votre valeur moyenne de vente — nous voyons qui arrive depuis un assistant IA, jamais ce qu'il achète.",
    leadsTitle: "1. Compter les prospects",
    leadsBody:
      "Chaque visiteur distinct qu'un assistant IA vous a envoyé ce mois-ci. Dès que le suivi des conversions est actif, ce sont les conversions comptées qui prennent le relais et la mention à côté de chaque chiffre passe d'« estimé d'après les visites » à « mesuré ». Les deux ne sont jamais mélangés dans un même chiffre.",
    modelTitle: "2. Décider à qui revient le crédit",
    modelBody:
      "Un visiteur arrivé par Perplexity puis revenu par ChatGPT est un seul prospect, et quatre modèles divergent sur l'assistant qui l'a gagné. Premier et dernier contact en choisissent un ; le linéaire partage ; l'influencé crédite les deux en entier, d'où une répartition supérieure au nombre de prospects.",
    wonTitle: "3. Chiffrer ce qui est acquis",
    wonBody:
      "Prospects × votre taux de conversion × votre valeur moyenne de vente. Modifiez l'une de ces hypothèses dans les paramètres du compte et le calcul de cette nuit met le mois à jour — les mois déjà enregistrés conservent les chiffres avec lesquels ils ont été lus.",
    lostTitle: "4. Chiffrer l'écart",
    lostBody:
      "Vos prospects divisés par votre part des réponses donnent ce que vaut l'ensemble de la question. La part que votre principal concurrent détient au-delà de la vôtre, appliquée à ce total, correspond à ce que son avance vous coûte. Une part non mesurable est plafonnée à 1 % plutôt que de diviser par zéro.",
    splitTitle: "Pourquoi l'acquis est par assistant et le perdu par moteur",
    splitBody:
      "Une visite référée indique quel assistant a envoyé la personne. Un instantané de part de voix indique quelle proportion des réponses d'un moteur vous détenez. Ce sont deux mesures distinctes qui partagent quelques noms : aucun des deux chiffres n'est réparti sur l'axe de l'autre.",
  },
  "de-CH": {
    button: "So funktioniert es",
    buttonAria: "Funktionsweise der Seite KI-Umsatz",
    title: "So funktioniert der KI-Umsatz",
    close: "Schliessen",
    intro:
      "Zwei Zahlen: was die Antworten eingebracht haben und was der Abstand zur stärksten Konkurrenz kostet. Beide beruhen auf Ihrer eigenen Abschlussquote und Ihrem durchschnittlichen Verkaufswert — wir sehen, wer über einen KI-Assistenten kommt, nie was diese Person kauft.",
    leadsTitle: "1. Die Leads zählen",
    leadsBody:
      "Jede eindeutige Person, die Ihnen ein KI-Assistent in diesem Monat geschickt hat. Sobald die Conversion-Messung aktiv ist, treten gezählte Abschlüsse an ihre Stelle, und die Angabe neben jeder Zahl wechselt von «aus Besuchen geschätzt» zu «gemessen». Beides wird nie in einer Zahl vermischt.",
    modelTitle: "2. Entscheiden, wem die Gutschrift zusteht",
    modelBody:
      "Eine Person, die über Perplexity kam und über ChatGPT zurückkehrte, ist ein Lead — und vier Modelle sind sich uneinig, welcher Assistent ihn verdient hat. Erster und letzter Kontakt wählen einen aus, linear teilt auf, beteiligt schreibt beiden voll gut; deshalb übersteigt jene Aufschlüsselung die Zahl der Leads.",
    wonTitle: "3. Beziffern, was erzielt wurde",
    wonBody:
      "Leads × Ihre Abschlussquote × Ihr durchschnittlicher Verkaufswert. Ändern Sie eine der Annahmen in den Kontoeinstellungen, schreibt die Auswertung dieser Nacht den Monat neu — bereits gespeicherte Monate behalten die Zahlen, mit denen sie gelesen wurden.",
    lostTitle: "4. Den Abstand beziffern",
    lostBody:
      "Ihre Leads geteilt durch Ihren Antwortanteil ergeben, was die ganze Frage wert ist. Der Anteil, den die stärkste Konkurrenz über Ihrem hält, auf diesen Wert angewendet, ist der Preis ihres Vorsprungs. Ein nicht messbarer Anteil wird auf 1 % begrenzt, statt durch null zu teilen.",
    splitTitle: "Warum Erzieltes pro Assistent und Verlorenes pro Engine gilt",
    splitBody:
      "Eine Verweisung sagt, welcher Assistent jemanden geschickt hat. Ein Antwortanteil-Snapshot sagt, wie viel der Antworten einer Engine Ihnen gehören. Das sind verschiedene Messungen mit teils gleichen Namen — keine der beiden Zahlen wird auf die Achse der anderen verteilt.",
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   AI Action Agent (tool page: /visibility/tools/action-agent)
   ═══════════════════════════════════════════════════════════════════════════

   THE COPY'S ONE JOB IS TO NEVER IMPLY PUBLISHING. Every string below is
   written so that a customer who reads only the buttons still understands that
   nothing reaches their site, their Google listing or their reviewers unless
   they go and paste it there. "Approve" approves a draft; "Mark as applied"
   records that they used it. Neither word is allowed to grow into "publish",
   because the day one of them does, the product has silently promised something
   it does not do.

   THE BUDGET LINE NAMES UTC. The counter is keyed on getUTCMonth (see
   marketingBudgetResetsAt), so a tenant in Zürich gets their allowance back at
   02:00 local and one in Vancouver on what their calendar calls the previous
   day. A bare date would be wrong for roughly half the customer base.

   ONE BUDGET, SAID OUT LOUD. This shares Marketing Studio's monthly allowance,
   and the copy says so rather than letting somebody discover it when a brief
   they were writing is refused because of a draft somebody else generated.
   ═══════════════════════════════════════════════════════════════════════════ */

const actionAgentEn = {
  title: "AI Action Agent",
  subtitle:
    "Drafts the fixes AI search needs, and waits for you. Nothing is published — you review, edit and copy.",

  // ── The standing promise, rendered above the queue on every locale ──
  noPublishBanner:
    "Echorank never publishes anything for you. Every draft here is text you copy out and use yourself.",

  // ── Generate ──
  generateTitle: "Generate a draft",
  generateSchema: "Structured data (JSON-LD)",
  generateSchemaHint: "Reads the page, plus your latest site audit, and writes a schema block.",
  generateFaq: "FAQ content",
  generateFaqHint: "Turns the questions you track across AI engines into answers for this page.",
  generateReviews: "Review replies",
  generateReviewsHint: "Drafts a reply for each review that has none yet.",
  urlLabel: "Page address",
  urlPlaceholder: "https://example.com/services",
  reviewCountLabel: "How many reviews",
  generateCta: "Generate",
  generating: "Generating…",
  queued: "Queued. The draft appears here when it is ready, and you get a notification.",

  // ── Usage ──
  usageTitle: "This month's generation budget",
  usageLine: "{used} of {limit} output tokens used",
  usageUnlimited: "Unmetered on your plan",
  usageResets: "Resets {date} (UTC)",
  usageShared:
    "Shared with Marketing Studio — both draw on the same monthly allowance.",

  // ── Queue ──
  tabDraft: "Needs review",
  tabApproved: "Approved",
  tabApplied: "Applied",
  tabRejected: "Rejected",
  empty: "No drafts yet. Generate one above, or use “Fix with AI” on an audit or a review.",
  emptyFiltered: "Nothing in this tab.",

  kindSchema: "Structured data",
  kindFaq: "FAQ",
  kindReviewReply: "Review reply",

  // ── Row actions ──
  edit: "Edit",
  save: "Save changes",
  cancel: "Cancel",
  approve: "Approve",
  reject: "Reject",
  apply: "Mark as applied",
  applyHint: "Records that you used it. It does not publish anything.",
  regenerate: "Generate a new draft",
  rejectNoteLabel: "Why? (optional)",
  copy: "Copy",
  copied: "Copied",
  download: "Download",

  // ── Row detail ──
  placementTitle: "Where to put it",
  omittedTitle: "Left out, because the page did not say",
  sourcePromptsTitle: "Built to answer",
  reviewOf: "{platform} · {rating}/5 · {author}",
  reviewAnonymous: "Anonymous",
  approvedBy: "Approved {date}",
  rejectedOn: "Rejected {date}",
  appliedOn: "Marked applied {date}",

  // ── Errors ──
  errBudget:
    "You have used this month's generation budget. It resets {date} (UTC), or upgrade for a larger allowance.",
  errLocked: "Marketing Studio and the Action Agent are included from the Starter plan up.",
  errPage: "That page could not be read. Check the address and that it is publicly reachable.",
  errConflict: "Somebody else changed this draft. Refresh to see where it got to.",
  errGeneric: "Something went wrong. Try again.",

  // ── The entry-point button, on /visibility and /monitoring ──
  entryIntro:
    "Want a version you can keep, edit and approve? The Action Agent drafts these into a review queue instead of a one-off panel.",
  entryIntroReviews:
    "Draft a reply to each of these, then read and approve them before you post anything.",
  fixWithAi: "Fix with AI",
  fixWithAiReviews: "Draft replies with AI",
  fixWithAiQueued: "Queued — nothing is published. Review the draft in the Action Agent.",
  openQueue: "Open the Action Agent",

  // ── Locked (below Starter, or no marketing_studio) ──
  lockedTitle: "Included from the Starter plan up",
  lockedBody:
    "The Action Agent drafts structured data, FAQ content and review replies from your own pages and reviews, and waits for you to approve them. It shares Marketing Studio's monthly generation budget.",
  lockedCta: "See plans",
};

export type ActionAgentCopy = typeof actionAgentEn;

export const ACTION_AGENT_COPY: Record<DashLocale, ActionAgentCopy> = {
  en: actionAgentEn,
  fr: {
    title: "Agent d'action IA",
    subtitle:
      "Il rédige les correctifs dont la recherche IA a besoin, puis il vous attend. Rien n'est publié : vous relisez, modifiez et copiez.",

    noPublishBanner:
      "Echorank ne publie jamais rien à votre place. Chaque proposition ci-dessous est un texte que vous copiez et utilisez vous-même.",

    generateTitle: "Rédiger une proposition",
    generateSchema: "Données structurées (JSON-LD)",
    generateSchemaHint:
      "Lit la page, ainsi que votre dernier audit de site, et rédige un bloc de données structurées.",
    generateFaq: "Contenu FAQ",
    generateFaqHint:
      "Transforme les questions que vous suivez sur les moteurs IA en réponses pour cette page.",
    generateReviews: "Réponses aux avis",
    generateReviewsHint: "Rédige une réponse pour chaque avis qui n'en a pas encore.",
    urlLabel: "Adresse de la page",
    urlPlaceholder: "https://exemple.com/services",
    reviewCountLabel: "Combien d'avis",
    generateCta: "Rédiger",
    generating: "Rédaction…",
    queued:
      "En file d'attente. La proposition apparaîtra ici une fois prête, et vous recevrez une notification.",

    usageTitle: "Budget de rédaction du mois",
    usageLine: "{used} jetons de sortie utilisés sur {limit}",
    usageUnlimited: "Sans limite sur votre offre",
    usageResets: "Réinitialisation le {date} (UTC)",
    usageShared:
      "Partagé avec Marketing Studio : les deux puisent dans la même enveloppe mensuelle.",

    tabDraft: "À relire",
    tabApproved: "Approuvées",
    tabApplied: "Appliquées",
    tabRejected: "Refusées",
    empty:
      "Aucune proposition pour l'instant. Rédigez-en une ci-dessus, ou utilisez « Corriger avec l'IA » sur un audit ou un avis.",
    emptyFiltered: "Rien dans cet onglet.",

    kindSchema: "Données structurées",
    kindFaq: "FAQ",
    kindReviewReply: "Réponse à un avis",

    edit: "Modifier",
    save: "Enregistrer",
    cancel: "Annuler",
    approve: "Approuver",
    reject: "Refuser",
    apply: "Marquer comme appliquée",
    applyHint: "Enregistre que vous l'avez utilisée. Cela ne publie rien.",
    regenerate: "Rédiger une nouvelle proposition",
    rejectNoteLabel: "Pourquoi ? (facultatif)",
    copy: "Copier",
    copied: "Copié",
    download: "Télécharger",

    placementTitle: "Où le placer",
    omittedTitle: "Omis, faute d'information sur la page",
    sourcePromptsTitle: "Rédigé pour répondre à",
    reviewOf: "{platform} · {rating}/5 · {author}",
    reviewAnonymous: "Anonyme",
    approvedBy: "Approuvée le {date}",
    rejectedOn: "Refusée le {date}",
    appliedOn: "Marquée appliquée le {date}",

    errBudget:
      "Vous avez épuisé le budget de rédaction du mois. Il se réinitialise le {date} (UTC) ; vous pouvez aussi passer à une offre supérieure.",
    errLocked:
      "Marketing Studio et l'Agent d'action sont inclus à partir de l'offre Starter.",
    errPage:
      "Cette page n'a pas pu être lue. Vérifiez l'adresse et qu'elle est accessible publiquement.",
    errConflict:
      "Quelqu'un d'autre a modifié cette proposition. Actualisez pour voir son état.",
    errGeneric: "Une erreur est survenue. Réessayez.",

    entryIntro:
      "Vous voulez une version que vous pouvez conserver, modifier et approuver ? L'Agent d'action les rédige dans une file de relecture plutôt que dans un panneau éphémère.",
    entryIntroReviews:
      "Rédigez une réponse à chacun de ces avis, puis relisez-les et approuvez-les avant de publier quoi que ce soit.",
    fixWithAi: "Corriger avec l'IA",
    fixWithAiReviews: "Rédiger les réponses avec l'IA",
    fixWithAiQueued:
      "En file d'attente — rien n'est publié. Relisez la proposition dans l'Agent d'action.",
    openQueue: "Ouvrir l'Agent d'action",

    lockedTitle: "Inclus à partir de l'offre Starter",
    lockedBody:
      "L'Agent d'action rédige des données structurées, du contenu FAQ et des réponses aux avis à partir de vos propres pages et avis, puis attend votre approbation. Il partage l'enveloppe mensuelle de rédaction de Marketing Studio.",
    lockedCta: "Voir les offres",
  },
  "de-CH": {
    title: "KI-Aktionsagent",
    subtitle:
      "Er entwirft die Korrekturen, die KI-Suche braucht, und wartet dann auf Sie. Nichts wird veröffentlicht — Sie prüfen, bearbeiten und kopieren.",

    noPublishBanner:
      "Echorank veröffentlicht nie etwas für Sie. Jeder Entwurf hier ist Text, den Sie selbst herauskopieren und einsetzen.",

    generateTitle: "Entwurf erstellen",
    generateSchema: "Strukturierte Daten (JSON-LD)",
    generateSchemaHint:
      "Liest die Seite sowie Ihren letzten Site-Audit und schreibt einen Block mit strukturierten Daten.",
    generateFaq: "FAQ-Inhalt",
    generateFaqHint:
      "Macht aus den Fragen, die Sie über KI-Engines verfolgen, Antworten für diese Seite.",
    generateReviews: "Antworten auf Bewertungen",
    generateReviewsHint: "Entwirft eine Antwort für jede Bewertung, die noch keine hat.",
    urlLabel: "Seitenadresse",
    urlPlaceholder: "https://beispiel.ch/leistungen",
    reviewCountLabel: "Wie viele Bewertungen",
    generateCta: "Erstellen",
    generating: "Wird erstellt…",
    queued:
      "In der Warteschlange. Der Entwurf erscheint hier, sobald er fertig ist, und Sie erhalten eine Benachrichtigung.",

    usageTitle: "Erstellungsbudget dieses Monats",
    usageLine: "{used} von {limit} Ausgabe-Tokens verbraucht",
    usageUnlimited: "In Ihrem Abo ohne Limit",
    usageResets: "Zurückgesetzt am {date} (UTC)",
    usageShared:
      "Geteilt mit Marketing Studio — beide schöpfen aus demselben Monatskontingent.",

    tabDraft: "Zu prüfen",
    tabApproved: "Freigegeben",
    tabApplied: "Angewendet",
    tabRejected: "Abgelehnt",
    empty:
      "Noch keine Entwürfe. Erstellen Sie oben einen, oder nutzen Sie «Mit KI beheben» bei einem Audit oder einer Bewertung.",
    emptyFiltered: "In diesem Reiter ist nichts.",

    kindSchema: "Strukturierte Daten",
    kindFaq: "FAQ",
    kindReviewReply: "Bewertungsantwort",

    edit: "Bearbeiten",
    save: "Änderungen speichern",
    cancel: "Abbrechen",
    approve: "Freigeben",
    reject: "Ablehnen",
    apply: "Als angewendet markieren",
    applyHint: "Hält fest, dass Sie ihn eingesetzt haben. Es wird nichts veröffentlicht.",
    regenerate: "Neuen Entwurf erstellen",
    rejectNoteLabel: "Warum? (optional)",
    copy: "Kopieren",
    copied: "Kopiert",
    download: "Herunterladen",

    placementTitle: "Wohin damit",
    omittedTitle: "Weggelassen, weil die Seite nichts dazu sagt",
    sourcePromptsTitle: "Geschrieben als Antwort auf",
    reviewOf: "{platform} · {rating}/5 · {author}",
    reviewAnonymous: "Anonym",
    approvedBy: "Freigegeben am {date}",
    rejectedOn: "Abgelehnt am {date}",
    appliedOn: "Als angewendet markiert am {date}",

    errBudget:
      "Sie haben das Erstellungsbudget dieses Monats aufgebraucht. Es wird am {date} (UTC) zurückgesetzt; alternativ können Sie das Abo erweitern.",
    errLocked:
      "Marketing Studio und der Aktionsagent sind ab dem Starter-Abo enthalten.",
    errPage:
      "Diese Seite konnte nicht gelesen werden. Prüfen Sie die Adresse und ob sie öffentlich erreichbar ist.",
    errConflict:
      "Jemand anderes hat diesen Entwurf geändert. Laden Sie neu, um den aktuellen Stand zu sehen.",
    errGeneric: "Etwas ist schiefgelaufen. Versuchen Sie es erneut.",

    entryIntro:
      "Möchten Sie eine Fassung, die Sie behalten, bearbeiten und freigeben können? Der Aktionsagent entwirft sie in eine Prüfliste statt in ein einmaliges Panel.",
    entryIntroReviews:
      "Entwerfen Sie zu jeder dieser Bewertungen eine Antwort und geben Sie sie frei, bevor Sie etwas veröffentlichen.",
    fixWithAi: "Mit KI beheben",
    fixWithAiReviews: "Antworten mit KI entwerfen",
    fixWithAiQueued:
      "In der Warteschlange — es wird nichts veröffentlicht. Prüfen Sie den Entwurf im Aktionsagenten.",
    openQueue: "Aktionsagent öffnen",

    lockedTitle: "Ab dem Starter-Abo enthalten",
    lockedBody:
      "Der Aktionsagent entwirft strukturierte Daten, FAQ-Inhalte und Bewertungsantworten aus Ihren eigenen Seiten und Bewertungen und wartet dann auf Ihre Freigabe. Er teilt sich das monatliche Erstellungsbudget mit Marketing Studio.",
    lockedCta: "Abos ansehen",
  },
};
