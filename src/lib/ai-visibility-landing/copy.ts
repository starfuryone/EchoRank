// src/lib/ai-visibility-landing/copy.ts — the words on /[locale]/ai-visibility,
// the AI Visibility plan's landing page, in en / fr / de (de-CH: ss, never ß).
// en-CA reads en, fr-CA reads fr (pricingBase()).
//
// NO NUMBER AND NO ENGINE NAME IS TYPED HERE. Every sentence that carries one
// is a function of the facts (facts.ts): prices, prompts, engines, cadence,
// repetitions, the keyword scan's daily limit, the score weights.

import type { AiCheckupShape } from "@/lib/plan-config";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import type { KeywordWidgetContent } from "@/components/KeywordWidget";
import type { AllowanceRow, AvFeatureId, STARTER_ADD_AREAS } from "./facts";

export type AvBase = "en" | "fr" | "de";
const NB = CRAWLER_BRAND.name;
type AddArea = (typeof STARTER_ADD_AREAS)[number];

export interface AvFaqFacts {
  rows: AllowanceRow[];
  reviewsFrom: string | null;
  list: (items: string[]) => string;
}

export interface AvCopy {
  meta: { title: string; description: (engines: string) => string };
  subnav: { aria: string; how: string; what: string; tools: string; pricing: string; faq: string };
  hero: {
    h1a: string;
    h1b: string;
    sub: string;
    primary: (price: string) => string;
    secondary: string;
    engines: (planName: string, engines: string) => string;
  };
  mock: {
    label: string;
    aria: string;
    q: string;
    l1: string;
    l2desc: string;
    youBrand: string;
    youDesc: string;
    pos: string;
    l4desc: string;
    /** The alert chip: the engine is the AI plan's last live one, the age relative. */
    alert: (engine: string) => string;
    scoreChip: (n: number) => string;
  };
  problem: { h2: string; p: string };
  how: {
    label: string;
    h2: string;
    steps: [
      { h3: string; p: (scansPerDay: number) => string },
      { h3: string; p: (cadence: string, reps: number) => string },
      { h3: string; p: string },
    ];
    kwH3: string;
  };
  what: {
    label: string;
    h2: string;
    items: Record<AvFeatureId, { h3: string; p: string }>;
    score: { h3: string; p: (w: { mention: number; position: number; citation: number; sentiment: number }) => string; link: string };
  };
  tools: { label: string; h2: string; check: { name: string; line: string; cta: string }; audit: { name: string; line: string; cta: string } };
  pricing: {
    label: string;
    h2: string;
    tableCaption: string;
    cols: { plan: string; prompts: string; engines: string; cadence: string; reps: string };
    reps: (n: number) => string;
    starterAdds: (starter: string, items: string) => string;
    areas: Record<AddArea, string>;
  };
  faqH2: string;
  faq: (f: AvFaqFacts) => { q: string; a: string }[];
  final: { h2: string };
  /** errLimit and fine are filled from kwText (keywordWidgetCopy). */
  kw: KeywordWidgetContent;
  kwText: { errLimit: (n: number) => string; fine: (n: number) => string };
}

/** "2 times" / "once": how many times each prompt is asked per engine. */
const timesEn = (n: number) => (n === 1 ? "once" : `${n} times`);
const timesFr = (n: number) => (n === 1 ? "une fois" : `${n} fois`);
const timesDe = (n: number) => (n === 1 ? "einmal" : `${n}-mal`);

const cadenceOf = (row: AllowanceRow, labels: Record<AiCheckupShape["frequency"], string>) => labels[row.frequency];
const CAD: Record<AvBase, Record<AiCheckupShape["frequency"], string>> = {
  en: { weekly: "weekly", twice_weekly: "twice a week", daily: "daily", custom: "on a schedule set in your contract", none: "never" },
  fr: { weekly: "chaque semaine", twice_weekly: "deux fois par semaine", daily: "chaque jour", custom: "selon le calendrier de votre contrat", none: "jamais" },
  de: { weekly: "wöchentlich", twice_weekly: "zweimal pro Woche", daily: "täglich", custom: "nach dem Zeitplan Ihres Vertrags", none: "nie" },
};
export function cadenceLabel(base: AvBase, f: AiCheckupShape["frequency"]): string {
  return CAD[base][f];
}

