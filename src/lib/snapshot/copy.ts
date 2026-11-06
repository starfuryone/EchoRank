// src/lib/snapshot/copy.ts
//
// Every string the free AI Visibility Check shows: landing page, widget,
// result, share page. en + fr written; every other marketing locale folds to
// en, as on /free-audit. Dependency-free: the client widget imports it.

export type SnapshotBase = "en" | "fr";
export const snapshotBaseOf = (locale: string): SnapshotBase => (locale.startsWith("fr") ? "fr" : "en");

export interface SnapshotCopy {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  h1: string;
  sub: string;
  pills: string[];
  form: {
    brand: string;
    brandPh: string;
    domain: string;
    domainPh: string;
    city: string;
    cityPh: string;
    category: string;
    categoryPh: string;
    categoryHint: string;
    prefilling: string;
    submit: string;
    submitting: string;
    fine: string;
  };
  progress: { queued: string; running: string; note: string };
  errors: Record<string, string>;
  result: {
    title: string;
    mentionRate: string;
    citationRate: string;
    notAnswered: string;
    competitorsTitle: string;
    competitorsNone: string;
    notMentionedLead: string;
    cached: string;
    capped: string;
    sourcesCount: string;
  };
  gate: {
    title: string;
    body: string;
    email: string;
    consent: string;
    submit: string;
    sending: string;
    privacy: string;
    sent: string;
  };
  full: {
    promptsTitle: string;
    prompt: string;
    yes: string;
    no: string;
    error: string;
    cited: string;
    sourcesTitle: string;
    sourcesNone: string;
    timesCited: string;
    share: string;
    copy: string;
    copied: string;
    expires: string;
    kinds: Record<"best" | "alternatives" | "howto" | "direct", string>;
    competitorsIn: string;
    showExcerpt: string;
    sourcesDecided: string;
    colSource: string;
    colTimes: string;
    colSupported: string;
    colYou: string;
    yesShort: string;
    noShort: string;
  };
  todo: {
    title: string;
    lead: string;
    none: string;
    types: Record<"directory" | "publisher" | "competitor" | "forum" | "unknown", string>;
    actions: Record<"get_listed" | "claim_profile" | "pitch_comparison" | "join_discussion", string>;
    noAction: string;
  };
  /** The citation gap (src/lib/citation-gap.ts), top three. */
  gap: {
    title: string;
    lead: string;
    none: string;
    colSource: string;
    colType: string;
    colTimes: string;
    colNamed: string;
    more: string;
    types: Record<"review_site" | "directory" | "forum" | "news" | "own_site" | "other", string>;
  };
  shows: { heading: string; lead: string; items: { h: string; p: string }[]; footnote: string };
  upsell: { heading: string; body: string; cta: string; planLine: string };
  /** Pricing page banner when arriving from the check's upsell. */
  pricingFit: string;
  share: { metaTitle: string; title: string; expired: string; expiredBody: string; runYours: string };
  again: string;
}

