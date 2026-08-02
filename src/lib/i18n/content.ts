// ---------------------------------------------------------------------------
// Homepage message catalog
// ---------------------------------------------------------------------------
// Textual copy is keyed by Locale. Price strings and the tax-disclosure line
// are keyed by (Locale, Currency) because Switzerland/UK reuse a language with
// a different currency (fr+CHF for Romandie, en+GBP for the UK). All numbers
// are stored pre-formatted to the locale's convention (comma/space/apostrophe
// thousands, comma/period decimal) so output is locale-correct by construction.

import type { Locale, Currency } from "./config";

export interface PricingTier {
  key: "starter" | "growth" | "agency" | "enterprise";
  name: string;
  features: string[];
  highlighted?: boolean;
}

export interface HomeContent {
  meta: { title: string; description: string };
  nav: {
    product: string;
    pricing: string;
    customers: string;
    login: string;
    cta: string;
    switcher: Locale[];
  };
  hero: {
    label: string;
    h1a: string;
    h1b: string;
    subhead: string;
    cta1: string;
    cta2: string;
  };
  trust: { used: string; industries: string[] };
  outcomes: { label: string; items: { value: string; label: string }[] };
  platform: {
    label: string;
    h2: string;
    cells: { key: string; tag?: string; title: string; body: string; link?: { href: string; label: string } }[];
  };
  how: { label: string; steps: { num: string; name: string; body: string; link?: { href: string; label: string }; cta?: { href: string; label: string } }[] };
  pricing: { label: string; altLinks?: { href: string; label: string; hideWhenCurrency: Currency }[]; tiers: PricingTier[] };
  field: { label: string; quoteA: string; quoteB: string; attribution: string };
  start: { label: string; h2: string; cta1: string; cta2: string };
  footer: { copyright: string; links: { label: string; href: string }[] };
  /** Chrome for the /resources download modal. Per-resource copy (titles,
   *  descriptions, "PDF · 34 pages") lives with the page, which is en/fr. */
  resourceModal: {
    close: string;
    downloadPdf: string;
    openGuide: string;
    openDirectly: string;
    /** Lead form. */
    emailLabel: string;
    emailPlaceholder: string;
    emailInvalid: string;
    optIn: string;
    privacy: string;
    submit: string;
    submitting: string;
    ready: string;
  };
}

export type TierPrices = Record<PricingTier["key"], string>;

const COPYRIGHT = "© 2026 ECHORANK / CHATLOGIC INSIGHTS LTD";

// ─── en (US / international default) ────────────────────────────────────────
const en: HomeContent = {
  meta: {
    title: "Echorank. AI Reputation Intelligence Platform",
    description:
      "When customers ask AI who to hire, does AI send them to you, or to your competitor? Audit your AI visibility, track answers daily, and act on an explainable reputation risk score.",
  },
  nav: {
    product: "Product",
    pricing: "Pricing",
    customers: "Customers",
    login: "Login",
    cta: "Start free trial",
    switcher: ["en", "fr"],
  },
  hero: {
    label: "/ 01 — AI REPUTATION INTELLIGENCE",
    h1a: "When customers ask AI about your business…",
    h1b: "does AI send them to you, or to your competitor?",
    subhead:
      "Every day, potential customers ask ChatGPT, Perplexity, and Google AI who to hire, where to eat, which contractor to trust, or which company to call. If AI doesn't recommend you, you never even get the chance to compete. Echorank helps you become the business AI recommends, bringing you more qualified leads, protecting your reputation, and uncovering hidden revenue before it's lost.",
    cta1: "Check your AI visibility →",
    cta2: "Start free trial ↗",
  },
  trust: {
    used: "FOR INDEPENDENT BUSINESSES AND THE AGENCIES BEHIND THEM",
    industries: ["HOME SERVICES", "CLINICS & PRACTICES", "HOSPITALITY", "RETAIL", "AGENCIES"],
  },
  outcomes: {
    label: "/ 02 — THE NUMBERS",
    items: [
      { value: "0–100", label: "AI Visibility Score" },
      { value: "DAILY", label: "Answers tracked" },
      { value: "HOURLY", label: "Risk recalculated" },
    ],
  },
  platform: {
    label: "/ 03 — THE PLATFORM",
    h2: "Get recommended more. Get ignored less.",
    cells: [
      {
        key: "visibility",
        title: "Become the business AI recommends",
        body: "Every day AI decides which businesses get mentioned, most owners have no idea if they're recommended or overlooked. Echorank audits every factor behind AI visibility and hands you a step-by-step roadmap into AI answers. Know the day AI starts recommending you, and the moment you disappear.",
        link: { href: "/ai-visibility", label: "More details →" },
      },
      {
        key: "risk",
        title: "Stop losing customers before you know they're leaving",
        body: "Reputation problems grow quietly, one unhappy customer, one unanswered review, one competitor gaining momentum. Echorank connects every signal into one explainable Reputation Risk Score: what's costing you customers, and how much revenue is at risk each month. Prevent instead of react; know where to act first.",
        link: { href: "/reputation-risk", label: "More details →" },
      },
      {
        key: "feedback",
        title: "Turn customer feedback into more sales",
        body: "Every review contains valuable information, most businesses never have time to find it. Echorank reads every review and comment, flags recurring complaints before they become crises, detects suspicious review activity, and drafts responses in your own voice. Happier customers, stronger credibility.",
        link: { href: "/customer-feedback", label: "More details →" },
      },
      {
        key: "engine",
        title: "A reputation that keeps working while you sleep",
        body: "A great reputation isn't luck, it's a system. Echorank automates the heavy lifting: compliant SMS, email and QR campaigns, multi-platform monitoring, white-label tools for agencies, and workflows that keep fresh customer signals flowing. More trust, more referrals, more customers choosing you first.",
        link: { href: "/reputation-engine", label: "More details →" },
      },
      {
        key: "answers",
        title: "Know what AI actually says about you",
        body: "Your key customer questions run against ChatGPT, Perplexity and Google AI every day. See when you're cited, misquoted or missing, with history: a quiet disappearance never goes unnoticed.",
        link: { href: "/ai-visibility", label: "More details →" },
      },
      {
        key: "competitors",
        title: "See competitors gaining ground, early",
        body: "Daily snapshots of rival ratings and review counts. When a competitor's momentum outpaces your own review velocity, you get an alert the same week, not a surprise next quarter.",
        link: { href: "/reputation-risk", label: "More details →" },
      },
    ],
  },
  how: {
    label: "/ 04 — HOW IT WORKS",
    steps: [
      {
        num: "01",
        name: "Connect",
        body: "Link your Google profile, review sources and website. Your first AI-visibility audit and risk baseline land in minutes.",
        link: { href: "/how-to", label: "More details →" },
        cta: { href: "/register", label: "Start free trial →" },
      },
      {
        num: "02",
        name: "Monitor",
        body: "Risk recalculated hourly, AI answers tracked daily, competitor snapshots every morning, every signal in one place.",
        link: { href: "/live-monitoring", label: "More details →" },
        cta: { href: "/register", label: "Start free trial →" },
      },
      {
        num: "03",
        name: "Act",
        body: "Alerts arrive with the cause and the dollar impact. Fix what moves the score, responses already drafted in your voice.",
        link: { href: "/act-on-signals", label: "More details →" },
        cta: { href: "/register", label: "Start free trial →" },
      },
    ],
  },
  pricing: {
    label: "/ 05 — PRICING",
    altLinks: [
    ],
    tiers: [
      {
        key: "starter",
        name: "STARTER",
        features: ["Review campaigns (email, SMS, QR)", "Private feedback & routing", "Multi-source review monitoring", "AI response drafting"],
      },
      {
        key: "growth",
        name: "GROWTH",
        highlighted: true,
        features: ["Everything in Starter", "AI Visibility Auditor + fix roadmap", "Reputation Risk Score & alerts", "Revenue-at-risk"],
      },
      {
        key: "agency",
        name: "AGENCY",
        features: ["Everything in Growth", "AI answer tracking (daily)", "Competitor momentum monitoring", "White-label & multi-client"],
      },
      {
        key: "enterprise",
        name: "ENTERPRISE",
        features: ["Unlimited everything", "Custom volume", "SSO / SAML", "99.9% SLA"],
      },
    ],
  },
  field: {
    label: "/ 06 — THE BOTTOM LINE",
    quoteA:
      "“In the AI era, the companies that grow the fastest won't simply have the best service. They'll be the businesses AI trusts enough to recommend first.”",
    quoteB: "",
    attribution: "THE ECHORANK METHOD",
  },
  start: {
    label: "/ 07 — START",
    h2: "Find out if AI recommends you.",
    cta1: "Check your AI visibility →",
    cta2: "Book a demo ↗",
  },
  resourceModal: {
    close: "Close",
    downloadPdf: "Download PDF",
    openGuide: "Open guide",
    openDirectly: "or open it directly",
    emailLabel: "Email address",
    emailPlaceholder: "you@company.com",
    emailInvalid: "Enter a valid email address.",
    optIn: "Send me occasional Echorank tips. No spam, unsubscribe anytime.",
    privacy: "We use your address to send the guide. Nothing else.",
    submit: "Get the guide",
    submitting: "Sending…",
    ready: "Your guide is ready.",
  },
  footer: {
    copyright: COPYRIGHT,
    links: [
      { label: "RESOURCES", href: "/resources" },
      { label: "GUIDE", href: "/guide" },
      { label: "AI VISIBILITY GUIDE", href: "/guide-visibilite-ia" },
      { label: "PRIVACY", href: "/legal/privacy" },
      { label: "TERMS", href: "/legal/terms" },
      { label: "DISCLAIMER", href: "/legal/disclaimer" },
    ],
  },
};

