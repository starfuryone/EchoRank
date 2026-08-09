// src/lib/solutions-taxonomy.ts
//
// The Solutions taxonomy: 4 categories, 25 items. Single source of truth for
// the mega-menu column, the category index pages and the 25 landing pages —
// same rule as PLAN_CONFIGS, no string written twice.
//
// FEATURE NAMES COME FROM A SHARED BANK, only the relevance line is per item.
// A product is called the same thing on every page — "Live monitoring" does not
// become something else because a freelancer is reading about it — so the name
// lives once in FEATURES and each item supplies only `why` it is relevant. This
// halves the copy and removes the failure where one page renames a feature.
//
// EVERY FEATURE href IS AN EXISTING ROUTE. Nothing here points at
// /visibility/tools/*: those are authenticated and plan-gated, so an anonymous
// reader clicking one bounces off the gate. Asserted in tests.
//
// PURE — no Prisma, no React. Imported by a client component (the nav) and by
// server pages.

export type SolutionCategorySlug = "goals" | "team-size" | "roles" | "industries";
export type SolutionBase = "en" | "fr";

/** Locale-less path, or a "#fragment" resolved against the locale root. */
export type FeatureHref =
  | "/ai-visibility"
  | "/live-monitoring"
  | "/reputation-engine"
  | "/customer-feedback"
  | "/act-on-signals"
  | "/free-tools"
  | "#tools";

/** Feature display names — one place, so no page can rename a product. */
export const FEATURES: Record<FeatureHref, Record<SolutionBase, string>> = {
  "/ai-visibility": { en: "AI Visibility", fr: "Visibilité IA" },
  "/live-monitoring": { en: "Live monitoring", fr: "Surveillance continue" },
  "/reputation-engine": { en: "Reputation Engine", fr: "Moteur de réputation" },
  "/customer-feedback": { en: "Customer feedback", fr: "Avis clients" },
  "/act-on-signals": { en: "Act on signals", fr: "Agir sur les signaux" },
  "/free-tools": { en: "Free tools", fr: "Outils gratuits" },
  "#tools": { en: "SEO toolkit", fr: "Boîte à outils SEO" },
};

export interface SolutionFeature {
  href: FeatureHref;
  /** Why this feature matters TO THIS ITEM. One line. */
  why: string;
}

export interface SolutionCopy {
  label: string;
  desc: string;
  h1: string;
  intro: string;
  features: SolutionFeature[];
}

export interface SolutionItem {
  slug: string;
  category: SolutionCategorySlug;
  en: SolutionCopy;
  fr: SolutionCopy;
}

export interface SolutionCategory {
  slug: SolutionCategorySlug;
  en: { label: string; h1: string; intro: string };
  fr: { label: string; h1: string; intro: string };
  items: SolutionItem[];
}

const AI = "/ai-visibility" as const;
const MON = "/live-monitoring" as const;
const ENG = "/reputation-engine" as const;
const FB = "/customer-feedback" as const;
const ACT = "/act-on-signals" as const;
const FREE = "/free-tools" as const;
const TOOLS = "#tools" as const;