const KW_EN: Omit<KeywordWidgetContent, "errLimit" | "fine"> = {
  label: "Run a free keyword scan",
  placeholder: "yourdomain.com",
  runIdle: "Scan keywords",
  runBusy: "Scanning…",
  note: "Reading your page and extracting keywords — takes a few seconds.",
  errGeneric: "The scan could not run. Check the URL and try again in a minute.",
  seedsTitle: "Seed keywords",
  questionsTitle: "Question keywords",
  promptsTitle: "AI prompts you should be recommended in",
  techTitle: "Technical SEO",
  techSummaryTemplate: "{pass} checks passed · {warn} warnings · {fail} failed — full details on a plan.",
  diffLow: "easy",
  diffMedium: "medium",
  diffHigh: "hard",
  lockedTemplate: "+{n} more on a plan",
  upsell: "This scan read your homepage only. On a plan, you pick the prompts to track and Echorank asks the engines for you.",
  cta: "See plans",
  again: "Scan another site",
};

const KW_FR: Omit<KeywordWidgetContent, "errLimit" | "fine"> = {
  label: "Lancez une analyse de mots-clés gratuite",
  placeholder: "votredomaine.com",
  runIdle: "Analyser les mots-clés",
  runBusy: "Analyse en cours…",
  note: "Lecture de votre page et extraction des mots-clés — quelques secondes.",
  errGeneric: "L’analyse n’a pas pu s’exécuter. Vérifiez l’URL et réessayez dans une minute.",
  seedsTitle: "Mots-clés de base",
  questionsTitle: "Mots-clés en question",
  promptsTitle: "Requêtes IA où vous devriez être recommandé",
  techTitle: "SEO technique",
  techSummaryTemplate: "{pass} vérifications réussies · {warn} avertissements · {fail} échecs — détails complets avec un forfait.",
  diffLow: "facile",
  diffMedium: "moyen",
  diffHigh: "difficile",
  lockedTemplate: "+{n} de plus avec un forfait",
  upsell: "Cette analyse n’a lu que votre page d’accueil. Avec un forfait, vous choisissez les requêtes à suivre et Echorank interroge les moteurs pour vous.",
  cta: "Voir les forfaits",
  again: "Analyser un autre site",
};

const KW_DE: Omit<KeywordWidgetContent, "errLimit" | "fine"> = {
  label: "Kostenlosen Keyword-Scan starten",
  placeholder: "ihredomain.ch",
  runIdle: "Keywords scannen",
  runBusy: "Scan läuft…",
  note: "Ihre Seite wird gelesen und Keywords werden extrahiert — dauert wenige Sekunden.",
  errGeneric: "Der Scan konnte nicht ausgeführt werden. Prüfen Sie die URL und versuchen Sie es in einer Minute erneut.",
  seedsTitle: "Basis-Keywords",
  questionsTitle: "Frage-Keywords",
  promptsTitle: "KI-Prompts, in denen Sie empfohlen werden sollten",
  techTitle: "Technisches SEO",
  techSummaryTemplate: "{pass} Prüfungen bestanden · {warn} Warnungen · {fail} fehlgeschlagen — alle Details in einem Abo.",
  diffLow: "leicht",
  diffMedium: "mittel",
  diffHigh: "schwer",
  lockedTemplate: "+{n} weitere in einem Abo",
  upsell: "Dieser Scan hat nur Ihre Startseite gelesen. Mit einem Abo wählen Sie die Prompts, die verfolgt werden, und Echorank fragt die Engines für Sie.",
  cta: "Abos ansehen",
  again: "Weitere Website scannen",
};