// ─── en-CA (Canada. English) ───────────────────────────────────────────────
const enCA: HomeContent = {
  meta: {
    title: "Echorank. AI Reputation Intelligence Platform",
    description:
      "When customers ask AI who to hire, does AI send them to you, or to your competitor? Audit your AI visibility, track answers daily, and act on an explainable reputation risk score.",
  },
  nav: {
    product: "Product",
    pricing: "Pricing",
    customers: "Customers",
    login: "Login",
    cta: "Start free trial",
    switcher: ["en-CA", "fr-CA"],
  },
  hero: {
    label: "/ 01 — AI REPUTATION INTELLIGENCE",
    h1a: "When customers ask AI about your business…",
    h1b: "does AI send them to you, or to your competitor?",
    subhead:
      "Every day, potential customers ask ChatGPT, Perplexity, and Google AI who to hire, where to eat, which contractor to trust, or which company to call. If AI doesn't recommend you, you never even get the chance to compete. Echorank helps you become the business AI recommends, bringing you more qualified leads, protecting your reputation, and uncovering hidden revenue before it's lost.",
    cta1: "Check your AI visibility →",
    cta2: "Start free trial ↗",
  },
  trust: {
    used: "FOR INDEPENDENT BUSINESSES AND THE AGENCIES BEHIND THEM",
    industries: ["HOME SERVICES", "CLINICS & PRACTICES", "HOSPITALITY", "RETAIL", "AGENCIES"],
  },
  outcomes: {
    label: "/ 02 — THE NUMBERS",
    items: [
      { value: "0–100", label: "AI Visibility Score" },
      { value: "DAILY", label: "Answers tracked" },
      { value: "HOURLY", label: "Risk recalculated" },
    ],
  },
  platform: {
    label: "/ 03 — THE PLATFORM",
    h2: "Get recommended more. Get ignored less.",
    cells: [
      {
        key: "visibility",
        title: "Become the business AI recommends",
        body: "Every day AI decides which businesses get mentioned, most owners have no idea if they're recommended or overlooked. Echorank audits every factor behind AI visibility and hands you a step-by-step roadmap into AI answers. Know the day AI starts recommending you, and the moment you disappear.",
        link: { href: "/ai-visibility", label: "More details →" },
      },
      {
        key: "risk",
        title: "Stop losing customers before you know they're leaving",
        body: "Reputation problems grow quietly, one unhappy customer, one unanswered review, one competitor gaining momentum. Echorank connects every signal into one explainable Reputation Risk Score: what's costing you customers, and how much revenue is at risk each month. Prevent instead of react; know where to act first.",
        link: { href: "/reputation-risk", label: "More details →" },
      },
      {
        key: "feedback",
        title: "Turn customer feedback into more sales",
        body: "Every review contains valuable information, most businesses never have time to find it. Echorank reads every review and comment, flags recurring complaints before they become crises, detects suspicious review activity, and drafts responses in your own voice. Happier customers, stronger credibility.",
        link: { href: "/customer-feedback", label: "More details →" },
      },
      {
        key: "engine",
        title: "A reputation that keeps working while you sleep",
        body: "A great reputation isn't luck, it's a system. Echorank automates the heavy lifting: compliant SMS, email and QR campaigns, multi-platform monitoring, white-label tools for agencies, and workflows that keep fresh customer signals flowing. More trust, more referrals, more customers choosing you first.",
        link: { href: "/reputation-engine", label: "More details →" },
      },
      {
        key: "answers",
        title: "Know what AI actually says about you",
        body: "Your key customer questions run against ChatGPT, Perplexity and Google AI every day. See when you're cited, misquoted or missing, with history: a quiet disappearance never goes unnoticed.",
        link: { href: "/ai-visibility", label: "More details →" },
      },
      {
        key: "competitors",
        title: "See competitors gaining ground, early",
        body: "Daily snapshots of rival ratings and review counts. When a competitor's momentum outpaces your own review velocity, you get an alert the same week, not a surprise next quarter.",
        link: { href: "/reputation-risk", label: "More details →" },
      },
    ],
  },
  how: {
    label: "/ 04 — HOW IT WORKS",
    steps: [
      {
        num: "01",
        name: "Connect",
        body: "Link your Google profile, review sources and website. Your first AI-visibility audit and risk baseline land in minutes.",
        link: { href: "/how-to", label: "More details →" },
        cta: { href: "/register", label: "Start free trial →" },
      },
      {
        num: "02",
        name: "Monitor",
        body: "Risk recalculated hourly, AI answers tracked daily, competitor snapshots every morning, every signal in one place.",
        link: { href: "/live-monitoring", label: "More details →" },
        cta: { href: "/register", label: "Start free trial →" },
      },
      {
        num: "03",
        name: "Act",
        body: "Alerts arrive with the cause and the dollar impact. Fix what moves the score, responses already drafted in your voice.",
        link: { href: "/act-on-signals", label: "More details →" },
        cta: { href: "/register", label: "Start free trial →" },
      },
    ],
  },
  pricing: {
    label: "/ 05 — PRICING",
    tiers: [
      {
        key: "starter",
        name: "STARTER",
        features: ["Review campaigns (email, SMS, QR)", "Private feedback & routing", "Multi-source review monitoring", "AI response drafting"],
      },
      {
        key: "growth",
        name: "GROWTH",
        highlighted: true,
        features: ["Everything in Starter", "AI Visibility Auditor + fix roadmap", "Reputation Risk Score & alerts", "Revenue-at-risk"],
      },
      {
        key: "agency",
        name: "AGENCY",
        features: ["Everything in Growth", "AI answer tracking (daily)", "Competitor momentum monitoring", "White-label & multi-client"],
      },
      {
        key: "enterprise",
        name: "ENTERPRISE",
        features: ["Unlimited everything", "Custom volume", "SSO / SAML", "99.9% SLA"],
      },
    ],
  },
  field: {
    label: "/ 06 — THE BOTTOM LINE",
    quoteA:
      "“In the AI era, the companies that grow the fastest won't simply have the best service. They'll be the businesses AI trusts enough to recommend first.”",
    quoteB: "",
    attribution: "THE ECHORANK METHOD",
  },
  start: {
    label: "/ 07 — START",
    h2: "Find out if AI recommends you.",
    cta1: "Check your AI visibility →",
    cta2: "Book a demo ↗",
  },
  resourceModal: {
    close: "Close",
    downloadPdf: "Download PDF",
    openGuide: "Open guide",
    openDirectly: "or open it directly",
    emailLabel: "Email address",
    emailPlaceholder: "you@company.com",
    emailInvalid: "Enter a valid email address.",
    optIn: "Send me occasional Echorank tips. No spam, unsubscribe anytime.",
    privacy: "We use your address to send the guide. Nothing else.",
    submit: "Get the guide",
    submitting: "Sending…",
    ready: "Your guide is ready.",
  },
  footer: {
    copyright: COPYRIGHT,
    links: [
      { label: "RESOURCES", href: "/resources" },
      { label: "GUIDE", href: "/guide" },
      { label: "AI VISIBILITY GUIDE", href: "/guide-visibilite-ia" },
      { label: "PRIVACY", href: "/legal/privacy" },
      { label: "TERMS", href: "/legal/terms" },
      { label: "DISCLAIMER", href: "/legal/disclaimer" },
    ],
  },
};

