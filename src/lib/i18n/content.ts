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
    cells: { key: string; title: string; body: string }[];
  };
  how: { label: string; steps: { num: string; name: string; body: string }[] };
  pricing: { label: string; tiers: PricingTier[] };
  field: { label: string; quoteA: string; quoteB: string; attribution: string };
  start: { label: string; h2: string; cta1: string; cta2: string };
  footer: { copyright: string; links: string[] };
}

export type TierPrices = Record<PricingTier["key"], string>;

const COPYRIGHT = "© 2026 ECHORANK / CHATLOGIC INSIGHTS LTD";

// ─── en (US / international default) ────────────────────────────────────────
const en: HomeContent = {
  meta: {
    title: "EchoRank — Reputation Intelligence",
    description:
      "Collect customer feedback, generate more authentic reviews, and identify service issues with AI-powered reputation management.",
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
    label: "/ 01 — REPUTATION INTELLIGENCE",
    h1a: "Turn Customer Feedback",
    h1b: "Into Better Reviews.",
    subhead:
      "Collect feedback, invite customers to share public reviews, and identify service issues early so your team can respond quickly and improve the customer experience.",
    cta1: "Start 14-day free trial →",
    cta2: "See it in action ↗",
  },
  trust: {
    used: "USED BY 2,500+ INDEPENDENT BUSINESSES",
    industries: ["RESTAURANTS", "PLUMBERS", "DENTISTS", "AUTO", "HOME SERVICES"],
  },
  outcomes: {
    label: "/ 02 — WHAT YOU GET",
    items: [
      { value: "★", label: "Multi-channel review requests" },
      { value: "◎", label: "Google and Facebook integrations" },
      { value: "AI", label: "AI-powered sentiment analysis" },
      { value: "↻", label: "Automated recovery workflows" },
    ],
  },
  platform: {
    label: "/ 03 — THE PLATFORM",
    h2: "Everything you need. Nothing you don't.",
    cells: [
      { key: "A", title: "Identify service issues early", body: "AI scores every customer interaction so your team can identify service issues early and respond faster." },
      { key: "B", title: "Watch every review site", body: "Google, Yelp, Facebook, Trustpilot, Apple, Tripadvisor. All in one inbox." },
      { key: "C", title: "Win them back", body: "Recovery tickets routed to the right person on your team. Collect customer feedback and review insights in one place." },
      { key: "D", title: "Get more real 5-stars", body: "The right ask, at the right moment, to the right customer. By email or SMS." },
      { key: "E", title: "One screen, every location", body: "Owner dashboard. One score. Tells you if today's a good day or a bad one." },
      { key: "F", title: "Compliance, handled", body: "No fake reviews. No gating. No tricks Google can ban you for. Just clean infrastructure." },
    ],
  },
  how: {
    label: "/ 04 — HOW IT WORKS",
    steps: [
      { num: "01", name: "Connect", body: "Plug in your POS, booking, or CRM. Ten minutes." },
      { num: "02", name: "Listen", body: "We score every interaction. Quietly. In the background." },
      { num: "03", name: "Act", body: "You get a ping. You reach out, follow up, and improve the customer experience." },
      { num: "04", name: "Grow", body: "Happy customers asked to review. Reputation compounds." },
    ],
  },
  pricing: {
    label: "/ 05 — PRICING",
    tiers: [
      { key: "starter", name: "STARTER", features: ["1 location", "500 requests/mo", "Email outreach", "Basic dashboard"] },
      { key: "growth", name: "GROWTH", highlighted: true, features: ["5 locations", "5,000 requests/mo", "Email + SMS", "AI risk scoring"] },
      { key: "agency", name: "AGENCY", features: ["25 locations", "15,000 requests/mo", "White-label", "API access"] },
      { key: "enterprise", name: "ENTERPRISE", features: ["Unlimited", "Custom volume", "SSO / SAML", "99.9% SLA"] },
    ],
  },
  field: {
    label: "/ 06 — IN THE FIELD",
    quoteA: "EchoRank helps us collect feedback after every job, invite happy customers to leave public reviews, and follow up quickly when something needs attention.",
    quoteB: "",
    attribution: "ECHORANK CUSTOMER",
  },
  start: {
    label: "/ 07 — START",
    h2: "Try it. Or talk to us.",
    cta1: "Start free trial →",
    cta2: "Book a demo ↗",
  },
  footer: { copyright: COPYRIGHT, links: ["PRIVACY", "TERMS", "SECURITY", "STATUS"] },
};

