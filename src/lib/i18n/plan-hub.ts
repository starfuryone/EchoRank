// Copy for the "Your plan" hub (/plan, PLAN-HUB Part 2). en / fr / de-CH,
// the dashboard's three locales (en-CA folds to en, fr-CA to fr).
//
// No string here names a plan or a number: plan names come from PLAN_CONFIGS,
// limits from the configs, the plan that unlocks a locked tool from
// src/lib/upgrade-target.ts. Tool names and descriptions come from the
// existing catalogs (SEO_TOOLS_COPY, AI_HUB_COPY, REPUTATION_COPY); only the
// sidebar destinations that have no catalog entry get a description here.
import type { DashLocale } from "@/lib/i18n/dashboard";
import type { HubGroup, LimitKey } from "@/lib/plan-resources";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";

const NB = CRAWLER_BRAND.name;

export interface PlanHubCopy {
  title: string;
  subtitle: string;
  welcome: (plan: string) => string;
  dismiss: string;
  // Plan & billing
  billingTitle: string;
  planLine: (plan: string) => string;
  perMonth: (amount: string) => string;
  perYear: (amount: string) => string;
  statusTrial: (date: string) => string;
  statusRenewing: (date: string) => string;
  statusCancelling: (date: string) => string;
  statusPastDue: string;
  statusEnded: string;
  manage: string;
  portal: string;
  changePlan: string;
  cancel: string;
  resume: string;
  resumeError: string;
  portalError: string;
  ownerOnly: (name: string | null) => string;
  timelineTitle: string;
  timelineToday: string;
  timelineTrialStarts: string;
  timelineReminder: (date: string) => string;
  timelineCharge: (date: string) => string;
  // Included
  includedTitle: string;
  groups: Record<HubGroup, string>;
  open: string;
  comingSoon: string;
  waitingGoogle: string;
  partner: string;
  meter: Record<LimitKey, string>;
  used: (used: string, limit: string, unit: string) => string;
  limitOnly: (limit: string, unit: string) => string;
  unlimited: (unit: string) => string;
  custom: (unit: string) => string;
  enterpriseContact: (email: string) => string;
  nav: Record<string, string>;
  // Getting started
  startTitle: string;
  stepDone: string;
  // Help
  helpTitle: string;
  helpHub: string;
  howToCancel: string;
  support: string;
  guidesTitle: string;
  aeoCourse: string;
  promptGuides: string;
  // Account
  accountTitle: string;
  account: {
    invite: string;
    inviteNote: string;
    notifications: string;
    language: string;
    gsc: string;
    api: string;
    mcp: string;
    data: string;
  };
  // More with another plan
  moreTitle: string;
  moreLead: string;
  includedIn: (plan: string) => string;
  seePlans: string;
  // Links elsewhere
  yourPlan: string;
  yourPlanCard: string;
}

const groupsEn: Record<HubGroup, string> = {
  ai_visibility: "AI Visibility",
  crawler: `${NB}`,
  seo_tools: "SEO Tools",
  reputation: "Reputation Tools",
  marketing_studio: "Marketing Studio",
  developers: "Developers",
  team_account: "Team & account",
};