// ─── fr (Europe. EUR; also Swiss-Romandie with CHF) ─────────────────────────
const fr: HomeContent = {
  meta: {
    title: "Echorank. Plateforme d'intelligence de réputation IA",
    description:
      "Quand vos clients interrogent l'IA, vous envoie-t-elle chez vous, ou chez votre concurrent ? Auditez votre visibilité IA, suivez les réponses chaque jour et agissez sur un score de risque explicable.",
  },
  nav: {
    product: "Produit",
    pricing: "Tarifs",
    customers: "Clients",
    login: "Connexion",
    cta: "Essai gratuit",
    switcher: ["fr", "en"],
  },
  hero: {
    label: "/ 01 — INTELLIGENCE DE RÉPUTATION IA",
    h1a: "Quand vos clients interrogent l'IA à votre sujet…",
    h1b: "vous envoie-t-elle chez vous, ou chez votre concurrent ?",
    subhead:
      "Chaque jour, des clients potentiels demandent à ChatGPT, Perplexity et Google AI qui embaucher, où manger, à quel artisan faire confiance ou quelle entreprise appeler. Si l'IA ne vous recommande pas, vous n'avez même pas la chance de concourir. Echorank fait de vous l'entreprise que l'IA recommande, plus de prospects qualifiés, une réputation protégée et des revenus cachés récupérés avant qu'ils ne soient perdus.",
    cta1: "Vérifiez votre visibilité IA →",
    cta2: "Essai gratuit ↗",
  },
  trust: {
    used: "POUR LES ENTREPRISES INDÉPENDANTES ET LES AGENCES QUI LES ACCOMPAGNENT",
    industries: ["ARTISANS & SERVICES", "CLINIQUES & CABINETS", "HÔTELLERIE-RESTAURATION", "COMMERCE", "AGENCES"],
  },
  outcomes: {
    label: "/ 02 — LES CHIFFRES",
    items: [
      { value: "0–100", label: "Score de visibilité IA" },
      { value: "QUOTIDIEN", label: "Réponses IA suivies" },
      { value: "HORAIRE", label: "Risque recalculé" },
    ],
  },
  platform: {
    label: "/ 03 — LA PLATEFORME",
    h2: "Plus recommandé. Moins ignoré.",
    cells: [
      {
        key: "visibility",
        tag: "visibilité",
        title: "Devenez l'entreprise que l'IA recommande",
        body: "Chaque jour, l'IA décide quelles entreprises méritent d'être citées, la plupart des dirigeants n'en savent rien. Echorank audite chaque facteur de votre visibilité IA et vous remet une feuille de route pas à pas vers les réponses générées. Sachez quand l'IA commence à vous recommander, et à l'instant où vous disparaissez.",
        link: { href: "/ai-visibility", label: "Plus de détails →" },
      },
      {
        key: "risk",
        tag: "risque",
        title: "Cessez de perdre des clients sans le savoir",
        body: "Les problèmes de réputation grandissent en silence, un client mécontent, un avis sans réponse, un concurrent qui prend de l'élan. Echorank relie chaque signal en un Score de risque explicable : ce qui vous coûte des clients et combien de chiffre d'affaires est menacé chaque mois. Prévenez au lieu de réagir ; sachez où agir en premier.",
        link: { href: "/reputation-risk", label: "Plus de détails →" },
      },
      {
        key: "feedback",
        tag: "retours",
        title: "Transformez les retours clients en ventes",
        body: "Chaque avis contient une information précieuse, la plupart des entreprises n'ont jamais le temps de la trouver. Echorank lit chaque avis et commentaire, repère les plaintes récurrentes avant la crise, détecte les activités d'avis suspectes et rédige des réponses dans votre ton. Clients plus satisfaits, crédibilité renforcée.",
        link: { href: "/customer-feedback", label: "Plus de détails →" },
      },
      {
        key: "engine",
        tag: "moteur",
        title: "Une réputation qui travaille pendant que vous dormez",
        body: "Une grande réputation n'est pas un hasard : c'est un système. Echorank automatise le gros du travail : campagnes conformes par SMS, e-mail et QR, surveillance multi-plateformes, marque blanche pour agences et flux qui alimentent en continu des signaux clients frais. Plus de confiance, plus de recommandations, plus de clients qui vous choisissent en premier.",
        link: { href: "/reputation-engine", label: "Plus de détails →" },
      },
      {
        key: "answers",
        tag: "réponses IA",
        title: "Sachez ce que l'IA dit vraiment de vous",
        body: "Vos questions clients clés sont testées chaque jour sur ChatGPT, Perplexity et Google AI. Voyez quand vous êtes cité, déformé ou absent, avec historique : une disparition silencieuse ne passe jamais inaperçue.",
        link: { href: "/ai-visibility", label: "Plus de détails →" },
      },
      {
        key: "competitors",
        tag: "concurrents",
        title: "Voyez les concurrents gagner du terrain, tôt",
        body: "Instantanés quotidiens des notes et volumes d'avis de vos concurrents. Quand l'élan d'un rival dépasse votre propre rythme d'avis, vous recevez une alerte la semaine même, pas une surprise au prochain trimestre.",
        link: { href: "/reputation-risk", label: "Plus de détails →" },
      },
    ],
  },
  how: {
    label: "/ 04 — COMMENT ÇA MARCHE",
    steps: [
      {
        num: "01",
        name: "Connectez",
        body: "Reliez votre fiche Google, vos sources d'avis et votre site. Premier audit de visibilité IA et score de risque de référence en quelques minutes.",
        link: { href: "/how-to", label: "Plus de détails →" },
        cta: { href: "/register", label: "Essai gratuit ↗" },
      },
      {
        num: "02",
        name: "Surveillez",
        body: "Risque recalculé chaque heure, réponses IA suivies chaque jour, instantanés concurrents chaque matin, tous les signaux au même endroit.",
        link: { href: "/live-monitoring", label: "Plus de détails →" },
        cta: { href: "/register", label: "Essai gratuit ↗" },
      },
      {
        num: "03",
        name: "Agissez",
        body: "Les alertes arrivent avec la cause et l'impact en euros. Corrigez ce qui fait bouger le score, les réponses sont déjà rédigées dans votre ton.",
        link: { href: "/act-on-signals", label: "Plus de détails →" },
        cta: { href: "/register", label: "Essai gratuit ↗" },
      },
    ],
  },
  pricing: {
    label: "/ 05 — TARIFS",
    altLinks: [
      { href: "/fr?currency=EUR#pricing", label: "Voir les tarifs en euros →", hideWhenCurrency: "EUR" },
    ],
    tiers: [
      {
        key: "starter",
        name: "STARTER",
        features: ["Campagnes d'avis (e-mail, SMS, QR)", "Retours privés & routage", "Surveillance multi-sources", "Réponses rédigées par IA"],
      },
      {
        key: "growth",
        name: "CROISSANCE",
        highlighted: true,
        features: ["Tout Starter inclus", "Audit de visibilité IA + feuille de route", "Score de risque & alertes", "Chiffre d'affaires à risque"],
      },
      {
        key: "agency",
        name: "AGENCE",
        features: ["Tout Croissance inclus", "Suivi quotidien des réponses IA", "Veille concurrentielle", "Marque blanche & multi-clients"],
      },
      {
        key: "enterprise",
        name: "ENTREPRISE",
        features: ["Illimité", "Volume sur mesure", "SSO / SAML", "SLA 99,9 %"],
      },
    ],
  },
  field: {
    label: "/ 06 — L'ESSENTIEL",
    quoteA:
      "« À l'ère de l'IA, les entreprises qui grandiront le plus vite ne seront pas simplement celles qui offrent le meilleur service. Ce seront celles que l'IA juge assez fiables pour les recommander en premier. »",
    quoteB: "",
    attribution: "LA MÉTHODE ECHORANK",
  },
  start: {
    label: "/ 07 — COMMENCER",
    h2: "Découvrez si l'IA vous recommande.",
    cta1: "Vérifiez votre visibilité IA →",
    cta2: "Réserver une démo ↗",
  },
  resourceModal: {
    close: "Fermer",
    downloadPdf: "Télécharger le PDF",
    openGuide: "Ouvrir le guide",
    openDirectly: "ou l'ouvrir directement",
    emailLabel: "Adresse courriel",
    emailPlaceholder: "vous@entreprise.com",
    emailInvalid: "Saisissez une adresse courriel valide.",
    optIn: "Envoyez-moi de temps en temps des conseils Echorank. Aucun pourriel, désabonnement en tout temps.",
    privacy: "Nous utilisons votre adresse pour vous envoyer le guide. Rien d'autre.",
    submit: "Recevoir le guide",
    submitting: "Envoi…",
    ready: "Votre guide est prêt.",
  },
  footer: {
    copyright: COPYRIGHT,
    links: [
      { label: "RESSOURCES", href: "/resources" },
      { label: "GUIDE", href: "/guide" },
      { label: "GUIDE VISIBILITÉ IA", href: "/guide-visibilite-ia" },
      { label: "CONFIDENTIALITÉ", href: "/legal/privacy" },
      { label: "CONDITIONS", href: "/legal/terms" },
      { label: "AVIS LÉGAL", href: "/legal/disclaimer" },
    ],
  },
};

// ─── fr-CA (Quebec), fr with Quebec vocabulary overrides ─────────────────────
const frCA: HomeContent = {
  meta: {
    title: "Echorank. Plateforme d'intelligence de réputation IA",
    description:
      "Quand vos clients interrogent l'IA, vous envoie-t-elle chez vous, ou chez votre concurrent ? Auditez votre visibilité IA, suivez les réponses chaque jour et agissez sur un score de risque explicable.",
  },
  nav: {
    product: "Produit",
    pricing: "Tarifs",
    customers: "Clients",
    login: "Connexion",
    cta: "Essai gratuit",
    switcher: ["fr-CA", "en-CA"],
  },
  hero: {
    label: "/ 01 — INTELLIGENCE DE RÉPUTATION IA",
    h1a: "Quand vos clients interrogent l'IA à propos de votre entreprise…",
    h1b: "est-ce qu'elle les envoie chez vous, ou chez votre concurrent ?",
    subhead:
      "Chaque jour, des clients potentiels demandent à ChatGPT, Perplexity et Google AI qui embaucher, où manger, à quel entrepreneur faire confiance ou quelle entreprise appeler. Si l'IA ne vous recommande pas, vous n'avez même pas la chance de compétitionner. Echorank fait de vous l'entreprise que l'IA recommande, plus de clients potentiels qualifiés, une réputation protégée et des revenus cachés récupérés avant qu'ils soient perdus.",
    cta1: "Vérifiez votre visibilité IA →",
    cta2: "Essai gratuit ↗",
  },
  trust: {
    used: "POUR LES ENTREPRISES INDÉPENDANTES ET LES AGENCES QUI LES ACCOMPAGNENT",
    industries: ["SERVICES À DOMICILE", "CLINIQUES & CABINETS", "RESTAURATION & HÔTELLERIE", "COMMERCE DE DÉTAIL", "AGENCES"],
  },
  outcomes: {
    label: "/ 02 — LES CHIFFRES",
    items: [
      { value: "0–100", label: "Score de visibilité IA" },
      { value: "QUOTIDIEN", label: "Réponses IA suivies" },
      { value: "HORAIRE", label: "Risque recalculé" },
    ],
  },
  platform: {
    label: "/ 03 — LA PLATEFORME",
    h2: "Plus recommandé. Moins ignoré.",
    cells: [
      {
        key: "visibility",
        tag: "visibilité",
        title: "Devenez l'entreprise que l'IA recommande",
        body: "Chaque jour, l'IA décide quelles entreprises méritent d'être mentionnées, la plupart des propriétaires n'en ont aucune idée. Echorank audite chaque facteur de votre visibilité IA et vous remet une feuille de route étape par étape vers les réponses générées. Sachez quand l'IA commence à vous recommander, et à l'instant où vous disparaissez.",
        link: { href: "/ai-visibility", label: "Plus de détails →" },
      },
      {
        key: "risk",
        tag: "risque",
        title: "Arrêtez de perdre des clients sans le savoir",
        body: "Les problèmes de réputation grandissent en silence, un client insatisfait, un avis sans réponse, un concurrent qui prend de l'élan. Echorank relie chaque signal en un Score de risque facile à comprendre : ce qui vous coûte des clients et combien de revenus sont à risque chaque mois. Prévenez au lieu de réagir; sachez où agir en premier.",
        link: { href: "/reputation-risk", label: "Plus de détails →" },
      },
      {
        key: "feedback",
        tag: "rétroaction",
        title: "Transformez les commentaires clients en ventes",
        body: "Chaque avis contient de l'information précieuse, la plupart des entreprises n'ont jamais le temps de la trouver. Echorank lit chaque avis et commentaire, repère les plaintes récurrentes avant la crise, détecte les activités d'avis suspectes et rédige des réponses dans votre ton. Des clients plus satisfaits, une crédibilité renforcée.",
        link: { href: "/customer-feedback", label: "Plus de détails →" },
      },
      {
        key: "engine",
        tag: "moteur",
        title: "Une réputation qui travaille pendant que vous dormez",
        body: "Une bonne réputation, ce n'est pas de la chance : c'est un système. Echorank automatise le gros du travail : campagnes conformes par texto, courriel et code QR, surveillance multiplateforme, marque blanche pour agences et flux qui gardent les signaux clients bien frais. Plus de confiance, plus de références, plus de clients qui vous choisissent en premier.",
        link: { href: "/reputation-engine", label: "Plus de détails →" },
      },
      {
        key: "answers",
        tag: "réponses IA",
        title: "Sachez ce que l'IA dit vraiment de vous",
        body: "Vos questions clients clés sont testées chaque jour sur ChatGPT, Perplexity et Google AI. Voyez quand vous êtes cité, déformé ou absent, avec historique : une disparition silencieuse ne passe jamais inaperçue.",
        link: { href: "/ai-visibility", label: "Plus de détails →" },
      },
      {
        key: "competitors",
        tag: "concurrents",
        title: "Voyez les concurrents gagner du terrain, tôt",
        body: "Instantanés quotidiens des notes et volumes d'avis de vos concurrents. Quand l'élan d'un rival dépasse votre propre rythme d'avis, vous recevez une alerte la semaine même, pas une surprise au prochain trimestre.",
        link: { href: "/reputation-risk", label: "Plus de détails →" },
      },
    ],
  },
  how: {
    label: "/ 04 — COMMENT ÇA FONCTIONNE",
    steps: [
      {
        num: "01",
        name: "Connectez",
        body: "Reliez votre fiche Google, vos sources d'avis et votre site. Premier audit de visibilité IA et score de risque de base en quelques minutes.",
        link: { href: "/how-to", label: "Plus de détails →" },
        cta: { href: "/register", label: "Essai gratuit ↗" },
      },
      {
        num: "02",
        name: "Surveillez",
        body: "Risque recalculé chaque heure, réponses IA suivies chaque jour, instantanés des concurrents chaque matin, tous les signaux au même endroit.",
        link: { href: "/live-monitoring", label: "Plus de détails →" },
        cta: { href: "/register", label: "Essai gratuit ↗" },
      },
      {
        num: "03",
        name: "Agissez",
        body: "Les alertes arrivent avec la cause et l'impact en dollars. Corrigez ce qui fait bouger le score, les réponses sont déjà rédigées dans votre ton.",
        link: { href: "/act-on-signals", label: "Plus de détails →" },
        cta: { href: "/register", label: "Essai gratuit ↗" },
      },
    ],
  },
  pricing: {
    label: "/ 05 — TARIFS",
    altLinks: [
      { href: "/fr#pricing", label: "Voir les tarifs en euros →", hideWhenCurrency: "EUR" },
    ],
    tiers: [
      {
        key: "starter",
        name: "STARTER",
        features: ["Campagnes d'avis (courriel, texto, QR)", "Rétroaction privée & routage", "Surveillance multi-sources", "Réponses rédigées par IA"],
      },
      {
        key: "growth",
        name: "CROISSANCE",
        highlighted: true,
        features: ["Tout Starter inclus", "Audit de visibilité IA + feuille de route", "Score de risque & alertes", "Revenus à risque"],
      },
      {
        key: "agency",
        name: "AGENCE",
        features: ["Tout Croissance inclus", "Suivi quotidien des réponses IA", "Veille concurrentielle", "Marque blanche & multi-clients"],
      },
      {
        key: "enterprise",
        name: "ENTREPRISE",
        features: ["Illimité", "Volume sur mesure", "SSO / SAML", "SLA 99,9 %"],
      },
    ],
  },
  field: {
    label: "/ 06 — L'ESSENTIEL",
    quoteA:
      "« À l'ère de l'IA, les entreprises qui vont grandir le plus vite ne seront pas simplement celles qui offrent le meilleur service. Ce seront celles que l'IA juge assez fiables pour les recommander en premier. »",
    quoteB: "",
    attribution: "LA MÉTHODE ECHORANK",
  },
  start: {
    label: "/ 07 — COMMENCER",
    h2: "Découvrez si l'IA vous recommande.",
    cta1: "Vérifiez votre visibilité IA →",
    cta2: "Réserver une démo ↗",
  },
  resourceModal: {
    close: "Fermer",
    downloadPdf: "Télécharger le PDF",
    openGuide: "Ouvrir le guide",
    openDirectly: "ou l'ouvrir directement",
    emailLabel: "Adresse courriel",
    emailPlaceholder: "vous@entreprise.com",
    emailInvalid: "Saisissez une adresse courriel valide.",
    optIn: "Envoyez-moi de temps en temps des conseils Echorank. Aucun pourriel, désabonnement en tout temps.",
    privacy: "Nous utilisons votre adresse pour vous envoyer le guide. Rien d'autre.",
    submit: "Recevoir le guide",
    submitting: "Envoi…",
    ready: "Votre guide est prêt.",
  },
  footer: {
    copyright: COPYRIGHT,
    links: [
      { label: "RESSOURCES", href: "/resources" },
      { label: "GUIDE", href: "/guide" },
      { label: "GUIDE VISIBILITÉ IA", href: "/guide-visibilite-ia" },
      { label: "CONFIDENTIALITÉ", href: "/legal/privacy" },
      { label: "CONDITIONS", href: "/legal/terms" },
      { label: "AVIS LÉGAL", href: "/legal/disclaimer" },
    ],
  },
};