// ─── en-CA (Canada — English) ───────────────────────────────────────────────
const enCA: HomeContent = {
  ...en,
  nav: { ...en.nav, switcher: ["en-CA", "fr-CA"] },
  field: { ...en.field, attribution: "OWNER, INDEPENDENT PLUMBING CO., TORONTO ON" },
};

// ─── fr (Europe — EUR; also Swiss-Romandie with CHF) ─────────────────────────
const fr: HomeContent = {
  meta: {
    title: "EchoRank — Intelligence de réputation",
    description:
      "Recueillez les retours clients, générez des avis plus authentiques et identifiez les problèmes de service grâce à une gestion de réputation assistée par IA.",
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
    label: "/ 01 — INTELLIGENCE DE RÉPUTATION",
    h1a: "Transformez les retours clients",
    h1b: "en meilleurs avis.",
    subhead:
      "Recueillez les retours, invitez les clients à laisser des avis publics et identifiez tôt les problèmes de service pour que votre équipe réagisse vite et améliore l'expérience client.",
    cta1: "Essai gratuit de 14 jours →",
    cta2: "Voir en action ↗",
  },
  trust: {
    used: "UTILISÉ PAR 2 500+ ENTREPRISES INDÉPENDANTES",
    industries: ["RESTAURATION", "PLOMBERIE", "DENTAIRE", "AUTO", "SERVICES À DOMICILE"],
  },
  outcomes: {
    label: "/ 02 — CE QUE VOUS OBTENEZ",
    items: [
      { value: "★", label: "Demandes d'avis multicanal" },
      { value: "◎", label: "Intégrations Google et Facebook" },
      { value: "IA", label: "Analyse de sentiment par IA" },
      { value: "↻", label: "Flux de récupération automatisés" },
    ],
  },
  platform: {
    label: "/ 03 — LA PLATEFORME",
    h2: "Tout ce qu'il faut. Rien de plus.",
    cells: [
      { key: "A", title: "Identifiez les problèmes tôt", body: "L'IA évalue chaque interaction client pour que votre équipe identifie les problèmes de service tôt et réagisse plus vite." },
      { key: "B", title: "Tous les sites surveillés", body: "Google, Pages Jaunes, Trustpilot, TripAdvisor, Facebook. Une seule boîte de réception." },
      { key: "C", title: "Les reconquérir", body: "Les demandes de récupération arrivent à la bonne personne. Retours clients et avis réunis au même endroit." },
      { key: "D", title: "Plus de 5 étoiles authentiques", body: "La bonne demande, au bon moment, au bon client. Par e-mail ou SMS." },
      { key: "E", title: "Un écran, tous vos établissements", body: "Tableau de bord propriétaire. Un score. Vous dit si la journée est bonne ou mauvaise." },
      { key: "F", title: "Conformité, assurée", body: "Aucun faux avis. Aucun filtrage. Aucune astuce sanctionnable par Google. Juste de l'infrastructure propre." },
    ],
  },
  how: {
    label: "/ 04 — COMMENT ÇA MARCHE",
    steps: [
      { num: "01", name: "Connecter", body: "Branchez votre caisse, logiciel de réservation ou CRM. Dix minutes." },
      { num: "02", name: "Écouter", body: "Nous évaluons chaque interaction. En silence. En arrière-plan." },
      { num: "03", name: "Agir", body: "Vous recevez une alerte. Vous contactez, faites le suivi et améliorez l'expérience client." },
      { num: "04", name: "Croître", body: "Les clients satisfaits sont invités à laisser un avis. La réputation se renforce." },
    ],
  },
  pricing: {
    label: "/ 05 — TARIFS",
    tiers: [
      { key: "starter", name: "STARTER", features: ["1 établissement", "500 demandes/mois", "Envois par e-mail", "Tableau de bord"] },
      { key: "growth", name: "GROWTH", highlighted: true, features: ["5 établissements", "5 000 demandes/mois", "E-mail + SMS", "Évaluation IA"] },
      { key: "agency", name: "AGENCE", features: ["25 établissements", "15 000 demandes/mois", "Marque blanche", "Accès API"] },
      { key: "enterprise", name: "ENTREPRISE", features: ["Illimité", "Volume sur mesure", "SSO / SAML", "SLA 99,9 %"] },
    ],
  },
  field: {
    label: "/ 06 — SUR LE TERRAIN",
    quoteA: "« EchoRank nous aide à recueillir les retours après chaque intervention, à inviter les clients satisfaits à laisser un avis public et à réagir vite quand quelque chose mérite attention. »",
    quoteB: "",
    attribution: "CLIENT ECHORANK",
  },
  start: {
    label: "/ 07 — COMMENCER",
    h2: "Essayez. Ou parlez-nous.",
    cta1: "Essai gratuit →",
    cta2: "Réserver une démo ↗",
  },
  footer: { copyright: COPYRIGHT, links: ["CONFIDENTIALITÉ", "CONDITIONS", "SÉCURITÉ", "STATUT"] },
};