export const SNAPSHOT_COPY: Record<SnapshotBase, SnapshotCopy> = {
  en: {
    metaTitle: "Free AI Visibility Check: what ChatGPT and Gemini say about you | Echorank360",
    metaDescription:
      "Run 10 real questions through ChatGPT and Gemini and see whether you're mentioned, who is, and which sources they cite. Free, no account.",
    eyebrow: "Free AI Visibility Check",
    h1: "See what AI says when customers ask.",
    sub: "Run 10 real questions through ChatGPT and Gemini and see whether you're mentioned, who is, and which sources they cite.",
    pills: ["Free", "No account", "Real ChatGPT and Gemini answers"],
    form: {
      brand: "Business name",
      brandPh: "Acme Plumbing",
      domain: "Website",
      domainPh: "acmeplumbing.com",
      city: "City (optional)",
      cityPh: "Leeds",
      category: "What you do",
      categoryPh: "emergency plumber",
      categoryHint: "The category customers would ask about. We fill it from your homepage; change it if it's off.",
      prefilling: "Reading your homepage…",
      submit: "Run the free check",
      submitting: "Starting…",
      fine: "Takes about a minute. 3 checks per day per visitor; a site checked in the last 7 days shows that result.",
    },
    progress: {
      queued: "Queued…",
      running: "Asking ChatGPT and Gemini 10 questions…",
      note: "Each answer is a live, search-backed response. This usually takes under a minute.",
    },
    errors: {
      invalid_request: "Please fill in the business name, website and what you do.",
      invalid_domain: "That doesn't look like a website address.",
      blocked: "We can't run a check for that.",
      turnstile: "The anti-bot check didn't pass. Please try again.",
      rate_limited: "You've run 3 checks today. Come back tomorrow, or start a plan to track every day.",
      busy: "A check for this site is starting right now. Try again in a moment.",
      unavailable: "The check is unavailable right now. Please try again later.",
      failed: "The check couldn't get answers from the engines. Please try again later.",
      invalid_email: "Please enter a valid email address.",
      not_ready: "The report isn't ready yet.",
      generic: "Something went wrong. Please try again.",
    },
    result: {
      title: "Your result",
      mentionRate: "mentioned",
      citationRate: "cited as a source",
      notAnswered: "no answers",
      competitorsTitle: "Named instead of you",
      competitorsNone: "No competitors were named.",
      notMentionedLead: "AI doesn't mention you yet. These are the competitors it names instead.",
      cached: "This site was checked in the last 7 days, so you're seeing that result.",
      capped: "The run hit its cost limit, so some questions were not asked.",
      sourcesCount: "{n} sources cited across the answers",
    },
    gate: {
      title: "Email me the full report",
      body: "Get the 10 questions with each engine's answer, the sources they cited, and a PDF copy.",
      email: "Email",
      consent: "Also send me Echorank360 tips and product news. Unsubscribe anytime.",
      submit: "Email me the full report",
      sending: "Sending…",
      privacy: "We use your email to send this report.",
      sent: "Sent. The full report is below and in your inbox.",
    },
    full: {
      promptsTitle: "The 10 questions",
      prompt: "Question",
      yes: "YES",
      no: "no",
      error: "no answer",
      cited: "cited",
      sourcesTitle: "Sources the answers cited",
      sourcesNone: "No sources were cited.",
      timesCited: "answers",
      share: "Share link",
      copy: "Copy",
      copied: "Copied",
      expires: "Works until {date}.",
      kinds: { best: "Best / top", alternatives: "Alternatives", howto: "How to", direct: "About you" },
      competitorsIn: "Named",
      showExcerpt: "Answer excerpt",
      sourcesDecided: "Sources that decided the answers",
      colSource: "Source",
      colTimes: "Times cited",
      colSupported: "Competitors it supported",
      colYou: "You cited there",
      yesShort: "yes",
      noShort: "no",
    },
    todo: {
      title: "What to do",
      lead: "The sources the answers leaned on where you don't appear, ranked by how often they were cited.",
      none: "You appear wherever the answers cited a source. Nothing to add here.",
      types: {
        directory: "Directory / review site",
        publisher: "Publisher",
        competitor: "Competitor-owned",
        forum: "Forum",
        unknown: "Unclassified",
      },
      actions: {
        get_listed: "Get listed",
        claim_profile: "Claim your profile",
        pitch_comparison: "Pitch a comparison",
        join_discussion: "Join the discussion",
      },
      noAction: "No action",
    },
    gap: {
      title: "Where competitors are cited and you are not",
      lead: "The sources behind answers that named a competitor and not you, most cited first.",
      none: "No answer named a competitor without you. No gap to close here.",
      colSource: "Source",
      colType: "Type",
      colTimes: "Answers",
      colNamed: "Named instead of you",
      more: "The full list, refreshed on every check, is in the paid plans.",
      types: {
        review_site: "Review site",
        directory: "Directory",
        forum: "Forum",
        news: "News",
        own_site: "Your own site",
        other: "Other",
      },
    },
    shows: {
      heading: "What the check shows",
      lead: "The moment that matters: a customer asks an AI assistant a category question. Are you in the answer?",
      items: [
        { h: "Are you mentioned?", p: "Mention rate per engine across 10 real questions." },
        { h: "Who's named instead?", p: "The competitors that fill the answers you're absent from." },
        { h: "Where do the answers come from?", p: "The sources AI leaned on, and which competitor each one helped." },
        { h: "What to do about it.", p: "The sources you aren't on yet, ranked by how often they decided an answer." },
      ],
      footnote: "Every prompt comes with the answer excerpt, so you can see it for yourself.",
    },
    upsell: {
      heading: "The shortlist is made before anyone visits your site.",
      body: "When AI leaves you out, names a competitor first, or cites their sources instead of yours, the customer has already narrowed the choice — and you never saw the question. Tracking shows you every answer that changes, the week it changes.",
      cta: "Track these 10 prompts weekly",
      planLine: "10 prompts × 2 engines × weekly",
    },
    pricingFit: "Tracking the 10 prompts from your check on 2 engines, weekly: the {plan} plan covers it.",
    share: {
      metaTitle: "AI Visibility Check report",
      title: "AI Visibility Check: {brand}",
      expired: "This report link has expired",
      expiredBody: "Shared reports stay available for 30 days. Run a new check to see today's answers.",
      runYours: "Run a free check",
    },
    again: "Check another business",
  },
  fr: {
    metaTitle: "Vérification gratuite de visibilité IA : ce que ChatGPT et Gemini disent de vous | Echorank360",
    metaDescription:
      "Posez 10 vraies questions à ChatGPT et Gemini : êtes-vous cité, qui l'est à votre place, et sur quelles sources s'appuient-ils. Gratuit, sans compte.",
    eyebrow: "Vérification gratuite de visibilité IA",
    h1: "Voyez ce que l'IA répond quand vos clients demandent.",
    sub: "Posez 10 vraies questions à ChatGPT et Gemini, et voyez si vous êtes cité, qui l'est à votre place et quelles sources ils citent.",
    pills: ["Gratuit", "Sans compte", "Vraies réponses de ChatGPT et Gemini"],
    form: {
      brand: "Nom de l'entreprise",
      brandPh: "Plomberie Martin",
      domain: "Site web",
      domainPh: "plomberie-martin.fr",
      city: "Ville (facultatif)",
      cityPh: "Lyon",
      category: "Votre activité",
      categoryPh: "plombier",
      categoryHint: "La catégorie sur laquelle vos clients posent des questions. Nous la tirons de votre page d'accueil ; corrigez-la si besoin.",
      prefilling: "Lecture de votre page d'accueil…",
      submit: "Lancer la vérification gratuite",
      submitting: "Démarrage…",
      fine: "Environ une minute. 3 vérifications par jour et par visiteur ; un site vérifié ces 7 derniers jours affiche ce résultat.",
    },
    progress: {
      queued: "En file d'attente…",
      running: "10 questions posées à ChatGPT et Gemini…",
      note: "Chaque réponse est générée en direct, avec recherche web. Comptez en général moins d'une minute.",
    },
    errors: {
      invalid_request: "Indiquez le nom de l'entreprise, le site web et votre activité.",
      invalid_domain: "Cette adresse ne ressemble pas à un site web.",
      blocked: "Nous ne pouvons pas lancer de vérification pour ce site.",
      turnstile: "La vérification anti-robot a échoué. Veuillez réessayer.",
      rate_limited: "Vous avez lancé 3 vérifications aujourd'hui. Revenez demain, ou choisissez un forfait pour un suivi quotidien.",
      busy: "Une vérification de ce site est en cours de lancement. Réessayez dans un instant.",
      unavailable: "La vérification est indisponible pour le moment. Réessayez plus tard.",
      failed: "Les moteurs n'ont pas répondu. Réessayez plus tard.",
      invalid_email: "Indiquez une adresse e-mail valide.",
      not_ready: "Le rapport n'est pas encore prêt.",
      generic: "Une erreur s'est produite. Veuillez réessayer.",
    },
    result: {
      title: "Votre résultat",
      mentionRate: "de mentions",
      citationRate: "cité comme source",
      notAnswered: "aucune réponse",
      competitorsTitle: "Cités à votre place",
      competitorsNone: "Aucun concurrent n'a été cité.",
      notMentionedLead: "L'IA ne vous mentionne pas encore. Voici les concurrents qu'elle cite à votre place.",
      cached: "Ce site a été vérifié ces 7 derniers jours : vous voyez ce résultat.",
      capped: "La vérification a atteint sa limite de coût : certaines questions n'ont pas été posées.",
      sourcesCount: "{n} sources citées dans les réponses",
    },
    gate: {
      title: "Recevoir le rapport complet par e-mail",
      body: "Les 10 questions avec la réponse de chaque moteur, les sources citées, et une copie en PDF.",
      email: "E-mail",
      consent: "M'envoyer aussi les conseils et nouveautés d'Echorank360. Désinscription à tout moment.",
      submit: "Recevoir le rapport complet",
      sending: "Envoi…",
      privacy: "Nous utilisons votre e-mail pour vous envoyer ce rapport.",
      sent: "Envoyé. Le rapport complet est ci-dessous et dans votre boîte de réception.",
    },
    full: {
      promptsTitle: "Les 10 questions",
      prompt: "Question",
      yes: "OUI",
      no: "non",
      error: "sans réponse",
      cited: "cité",
      sourcesTitle: "Sources citées dans les réponses",
      sourcesNone: "Aucune source citée.",
      timesCited: "réponses",
      share: "Lien de partage",
      copy: "Copier",
      copied: "Copié",
      expires: "Valable jusqu'au {date}.",
      kinds: { best: "Meilleurs", alternatives: "Alternatives", howto: "Comment faire", direct: "Sur vous" },
      competitorsIn: "Cités",
      showExcerpt: "Extrait de la réponse",
      sourcesDecided: "Les sources qui ont fait les réponses",
      colSource: "Source",
      colTimes: "Citée",
      colSupported: "Concurrents qu'elle a servis",
      colYou: "Vous y êtes cité",
      yesShort: "oui",
      noShort: "non",
    },
    todo: {
      title: "Que faire",
      lead: "Les sources sur lesquelles les réponses s'appuient et où vous n'apparaissez pas, classées par nombre de citations.",
      none: "Vous apparaissez partout où les réponses citent une source. Rien à ajouter ici.",
      types: {
        directory: "Annuaire / site d'avis",
        publisher: "Média",
        competitor: "Site d'un concurrent",
        forum: "Forum",
        unknown: "Non classé",
      },
      actions: {
        get_listed: "Vous y faire référencer",
        claim_profile: "Revendiquer votre fiche",
        pitch_comparison: "Proposer un comparatif",
        join_discussion: "Prendre part à la discussion",
      },
      noAction: "Aucune action",
    },
    gap: {
      title: "Là où vos concurrents sont cités, et pas vous",
      lead: "Les sources des réponses qui nomment un concurrent sans vous nommer, des plus citées aux moins citées.",
      none: "Aucune réponse ne nomme un concurrent sans vous. Rien à combler ici.",
      colSource: "Source",
      colType: "Type",
      colTimes: "Réponses",
      colNamed: "Nommés à votre place",
      more: "La liste complète, mise à jour à chaque vérification, est incluse dans les forfaits payants.",
      types: {
        review_site: "Site d’avis",
        directory: "Annuaire",
        forum: "Forum",
        news: "Presse",
        own_site: "Votre propre site",
        other: "Autre",
      },
    },
    shows: {
      heading: "Ce que montre la vérification",
      lead: "Le moment décisif : un client pose une question sur votre catégorie à un assistant IA. Êtes-vous dans la réponse ?",
      items: [
        { h: "Êtes-vous mentionné ?", p: "Le taux de mention par moteur, sur 10 vraies questions." },
        { h: "Qui est cité à votre place ?", p: "Les concurrents qui occupent les réponses dont vous êtes absent." },
        { h: "D'où viennent les réponses ?", p: "Les sources sur lesquelles l'IA s'est appuyée, et le concurrent que chacune a servi." },
        { h: "Que faire ?", p: "Les sources où vous n'êtes pas encore, classées selon le nombre de réponses qu'elles ont emportées." },
      ],
      footnote: "Chaque question est accompagnée de l'extrait de la réponse : vous pouvez vérifier par vous-même.",
    },
    upsell: {
      heading: "La liste restreinte se fait avant qu'on visite votre site.",
      body: "Quand l'IA vous oublie, cite d'abord un concurrent ou s'appuie sur ses sources plutôt que les vôtres, le client a déjà fait son tri — et vous n'avez jamais vu la question. Le suivi vous montre chaque réponse qui change, la semaine où elle change.",
      cta: "Suivre ces 10 questions chaque semaine",
      planLine: "10 questions × 2 moteurs × chaque semaine",
    },
    pricingFit: "Suivre les 10 questions de votre vérification sur 2 moteurs, chaque semaine : le forfait {plan} le couvre.",
    share: {
      metaTitle: "Rapport de vérification de visibilité IA",
      title: "Vérification de visibilité IA : {brand}",
      expired: "Ce lien de rapport a expiré",
      expiredBody: "Les rapports partagés restent disponibles 30 jours. Lancez une nouvelle vérification pour voir les réponses d'aujourd'hui.",
      runYours: "Lancer une vérification gratuite",
    },
    again: "Vérifier une autre entreprise",
  },
};

/** The plan picker link: these prompts × 2 engines × weekly, prefilled. */
export function trackHref(locale: string, snapshotId?: string): string {
  const q = new URLSearchParams({ track: "10x2-weekly", from: "ai-visibility-check" });
  if (snapshotId) q.set("snapshot", snapshotId);
  return `/${locale}/pricing?${q.toString()}#pricing`;
}