// ─── de-CH (Switzerland. German) ─────────────────────────────────────────────
const deCH: HomeContent = {
  meta: {
    title: "Echorank. KI-Reputationsintelligenz-Plattform",
    description:
      "Wenn Kunden die KI fragen, schickt sie diese zu Ihnen, oder zur Konkurrenz? Prüfen Sie Ihre KI-Sichtbarkeit, verfolgen Sie Antworten täglich und handeln Sie auf Basis eines erklärbaren Risiko-Scores.",
  },
  nav: {
    product: "Produkt",
    pricing: "Preise",
    customers: "Kunden",
    login: "Anmelden",
    cta: "Kostenlos testen",
    switcher: ["de-CH", "fr", "en"],
  },
  hero: {
    label: "/ 01 — KI-REPUTATIONSINTELLIGENZ",
    h1a: "Wenn Kunden die KI nach Ihrem Geschäft fragen…",
    h1b: "schickt sie diese zu Ihnen, oder zur Konkurrenz?",
    subhead:
      "Jeden Tag fragen potenzielle Kunden ChatGPT, Perplexity und Google AI, wen sie beauftragen, wo sie essen, welchem Handwerker sie vertrauen oder welche Firma sie anrufen sollen. Wenn die KI Sie nicht empfiehlt, bekommen Sie nicht einmal die Chance, mitzubieten. Echorank macht Sie zum Unternehmen, das die KI empfiehlt, mehr qualifizierte Anfragen, eine geschützte Reputation und verborgener Umsatz, der gesichert wird, bevor er verloren geht.",
    cta1: "KI-Sichtbarkeit prüfen →",
    cta2: "Kostenlos testen ↗",
  },
  trust: {
    used: "FÜR UNABHÄNGIGE UNTERNEHMEN UND DIE AGENTUREN DAHINTER",
    industries: ["HANDWERK & SERVICES", "PRAXEN & KLINIKEN", "GASTRONOMIE & HOTELLERIE", "DETAILHANDEL", "AGENTUREN"],
  },
  outcomes: {
    label: "/ 02 — DIE ZAHLEN",
    items: [
      { value: "0–100", label: "KI-Sichtbarkeits-Score" },
      { value: "TÄGLICH", label: "Antworten verfolgt" },
      { value: "STÜNDLICH", label: "Risiko neu berechnet" },
    ],
  },
  platform: {
    label: "/ 03 — DIE PLATTFORM",
    h2: "Öfter empfohlen. Seltener übersehen.",
    cells: [
      {
        key: "visibility",
        tag: "sichtbarkeit",
        title: "Werden Sie das Unternehmen, das die KI empfiehlt",
        body: "Jeden Tag entscheidet die KI, welche Unternehmen erwähnt werden, die meisten Inhaber wissen nicht, ob sie empfohlen oder übersehen werden. Echorank prüft jeden Faktor Ihrer KI-Sichtbarkeit und liefert einen Schritt-für-Schritt-Fahrplan in die KI-Antworten. Sie wissen, wann die KI Sie zu empfehlen beginnt, und sofort, wenn Sie verschwinden.",
        link: { href: "/ai-visibility", label: "Mehr erfahren →" },
      },
      {
        key: "risk",
        tag: "risiko",
        title: "Verlieren Sie keine Kunden mehr, ohne es zu merken",
        body: "Reputationsprobleme wachsen leise, ein unzufriedener Kunde, eine unbeantwortete Bewertung, ein Konkurrent im Aufwind. Echorank verbindet jedes Signal zu einem erklärbaren Risiko-Score: was Sie Kunden kostet und wie viel Umsatz jeden Monat auf dem Spiel steht. Vorbeugen statt reagieren; wissen, wo zuerst zu handeln ist.",
        link: { href: "/reputation-risk", label: "Mehr erfahren →" },
      },
      {
        key: "feedback",
        tag: "feedback",
        title: "Machen Sie aus Kundenfeedback mehr Umsatz",
        body: "Jede Bewertung enthält wertvolle Informationen, den meisten Unternehmen fehlt die Zeit, sie zu finden. Echorank liest jede Bewertung und jeden Kommentar, erkennt wiederkehrende Beschwerden vor der Krise, entdeckt verdächtige Bewertungsaktivitäten und entwirft Antworten in Ihrem Ton. Zufriedenere Kunden, stärkere Glaubwürdigkeit.",
        link: { href: "/customer-feedback", label: "Mehr erfahren →" },
      },
      {
        key: "engine",
        tag: "motor",
        title: "Eine Reputation, die arbeitet, während Sie schlafen",
        body: "Eine starke Reputation ist kein Glück, sondern ein System. Echorank automatisiert die Schwerarbeit: konforme Kampagnen per SMS, E-Mail und QR, Multi-Plattform-Überwachung, White-Label für Agenturen und Abläufe, die laufend frische Kundensignale liefern. Mehr Vertrauen, mehr Empfehlungen, mehr Kunden, die Sie zuerst wählen.",
        link: { href: "/reputation-engine", label: "Mehr erfahren →" },
      },
      {
        key: "answers",
        tag: "ki-antworten",
        title: "Wissen, was die KI wirklich über Sie sagt",
        body: "Ihre wichtigsten Kundenfragen laufen täglich gegen ChatGPT, Perplexity und Google AI. Sehen Sie, wann Sie zitiert, verzerrt oder gar nicht genannt werden, mit Verlauf: ein stilles Verschwinden bleibt nie unbemerkt.",
        link: { href: "/ai-visibility", label: "Mehr erfahren →" },
      },
      {
        key: "competitors",
        tag: "konkurrenz",
        title: "Sehen Sie früh, wenn Konkurrenten aufholen",
        body: "Tägliche Momentaufnahmen der Bewertungen und Bewertungszahlen Ihrer Mitbewerber. Überholt der Schwung eines Konkurrenten Ihr eigenes Bewertungstempo, erhalten Sie noch in derselben Woche einen Alarm, keine Überraschung im nächsten Quartal.",
        link: { href: "/reputation-risk", label: "Mehr erfahren →" },
      },
    ],
  },
  how: {
    label: "/ 04 — SO FUNKTIONIERT ES",
    steps: [
      {
        num: "01",
        name: "Verbinden",
        body: "Google-Profil, Bewertungsquellen und Website verknüpfen. Erster KI-Sichtbarkeits-Audit und Risiko-Basiswert in Minuten.",
        link: { href: "/how-to", label: "Mehr erfahren →" },
        cta: { href: "/register", label: "Kostenlos testen →" },
      },
      {
        num: "02",
        name: "Überwachen",
        body: "Risiko stündlich neu berechnet, KI-Antworten täglich verfolgt, Konkurrenz-Momentaufnahmen jeden Morgen, alle Signale an einem Ort.",
        link: { href: "/live-monitoring", label: "Mehr erfahren →" },
        cta: { href: "/register", label: "Kostenlos testen →" },
      },
      {
        num: "03",
        name: "Handeln",
        body: "Alarme kommen mit Ursache und Umsatzwirkung. Beheben Sie, was den Score bewegt. Antworten liegen bereits in Ihrem Ton bereit.",
        link: { href: "/act-on-signals", label: "Mehr erfahren →" },
        cta: { href: "/register", label: "Kostenlos testen →" },
      },
    ],
  },
  pricing: {
    label: "/ 05 — PREISE",
    tiers: [
      {
        key: "starter",
        name: "STARTER",
        features: ["Bewertungskampagnen (E-Mail, SMS, QR)", "Privates Feedback & Routing", "Multi-Quellen-Überwachung", "KI-Antwortentwürfe"],
      },
      {
        key: "growth",
        name: "WACHSTUM",
        highlighted: true,
        features: ["Alles aus Starter", "KI-Sichtbarkeits-Audit + Fahrplan", "Risiko-Score & Alarme", "Umsatz im Risiko"],
      },
      {
        key: "agency",
        name: "AGENTUR",
        features: ["Alles aus Wachstum", "Tägliches KI-Antwort-Tracking", "Konkurrenz-Monitoring", "White-Label & Mandanten"],
      },
      {
        key: "enterprise",
        name: "ENTERPRISE",
        features: ["Unbegrenzt", "Individuelles Volumen", "SSO / SAML", "99,9 % SLA"],
      },
    ],
  },
  field: {
    label: "/ 06 — DAS FAZIT",
    quoteA:
      "«Im KI-Zeitalter wachsen nicht einfach die Unternehmen mit dem besten Service am schnellsten. Es werden die Unternehmen sein, denen die KI genug vertraut, um sie zuerst zu empfehlen.»",
    quoteB: "",
    attribution: "DIE ECHORANK-METHODE",
  },
  start: {
    label: "/ 07 — LOSLEGEN",
    h2: "Finden Sie heraus, ob die KI Sie empfiehlt.",
    cta1: "KI-Sichtbarkeit prüfen →",
    cta2: "Demo buchen ↗",
  },
  resourceModal: {
    close: "Schliessen",
    downloadPdf: "PDF herunterladen",
    openGuide: "Anleitung öffnen",
    openDirectly: "oder direkt öffnen",
    emailLabel: "E-Mail-Adresse",
    emailPlaceholder: "sie@firma.com",
    emailInvalid: "Geben Sie eine gültige E-Mail-Adresse ein.",
    optIn: "Senden Sie mir gelegentlich Echorank-Tipps. Kein Spam, jederzeit abbestellbar.",
    privacy: "Wir verwenden Ihre Adresse, um Ihnen die Anleitung zu senden. Sonst nichts.",
    submit: "Anleitung erhalten",
    submitting: "Wird gesendet…",
    ready: "Ihre Anleitung ist bereit.",
  },
  footer: {
    copyright: COPYRIGHT,
    links: [
      { label: "RESSOURCEN", href: "/resources" },
      { label: "ANLEITUNG", href: "/guide" },
      { label: "KI-GUIDE (EN)", href: "/guide-visibilite-ia" },
      { label: "DATENSCHUTZ", href: "/legal/privacy" },
      { label: "AGB", href: "/legal/terms" },
      { label: "HAFTUNGSAUSSCHLUSS", href: "/legal/disclaimer" },
    ],
  },
};