// ─── fr-CA (Quebec) — fr with Quebec vocabulary overrides ─────────────────────
const frCA: HomeContent = {
  ...fr,
  nav: { ...fr.nav, switcher: ["fr-CA", "en-CA"] },
  platform: {
    ...fr.platform,
    cells: fr.platform.cells.map((c) =>
      c.key === "D"
        ? { ...c, body: "La bonne demande, au bon moment, au bon client. Par courriel ou SMS." }
        : c,
    ),
  },
  pricing: {
    ...fr.pricing,
    tiers: fr.pricing.tiers.map((t) => {
      if (t.key === "starter") {
        return { ...t, features: ["1 établissement", "500 demandes/mois", "Envois par courriel", "Tableau de bord"] };
      }
      if (t.key === "growth") {
        return { ...t, features: ["5 établissements", "5 000 demandes/mois", "Courriel + SMS", "Évaluation IA"] };
      }
      return t;
    }),
  },
  field: { ...fr.field, attribution: "PROPRIÉTAIRE, PLOMBERIE INDÉPENDANTE, MONTRÉAL QC" },
};

// ─── de-CH (Switzerland — German) ─────────────────────────────────────────────
const deCH: HomeContent = {
  meta: {
    title: "EchoRank — Reputations-Intelligenz",
    description:
      "Erfassen Sie Kundenfeedback, generieren Sie authentischere Bewertungen und erkennen Sie Servicethemen mit KI-gestütztem Reputationsmanagement.",
  },
  nav: {
    product: "Produkt",
    pricing: "Preise",
    customers: "Kunden",
    login: "Login",
    cta: "Kostenlos testen",
    switcher: ["de-CH", "fr", "en"],
  },
  hero: {
    label: "/ 01 — REPUTATIONS-INTELLIGENZ",
    h1a: "Machen Sie aus Kundenfeedback",
    h1b: "bessere Bewertungen.",
    subhead:
      "Erfassen Sie Feedback, laden Sie Kunden zu öffentlichen Bewertungen ein und erkennen Sie Servicethemen früh, damit Ihr Team schnell reagieren und die Kundenerfahrung verbessern kann.",
    cta1: "14 Tage kostenlos testen →",
    cta2: "In Aktion ansehen ↗",
  },
  trust: {
    used: "EINGESETZT VON 2'500+ UNABHÄNGIGEN UNTERNEHMEN",
    industries: ["RESTAURANTS", "SANITÄR", "ZAHNÄRZTE", "AUTO", "HANDWERK"],
  },
  outcomes: {
    label: "/ 02 — WAS SIE BEKOMMEN",
    items: [
      { value: "★", label: "Mehrkanalige Bewertungsanfragen" },
      { value: "◎", label: "Google- und Facebook-Integrationen" },
      { value: "KI", label: "KI-gestützte Sentiment-Analyse" },
      { value: "↻", label: "Automatisierte Wiederherstellungs-Workflows" },
    ],
  },
  platform: {
    label: "/ 03 — DIE PLATTFORM",
    h2: "Alles, was Sie brauchen. Nichts, was Sie nicht brauchen.",
    cells: [
      { key: "A", title: "Servicethemen früh erkennen", body: "KI bewertet jede Kundeninteraktion, damit Ihr Team Servicethemen früh erkennt und schneller reagiert." },
      { key: "B", title: "Alle Bewertungsplattformen im Blick", body: "Google, local.ch, Facebook, Trustpilot, TripAdvisor. Alles in einem Posteingang." },
      { key: "C", title: "Kunden zurückgewinnen", body: "Wiederherstellungstickets gehen an die richtige Person im Team. Kundenfeedback und Bewertungs-Insights an einem Ort." },
      { key: "D", title: "Mehr echte 5-Sterne-Bewertungen", body: "Die richtige Bitte, zum richtigen Zeitpunkt, an den richtigen Kunden. Per E-Mail oder SMS." },
      { key: "E", title: "Ein Bildschirm, alle Standorte", body: "Geschäftsführer-Dashboard. Eine Kennzahl. Sagt Ihnen, ob es ein guter oder ein schlechter Tag ist." },
      { key: "F", title: "Compliance erledigt", body: "Keine gefälschten Bewertungen. Kein Filtern. Keine Tricks, für die Google Sie sperren würde. Nur saubere Infrastruktur." },
    ],
  },
  how: {
    label: "/ 04 — SO FUNKTIONIERT ES",
    steps: [
      { num: "01", name: "Verbinden", body: "Kasse, Buchungssystem oder CRM anschliessen. Zehn Minuten." },
      { num: "02", name: "Zuhören", body: "Wir bewerten jede Interaktion. Leise. Im Hintergrund." },
      { num: "03", name: "Handeln", body: "Sie bekommen eine Meldung. Sie melden sich, folgen nach und verbessern die Kundenerfahrung." },
      { num: "04", name: "Wachsen", body: "Zufriedene Kunden werden um eine Bewertung gebeten. Die Reputation wächst." },
    ],
  },
  pricing: {
    label: "/ 05 — PREISE",
    tiers: [
      { key: "starter", name: "STARTER", features: ["1 Standort", "500 Anfragen/Mt.", "E-Mail-Versand", "Dashboard"] },
      { key: "growth", name: "GROWTH", highlighted: true, features: ["5 Standorte", "5'000 Anfragen/Mt.", "E-Mail + SMS", "KI-Risikoanalyse"] },
      { key: "agency", name: "AGENTUR", features: ["25 Standorte", "15'000 Anfragen/Mt.", "White-Label", "API-Zugang"] },
      { key: "enterprise", name: "ENTERPRISE", features: ["Unbegrenzt", "Individuelles Volumen", "SSO / SAML", "SLA 99,9 %"] },
    ],
  },
  field: {
    label: "/ 06 — IM EINSATZ",
    quoteA: "«EchoRank hilft uns, nach jedem Auftrag Feedback zu erfassen, zufriedene Kunden zu einer öffentlichen Bewertung einzuladen und schnell nachzufassen, wenn etwas Aufmerksamkeit braucht.»",
    quoteB: "",
    attribution: "ECHORANK-KUNDE",
  },
  start: {
    label: "/ 07 — STARTEN",
    h2: "Testen. Oder sprechen Sie mit uns.",
    cta1: "Kostenlos testen →",
    cta2: "Demo buchen ↗",
  },
  footer: { copyright: COPYRIGHT, links: ["DATENSCHUTZ", "AGB", "SICHERHEIT", "STATUS"] },
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
    USD: "14-day free trial on all plans. No card required.",
    GBP: "14-day free trial on all plans. No card required.",
    CAD: "14-day free trial. No credit card required. Billed in Canadian dollars. GST/HST/PST extra.",
  },
  "en-CA": {
    CAD: "14-day free trial. No credit card required. Billed in Canadian dollars. GST/HST/PST extra.",
  },
  fr: {
    EUR: "Essai gratuit de 14 jours sur tous les plans. Sans carte bancaire.",
    CHF: "Essai gratuit de 14 jours. Sans carte bancaire. Facturation en francs suisses. TVA 8,1 % en sus.",
    CAD: "Essai gratuit de 14 jours. Sans carte de crédit. Facturation en dollars canadiens. Toutes taxes en sus (TPS/TVQ).",
  },
  "fr-CA": {
    CAD: "Essai gratuit de 14 jours. Sans carte de crédit. Facturation en dollars canadiens. Toutes taxes en sus (TPS/TVQ).",
  },
  "de-CH": {
    CHF: "14 Tage kostenlos testen. Keine Kreditkarte erforderlich. Abrechnung in Schweizer Franken. MwSt. 8,1 % exkl.",
  },
};