const EN: AvCopy = {
  meta: {
    title: "AI Visibility: track what ChatGPT and AI search say about you",
    description: (engines) =>
      `See whether ${engines} name your business when customers ask. Daily prompt tracking, competitors named instead of you, cited sources and alerts when you drop out.`,
  },
  subnav: { aria: "On this page", how: "How it works", what: "What you get", tools: "Free tools", pricing: "Pricing", faq: "FAQ" },
  hero: {
    h1a: "When someone asks ChatGPT for a recommendation,",
    h1b: " are you in the answer?",
    sub: "Echorank tracks the prompts that matter to your business, shows who the AI names instead of you, and alerts you the moment an engine stops recommending you.",
    primary: (price) => `Start AI Visibility: ${price}/mo`,
    secondary: "See what AI says about you, free",
    engines: (plan, engines) => `${plan} asks ${engines}.`,
  },
  mock: {
    label: "Example",
    aria: "Example of a tracked AI answer",
    q: "best accounting software for freelancers",
    l1: "Here are the tools freelancers rate highest:",
    l2desc: "strong invoicing",
    youBrand: "Your brand",
    youDesc: "best value for solo work",
    pos: "↑ #2 this week",
    l4desc: "good bank sync",
    alert: (engine) => `⚠ Dropped from ${engine} answers · 3 days ago`,
    scoreChip: (n) => `AI Search Score ${n}`,
  },
  problem: {
    h2: "The new search results have no page two",
    p: "An AI answer names three or four businesses. Everyone else is invisible, and nothing tells you when you fall out. AI Visibility makes that layer observable.",
  },
  how: {
    label: "How it works",
    h2: "Three steps, then it runs on its own",
    steps: [
      {
        h3: "1. Pick your prompts",
        p: (n) => `Choose the questions your customers ask an AI. The free keyword scan below suggests prompts from your homepage (${n} scans a day, no account).`,
      },
      {
        h3: "2. Echorank asks the engines",
        p: (cadence, reps) => `On your plan's schedule (${cadence} on AI Visibility), each prompt is asked ${timesEn(reps)} per engine, and every answer is stored.`,
      },
      { h3: "3. You see what changed", p: "Whether you were mentioned, which competitors were named instead, which sources the engines cited, and an alert when you drop out." },
    ],
    kwH3: "Find your prompts: free keyword scan",
  },
  what: {
    label: "What you get",
    h2: "What the AI Visibility plan includes",
    items: {
      answers: { h3: "Answer tracking", p: "Every answer to every tracked prompt, stored: who gets named, in what order, and why." },
      trend: { h3: "Mention-rate trend", p: "Your share of answers that name you, over time, so a slow slide shows weeks before it costs you customers." },
      competitors: { h3: "Competitors named instead", p: "The businesses the engines recommend when they leave you out, prompt by prompt." },
      sources: { h3: "Cited sources and citation gaps", p: "The pages and sites the engines cite, and the ones that cite your competitors but not you." },
      alerts: { h3: "Lost-recommendation alerts", p: "An email when you drop out of an answer you used to appear in, naming the prompt, the engine and who replaced you." },
      history: { h3: "History", p: "Every checkup kept, so you can see what an engine said last month and compare." },
    },
    score: {
      h3: "AI Search Score",
      p: (w) => `One 0–100 number per checkup: how often you are mentioned (${w.mention}%), how high (${w.position}%), how often you are cited (${w.citation}%) and how warmly (${w.sentiment}%).`,
      link: "How we measure",
    },
  },
  tools: {
    label: "Free tools",
    h2: "Two free tools, two different questions",
    check: { name: "AI Visibility Check", line: "What AI says about you: we ask the engines about your business once and show the answers.", cta: "Run the check" },
    audit: { name: "AI Readiness Audit", line: "Whether AI can read your site: crawler access, readable content and the facts an answer quotes.", cta: "Run the audit" },
  },
  pricing: {
    label: "Pricing",
    h2: "AI tracking on every plan",
    tableCaption: "AI allowances per plan",
    cols: { plan: "Plan", prompts: "Prompts", engines: "Engines", cadence: "How often", reps: "Asks per engine" },
    reps: (n) => timesEn(n),
    starterAdds: (starter, items) => `${starter} adds ${items}.`,
    areas: {
      reputation: "review management",
      seo_tools: "the SEO tools",
      crawler: `the ${NB} site crawler`,
      marketing_studio: "Marketing Studio",
    },
  },
  faqH2: "Questions",
  faq: ({ rows, reviewsFrom, list }) => {
    const av = rows[0];
    return [
      {
        q: "Which AI engines do you track?",
        a: rows.map((r) => `${r.name}: ${list(r.engines)}.`).join(" ") + " We list only the engines we query today.",
      },
      {
        q: "How often are answers checked?",
        a: rows.map((r) => `${r.name}: ${cadenceOf(r, CAD.en)}.`).join(" "),
      },
      {
        q: "AI answers change every time. How do you handle that?",
        a:
          "The same prompt can get a different answer a minute later. " +
          rows.map((r) => `${r.name} asks each prompt ${timesEn(r.repetitions)} per engine.`).join(" ") +
          " Your mention rate is the share of all those answers that name you, so one odd answer does not swing it, and the trend shows the direction over days.",
      },
      {
        q: "How is this different from the free AI Visibility Check and the AI Readiness Audit?",
        a: "The AI Visibility Check asks the engines about you once. The AI Readiness Audit checks whether AI crawlers can read your site; it asks no engine anything. The plan asks your own prompts on a schedule, keeps the history and alerts you when something changes.",
      },
      { q: "Can I track competitors?", a: "Yes. Every tracked answer records which businesses are named, so you see who appears instead of you, prompt by prompt and engine by engine." },
      { q: "Which sources do you show?", a: "The pages and websites the engines cite in their answers, and the sites that cite your competitors but not you, so you know where to be listed." },
      { q: "Can I change my prompts?", a: `Yes, any time, up to ${av.prompts} prompts on ${av.name}. Changes apply from the next checkup.` },
      { q: "Can I cancel anytime?", a: "Yes. Billing → Manage subscription → Cancel. Your plan stays active until the end of the period you paid for, and you are not charged again. Cancel during the free trial and you are never charged." },
      { q: "What happens to my data?", a: "We do not sell it. Your tracked answers are kept while your subscription is active and deleted or returned after you close your account, as our Privacy Policy explains." },
      {
        q: "Does it include review management?",
        a: reviewsFrom
          ? `Not on ${av.name}: it is the AI tracking layer only. Review management starts on ${reviewsFrom}.`
          : `Not on ${av.name}: it is the AI tracking layer only.`,
      },
    ];
  },
  final: { h2: "Find out what the AIs say about you" },
  kw: { ...KW_EN, errLimit: "", fine: "" },
  kwText: {
    errLimit: (n) => `Free scan limit reached (${n} a day). Try again tomorrow, or pick your prompts on a plan.`,
    fine: (n) => `No account needed. ${n} scans a day.`,
  },
};