export const CONTENT: Record<Locale, HomeContent> = {
  en,
  "en-CA": enCA,
  fr,
  "fr-CA": frCA,
  "de-CH": deCH,
};

// ─── Price strings per (locale, currency) ─────────────────────────────────────
// Each locale supports its default currency plus, where the geo matrix demands,
// an override (en+GBP for the UK, fr+CHF for Swiss-Romandie).
export const PRICE_STRINGS: Record<Locale, Partial<Record<Currency, TierPrices>>> = {
  en: {
    USD: { starter: "$49/mo", growth: "$149/mo", agency: "$349/mo", enterprise: "$999/mo" },
    GBP: { starter: "£49/mo", growth: "£149/mo", agency: "£349/mo", enterprise: "£999/mo" },
    CAD: { starter: "$69 CAD/mo", growth: "$209 CAD/mo", agency: "$479 CAD/mo", enterprise: "$1,379 CAD/mo" },
  },
  "en-CA": {
    CAD: { starter: "$69 CAD/mo", growth: "$209 CAD/mo", agency: "$479 CAD/mo", enterprise: "$1,379 CAD/mo" },
  },
  fr: {
    EUR: { starter: "49 €/mois", growth: "149 €/mois", agency: "349 €/mois", enterprise: "999 €/mois" },
    CHF: { starter: "39 CHF/mois", growth: "119 CHF/mois", agency: "279 CHF/mois", enterprise: "799 CHF/mois" },
    CAD: { starter: "69 $ CAD/mois", growth: "209 $ CAD/mois", agency: "479 $ CAD/mois", enterprise: "1 379 $ CAD/mois" },
  },
  "fr-CA": {
    CAD: { starter: "69 $ CAD/mois", growth: "209 $ CAD/mois", agency: "479 $ CAD/mois", enterprise: "1 379 $ CAD/mois" },
  },
  "de-CH": {
    CHF: { starter: "CHF 39 / Monat", growth: "CHF 119 / Monat", agency: "CHF 279 / Monat", enterprise: "CHF 799 / Monat" },
  },
};

// ─── Tax / trial disclosure per (locale, currency) ────────────────────────────
export const TAX_LINES: Record<Locale, Partial<Record<Currency, string>>> = {
  en: {
    USD: "Try Echorank free for 7 days. Cancel anytime. No card required.",
    GBP: "Try Echorank free for 7 days. Cancel anytime. No card required.",
    CAD: "7-day free trial. No credit card required. Billed in Canadian dollars. GST/HST/PST extra.",
  },
  "en-CA": {
    CAD: "7-day free trial. No credit card required. Billed in Canadian dollars. GST/HST/PST extra.",
  },
  fr: {
    EUR: "Essayez Echorank gratuitement pendant 7 jours. Annulez à tout moment. Aucune carte requise.",
    CHF: "Essai gratuit de 7 jours. Sans carte bancaire. Facturation en francs suisses. TVA 8,1 % en sus.",
    CAD: "Essai gratuit de 7 jours. Sans carte de crédit. Facturation en dollars canadiens. Toutes taxes en sus (TPS/TVQ).",
  },
  "fr-CA": {
    CAD: "Essai gratuit de 7 jours. Sans carte de crédit. Facturation en dollars canadiens. Toutes taxes en sus (TPS/TVQ).",
  },
  "de-CH": {
    CHF: "7 Tage kostenlos testen. Keine Kreditkarte erforderlich. Abrechnung in Schweizer Franken. MwSt. 8,1 % exkl.",
  },
};

// ─── About page ──────────────────────────────────────────────────────────────
// Company story + platform overview for /{locale}/about. Every factual claim
// below restates something already published elsewhere on the site (the
// homepage sections, the pricing table, the legal pages). No metrics, customer
// counts or funding details are asserted — none are documented in this repo.
//
// privacy@echorank360.com is the only contact address of record in the
// codebase (see the legal pages); no general support alias is invented here.

export interface AboutContent {
  meta: { title: string; titleShort: string; description: string };
  h1: string;
  lede: string;
  sections: { h2: string; body: string[] }[];
  contact: { h2: string; body: string; email: string };
  backHome: string;
}