export const SOLUTION_CATEGORIES: SolutionCategory[] = [
  {
    slug: "goals",
    en: { label: "By goal", h1: "Solutions by goal", intro: "Start from the outcome you want, not from a feature list." },
    fr: { label: "Par objectif", h1: "Solutions par objectif", intro: "Partez du résultat que vous visez, pas d'une liste de fonctionnalités." },
    items: [
      {
        slug: "boost-search-rankings",
        category: "goals",
        en: {
          label: "Boost search rankings",
          desc: "Find the keywords worth winning and track your position on them.",
          h1: "Boost search rankings",
          intro: "Ranking work starts with knowing where you actually stand. Track positions, research the terms that bring buyers, and fix what holds pages back.",
          features: [
            { href: TOOLS, why: "Keyword research, rank tracking and site audits in one hub." },
            { href: FREE, why: "Check a SERP or simulate a listing before you commit to a change." },
            { href: MON, why: "Get told when a ranking moves instead of finding out a month later." },
          ],
        },
        fr: {
          label: "Améliorer votre référencement",
          desc: "Trouvez les mots-clés qui comptent et suivez vos positions.",
          h1: "Améliorer votre référencement",
          intro: "Le référencement commence par savoir où vous en êtes vraiment. Suivez vos positions, cherchez les termes qui amènent des acheteurs et corrigez ce qui freine vos pages.",
          features: [
            { href: TOOLS, why: "Recherche de mots-clés, suivi de positions et audits au même endroit." },
            { href: FREE, why: "Vérifiez une SERP ou simulez une annonce avant de modifier quoi que ce soit." },
            { href: MON, why: "Soyez alerté quand une position bouge, pas un mois plus tard." },
          ],
        },
      },
      {
        slug: "get-cited-by-ai",
        category: "goals",
        en: {
          label: "Get cited by AI assistants",
          desc: "Track how AI answers describe you, and improve how often you appear.",
          h1: "Get cited by AI assistants",
          intro: "Buyers ask assistants for recommendations before they open a search page. Find out whether you are named, where you rank in the answer, and what to change.",
          features: [
            { href: AI, why: "See what assistants say about you, scored and tracked over time." },
            { href: MON, why: "Scheduled re-checks, and an alert when a mention disappears." },
            { href: TOOLS, why: "AI Lens shows the content a crawler never sees." },
          ],
        },
        fr: {
          label: "Être cité par les assistants IA",
          desc: "Suivez ce que les réponses IA disent de vous et améliorez votre présence.",
          h1: "Être cité par les assistants IA",
          intro: "Vos acheteurs interrogent les assistants avant même d'ouvrir un moteur de recherche. Sachez si vous êtes nommé, à quel rang, et ce qu'il faut changer.",
          features: [
            { href: AI, why: "Voyez ce que les assistants disent de vous, avec un score suivi dans le temps." },
            { href: MON, why: "Contrôles programmés et alerte quand une mention disparaît." },
            { href: TOOLS, why: "AI Lens révèle le contenu qu'un robot ne voit jamais." },
          ],
        },
      },
      {
        slug: "understand-your-market",
        category: "goals",
        en: {
          label: "Understand your market",
          desc: "See who else gets recommended, and where the gaps are.",
          h1: "Understand your market",
          intro: "Knowing your own numbers is half the picture. See which competitors get named alongside you and which questions nobody is answering well.",
          features: [
            { href: AI, why: "Competitor names captured from the same answers you are measured in." },
            { href: TOOLS, why: "Share of search, SERP comparison and content gap analysis." },
            { href: FREE, why: "Run a competitive check without an account." },
          ],
        },
        fr: {
          label: "Comprendre votre marché",
          desc: "Voyez qui d'autre est recommandé et où sont les créneaux libres.",
          h1: "Comprendre votre marché",
          intro: "Vos propres chiffres ne racontent que la moitié de l'histoire. Voyez quels concurrents sont cités à côté de vous et quelles questions restent mal traitées.",
          features: [
            { href: AI, why: "Les noms de concurrents relevés dans les réponses qui vous mesurent." },
            { href: TOOLS, why: "Part de recherche, comparaison de SERP et analyse des écarts de contenu." },
            { href: FREE, why: "Lancez une analyse concurrentielle sans compte." },
          ],
        },
      },
      {
        slug: "win-local-customers",
        category: "goals",
        en: {
          label: "Win local customers",
          desc: "Show up for nearby searches and keep your listings honest.",
          h1: "Win local customers",
          intro: "Local buyers decide on reviews and proximity. Keep your listings accurate, your reviews coming, and your response time short.",
          features: [
            { href: FB, why: "Ask for reviews by email and SMS, at the moment people are happy." },
            { href: MON, why: "Watch new reviews and ratings across the platforms that matter locally." },
            { href: ACT, why: "Reply quickly, before an unhappy visit becomes a public one." },
          ],
        },
        fr: {
          label: "Gagner des clients locaux",
          desc: "Apparaissez dans les recherches de proximité et gardez vos fiches à jour.",
          h1: "Gagner des clients locaux",
          intro: "Les clients locaux décident sur les avis et la proximité. Gardez vos fiches exactes, vos avis réguliers et vos réponses rapides.",
          features: [
            { href: FB, why: "Demandez des avis par courriel et SMS, au bon moment." },
            { href: MON, why: "Suivez les nouveaux avis sur les plateformes qui comptent localement." },
            { href: ACT, why: "Répondez vite, avant qu'une visite déçue ne devienne publique." },
          ],
        },
      },
      {
        slug: "content-that-converts",
        category: "goals",
        en: {
          label: "Publish content that converts",
          desc: "Write what buyers and assistants both quote.",
          h1: "Publish content that converts",
          intro: "Content that ranks and content that gets quoted are increasingly the same thing. Find the questions worth answering and publish answers worth citing.",
          features: [
            { href: TOOLS, why: "Content Explorer and the AI Content Helper, from brief to draft." },
            { href: AI, why: "Check whether assistants actually start quoting the page." },
            { href: FREE, why: "Score a page before you publish it." },
          ],
        },
        fr: {
          label: "Publier du contenu qui convertit",
          desc: "Écrivez ce que les acheteurs et les assistants citent.",
          h1: "Publier du contenu qui convertit",
          intro: "Le contenu qui se positionne et celui qui se fait citer deviennent la même chose. Trouvez les questions qui méritent une réponse et publiez des réponses citables.",
          features: [
            { href: TOOLS, why: "Content Explorer et l'assistant de contenu IA, du brief au brouillon." },
            { href: AI, why: "Vérifiez si les assistants se mettent réellement à citer la page." },
            { href: FREE, why: "Évaluez une page avant de la publier." },
          ],
        },
      },
      {
        slug: "clean-up-technical-seo",
        category: "goals",
        en: {
          label: "Clean up technical SEO",
          desc: "Crawl the site, list what is broken, fix it in order.",
          h1: "Clean up technical SEO",
          intro: "Technical problems are cheap to fix and expensive to ignore. Crawl every page, get the issues ranked by severity, and work down the list.",
          features: [
            { href: TOOLS, why: "Site Crawler, Site Audit and Lighthouse, with issues sorted by severity." },
            { href: AI, why: "AI Lens shows what renders for a crawler versus a browser." },
            { href: MON, why: "Get told when a crawler starts being blocked." },
          ],
        },
        fr: {
          label: "Assainir votre SEO technique",
          desc: "Explorez le site, listez ce qui est cassé, corrigez dans l'ordre.",
          h1: "Assainir votre SEO technique",
          intro: "Les problèmes techniques coûtent peu à corriger et cher à ignorer. Explorez chaque page, classez les anomalies par gravité et déroulez la liste.",
          features: [
            { href: TOOLS, why: "Site Crawler, audit de site et Lighthouse, anomalies classées par gravité." },
            { href: AI, why: "AI Lens montre ce que voit un robot par rapport à un navigateur." },
            { href: MON, why: "Soyez averti si un robot commence à être bloqué." },
          ],
        },
      },
      {
        slug: "build-offsite-authority",
        category: "goals",
        en: {
          label: "Build off-site authority",
          desc: "See who links to you, who links to them, and what it is worth.",
          h1: "Build off-site authority",
          intro: "Authority is built off your own site. Look at the links you have, the ones competitors have, and the mentions that never became links.",
          features: [
            { href: TOOLS, why: "Backlinks and Brand Radar, including unlinked mentions." },
            { href: AI, why: "See which domains assistants cite when they answer about your category." },
            { href: MON, why: "Track the mentions as they appear rather than in a quarterly review." },
          ],
        },
        fr: {
          label: "Construire votre autorité externe",
          desc: "Voyez qui vous cite, qui cite vos concurrents, et ce que cela vaut.",
          h1: "Construire votre autorité externe",
          intro: "L'autorité se construit en dehors de votre site. Regardez vos liens, ceux de vos concurrents, et les mentions qui ne sont jamais devenues des liens.",
          features: [
            { href: TOOLS, why: "Backlinks et Brand Radar, y compris les mentions sans lien." },
            { href: AI, why: "Voyez quels domaines les assistants citent sur votre catégorie." },
            { href: MON, why: "Suivez les mentions au fil de l'eau plutôt qu'au trimestre." },
          ],
        },
      },
      {
        slug: "client-strategies",
        category: "goals",
        en: {
          label: "Deliver client strategies",
          desc: "Turn an audit into a plan a client will sign off.",
          h1: "Deliver client strategies",
          intro: "A strategy needs a defensible starting number and a short list of moves. Start from a scored audit and build the plan on what it found.",
          features: [
            { href: AI, why: "A scored baseline you can put in front of a client on day one." },
            { href: TOOLS, why: "Report Builder and Portfolios for per-client reporting." },
            { href: ENG, why: "Automate the review and response work so the plan actually runs." },
          ],
        },
        fr: {
          label: "Livrer des stratégies clients",
          desc: "Transformez un audit en plan que le client validera.",
          h1: "Livrer des stratégies clients",
          intro: "Une stratégie a besoin d'un point de départ chiffré et d'une courte liste d'actions. Partez d'un audit noté et bâtissez le plan sur ce qu'il révèle.",
          features: [
            { href: AI, why: "Une base chiffrée à présenter au client dès le premier jour." },
            { href: TOOLS, why: "Report Builder et Portfolios pour le reporting par client." },
            { href: ENG, why: "Automatisez les avis et les réponses pour que le plan tourne vraiment." },
          ],
        },
      },
    ],
  },

  {
    slug: "team-size",
    en: { label: "By size", h1: "Solutions by team size", intro: "The same platform, scoped to how many people and brands you run." },
    fr: { label: "Par taille", h1: "Solutions par taille d'équipe", intro: "La même plateforme, adaptée au nombre de personnes et de marques que vous gérez." },
    items: [
      {
        slug: "large-organizations",
        category: "team-size",
        en: {
          label: "Large organizations",
          desc: "Many locations, many stakeholders, one source of truth.",
          h1: "Echorank for large organizations",
          intro: "At scale the problem is consistency: the same standard applied everywhere, and reporting that rolls up without a spreadsheet.",
          features: [
            { href: MON, why: "Monitoring across every location, with alerts routed by severity." },
            { href: ENG, why: "One review and response workflow, applied consistently." },
            { href: AI, why: "Brand-level AI visibility tracked over time, not spot-checked." },
          ],
        },
        fr: {
          label: "Grandes organisations",
          desc: "Beaucoup d'établissements, beaucoup d'interlocuteurs, une seule référence.",
          h1: "Echorank360 pour les grandes organisations",
          intro: "À grande échelle, le problème est la cohérence : un même standard partout et un reporting qui se consolide sans tableur.",
          features: [
            { href: MON, why: "Surveillance de tous les établissements, alertes routées par gravité." },
            { href: ENG, why: "Un seul flux d'avis et de réponses, appliqué de façon cohérente." },
            { href: AI, why: "Visibilité IA de la marque suivie dans le temps, pas par sondage." },
          ],
        },
      },
      {
        slug: "mid-market",
        category: "team-size",
        en: {
          label: "Mid-market companies",
          desc: "Enough locations to need process, not enough to need a department.",
          h1: "Echorank for mid-market companies",
          intro: "You have outgrown doing this by hand but do not want a tool per problem. One platform covering reputation, AI visibility and search.",
          features: [
            { href: ENG, why: "Automate requests and responses instead of adding headcount." },
            { href: AI, why: "Track how assistants describe you as you enter new markets." },
            { href: TOOLS, why: "The SEO toolkit without a second subscription." },
          ],
        },
        fr: {
          label: "Entreprises de taille intermédiaire",
          desc: "Assez d'établissements pour avoir besoin de méthode, pas assez pour un service dédié.",
          h1: "Echorank360 pour les entreprises de taille intermédiaire",
          intro: "Vous avez dépassé le travail manuel sans vouloir un outil par problème. Une plateforme pour la réputation, la visibilité IA et la recherche.",
          features: [
            { href: ENG, why: "Automatisez demandes et réponses plutôt que de recruter." },
            { href: AI, why: "Suivez ce que disent les assistants à mesure que vous vous étendez." },
            { href: TOOLS, why: "La boîte à outils SEO sans second abonnement." },
          ],
        },
      },
      {
        slug: "small-teams",
        category: "team-size",
        en: {
          label: "Small teams",
          desc: "A few people, no specialist, limited time.",
          h1: "Echorank360 for small teams",
          intro: "Nobody here does this full time. The value is in what runs on a schedule and what tells you when something needs attention.",
          features: [
            { href: MON, why: "Scheduled checks and an email when something drops." },
            { href: FB, why: "Review requests that go out without anyone remembering to send them." },
            { href: FREE, why: "Start with the free tools before committing budget." },
          ],
        },
        fr: {
          label: "Petites équipes",
          desc: "Quelques personnes, pas de spécialiste, peu de temps.",
          h1: "Echorank360 pour les petites équipes",
          intro: "Personne ici n'y consacre son temps plein. L'intérêt est dans ce qui tourne tout seul et ce qui vous prévient quand il faut agir.",
          features: [
            { href: MON, why: "Contrôles programmés et courriel si quelque chose baisse." },
            { href: FB, why: "Des demandes d'avis qui partent sans que personne y pense." },
            { href: FREE, why: "Commencez par les outils gratuits avant d'engager un budget." },
          ],
        },
      },
      {
        slug: "solo-founders",
        category: "team-size",
        en: {
          label: "Solo founders",
          desc: "You are the marketing team. Start with what moves the needle.",
          h1: "Echorank360 for solo founders",
          intro: "One person cannot run every channel. Find out where you actually stand, then pick the two things worth doing this month.",
          features: [
            { href: AI, why: "A scored baseline in about a minute, with no account needed." },
            { href: FREE, why: "Free tools for the checks you only need occasionally." },
            { href: FB, why: "Turn the customers you already have into public proof." },
          ],
        },
        fr: {
          label: "Fondateurs solos",
          desc: "Vous êtes l'équipe marketing. Commencez par ce qui compte.",
          h1: "Echorank360 pour les fondateurs solos",
          intro: "Une personne seule ne peut pas tenir tous les canaux. Sachez où vous en êtes, puis choisissez les deux actions du mois.",
          features: [
            { href: AI, why: "Une base chiffrée en une minute, sans compte." },
            { href: FREE, why: "Des outils gratuits pour les vérifications ponctuelles." },
            { href: FB, why: "Transformez vos clients actuels en preuve publique." },
          ],
        },
      },
      {
        slug: "freelancers",
        category: "team-size",
        en: {
          label: "Freelancers",
          desc: "Client-ready numbers without an agency toolstack.",
          h1: "Echorank360 for freelancers",
          intro: "You need defensible figures for a proposal and a report at the end, without paying for seats you will not use.",
          features: [
            { href: AI, why: "An audit you can attach to a proposal." },
            { href: TOOLS, why: "Report Builder for the deliverable at the end of the engagement." },
            { href: FREE, why: "Free tools for quick checks between projects." },
          ],
        },
        fr: {
          label: "Indépendants",
          desc: "Des chiffres présentables sans la panoplie d'une agence.",
          h1: "Echorank360 pour les indépendants",
          intro: "Il vous faut des chiffres solides pour une proposition et un rapport à la fin, sans payer des sièges inutilisés.",
          features: [
            { href: AI, why: "Un audit à joindre à votre proposition." },
            { href: TOOLS, why: "Report Builder pour le livrable de fin de mission." },
            { href: FREE, why: "Des outils gratuits pour les vérifications entre deux projets." },
          ],
        },
      },
      {
        slug: "agencies",
        category: "team-size",
        en: {
          label: "Agencies & consultancies",
          desc: "Many clients, white-label reporting, one login.",
          h1: "Echorank360 for agencies and consultancies",
          intro: "Client work needs separation and presentation: each brand tracked on its own, and reports that carry your name rather than ours.",
          features: [
            { href: TOOLS, why: "Portfolios and Report Builder, white-labelled on Agency." },
            { href: AI, why: "Per-client AI visibility, tracked and comparable over time." },
            { href: ENG, why: "Run review workflows for every client from one place." },
          ],
        },
        fr: {
          label: "Agences et cabinets de conseil",
          desc: "Beaucoup de clients, rapports en marque blanche, un seul accès.",
          h1: "Echorank360 pour les agences et cabinets de conseil",
          intro: "Le travail client demande séparation et présentation : chaque marque suivie à part et des rapports à votre nom, pas au nôtre.",
          features: [
            { href: TOOLS, why: "Portfolios et Report Builder, en marque blanche sur Agency." },
            { href: AI, why: "Visibilité IA par client, suivie et comparable dans le temps." },
            { href: ENG, why: "Pilotez les flux d'avis de tous vos clients au même endroit." },
          ],
        },
      },
    ],
  },

  {
    slug: "roles",
    en: { label: "By role", h1: "Solutions by role", intro: "What the platform does for the person actually using it." },
    fr: { label: "Par rôle", h1: "Solutions par rôle", intro: "Ce que la plateforme apporte à la personne qui l'utilise vraiment." },
    items: [
      {
        slug: "business-owners",
        category: "roles",
        en: {
          label: "Business owners",
          desc: "One number that tells you whether this is working.",
          h1: "Echorank360 for business owners",
          intro: "You do not need a dashboard you have to study. You need to know whether people find you, what they say, and what to fix first.",
          features: [
            { href: AI, why: "A single scored view of how you show up, tracked over time." },
            { href: MON, why: "An email when something changes, instead of a daily check." },
            { href: FB, why: "More reviews without chasing customers yourself." },
          ],
        },
        fr: {
          label: "Dirigeants d'entreprise",
          desc: "Un chiffre qui vous dit si tout cela fonctionne.",
          h1: "Echorank360 pour les dirigeants",
          intro: "Vous n'avez pas besoin d'un tableau de bord à décrypter, mais de savoir si l'on vous trouve, ce que l'on dit de vous et par quoi commencer.",
          features: [
            { href: AI, why: "Une vue chiffrée unique de votre présence, suivie dans le temps." },
            { href: MON, why: "Un courriel quand quelque chose change, plutôt qu'un contrôle quotidien." },
            { href: FB, why: "Plus d'avis sans relancer vos clients vous-même." },
          ],
        },
      },
      {
        slug: "agency-leaders",
        category: "roles",
        en: {
          label: "Agency leaders",
          desc: "Win the pitch, prove the retainer.",
          h1: "Echorank360 for agency leaders",
          intro: "The two hard moments are the pitch and the renewal. Both need numbers a client recognises and a report they can forward.",
          features: [
            { href: AI, why: "A scored audit that makes the pitch concrete." },
            { href: TOOLS, why: "White-label reporting and per-client portfolios." },
            { href: MON, why: "Alerts that let you tell the client before they tell you." },
          ],
        },
        fr: {
          label: "Dirigeants d'agence",
          desc: "Gagnez l'appel d'offres, justifiez le forfait.",
          h1: "Echorank360 pour les dirigeants d'agence",
          intro: "Les deux moments difficiles sont la présentation et le renouvellement. Les deux exigent des chiffres parlants et un rapport transmissible.",
          features: [
            { href: AI, why: "Un audit chiffré qui rend la présentation concrète." },
            { href: TOOLS, why: "Rapports en marque blanche et portfolios par client." },
            { href: MON, why: "Des alertes pour prévenir le client avant qu'il ne vous prévienne." },
          ],
        },
      },
      {
        slug: "seo-professionals",
        category: "roles",
        en: {
          label: "SEO professionals",
          desc: "The classic toolkit, plus the AI layer nobody else covers.",
          h1: "Echorank360 for SEO professionals",
          intro: "Rank tracking and crawls are table stakes. The new work is whether assistants quote the page at all, and that needs measuring too.",
          features: [
            { href: TOOLS, why: "Rank tracking, crawls, backlinks and GSC in one hub." },
            { href: AI, why: "AI Lens and answer tracking for the layer above search." },
            { href: MON, why: "Bot analytics: which crawlers actually reach your pages." },
          ],
        },
        fr: {
          label: "Professionnels du SEO",
          desc: "La boîte à outils classique, plus la couche IA que personne ne couvre.",
          h1: "Echorank360 pour les professionnels du SEO",
          intro: "Le suivi de positions et les crawls sont acquis. Le nouveau travail est de savoir si les assistants citent la page, et cela se mesure aussi.",
          features: [
            { href: TOOLS, why: "Positions, crawls, backlinks et GSC au même endroit." },
            { href: AI, why: "AI Lens et suivi des réponses pour la couche au-dessus de la recherche." },
            { href: MON, why: "Bot analytics : quels robots atteignent réellement vos pages." },
          ],
        },
      },
      {
        slug: "content-marketers",
        category: "roles",
        en: {
          label: "Content marketers",
          desc: "From gap to brief to a page that gets quoted.",
          h1: "Echorank360 for content marketers",
          intro: "The measure of a page is changing. Ranking still matters, but so does whether an assistant reaches for your wording when it answers.",
          features: [
            { href: TOOLS, why: "Content Explorer, briefs and the AI Content Helper." },
            { href: AI, why: "See whether the page you published gets cited." },
            { href: FREE, why: "Score a draft before it ships." },
          ],
        },
        fr: {
          label: "Responsables de contenu",
          desc: "De l'écart au brief, jusqu'à une page qui se fait citer.",
          h1: "Echorank360 pour les responsables de contenu",
          intro: "La mesure d'une page change. Le positionnement compte toujours, mais aussi le fait qu'un assistant reprenne votre formulation.",
          features: [
            { href: TOOLS, why: "Content Explorer, briefs et assistant de contenu IA." },
            { href: AI, why: "Vérifiez si la page publiée se fait citer." },
            { href: FREE, why: "Évaluez un brouillon avant publication." },
          ],
        },
      },
      {
        slug: "growth-marketers",
        category: "roles",
        en: {
          label: "Growth marketers",
          desc: "Find the channel that is quietly working, and the one that is not.",
          h1: "Echorank360 for growth marketers",
          intro: "Attribution is hard enough without a blind spot. AI answers are now a discovery channel, and most teams have no read on it at all.",
          features: [
            { href: AI, why: "A measurable read on a channel most teams cannot see." },
            { href: TOOLS, why: "Share of search and web analytics next to the AI numbers." },
            { href: ACT, why: "Turn a signal into a task rather than a screenshot." },
          ],
        },
        fr: {
          label: "Responsables growth",
          desc: "Repérez le canal qui fonctionne discrètement, et celui qui ne fonctionne pas.",
          h1: "Echorank360 pour les responsables growth",
          intro: "L'attribution est déjà difficile sans angle mort. Les réponses IA sont devenues un canal de découverte que la plupart des équipes ne mesurent pas.",
          features: [
            { href: AI, why: "Une lecture chiffrée d'un canal que la plupart ne voient pas." },
            { href: TOOLS, why: "Part de recherche et analytics à côté des chiffres IA." },
            { href: ACT, why: "Transformez un signal en tâche plutôt qu'en capture d'écran." },
          ],
        },
      },
    ],
  },

  {
    slug: "industries",
    en: { label: "By industry", h1: "Solutions by industry", intro: "Where the reputation and visibility problem looks different." },
    fr: { label: "Par secteur", h1: "Solutions par secteur", intro: "Là où le problème de réputation et de visibilité se pose différemment." },
    items: [
      {
        slug: "professional-services",
        category: "industries",
        en: {
          label: "Professional services",
          desc: "Trust decides the engagement before the first call.",
          h1: "Echorank360 for professional services",
          intro: "Clients check you before they contact you. What an assistant says about your firm, and what your reviews say, is the shortlist.",
          features: [
            { href: AI, why: "Know how assistants describe your firm to a prospective client." },
            { href: FB, why: "Collect the references that make a decision easy." },
            { href: MON, why: "Catch a bad review while it can still be answered well." },
          ],
        },
        fr: {
          label: "Services professionnels",
          desc: "La confiance décide de la mission avant le premier appel.",
          h1: "Echorank360 pour les services professionnels",
          intro: "Vos clients vous vérifient avant de vous contacter. Ce qu'un assistant dit de votre cabinet et ce que disent vos avis font la présélection.",
          features: [
            { href: AI, why: "Sachez comment les assistants décrivent votre cabinet." },
            { href: FB, why: "Recueillez les références qui facilitent la décision." },
            { href: MON, why: "Repérez un avis négatif tant qu'on peut encore y répondre." },
          ],
        },
      },
      {
        slug: "ecommerce-retail",
        category: "industries",
        en: {
          label: "Ecommerce & retail",
          desc: "Product discovery now starts in an answer, not a listing.",
          h1: "Echorank360 for ecommerce and retail",
          intro: "Shoppers ask assistants what to buy. Whether your product is named — and how it is described — is now part of the funnel.",
          features: [
            { href: AI, why: "Track whether assistants recommend your products by name." },
            { href: TOOLS, why: "Rank tracking and SERP monitoring for the terms that convert." },
            { href: FB, why: "Reviews at the volume product pages need." },
          ],
        },
        fr: {
          label: "E-commerce et distribution",
          desc: "La découverte produit commence dans une réponse, plus dans une liste.",
          h1: "Echorank360 pour l'e-commerce et la distribution",
          intro: "Les acheteurs demandent aux assistants quoi acheter. Que votre produit soit nommé, et comment il est décrit, fait désormais partie du tunnel.",
          features: [
            { href: AI, why: "Suivez si les assistants recommandent vos produits par leur nom." },
            { href: TOOLS, why: "Suivi de positions et de SERP sur les termes qui convertissent." },
            { href: FB, why: "Des avis au volume qu'exigent les fiches produit." },
          ],
        },
      },
      {
        slug: "marketing-agencies",
        category: "industries",
        en: {
          label: "Marketing agencies",
          desc: "A service line your clients are already asking about.",
          h1: "Echorank360 for marketing agencies",
          intro: "Clients have started asking what AI says about them. Answering that with data, per client, is a service you can bill for.",
          features: [
            { href: AI, why: "Per-client AI visibility, with a number that moves." },
            { href: TOOLS, why: "White-label reports and portfolios per client." },
            { href: ENG, why: "Review workflows you can run on a client's behalf." },
          ],
        },
        fr: {
          label: "Agences marketing",
          desc: "Une offre que vos clients réclament déjà.",
          h1: "Echorank360 pour les agences marketing",
          intro: "Vos clients commencent à demander ce que l'IA dit d'eux. Y répondre avec des données, client par client, est une prestation facturable.",
          features: [
            { href: AI, why: "Visibilité IA par client, avec un chiffre qui évolue." },
            { href: TOOLS, why: "Rapports en marque blanche et portfolios par client." },
            { href: ENG, why: "Des flux d'avis que vous pilotez pour le compte du client." },
          ],
        },
      },
      {
        slug: "saas-b2b",
        category: "industries",
        en: {
          label: "SaaS & B2B tech",
          desc: "Get named in the comparison, not just the category.",
          h1: "Echorank360 for SaaS and B2B tech",
          intro: "Buyers ask assistants for alternatives and comparisons. Being absent from that answer costs more than a ranking drop.",
          features: [
            { href: AI, why: "Track alternatives and comparison prompts, not just your brand." },
            { href: TOOLS, why: "Content gaps for the comparison pages buyers actually read." },
            { href: MON, why: "Alerts when a competitor takes your place in an answer." },
          ],
        },
        fr: {
          label: "SaaS et tech B2B",
          desc: "Être nommé dans la comparaison, pas seulement dans la catégorie.",
          h1: "Echorank360 pour le SaaS et la tech B2B",
          intro: "Les acheteurs demandent aux assistants des alternatives et des comparatifs. Être absent de cette réponse coûte plus qu'une perte de position.",
          features: [
            { href: AI, why: "Suivez les requêtes d'alternatives et de comparaison, pas que votre marque." },
            { href: TOOLS, why: "Écarts de contenu sur les comparatifs que lisent vos acheteurs." },
            { href: MON, why: "Alerte quand un concurrent prend votre place dans une réponse." },
          ],
        },
      },
      {
        slug: "healthcare",
        category: "industries",
        en: {
          label: "Healthcare practices",
          desc: "Patients choose on reviews, and read them closely.",
          h1: "Echorank360 for healthcare practices",
          intro: "Few decisions are researched as carefully as choosing a practice. Reviews, accuracy and response tone all carry more weight here.",
          features: [
            { href: FB, why: "Ask for feedback at the right moment, by email or SMS." },
            { href: ACT, why: "Reach an unhappy patient before the review is written." },
            { href: MON, why: "Watch new reviews across the platforms patients actually use." },
          ],
        },
        fr: {
          label: "Cabinets de santé",
          desc: "Les patients choisissent sur les avis, et les lisent attentivement.",
          h1: "Echorank360 pour les cabinets de santé",
          intro: "Peu de décisions sont autant vérifiées que le choix d'un praticien. Les avis, l'exactitude et le ton des réponses pèsent davantage ici.",
          features: [
            { href: FB, why: "Demandez un retour au bon moment, par courriel ou SMS." },
            { href: ACT, why: "Joignez un patient mécontent avant que l'avis ne soit écrit." },
            { href: MON, why: "Suivez les nouveaux avis sur les plateformes que consultent les patients." },
          ],
        },
      },
      {
        slug: "local-businesses",
        category: "industries",
        en: {
          label: "Local businesses",
          desc: "Be the one recommended nearby.",
          h1: "Echorank360 for local businesses",
          intro: "Local demand is decided on proximity, reviews and whether your details are right. All three are fixable and all three are measurable.",
          features: [
            { href: FB, why: "A steady flow of reviews from the customers you already serve." },
            { href: MON, why: "Listing and review monitoring across local platforms." },
            { href: AI, why: "Check whether assistants recommend you for nearby searches." },
          ],
        },
        fr: {
          label: "Commerces de proximité",
          desc: "Être celui que l'on recommande dans le quartier.",
          h1: "Echorank360 pour les commerces de proximité",
          intro: "La demande locale se décide sur la proximité, les avis et l'exactitude de vos informations. Ces trois points se corrigent et se mesurent.",
          features: [
            { href: FB, why: "Un flux régulier d'avis venant de vos clients actuels." },
            { href: MON, why: "Surveillance des fiches et des avis sur les plateformes locales." },
            { href: AI, why: "Vérifiez si les assistants vous recommandent pour les recherches proches." },
          ],
        },
      },
    ],
  },
];

/** Flat list of every item, in category order. */
export const SOLUTION_ITEMS: SolutionItem[] = SOLUTION_CATEGORIES.flatMap((c) => c.items);

export function categoryBySlug(slug: string): SolutionCategory | undefined {
  return SOLUTION_CATEGORIES.find((c) => c.slug === slug);
}

export function itemBySlug(category: string, slug: string): SolutionItem | undefined {
  return categoryBySlug(category)?.items.find((i) => i.slug === slug);
}

/** en/fr only — de-CH and the regional locales fold, as elsewhere in marketing. */
export function solutionBase(locale: string): SolutionBase {
  return locale.startsWith("fr") ? "fr" : "en";
}

/**
 * Every solutions path, for the sitemap registry — category indexes plus the
 * 25 item pages. Derived, so adding an item registers it everywhere at once.
 */
export function solutionRoutes(): string[] {
  return SOLUTION_CATEGORIES.flatMap((c) => [
    `/solutions/${c.slug}`,
    ...c.items.map((i) => `/solutions/${c.slug}/${i.slug}`),
  ]);
}