export const PLAN_HUB_COPY: Record<DashLocale, PlanHubCopy> = {
  en: {
    title: "Your plan",
    subtitle: "Everything your plan includes, what you have used, and your billing — in one place.",
    welcome: (plan) => `Welcome to ${plan}. Your plan is active.`,
    dismiss: "Dismiss",
    billingTitle: "Plan & billing",
    planLine: (plan) => `${plan} plan`,
    perMonth: (amount) => `${amount} / month`,
    perYear: (amount) => `${amount} / year`,
    statusTrial: (date) => `Trial, first charge on ${date}`,
    statusRenewing: (date) => `Renews on ${date}`,
    statusCancelling: (date) => `Cancelled, access until ${date}`,
    statusPastDue: "Payment issue, update your card",
    statusEnded: "Your plan has ended",
    manage: "Manage subscription",
    portal: "Payment method & invoices",
    changePlan: "Change plan",
    cancel: "Cancel subscription",
    resume: "Resume subscription",
    resumeError: "Could not resume the subscription. Please try again.",
    portalError: "Could not open the billing portal. Please try again.",
    ownerOnly: (name) => (name ? `Only ${name} can change or cancel this subscription.` : "Only the account owner or an admin can change or cancel this subscription."),
    timelineTitle: "Your trial",
    timelineToday: "Today",
    timelineTrialStarts: "Trial starts",
    timelineReminder: (date) => `Reminder email on ${date}`,
    timelineCharge: (date) => `First charge on ${date}`,
    includedTitle: "Included in your plan",
    groups: groupsEn,
    open: "Open",
    comingSoon: "Coming soon",
    waitingGoogle: "Coming soon · waiting on Google",
    partner: "By EchoPilot",
    // "Label: value", so no number ever has to agree with a noun.
    meter: {
      ai_prompts: "Prompts per checkup",
      ai_brands: "Brands tracked",
      seo_searches: "Searches this month",
      tracked_keywords: "Tracked keywords",
      crawl_pages: "Pages crawled this month",
      link_authority: "Checks this month",
      kof_analyses: "Domain analyses this month",
      marketing_tokens: "Output tokens this month",
      feedback_requests: "Feedback requests this month",
      api_requests: "API requests today",
    },
    used: (used, limit, unit) => `${unit}: ${used} / ${limit}`,
    limitOnly: (limit, unit) => `${unit}: ${limit}`,
    unlimited: (unit) => `${unit}: unlimited`,
    custom: (unit) => `${unit}: set in your contract`,
    enterpriseContact: (email) => `Limits "set in your contract" are agreed per contract. Questions about them: ${email}`,
    nav: {
      "/assistant": "Ask questions about your AI visibility data in plain language.",
      "/team": "Invite teammates and choose what each of them can do.",
      "/notifications": "Alerts when something in your workspace needs a look.",
      "/settings": "Your business details, language and time zone.",
      "/billing": "Your subscription, payment method and invoices.",
      "/help": "Guides and answers for every part of Echorank.",
    },
    startTitle: "Get started",
    stepDone: "Done",
    helpTitle: "Help & resources",
    helpHub: "Help hub",
    howToCancel: "How to cancel",
    support: "Write to support",
    guidesTitle: "Guides for your plan",
    aeoCourse: "The AEO course: become the answer",
    promptGuides: "Prompt guides by industry",
    accountTitle: "Account essentials",
    account: {
      invite: "Invite teammates",
      inviteNote: "No per-seat charge",
      notifications: "Notifications",
      language: "Language and time zone",
      gsc: "Connect Google Search Console",
      api: "API keys",
      mcp: "MCP server",
      data: "Export your data, or delete it",
    },
    moreTitle: "More with another plan",
    moreLead: "What other plans add, and the first plan that includes each.",
    includedIn: (plan) => `Included in ${plan}`,
    seePlans: "See plans",
    yourPlan: "Your plan",
    yourPlanCard: "Everything your plan includes, your usage and your billing.",
  },
  fr: {
    title: "Votre forfait",
    subtitle: "Tout ce que comprend votre forfait, ce que vous avez utilisé et votre facturation, au même endroit.",
    welcome: (plan) => `Bienvenue dans le forfait ${plan}. Votre forfait est actif.`,
    dismiss: "Fermer",
    billingTitle: "Forfait et facturation",
    planLine: (plan) => `Forfait ${plan}`,
    perMonth: (amount) => `${amount} / mois`,
    perYear: (amount) => `${amount} / an`,
    statusTrial: (date) => `Essai, premier prélèvement le ${date}`,
    statusRenewing: (date) => `Renouvellement le ${date}`,
    statusCancelling: (date) => `Annulé, accès jusqu'au ${date}`,
    statusPastDue: "Problème de paiement, mettez à jour votre carte",
    statusEnded: "Votre forfait est terminé",
    manage: "Gérer l'abonnement",
    portal: "Moyen de paiement et factures",
    changePlan: "Changer de forfait",
    cancel: "Annuler l'abonnement",
    resume: "Reprendre l'abonnement",
    resumeError: "Impossible de reprendre l'abonnement. Veuillez réessayer.",
    portalError: "Impossible d'ouvrir le portail de facturation. Veuillez réessayer.",
    ownerOnly: (name) => (name ? `${name} est la seule personne à pouvoir modifier ou annuler cet abonnement.` : "Seul le propriétaire du compte ou un administrateur peut modifier ou annuler cet abonnement."),
    timelineTitle: "Votre essai",
    timelineToday: "Aujourd'hui",
    timelineTrialStarts: "Début de l'essai",
    timelineReminder: (date) => `Courriel de rappel le ${date}`,
    timelineCharge: (date) => `Premier prélèvement le ${date}`,
    includedTitle: "Inclus dans votre forfait",
    groups: {
      ai_visibility: "Visibilité IA",
      crawler: `${NB}`,
      seo_tools: "Outils SEO",
      reputation: "Outils de réputation",
      marketing_studio: "Studio marketing",
      developers: "Développeurs",
      team_account: "Équipe et compte",
    },
    open: "Ouvrir",
    comingSoon: "Bientôt disponible",
    waitingGoogle: "Bientôt disponible · en attente de Google",
    partner: "Par EchoPilot",
    meter: {
      ai_prompts: "Requêtes par vérification",
      ai_brands: "Marques suivies",
      seo_searches: "Recherches ce mois-ci",
      tracked_keywords: "Mots-clés suivis",
      crawl_pages: "Pages explorées ce mois-ci",
      link_authority: "Vérifications ce mois-ci",
      kof_analyses: "Analyses de domaine ce mois-ci",
      marketing_tokens: "Jetons générés ce mois-ci",
      feedback_requests: "Demandes de rétroaction ce mois-ci",
      api_requests: "Requêtes API aujourd'hui",
    },
    used: (used, limit, unit) => `${unit} : ${used} / ${limit}`,
    limitOnly: (limit, unit) => `${unit} : ${limit}`,
    unlimited: (unit) => `${unit} : illimité`,
    custom: (unit) => `${unit} : selon votre contrat`,
    enterpriseContact: (email) => `Les limites « selon votre contrat » sont fixées par votre contrat. Pour toute question : ${email}`,
    nav: {
      "/assistant": "Posez vos questions sur vos données de visibilité IA, en langage courant.",
      "/team": "Invitez des membres et choisissez ce que chacun peut faire.",
      "/notifications": "Des alertes quand quelque chose dans votre espace demande votre attention.",
      "/settings": "Les informations de votre entreprise, la langue et le fuseau horaire.",
      "/billing": "Votre abonnement, votre moyen de paiement et vos factures.",
      "/help": "Guides et réponses pour chaque partie d'Echorank.",
    },
    startTitle: "Pour commencer",
    stepDone: "Fait",
    helpTitle: "Aide et ressources",
    helpHub: "Centre d'aide",
    howToCancel: "Comment annuler",
    support: "Écrire au soutien",
    guidesTitle: "Guides pour votre forfait",
    aeoCourse: "Le cours AEO : devenir la réponse",
    promptGuides: "Guides de requêtes par secteur",
    accountTitle: "L'essentiel du compte",
    account: {
      invite: "Inviter des membres",
      inviteNote: "Aucuns frais par siège",
      notifications: "Notifications",
      language: "Langue et fuseau horaire",
      gsc: "Connecter Google Search Console",
      api: "Clés d'API",
      mcp: "Serveur MCP",
      data: "Exporter vos données, ou les supprimer",
    },
    moreTitle: "Plus avec un autre forfait",
    moreLead: "Ce qu'ajoutent les autres forfaits, et le premier forfait qui inclut chaque élément.",
    includedIn: (plan) => `Inclus dans le forfait ${plan}`,
    seePlans: "Voir les forfaits",
    yourPlan: "Votre forfait",
    yourPlanCard: "Tout ce que comprend votre forfait, votre utilisation et votre facturation.",
  },
  "de-CH": {
    title: "Ihr Abo",
    subtitle: "Alles, was Ihr Abo umfasst, was Sie genutzt haben, und Ihre Abrechnung – an einem Ort.",
    welcome: (plan) => `Willkommen bei ${plan}. Ihr Abo ist aktiv.`,
    dismiss: "Schliessen",
    billingTitle: "Abo und Abrechnung",
    planLine: (plan) => `${plan}-Abo`,
    perMonth: (amount) => `${amount} / Monat`,
    perYear: (amount) => `${amount} / Jahr`,
    statusTrial: (date) => `Testphase, erste Belastung am ${date}`,
    statusRenewing: (date) => `Verlängert sich am ${date}`,
    statusCancelling: (date) => `Gekündigt, Zugang bis ${date}`,
    statusPastDue: "Zahlungsproblem, bitte aktualisieren Sie Ihre Karte",
    statusEnded: "Ihr Abo ist beendet",
    manage: "Abo verwalten",
    portal: "Zahlungsmittel und Rechnungen",
    changePlan: "Abo wechseln",
    cancel: "Abo kündigen",
    resume: "Abo fortsetzen",
    resumeError: "Das Abo konnte nicht fortgesetzt werden. Bitte versuchen Sie es erneut.",
    portalError: "Das Abrechnungsportal konnte nicht geöffnet werden. Bitte versuchen Sie es erneut.",
    ownerOnly: (name) => (name ? `Nur ${name} kann dieses Abo ändern oder kündigen.` : "Nur die Kontoinhaberin, der Kontoinhaber oder ein Admin kann dieses Abo ändern oder kündigen."),
    timelineTitle: "Ihre Testphase",
    timelineToday: "Heute",
    timelineTrialStarts: "Testphase beginnt",
    timelineReminder: (date) => `Erinnerungs-E-Mail am ${date}`,
    timelineCharge: (date) => `Erste Belastung am ${date}`,
    includedTitle: "In Ihrem Abo enthalten",
    groups: {
      ai_visibility: "KI-Sichtbarkeit",
      crawler: `${NB}`,
      seo_tools: "SEO-Werkzeuge",
      reputation: "Reputationswerkzeuge",
      marketing_studio: "Marketing Studio",
      developers: "Entwickler",
      team_account: "Team und Konto",
    },
    open: "Öffnen",
    comingSoon: "Demnächst",
    waitingGoogle: "Demnächst · wartet auf Google",
    partner: "Von EchoPilot",
    meter: {
      ai_prompts: "Prompts pro Prüfung",
      ai_brands: "Verfolgte Marken",
      seo_searches: "Suchen diesen Monat",
      tracked_keywords: "Verfolgte Keywords",
      crawl_pages: "Gecrawlte Seiten diesen Monat",
      link_authority: "Prüfungen diesen Monat",
      kof_analyses: "Domain-Analysen diesen Monat",
      marketing_tokens: "Generierte Tokens diesen Monat",
      feedback_requests: "Feedback-Anfragen diesen Monat",
      api_requests: "API-Anfragen heute",
    },
    used: (used, limit, unit) => `${unit}: ${used} / ${limit}`,
    limitOnly: (limit, unit) => `${unit}: ${limit}`,
    unlimited: (unit) => `${unit}: unbegrenzt`,
    custom: (unit) => `${unit}: gemäss Vertrag`,
    enterpriseContact: (email) => `Limits «gemäss Vertrag» sind in Ihrem Vertrag festgelegt. Fragen dazu: ${email}`,
    nav: {
      "/assistant": "Stellen Sie Fragen zu Ihren KI-Sichtbarkeitsdaten in Alltagssprache.",
      "/team": "Laden Sie Teammitglieder ein und legen Sie fest, was alle tun dürfen.",
      "/notifications": "Benachrichtigungen, wenn in Ihrem Arbeitsbereich etwas Aufmerksamkeit braucht.",
      "/settings": "Ihre Firmenangaben, Sprache und Zeitzone.",
      "/billing": "Ihr Abo, Ihr Zahlungsmittel und Ihre Rechnungen.",
      "/help": "Anleitungen und Antworten zu allen Teilen von Echorank.",
    },
    startTitle: "Erste Schritte",
    stepDone: "Erledigt",
    helpTitle: "Hilfe und Ressourcen",
    helpHub: "Hilfe-Center",
    howToCancel: "So kündigen Sie",
    support: "Dem Support schreiben",
    guidesTitle: "Anleitungen für Ihr Abo",
    aeoCourse: "Der AEO-Kurs: Werden Sie die Antwort",
    promptGuides: "Prompt-Leitfäden nach Branche",
    accountTitle: "Das Wichtigste zum Konto",
    account: {
      invite: "Teammitglieder einladen",
      inviteNote: "Keine Kosten pro Platz",
      notifications: "Benachrichtigungen",
      language: "Sprache und Zeitzone",
      gsc: "Google Search Console verbinden",
      api: "API-Schlüssel",
      mcp: "MCP-Server",
      data: "Ihre Daten exportieren oder löschen",
    },
    moreTitle: "Mehr mit einem anderen Abo",
    moreLead: "Was andere Abos hinzufügen, und das erste Abo, das jeweils enthalten ist.",
    includedIn: (plan) => `Im ${plan}-Abo enthalten`,
    seePlans: "Abos ansehen",
    yourPlan: "Ihr Abo",
    yourPlanCard: "Alles, was Ihr Abo umfasst, Ihre Nutzung und Ihre Abrechnung.",
  },
};