export const ABOUT: Record<Locale, AboutContent> = {
  en: {
    meta: {
      title: "About Echorank360 — AI Visibility Management",
      titleShort: "About",
      description:
        "Echorank360 is an AI Visibility Management platform built by ChatLogic Insights Ltd. Learn what we measure, which AI engines we track, and how to reach us.",
    },
    h1: "About Echorank360",
    lede:
      "Echorank360 is an AI Visibility Management platform built by ChatLogic Insights Ltd. We measure whether AI assistants recommend your business — and show you what to change when they don't.",
    sections: [
      {
        h2: "Why we built it",
        body: [
          "Search engines gave businesses a list of links to compete for. AI assistants give their users a verdict: a short list of names, delivered with the confidence of a recommendation from someone you trust. That shift changed what being findable means. A business can rank respectably on a results page and still never be named when a customer asks an assistant who to hire.",
          "ChatLogic Insights Ltd built Echorank360 to make that new surface measurable. Instead of guessing whether AI mentions you, you get a number, the evidence behind it, and a prioritized list of things to fix.",
        ],
      },
      {
        h2: "What the platform does",
        body: [
          "Echorank360 runs your customers' real questions against the major AI engines and records what comes back — whether you appear, where you place, how you are described, and when you vanish. Those observations roll up into an AI Visibility Score out of 100, supported by five component scores: AI Citation Score, Authority Score, Review Health, Citation Consistency and Competitor Gap.",
          "Underneath sit the signals engines weigh when they decide who to recommend: reviews, website quality, citations, trust, authority, freshness, structured data and brand mentions. The platform also carries the classic reputation stack — review campaigns by email, SMS and QR, private feedback routing, AI-drafted responses and suspicious review detection — because the review platforms you already manage are among the sources AI engines learn from.",
          "Every audit ends in a roadmap rather than a report: prioritized fixes, each with an estimated score lift and an expected level of effort.",
        ],
      },
      {
        h2: "The engines we track",
        body: [
          "We monitor six engines continuously: ChatGPT, Google AI, Perplexity, Claude, Gemini and Microsoft Copilot. Answers are tracked daily and risk is recalculated hourly, so a quiet disappearance from one engine does not go unnoticed for a quarter. Alerts fire the moment your coverage flips.",
        ],
      },
    ],
    contact: {
      h2: "Contact",
      body:
        "Echorank360 is operated by ChatLogic Insights Ltd. For privacy and data-protection requests, including access and deletion, write to us at:",
      email: "privacy@echorank360.com",
    },
    backHome: "← Back to home",
  },

  "en-CA": {
    meta: {
      title: "About Echorank360 — AI Visibility Management",
      titleShort: "About",
      description:
        "Echorank360 is an AI Visibility Management platform built by ChatLogic Insights Ltd. Learn what we measure, which AI engines we track, and how to reach us.",
    },
    h1: "About Echorank360",
    lede:
      "Echorank360 is an AI Visibility Management platform built by ChatLogic Insights Ltd. We measure whether AI assistants recommend your business — and show you what to change when they don't.",
    sections: [
      {
        h2: "Why we built it",
        body: [
          "Search engines gave businesses a list of links to compete for. AI assistants give their users a verdict: a short list of names, delivered with the confidence of a recommendation from someone you trust. That shift changed what being findable means. A business can rank respectably on a results page and still never be named when a customer asks an assistant who to hire.",
          "ChatLogic Insights Ltd built Echorank360 to make that new surface measurable. Instead of guessing whether AI mentions you, you get a number, the evidence behind it, and a prioritized list of things to fix.",
        ],
      },
      {
        h2: "What the platform does",
        body: [
          "Echorank360 runs your customers' real questions against the major AI engines and records what comes back — whether you appear, where you place, how you are described, and when you vanish. Those observations roll up into an AI Visibility Score out of 100, supported by five component scores: AI Citation Score, Authority Score, Review Health, Citation Consistency and Competitor Gap.",
          "Underneath sit the signals engines weigh when they decide who to recommend: reviews, website quality, citations, trust, authority, freshness, structured data and brand mentions. The platform also carries the classic reputation stack — review campaigns by email, SMS and QR, private feedback routing, AI-drafted responses and suspicious review detection — because the review platforms you already manage are among the sources AI engines learn from.",
          "Every audit ends in a roadmap rather than a report: prioritized fixes, each with an estimated score lift and an expected level of effort.",
        ],
      },
      {
        h2: "The engines we track",
        body: [
          "We monitor six engines continuously: ChatGPT, Google AI, Perplexity, Claude, Gemini and Microsoft Copilot. Answers are tracked daily and risk is recalculated hourly, so a quiet disappearance from one engine does not go unnoticed for a quarter. Alerts fire the moment your coverage flips.",
        ],
      },
    ],
    contact: {
      h2: "Contact",
      body:
        "Echorank360 is operated by ChatLogic Insights Ltd. Canadian plans are billed in Canadian dollars. For privacy and data-protection requests, including access and deletion, write to us at:",
      email: "privacy@echorank360.com",
    },
    backHome: "← Back to home",
  },

  fr: {
    meta: {
      title: "À propos d'Echorank360 — Visibilité IA",
      titleShort: "À propos",
      description:
        "Echorank360 est une plateforme de gestion de visibilité IA développée par ChatLogic Insights Ltd. Découvrez ce que nous mesurons, les moteurs IA suivis et comment nous joindre.",
    },
    h1: "À propos d'Echorank360",
    lede:
      "Echorank360 est une plateforme de gestion de visibilité IA développée par ChatLogic Insights Ltd. Nous mesurons si les assistants IA recommandent votre entreprise — et vous montrons quoi changer quand ce n'est pas le cas.",
    sections: [
      {
        h2: "Pourquoi nous l'avons créée",
        body: [
          "Les moteurs de recherche offraient aux entreprises une liste de liens à disputer. Les assistants IA livrent un verdict : une courte liste de noms, énoncée avec l'assurance d'une recommandation venant d'un proche. Ce basculement a changé le sens même d'être trouvable. Une entreprise peut être bien classée sur une page de résultats et n'être jamais nommée quand un client demande à un assistant qui embaucher.",
          "ChatLogic Insights Ltd a créé Echorank360 pour rendre cette nouvelle surface mesurable. Au lieu de deviner si l'IA vous mentionne, vous obtenez un chiffre, les preuves qui le sous-tendent et une liste priorisée de correctifs.",
        ],
      },
      {
        h2: "Ce que fait la plateforme",
        body: [
          "Echorank360 soumet les vraies questions de vos clients aux principaux moteurs IA et consigne ce qui revient : si vous apparaissez, à quelle position, comment vous êtes décrit et à quel moment vous disparaissez. Ces observations se synthétisent en un score de visibilité IA sur 100, appuyé par cinq scores composants : score de citation IA, score d'autorité, santé des avis, cohérence des citations et écart concurrentiel.",
          "En dessous se trouvent les signaux que les moteurs pèsent pour décider qui recommander : avis, qualité du site, citations, confiance, autorité, fraîcheur, données structurées et mentions de marque. La plateforme intègre aussi la gestion de réputation classique — campagnes d'avis par courriel, SMS et QR, routage de la rétroaction privée, réponses rédigées par IA et détection d'avis suspects — parce que les plateformes d'avis que vous gérez déjà comptent parmi les sources dont les moteurs IA apprennent.",
          "Chaque audit se termine par une feuille de route plutôt qu'un rapport : des correctifs priorisés, chacun avec un gain de score estimé et un effort attendu.",
        ],
      },
      {
        h2: "Les moteurs que nous suivons",
        body: [
          "Nous surveillons six moteurs en continu : ChatGPT, Google AI, Perplexity, Claude, Gemini et Microsoft Copilot. Les réponses sont suivies chaque jour et le risque est recalculé chaque heure, afin qu'une disparition silencieuse sur un moteur ne passe pas inaperçue pendant un trimestre. Les alertes se déclenchent dès que votre couverture bascule.",
        ],
      },
    ],
    contact: {
      h2: "Nous joindre",
      body:
        "Echorank360 est exploitée par ChatLogic Insights Ltd. Pour toute demande relative à la vie privée et à la protection des données, y compris l'accès et la suppression, écrivez-nous à :",
      email: "privacy@echorank360.com",
    },
    backHome: "← Retour à l'accueil",
  },

  "fr-CA": {
    meta: {
      title: "À propos d'Echorank360 — Visibilité IA",
      titleShort: "À propos",
      description:
        "Echorank360 est une plateforme de gestion de visibilité IA développée par ChatLogic Insights Ltd. Découvrez ce que nous mesurons, les moteurs IA suivis et comment nous joindre.",
    },
    h1: "À propos d'Echorank360",
    lede:
      "Echorank360 est une plateforme de gestion de visibilité IA développée par ChatLogic Insights Ltd. Nous mesurons si les assistants IA recommandent votre entreprise — et vous montrons quoi changer quand ce n'est pas le cas.",
    sections: [
      {
        h2: "Pourquoi nous l'avons créée",
        body: [
          "Les moteurs de recherche offraient aux entreprises une liste de liens à disputer. Les assistants IA livrent un verdict : une courte liste de noms, énoncée avec l'assurance d'une recommandation venant d'un proche. Ce basculement a changé le sens même d'être trouvable. Une entreprise peut être bien classée dans une page de résultats et n'être jamais nommée quand un client demande à un assistant qui embaucher.",
          "ChatLogic Insights Ltd a créé Echorank360 pour rendre cette nouvelle surface mesurable. Au lieu de deviner si l'IA vous mentionne, vous obtenez un chiffre, les preuves qui le sous-tendent et une liste priorisée de correctifs.",
        ],
      },
      {
        h2: "Ce que fait la plateforme",
        body: [
          "Echorank360 soumet les vraies questions de vos clients aux principaux moteurs IA et consigne ce qui revient : si vous apparaissez, à quel rang, comment vous êtes décrit et à quel moment vous disparaissez. Ces observations se synthétisent en un score de visibilité IA sur 100, appuyé par cinq scores composants : score de citation IA, score d'autorité, santé des avis, cohérence des citations et écart concurrentiel.",
          "En dessous se trouvent les signaux que les moteurs pèsent pour décider qui recommander : avis, qualité du site, citations, confiance, autorité, fraîcheur, données structurées et mentions de marque. La plateforme intègre aussi la gestion de réputation classique — campagnes d'avis par courriel, SMS et code QR, routage de la rétroaction privée, réponses rédigées par IA et détection d'avis suspects — parce que les plateformes d'avis que vous gérez déjà comptent parmi les sources dont les moteurs IA apprennent.",
          "Chaque audit se termine par une feuille de route plutôt qu'un rapport : des correctifs priorisés, chacun avec un gain de score estimé et un effort attendu.",
        ],
      },
      {
        h2: "Les moteurs que nous suivons",
        body: [
          "Nous surveillons six moteurs en continu : ChatGPT, Google AI, Perplexity, Claude, Gemini et Microsoft Copilot. Les réponses sont suivies chaque jour et le risque est recalculé chaque heure, afin qu'une disparition silencieuse sur un moteur ne passe pas inaperçue pendant un trimestre. Les alertes se déclenchent dès que votre couverture bascule.",
        ],
      },
    ],
    contact: {
      h2: "Nous joindre",
      body:
        "Echorank360 est exploitée par ChatLogic Insights Ltd. Les forfaits canadiens sont facturés en dollars canadiens. Pour toute demande relative à la vie privée et à la protection des renseignements personnels, y compris l'accès et la suppression, écrivez-nous à :",
      email: "privacy@echorank360.com",
    },
    backHome: "← Retour à l'accueil",
  },

  "de-CH": {
    meta: {
      title: "Über Echorank360 — KI-Sichtbarkeit",
      titleShort: "Über uns",
      description:
        "Echorank360 ist eine Plattform für KI-Sichtbarkeitsmanagement von ChatLogic Insights Ltd. Erfahren Sie, was wir messen, welche KI-Engines wir verfolgen und wie Sie uns erreichen.",
    },
    h1: "Über Echorank360",
    lede:
      "Echorank360 ist eine Plattform für KI-Sichtbarkeitsmanagement, entwickelt von ChatLogic Insights Ltd. Wir messen, ob KI-Assistenten Ihr Unternehmen empfehlen — und zeigen Ihnen, was zu ändern ist, wenn sie es nicht tun.",
    sections: [
      {
        h2: "Warum wir sie gebaut haben",
        body: [
          "Suchmaschinen boten Unternehmen eine Liste von Links, um die man konkurrieren konnte. KI-Assistenten liefern ein Urteil: eine kurze Liste von Namen, vorgetragen mit der Selbstverständlichkeit einer Empfehlung aus dem Bekanntenkreis. Diese Verschiebung hat verändert, was Auffindbarkeit überhaupt bedeutet. Ein Unternehmen kann auf einer Ergebnisseite ordentlich ranken und trotzdem nie genannt werden, wenn eine Kundin einen Assistenten fragt, wen sie beauftragen soll.",
          "ChatLogic Insights Ltd hat Echorank360 entwickelt, um diese neue Oberfläche messbar zu machen. Statt zu raten, ob die KI Sie erwähnt, erhalten Sie eine Zahl, die Belege dahinter und eine priorisierte Liste von Massnahmen.",
        ],
      },
      {
        h2: "Was die Plattform leistet",
        body: [
          "Echorank360 stellt den grossen KI-Engines die echten Fragen Ihrer Kundinnen und Kunden und protokolliert, was zurückkommt: ob Sie erscheinen, an welcher Stelle, wie Sie beschrieben werden und wann Sie verschwinden. Diese Beobachtungen verdichten sich zu einem KI-Sichtbarkeits-Score von 0 bis 100, gestützt auf fünf Teilscores: KI-Zitations-Score, Autoritäts-Score, Bewertungsgesundheit, Zitationskonsistenz und Wettbewerbsabstand.",
          "Darunter liegen die Signale, die Engines gewichten, wenn sie entscheiden, wen sie empfehlen: Bewertungen, Website-Qualität, Zitationen, Vertrauen, Autorität, Aktualität, strukturierte Daten und Markenerwähnungen. Die Plattform enthält ausserdem das klassische Reputations-Instrumentarium — Bewertungskampagnen per E-Mail, SMS und QR-Code, Weiterleitung privater Rückmeldungen, KI-formulierte Antworten und Erkennung verdächtiger Bewertungen — denn die Bewertungsplattformen, die Sie ohnehin pflegen, gehören zu den Quellen, aus denen KI-Engines lernen.",
          "Jedes Audit endet mit einem Fahrplan statt mit einem Bericht: priorisierte Massnahmen, jeweils mit geschätztem Score-Gewinn und erwartetem Aufwand.",
        ],
      },
      {
        h2: "Die Engines, die wir verfolgen",
        body: [
          "Wir überwachen sechs Engines fortlaufend: ChatGPT, Google AI, Perplexity, Claude, Gemini und Microsoft Copilot. Antworten werden täglich verfolgt und das Risiko wird stündlich neu berechnet, damit ein stilles Verschwinden bei einer Engine nicht ein Quartal lang unbemerkt bleibt. Warnungen werden ausgelöst, sobald Ihre Abdeckung kippt.",
        ],
      },
    ],
    contact: {
      h2: "Kontakt",
      body:
        "Echorank360 wird von ChatLogic Insights Ltd betrieben. Schweizer Abonnements werden in Schweizer Franken abgerechnet. Für Anfragen zum Datenschutz, einschliesslich Auskunft und Löschung, schreiben Sie uns an:",
      email: "privacy@echorank360.com",
    },
    backHome: "← Zurück zur Startseite",
  },
};