const FR: AvCopy = {
  meta: {
    title: "Visibilité IA : suivez ce que ChatGPT et la recherche IA disent de vous",
    description: (engines) =>
      `Voyez si ${engines} citent votre entreprise quand vos clients posent la question. Suivi quotidien des requêtes, concurrents nommés à votre place, sources citées et alertes quand vous disparaissez.`,
  },
  subnav: { aria: "Sur cette page", how: "Fonctionnement", what: "Ce que vous obtenez", tools: "Outils gratuits", pricing: "Tarifs", faq: "FAQ" },
  hero: {
    h1a: "Quand quelqu’un demande une recommandation à ChatGPT,",
    h1b: " êtes-vous dans la réponse ?",
    sub: "Echorank suit les requêtes qui comptent pour votre entreprise, montre qui l’IA nomme à votre place et vous alerte dès qu’un moteur cesse de vous recommander.",
    primary: (price) => `Démarrer Visibilité IA : ${price}/mois`,
    secondary: "Voir ce que l’IA dit de vous, gratuitement",
    engines: (plan, engines) => `${plan} interroge ${engines}.`,
  },
  mock: {
    label: "Exemple",
    aria: "Exemple de réponse d’IA suivie",
    q: "meilleur logiciel de comptabilité pour indépendants",
    l1: "Voici les outils les mieux notés par les indépendants :",
    l2desc: "facturation solide",
    youBrand: "Votre marque",
    youDesc: "meilleur rapport qualité-prix en solo",
    pos: "↑ n°2 cette semaine",
    l4desc: "bonne synchro bancaire",
    alert: (engine) => `⚠ Sorti des réponses ${engine} · il y a 3 jours`,
    scoreChip: (n) => `AI Search Score ${n}`,
  },
  problem: {
    h2: "Les nouveaux résultats de recherche n’ont pas de page deux",
    p: "Une réponse d’IA nomme trois ou quatre entreprises. Toutes les autres sont invisibles, et rien ne vous avertit quand vous en sortez. La Visibilité IA rend cette couche observable.",
  },
  how: {
    label: "Fonctionnement",
    h2: "Trois étapes, puis tout tourne seul",
    steps: [
      {
        h3: "1. Choisissez vos requêtes",
        p: (n) => `Choisissez les questions que vos clients posent à une IA. L’analyse de mots-clés gratuite ci-dessous propose des requêtes à partir de votre page d’accueil (${n} analyses par jour, sans compte).`,
      },
      {
        h3: "2. Echorank interroge les moteurs",
        p: (cadence, reps) => `Selon le calendrier de votre forfait (${cadence} avec Visibilité IA), chaque requête est posée ${timesFr(reps)} par moteur, et chaque réponse est conservée.`,
      },
      { h3: "3. Vous voyez ce qui a changé", p: "Si vous avez été mentionné, quels concurrents ont été nommés à votre place, quelles sources les moteurs ont citées, et une alerte quand vous disparaissez." },
    ],
    kwH3: "Trouvez vos requêtes : analyse de mots-clés gratuite",
  },
  what: {
    label: "Ce que vous obtenez",
    h2: "Ce que comprend le forfait Visibilité IA",
    items: {
      answers: { h3: "Suivi des réponses", p: "Chaque réponse à chaque requête suivie, conservée : qui est nommé, dans quel ordre et pourquoi." },
      trend: { h3: "Évolution du taux de mention", p: "La part des réponses qui vous nomment, dans le temps : un lent déclin se voit des semaines avant de vous coûter des clients." },
      competitors: { h3: "Concurrents nommés à votre place", p: "Les entreprises que les moteurs recommandent quand ils vous laissent de côté, requête par requête." },
      sources: { h3: "Sources citées et manques de citation", p: "Les pages et les sites que les moteurs citent, et ceux qui citent vos concurrents mais pas vous." },
      alerts: { h3: "Alertes de perte de recommandation", p: "Un courriel quand vous disparaissez d’une réponse où vous figuriez, avec la requête, le moteur et qui vous a remplacé." },
      history: { h3: "Historique", p: "Chaque vérification conservée : vous voyez ce qu’un moteur disait le mois dernier et vous comparez." },
    },
    score: {
      h3: "AI Search Score",
      p: (w) => `Un chiffre de 0 à 100 par vérification : à quelle fréquence vous êtes mentionné (${w.mention} %), à quelle place (${w.position} %), à quelle fréquence vous êtes cité (${w.citation} %) et sur quel ton (${w.sentiment} %).`,
      link: "Notre méthode de mesure",
    },
  },
  tools: {
    label: "Outils gratuits",
    h2: "Deux outils gratuits, deux questions différentes",
    check: { name: "Vérification de visibilité IA", line: "Ce que l’IA dit de vous : nous interrogeons les moteurs sur votre entreprise une fois et montrons les réponses.", cta: "Lancer la vérification" },
    audit: { name: "Audit de préparation IA", line: "Si l’IA peut lire votre site : accès des robots, contenu lisible et les faits qu’une réponse cite.", cta: "Lancer l’audit" },
  },
  pricing: {
    label: "Tarifs",
    h2: "Le suivi IA dans chaque forfait",
    tableCaption: "Allocations IA par forfait",
    cols: { plan: "Forfait", prompts: "Requêtes", engines: "Moteurs", cadence: "Fréquence", reps: "Questions par moteur" },
    reps: (n) => timesFr(n),
    starterAdds: (starter, items) => `${starter} ajoute ${items}.`,
    areas: {
      reputation: "la gestion des avis",
      seo_tools: "les outils SEO",
      crawler: `le robot d’exploration ${NB}`,
      marketing_studio: "Marketing Studio",
    },
  },
  faqH2: "Questions",
  faq: ({ rows, reviewsFrom, list }) => {
    const av = rows[0];
    return [
      {
        q: "Quels moteurs d’IA suivez-vous ?",
        a: rows.map((r) => `${r.name} : ${list(r.engines)}.`).join(" ") + " Nous ne citons que les moteurs que nous interrogeons aujourd’hui.",
      },
      {
        q: "À quelle fréquence les réponses sont-elles vérifiées ?",
        a: rows.map((r) => `${r.name} : ${cadenceOf(r, CAD.fr)}.`).join(" "),
      },
      {
        q: "Les réponses d’IA changent à chaque fois. Comment le gérez-vous ?",
        a:
          "La même requête peut obtenir une autre réponse une minute plus tard. " +
          rows.map((r) => `${r.name} pose chaque requête ${timesFr(r.repetitions)} par moteur.`).join(" ") +
          " Votre taux de mention est la part de toutes ces réponses qui vous nomment : une réponse isolée ne le fait pas basculer, et la tendance montre la direction sur plusieurs jours.",
      },
      {
        q: "Quelle différence avec la Vérification de visibilité IA et l’Audit de préparation IA gratuits ?",
        a: "La Vérification interroge les moteurs sur vous une fois. L’Audit vérifie si les robots d’IA peuvent lire votre site ; il n’interroge aucun moteur. Le forfait pose vos propres requêtes selon un calendrier, garde l’historique et vous alerte quand quelque chose change.",
      },
      { q: "Puis-je suivre mes concurrents ?", a: "Oui. Chaque réponse suivie enregistre les entreprises nommées : vous voyez qui apparaît à votre place, requête par requête et moteur par moteur." },
      { q: "Quelles sources montrez-vous ?", a: "Les pages et les sites que les moteurs citent dans leurs réponses, et les sites qui citent vos concurrents mais pas vous, pour savoir où être présent." },
      { q: "Puis-je modifier mes requêtes ?", a: `Oui, à tout moment, jusqu’à ${av.prompts} requêtes avec ${av.name}. Les changements s’appliquent dès la vérification suivante.` },
      { q: "Puis-je annuler à tout moment ?", a: "Oui. Facturation → Gérer l’abonnement → Annuler. Le forfait reste actif jusqu’à la fin de la période payée, sans nouveau prélèvement. En cas d’annulation pendant l’essai gratuit, vous n’êtes jamais facturé." },
      { q: "Qu’advient-il de mes données ?", a: "Nous ne les vendons pas. Vos réponses suivies sont conservées tant que votre abonnement est actif, puis supprimées ou restituées après la fermeture de votre compte, comme l’explique notre politique de confidentialité." },
      {
        q: "La gestion des avis est-elle incluse ?",
        a: reviewsFrom
          ? `Pas avec ${av.name} : c’est uniquement la couche de suivi IA. La gestion des avis commence avec ${reviewsFrom}.`
          : `Pas avec ${av.name} : c’est uniquement la couche de suivi IA.`,
      },
    ];
  },
  final: { h2: "Découvrez ce que les IA disent de vous" },
  kw: { ...KW_FR, errLimit: "", fine: "" },
  kwText: {
    errLimit: (n) => `Limite d’analyses gratuites atteinte (${n} par jour). Réessayez demain, ou choisissez vos requêtes avec un forfait.`,
    fine: (n) => `Aucun compte requis. ${n} analyses par jour.`,
  },
};