// ---------------------------------------------------------------------------
// Demo video (modal on the homepage + /demo page)
// ---------------------------------------------------------------------------

export interface DemoVideoCopy {
  meta: { title: string; description: string };
  h1: string;
  sub: string;
  /** aria-label for the modal dialog */
  dialogLabel: string;
  /** aria-label for the <video> element */
  videoLabel: string;
  ctaPrimary: string;
  ctaSecondary: string;
  endHeadline: string;
  endSub: string;
  replay: string;
  close: string;
  backHome: string;
}

const demoEn: DemoVideoCopy = {
  meta: {
    title: "Watch the 2-Minute Demo",
    description:
      "See how Echorank measures the way ChatGPT, Perplexity, Google AI and other engines see your business — and turns it into a score you can move.",
  },
  h1: "See Echorank in action",
  sub: "Two minutes: how we measure the way AI engines see your business — and how you become the answer.",
  dialogLabel: "Echorank product demo",
  videoLabel: "Echorank 2-minute product demo video",
  ctaPrimary: "Run My Free AI Visibility Audit ↗",
  ctaSecondary: "See pricing",
  endHeadline: "Ready to become the answer?",
  endSub: "Run your free audit — no card required, results in 60 seconds.",
  replay: "Watch again",
  close: "Close",
  backHome: "← Back to homepage",
};

const demoFr: DemoVideoCopy = {
  meta: {
    title: "Regardez la démo de 2 minutes",
    description:
      "Découvrez comment Echorank mesure la façon dont ChatGPT, Perplexity, Google AI et les autres moteurs voient votre entreprise — et la transforme en un score que vous pouvez faire progresser.",
  },
  h1: "Echorank en action",
  sub: "Deux minutes : comment nous mesurons la façon dont les moteurs d'IA voient votre entreprise — et comment devenir la réponse.",
  dialogLabel: "Démo du produit Echorank",
  videoLabel: "Vidéo de démonstration Echorank (2 minutes)",
  ctaPrimary: "Lancer mon audit de visibilité IA gratuit ↗",
  ctaSecondary: "Voir les tarifs",
  endHeadline: "Prêt à devenir la réponse ?",
  endSub: "Lancez votre audit gratuit — sans carte, résultats en 60 secondes.",
  replay: "Revoir la vidéo",
  close: "Fermer",
  backHome: "← Retour à l'accueil",
};

export const DEMO_VIDEO: Record<Locale, DemoVideoCopy> = {
  en: demoEn,
  "en-CA": { ...demoEn },
  fr: demoFr,
  // Québec French — same register as the frCA homepage catalogue.
  "fr-CA": {
    ...demoFr,
    meta: {
      title: "Regardez la démo de 2 minutes",
      description:
        "Découvrez comment Echorank mesure la façon dont ChatGPT, Perplexity, Google AI et les autres moteurs voient votre entreprise — et la transforme en un score que vous pouvez améliorer.",
    },
  },
  // Swiss German — "ss", never "ß".
  "de-CH": {
    meta: {
      title: "Sehen Sie die 2-Minuten-Demo",
      description:
        "Sehen Sie, wie Echorank misst, wie ChatGPT, Perplexity, Google AI und weitere Engines Ihr Unternehmen sehen — und daraus einen Score macht, den Sie verbessern können.",
    },
    h1: "Echorank in Aktion",
    sub: "Zwei Minuten: wie wir messen, wie KI-Engines Ihr Unternehmen sehen — und wie Sie zur Antwort werden.",
    dialogLabel: "Echorank Produktdemo",
    videoLabel: "Echorank Produktdemo-Video (2 Minuten)",
    ctaPrimary: "Meinen kostenlosen KI-Sichtbarkeits-Audit starten ↗",
    ctaSecondary: "Preise ansehen",
    endHeadline: "Bereit, zur Antwort zu werden?",
    endSub: "Starten Sie Ihren kostenlosen Audit — keine Karte nötig, Resultate in 60 Sekunden.",
    replay: "Nochmals ansehen",
    close: "Schliessen",
    backHome: "← Zurück zur Startseite",
  },
};

// ---------------------------------------------------------------------------
// Homepage — "Classic SEO Tools" section + pricing chrome (added Jul 2026)
// ---------------------------------------------------------------------------
// SECTION CHROME ONLY. The tool names and one-line benefits are NOT here: they
// come from SEO_TOOLS_COPY in ./dashboard.ts, keyed by the same SeoToolId the
// hub renders, so the marketing grid and the product hub cannot drift. The
// dashboard catalog has three locales (en / fr / de-CH) which cover all five
// marketing locales through the documented fold — en-CA reads en, fr-CA reads
// fr, de-CH reads itself.
//
// TRANSLATION STATUS: en and en-CA are authored. fr, fr-CA and de-CH below are
// MACHINE-TRANSLATED and awaiting human review — see docs/agents/STATUS.md.
// de-CH follows the house rule of "ss", never "ß".

export interface HomeToolsCopy {
  label: string;
  h2: string;
  sub: string;
  /** "17 tools live today, 5 more on the way" — counts are injected. */
  count: (live: number, soon: number) => string;
  included: string;
  cta: string;
  badgeLive: string;
  badgeSoon: string;
  featuredLabel: string;
  featured: Array<{ k: string; h: string; p: string }>;
  /** Accessible name for the section's overview video. */
  videoLabel: string;
  /** Control labels + caption for the overview video's player (HomeVideo). */
  player: {
    play: string;
    pause: string;
    mute: string;
    unmute: string;
    caption: string;
  };
}