const DE: AvCopy = {
  meta: {
    title: "KI-Sichtbarkeit: verfolgen, was ChatGPT und die KI-Suche über Sie sagen",
    description: (engines) =>
      `Sehen Sie, ob ${engines} Ihr Unternehmen nennen, wenn Kunden fragen. Tägliches Prompt-Tracking, Mitbewerber, die statt Ihnen genannt werden, zitierte Quellen und Benachrichtigungen, wenn Sie herausfallen.`,
  },
  subnav: { aria: "Auf dieser Seite", how: "So funktioniert es", what: "Was Sie erhalten", tools: "Gratis-Tools", pricing: "Preise", faq: "FAQ" },
  hero: {
    h1a: "Wenn jemand ChatGPT um eine Empfehlung bittet,",
    h1b: " sind Sie in der Antwort?",
    sub: "Echorank verfolgt die Prompts, die für Ihr Unternehmen zählen, zeigt, wen die KI statt Ihnen nennt, und benachrichtigt Sie, sobald eine Engine Sie nicht mehr empfiehlt.",
    primary: (price) => `KI-Sichtbarkeit starten: ${price}/Monat`,
    secondary: "Gratis sehen, was KI über Sie sagt",
    engines: (plan, engines) => `${plan} fragt ${engines}.`,
  },
  mock: {
    label: "Beispiel",
    aria: "Beispiel einer verfolgten KI-Antwort",
    q: "beste Buchhaltungssoftware für Freelancer",
    l1: "Hier sind die von Freelancern am höchsten bewerteten Tools:",
    l2desc: "starke Rechnungsstellung",
    youBrand: "Ihre Marke",
    youDesc: "bestes Preis-Leistungs-Verhältnis für Solo-Arbeit",
    pos: "↑ Nr. 2 diese Woche",
    l4desc: "gute Banksynchronisierung",
    alert: (engine) => `⚠ Aus ${engine}-Antworten gefallen · vor 3 Tagen`,
    scoreChip: (n) => `AI Search Score ${n}`,
  },
  problem: {
    h2: "Die neuen Suchergebnisse haben keine zweite Seite",
    p: "Eine KI-Antwort nennt drei oder vier Unternehmen. Alle anderen sind unsichtbar, und nichts sagt Ihnen, wann Sie herausfallen. KI-Sichtbarkeit macht diese Ebene sichtbar.",
  },
  how: {
    label: "So funktioniert es",
    h2: "Drei Schritte, dann läuft es von selbst",
    steps: [
      {
        h3: "1. Prompts wählen",
        p: (n) => `Wählen Sie die Fragen, die Ihre Kunden einer KI stellen. Der kostenlose Keyword-Scan unten schlägt Prompts anhand Ihrer Startseite vor (${n} Scans pro Tag, ohne Konto).`,
      },
      {
        h3: "2. Echorank fragt die Engines",
        p: (cadence, reps) => `Nach dem Zeitplan Ihres Abos (${cadence} bei KI-Sichtbarkeit) wird jeder Prompt ${timesDe(reps)} pro Engine gestellt, und jede Antwort wird gespeichert.`,
      },
      { h3: "3. Sie sehen, was sich geändert hat", p: "Ob Sie genannt wurden, welche Mitbewerber statt Ihnen genannt wurden, welche Quellen die Engines zitiert haben, und eine Benachrichtigung, wenn Sie herausfallen." },
    ],
    kwH3: "Prompts finden: kostenloser Keyword-Scan",
  },
  what: {
    label: "Was Sie erhalten",
    h2: "Was das Abo KI-Sichtbarkeit enthält",
    items: {
      answers: { h3: "Antwort-Tracking", p: "Jede Antwort auf jeden verfolgten Prompt, gespeichert: wer genannt wird, in welcher Reihenfolge und warum." },
      trend: { h3: "Verlauf der Nennungsrate", p: "Ihr Anteil an Antworten, die Sie nennen, über die Zeit: Ein langsamer Rückgang zeigt sich Wochen, bevor er Sie Kunden kostet." },
      competitors: { h3: "Mitbewerber, die statt Ihnen genannt werden", p: "Die Unternehmen, die die Engines empfehlen, wenn sie Sie auslassen, Prompt für Prompt." },
      sources: { h3: "Zitierte Quellen und Zitatlücken", p: "Die Seiten und Websites, die die Engines zitieren, und jene, die Ihre Mitbewerber zitieren, Sie aber nicht." },
      alerts: { h3: "Benachrichtigungen bei verlorenen Empfehlungen", p: "Eine E-Mail, wenn Sie aus einer Antwort fallen, in der Sie vorher erschienen, mit Prompt, Engine und wer Sie ersetzt hat." },
      history: { h3: "Verlauf", p: "Jeder Check bleibt gespeichert: Sie sehen, was eine Engine letzten Monat gesagt hat, und vergleichen." },
    },
    score: {
      h3: "AI Search Score",
      p: (w) => `Eine Zahl von 0 bis 100 pro Check: wie oft Sie genannt werden (${w.mention} %), wie weit oben (${w.position} %), wie oft Sie zitiert werden (${w.citation} %) und wie positiv (${w.sentiment} %).`,
      link: "So messen wir",
    },
  },
  tools: {
    label: "Gratis-Tools",
    h2: "Zwei Gratis-Tools, zwei verschiedene Fragen",
    check: { name: "KI-Sichtbarkeits-Check", line: "Was KI über Sie sagt: Wir fragen die Engines einmal nach Ihrem Unternehmen und zeigen die Antworten.", cta: "Check starten" },
    audit: { name: "KI-Bereitschafts-Audit", line: "Ob KI Ihre Website lesen kann: Crawler-Zugang, lesbarer Inhalt und die Fakten, die eine Antwort zitiert.", cta: "Audit starten" },
  },
  pricing: {
    label: "Preise",
    h2: "KI-Tracking in jedem Abo",
    tableCaption: "KI-Kontingente pro Abo",
    cols: { plan: "Abo", prompts: "Prompts", engines: "Engines", cadence: "Wie oft", reps: "Anfragen pro Engine" },
    reps: (n) => timesDe(n),
    starterAdds: (starter, items) => `${starter} ergänzt ${items}.`,
    areas: {
      reputation: "die Bewertungsverwaltung",
      seo_tools: "die SEO-Tools",
      crawler: `den Website-Crawler ${NB}`,
      marketing_studio: "Marketing Studio",
    },
  },
  faqH2: "Fragen",
  faq: ({ rows, reviewsFrom, list }) => {
    const av = rows[0];
    return [
      {
        q: "Welche KI-Engines verfolgen Sie?",
        a: rows.map((r) => `${r.name}: ${list(r.engines)}.`).join(" ") + " Wir nennen nur die Engines, die wir heute abfragen.",
      },
      {
        q: "Wie oft werden die Antworten geprüft?",
        a: rows.map((r) => `${r.name}: ${cadenceOf(r, CAD.de)}.`).join(" "),
      },
      {
        q: "KI-Antworten ändern sich jedes Mal. Wie gehen Sie damit um?",
        a:
          "Derselbe Prompt kann eine Minute später eine andere Antwort erhalten. " +
          rows.map((r) => `${r.name} stellt jeden Prompt ${timesDe(r.repetitions)} pro Engine.`).join(" ") +
          " Ihre Nennungsrate ist der Anteil all dieser Antworten, die Sie nennen: Eine einzelne Antwort kippt sie nicht, und der Verlauf zeigt die Richtung über mehrere Tage.",
      },
      {
        q: "Was ist der Unterschied zum kostenlosen KI-Sichtbarkeits-Check und zum KI-Bereitschafts-Audit?",
        a: "Der Check fragt die Engines einmal nach Ihnen. Das Audit prüft, ob KI-Crawler Ihre Website lesen können; es fragt keine Engine. Das Abo stellt Ihre eigenen Prompts nach Zeitplan, speichert den Verlauf und benachrichtigt Sie, wenn sich etwas ändert.",
      },
      { q: "Kann ich Mitbewerber verfolgen?", a: "Ja. Jede verfolgte Antwort hält fest, welche Unternehmen genannt werden: Sie sehen, wer statt Ihnen erscheint, Prompt für Prompt und Engine für Engine." },
      { q: "Welche Quellen zeigen Sie?", a: "Die Seiten und Websites, die die Engines in ihren Antworten zitieren, und die Websites, die Ihre Mitbewerber zitieren, Sie aber nicht, damit Sie wissen, wo Sie gelistet sein sollten." },
      { q: "Kann ich meine Prompts ändern?", a: `Ja, jederzeit, bis zu ${av.prompts} Prompts bei ${av.name}. Änderungen gelten ab dem nächsten Check.` },
      { q: "Kann ich jederzeit kündigen?", a: "Ja. Abrechnung → Abo verwalten → Kündigen. Ihr Abo bleibt bis zum Ende der bezahlten Periode aktiv, und es wird nichts mehr abgebucht. Kündigen Sie während der Testphase, zahlen Sie nie etwas." },
      { q: "Was passiert mit meinen Daten?", a: "Wir verkaufen sie nicht. Ihre verfolgten Antworten bleiben gespeichert, solange Ihr Abo aktiv ist, und werden nach der Schliessung Ihres Kontos gelöscht oder zurückgegeben, wie in unserer Datenschutzerklärung beschrieben." },
      {
        q: "Ist die Bewertungsverwaltung enthalten?",
        a: reviewsFrom
          ? `Nicht bei ${av.name}: Es ist nur die KI-Tracking-Ebene. Die Bewertungsverwaltung beginnt mit ${reviewsFrom}.`
          : `Nicht bei ${av.name}: Es ist nur die KI-Tracking-Ebene.`,
      },
    ];
  },
  final: { h2: "Finden Sie heraus, was die KIs über Sie sagen" },
  kw: { ...KW_DE, errLimit: "", fine: "" },
  kwText: {
    errLimit: (n) => `Gratis-Scan-Limit erreicht (${n} pro Tag). Versuchen Sie es morgen wieder, oder wählen Sie Ihre Prompts in einem Abo.`,
    fine: (n) => `Kein Konto nötig. ${n} Scans pro Tag.`,
  },
};

export const AV_COPY: Record<AvBase, AvCopy> = { en: EN, fr: FR, de: DE };

/** The keyword widget's strings with the daily limit filled in. */
export function keywordWidgetCopy(base: AvBase, scansPerDay: number): KeywordWidgetContent {
  const c = AV_COPY[base];
  return { ...c.kw, errLimit: c.kwText.errLimit(scansPerDay), fine: c.kwText.fine(scansPerDay) };
}