export const HOME_TOOLS: Record<Locale, HomeToolsCopy> = {
  en: {
    label: "CLASSIC SEO TOOLS",
    h2: "The SEO stack, in the same workspace.",
    videoLabel: "Video: an overview of the Classic SEO Tools",
    player: { play: "Play video", pause: "Pause video", mute: "Mute", unmute: "Unmute", caption: "Video plays muted — tap the speaker icon to unmute." },
    sub: "AI visibility is the new layer, not a replacement — the rankings, links and crawl health underneath it still decide what AI has to read. Every tool below lives in one workspace, on your plan.",
    count: (live, soon) =>
      `${live} tools live today · ${soon} more in build`,
    included:
      "Included with a paid plan. Monthly allowances scale with your tier, and a few of the heavier tools start at Starter or Growth.",
    cta: "Start free trial",
    badgeLive: "LIVE",
    badgeSoon: "COMING SOON",
    featuredLabel: "WORTH A CLOSER LOOK",
    featured: [
      {
        k: "AI Lens",
        h: "See your site the way AI sees it",
        p: "Fetches one page twice — once as an AI crawler, once as a real browser — and reports the gap. Anything only a browser can see is content AI engines never read.",
      },
      {
        k: "Search Performance",
        h: "Your real Search Console data",
        p: "A live Google Search Console connection: the queries, clicks and impressions Google actually recorded, next to the AI-visibility numbers for the same site.",
      },
      {
        k: "API + MCP server",
        h: "Plug your visibility data into AI agents",
        p: "Tenant-scoped API keys, plus an MCP server that lets Claude and other assistants query your audits and rankings directly.",
      },
      {
        k: "PDF reports",
        h: "Branded downloads, agency-ready",
        p: "Audit, monitoring and intelligence reports as PDFs you can hand to a client without re-typing anything.",
      },
    ],
  },
  "en-CA": {
    label: "CLASSIC SEO TOOLS",
    h2: "The SEO stack, in the same workspace.",
    videoLabel: "Video: an overview of the Classic SEO Tools",
    player: { play: "Play video", pause: "Pause video", mute: "Mute", unmute: "Unmute", caption: "Video plays muted — tap the speaker icon to unmute." },
    sub: "AI visibility is the new layer, not a replacement — the rankings, links and crawl health underneath it still decide what AI has to read. Every tool below lives in one workspace, on your plan.",
    count: (live, soon) => `${live} tools live today · ${soon} more in build`,
    included:
      "Included with a paid plan. Monthly allowances scale with your tier, and a few of the heavier tools start at Starter or Growth.",
    cta: "Start free trial",
    badgeLive: "LIVE",
    badgeSoon: "COMING SOON",
    featuredLabel: "WORTH A CLOSER LOOK",
    featured: [
      {
        k: "AI Lens",
        h: "See your site the way AI sees it",
        p: "Fetches one page twice — once as an AI crawler, once as a real browser — and reports the gap. Anything only a browser can see is content AI engines never read.",
      },
      {
        k: "Search Performance",
        h: "Your real Search Console data",
        p: "A live Google Search Console connection: the queries, clicks and impressions Google actually recorded, next to the AI-visibility numbers for the same site.",
      },
      {
        k: "API + MCP server",
        h: "Plug your visibility data into AI agents",
        p: "Tenant-scoped API keys, plus an MCP server that lets Claude and other assistants query your audits and rankings directly.",
      },
      {
        k: "PDF reports",
        h: "Branded downloads, agency-ready",
        p: "Audit, monitoring and intelligence reports as PDFs you can hand to a client without re-typing anything.",
      },
    ],
  },
  fr: {
    label: "OUTILS SEO CLASSIQUES",
    h2: "La panoplie SEO, dans le même espace de travail.",
    videoLabel: "Vidéo : aperçu des outils SEO classiques",
    player: { play: "Lire la vidéo", pause: "Mettre en pause", mute: "Couper le son", unmute: "Activer le son", caption: "La vidéo démarre sans le son — touchez l'icône haut-parleur pour l'activer." },
    sub: "La visibilité IA est une nouvelle couche, pas un remplacement — les classements, les liens et la santé d'exploration en dessous décident encore de ce que l'IA aura à lire. Tous les outils ci-dessous vivent dans un seul espace de travail, inclus dans votre forfait.",
    count: (live, soon) => `${live} outils disponibles · ${soon} en construction`,
    included:
      "Inclus avec un forfait payant. Les quotas mensuels augmentent avec votre palier, et quelques outils plus lourds démarrent à Starter ou Growth.",
    cta: "Démarrer l'essai gratuit",
    badgeLive: "DISPONIBLE",
    badgeSoon: "BIENTÔT",
    featuredLabel: "À REGARDER DE PLUS PRÈS",
    featured: [
      {
        k: "AI Lens",
        h: "Voyez votre site comme l'IA le voit",
        p: "Récupère une page deux fois — une fois comme robot d'IA, une fois comme navigateur réel — et signale l'écart. Tout ce que seul un navigateur voit est du contenu que les moteurs d'IA ne lisent jamais.",
      },
      {
        k: "Search Performance",
        h: "Vos vraies données Search Console",
        p: "Une connexion Google Search Console en direct : les requêtes, clics et impressions réellement enregistrés par Google, à côté des chiffres de visibilité IA du même site.",
      },
      {
        k: "API + serveur MCP",
        h: "Branchez vos données de visibilité sur des agents IA",
        p: "Des clés d'API limitées à votre espace de travail, plus un serveur MCP qui permet à Claude et à d'autres assistants d'interroger directement vos audits et vos classements.",
      },
      {
        k: "Rapports PDF",
        h: "Téléchargements personnalisés, prêts pour les agences",
        p: "Rapports d'audit, de surveillance et d'intelligence en PDF, à remettre à un client sans rien ressaisir.",
      },
    ],
  },
  "fr-CA": {
    label: "OUTILS SEO CLASSIQUES",
    h2: "La panoplie SEO, dans le même espace de travail.",
    videoLabel: "Vidéo : aperçu des outils SEO classiques",
    player: { play: "Lire la vidéo", pause: "Mettre en pause", mute: "Couper le son", unmute: "Activer le son", caption: "La vidéo démarre sans le son — touchez l'icône haut-parleur pour l'activer." },
    sub: "La visibilité IA est une nouvelle couche, pas un remplacement — les classements, les liens et la santé d'exploration en dessous décident encore de ce que l'IA aura à lire. Tous les outils ci-dessous vivent dans un seul espace de travail, inclus dans votre forfait.",
    count: (live, soon) => `${live} outils disponibles · ${soon} en construction`,
    included:
      "Inclus avec un forfait payant. Les quotas mensuels augmentent avec votre palier, et quelques outils plus lourds démarrent à Starter ou Growth.",
    cta: "Démarrer l'essai gratuit",
    badgeLive: "DISPONIBLE",
    badgeSoon: "BIENTÔT",
    featuredLabel: "À REGARDER DE PLUS PRÈS",
    featured: [
      {
        k: "AI Lens",
        h: "Voyez votre site comme l'IA le voit",
        p: "Récupère une page deux fois — une fois comme robot d'IA, une fois comme navigateur réel — et signale l'écart. Tout ce que seul un navigateur voit est du contenu que les moteurs d'IA ne lisent jamais.",
      },
      {
        k: "Search Performance",
        h: "Vos vraies données Search Console",
        p: "Une connexion Google Search Console en direct : les requêtes, clics et impressions réellement enregistrés par Google, à côté des chiffres de visibilité IA du même site.",
      },
      {
        k: "API + serveur MCP",
        h: "Branchez vos données de visibilité sur des agents IA",
        p: "Des clés d'API limitées à votre espace de travail, plus un serveur MCP qui permet à Claude et à d'autres assistants d'interroger directement vos audits et vos classements.",
      },
      {
        k: "Rapports PDF",
        h: "Téléchargements personnalisés, prêts pour les agences",
        p: "Rapports d'audit, de surveillance et d'intelligence en PDF, à remettre à un client sans rien ressaisir.",
      },
    ],
  },
  "de-CH": {
    label: "KLASSISCHE SEO-WERKZEUGE",
    h2: "Der SEO-Werkzeugkasten, im selben Arbeitsbereich.",
    videoLabel: "Video: Überblick über die klassischen SEO-Tools",
    player: { play: "Video abspielen", pause: "Video pausieren", mute: "Ton aus", unmute: "Ton ein", caption: "Das Video startet ohne Ton — tippen Sie auf das Lautsprechersymbol." },
    sub: "KI-Sichtbarkeit ist eine neue Schicht, kein Ersatz — Rankings, Links und Crawl-Gesundheit darunter entscheiden weiterhin, was die KI überhaupt zu lesen bekommt. Alle Werkzeuge unten liegen in einem Arbeitsbereich, in Ihrem Abo enthalten.",
    count: (live, soon) => `${live} Werkzeuge verfügbar · ${soon} in Arbeit`,
    included:
      "In einem kostenpflichtigen Abo enthalten. Die monatlichen Kontingente wachsen mit Ihrer Stufe, und einige der schwereren Werkzeuge beginnen bei Starter oder Growth.",
    cta: "Kostenlos testen",
    badgeLive: "VERFÜGBAR",
    badgeSoon: "DEMNÄCHST",
    featuredLabel: "EINEN GENAUEREN BLICK WERT",
    featured: [
      {
        k: "AI Lens",
        h: "Sehen Sie Ihre Website so, wie die KI sie sieht",
        p: "Ruft eine Seite zweimal ab — einmal als KI-Crawler, einmal als echter Browser — und meldet die Differenz. Alles, was nur ein Browser sieht, ist Inhalt, den KI-Maschinen nie lesen.",
      },
      {
        k: "Search Performance",
        h: "Ihre echten Search-Console-Daten",
        p: "Eine Live-Verbindung zur Google Search Console: die Suchanfragen, Klicks und Impressionen, die Google tatsächlich erfasst hat, neben den KI-Sichtbarkeitszahlen derselben Website.",
      },
      {
        k: "API + MCP-Server",
        h: "Verbinden Sie Ihre Sichtbarkeitsdaten mit KI-Agenten",
        p: "Auf Ihren Arbeitsbereich beschränkte API-Schlüssel, dazu ein MCP-Server, über den Claude und andere Assistenten Ihre Audits und Rankings direkt abfragen.",
      },
      {
        k: "PDF-Berichte",
        h: "Berichte im eigenen Branding, agenturtauglich",
        p: "Audit-, Monitoring- und Intelligence-Berichte als PDF, die Sie einer Kundschaft ohne Abtippen weitergeben können.",
      },
    ],
  },
};

/**
 * EVERY FIELD MUST BE A PLAIN STRING.
 *
 * This object is handed from the server page to HomeClient, a client component,
 * and the server->client boundary cannot carry functions — passing one throws
 * "Functions cannot be passed directly to Client Components" at render time, not
 * at build time, so it takes the page down rather than failing the build. The
 * two interpolated strings therefore use {pct} / {n} placeholders substituted at
 * render time, exactly as AuditWidgetContent does for {brand}.
 */
export interface HomePricingChrome {
  monthly: string;
  annual: string;
  perMonth: string;
  billedAnnually: string;
  /** Contains "{pct}". */
  save: string;
  /** Contains "{n}". */
  toolsLine: string;
  toolsAnchor: string;
  contactUs: string;
  /** Primary checkout button on each paid pricing card. */
  checkoutCta: string;
  checkoutBusy: string;
  checkoutError: string;
}

export const HOME_PRICING_CHROME: Record<Locale, HomePricingChrome> = {
  en: {
    monthly: "Monthly",
    annual: "Annual",
    perMonth: "/mo",
    billedAnnually: "billed annually",
    save: "save {pct}%",
    toolsLine: "{n}+ SEO & AI tools included",
    toolsAnchor: "See the tools ↓",
    contactUs: "Contact us",
    checkoutCta: "Start free trial",
    checkoutBusy: "Starting\u2026",
    checkoutError: "Could not start checkout. Please try again.",
  },
  "en-CA": {
    monthly: "Monthly",
    annual: "Annual",
    perMonth: "/mo",
    billedAnnually: "billed annually",
    save: "save {pct}%",
    toolsLine: "{n}+ SEO & AI tools included",
    toolsAnchor: "See the tools ↓",
    contactUs: "Contact us",
    checkoutCta: "Start free trial",
    checkoutBusy: "Starting\u2026",
    checkoutError: "Could not start checkout. Please try again.",
  },
  fr: {
    monthly: "Mensuel",
    annual: "Annuel",
    perMonth: "/mois",
    billedAnnually: "facturé annuellement",
    save: "économisez {pct} %",
    toolsLine: "{n}+ outils SEO et IA inclus",
    toolsAnchor: "Voir les outils ↓",
    contactUs: "Nous contacter",
    checkoutCta: "D\u00e9marrer l'essai gratuit",
    checkoutBusy: "D\u00e9marrage\u2026",
    checkoutError: "Impossible de d\u00e9marrer le paiement. R\u00e9essayez.",
  },
  "fr-CA": {
    monthly: "Mensuel",
    annual: "Annuel",
    perMonth: "/mois",
    billedAnnually: "facturé annuellement",
    save: "économisez {pct} %",
    toolsLine: "{n}+ outils SEO et IA inclus",
    toolsAnchor: "Voir les outils ↓",
    contactUs: "Nous contacter",
    checkoutCta: "D\u00e9marrer l'essai gratuit",
    checkoutBusy: "D\u00e9marrage\u2026",
    checkoutError: "Impossible de d\u00e9marrer le paiement. R\u00e9essayez.",
  },
  "de-CH": {
    monthly: "Monatlich",
    annual: "Jährlich",
    perMonth: "/Mt.",
    billedAnnually: "jährlich verrechnet",
    save: "{pct}% sparen",
    toolsLine: "{n}+ SEO- und KI-Werkzeuge inklusive",
    toolsAnchor: "Werkzeuge ansehen ↓",
    contactUs: "Kontakt aufnehmen",
    checkoutCta: "Gratis-Test starten",
    checkoutBusy: "Wird gestartet\u2026",
    checkoutError: "Zahlung konnte nicht gestartet werden. Bitte erneut versuchen.",
  },
};
