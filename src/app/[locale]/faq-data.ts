// Homepage FAQ — single source of truth.
//
// Imported by HomeClient.tsx (renders the visible section) and by page.tsx
// (emits the FAQPage JSON-LD). Both read this same array so the structured
// data can never describe questions the page doesn't actually show.
//
// Locale coverage intentionally mirrors HomeClient's `T`: two bases, en + fr.
// en-CA/fr-CA/de-CH resolve through baseOf() exactly like the rest of the
// homepage copy.
//
// Every answer paraphrases a claim already made elsewhere on the page. No
// figures appear here that aren't already stated on the page itself.
//
// ONE ENTRY IS NOT AUTHORED HERE. The cancellation Q&A is the short form of the
// help article at /help/cancel-subscription and is imported from
// src/lib/help-articles.ts, which is the single source every surface that
// answers "how do I cancel" reads. Retyping it here is exactly the drift that
// file exists to prevent.
//
// Answers may carry the same inline markup the Knowledge Hub prose uses —
// **bold** and [label](href). HomeClient renders them through inline(); the
// FAQPage JSON-LD in page.tsx strips them with plainText(), because a rich
// result must not publish the asterisks.

import { helpArticleBySlug, helpArticleCopy } from "@/lib/help-articles";

export type FaqBase = "en" | "fr";

export interface FaqItem {
  q: string;
  a: string;
}

const CANCEL = helpArticleBySlug("cancel-subscription")!;
/** The short-form Q&A, in the base the catalog below is keyed by. */
const cancelFaq = (base: FaqBase): FaqItem => helpArticleCopy(CANCEL, base).faq;

export const FAQ: Record<FaqBase, { label: string; h2: string; sub: string; items: FaqItem[] }> = {
  en: {
    label: "COMMON QUESTIONS",
    h2: "What people ask before they start",
    sub: "The short version of what AI visibility is, how it differs from search, and what Echorank actually does about it.",
    items: [
      {
        q: "What is AI visibility?",
        a: "AI visibility is whether AI assistants name your business when someone asks them for a recommendation. When a customer asks an assistant who to hire, the answer is a short list — and either you are on it or you are not. AI visibility measures how often you appear, on which engines, and for which questions.",
      },
      {
        q: "How is AI visibility different from SEO?",
        a: "A search ranking is a list of links; an AI answer is a verdict. SEO optimizes for position on a results page so someone can click you, while AI visibility optimizes for being the business the assistant actually names. The signals differ too: where SEO tracks keywords, backlinks and SERP position, AI visibility tracks citations, trust signals and your share of AI answers.",
      },
      {
        q: "Which AI engines does Echorank track?",
        a: "We monitor six engines: ChatGPT, Google AI, Perplexity, Claude, Gemini and Microsoft Copilot. Coverage is continuous rather than a one-time audit — answers are tracked daily and risk is recalculated hourly. You get an alert the moment your coverage on any engine flips.",
      },
      {
        q: "How is the AI Visibility Score calculated?",
        a: "The score is a 0–100 roll-up of the signals AI engines weigh when they decide who to recommend: reviews, website quality, citations, trust, authority, freshness, structured data and brand mentions. Underneath it sit five component scores — AI Citation Score, Authority Score, Review Health, Citation Consistency and Competitor Gap — so you can see which input is holding you back. Each component is measured per engine, then combined into the single number you track over time.",
      },
      {
        q: "How fast do results show?",
        a: "Your first audit returns a baseline score, an engine coverage map and a full signal inventory in under 60 seconds. After that the pace depends on which fixes you ship and how quickly engines re-crawl your signals — structured data and business listing corrections tend to register sooner than review velocity or authority work, which build over weeks. The 90-day trajectory shown above is an illustrative example, not a promise.",
      },
      {
        q: "Do I need to replace my SEO tools?",
        a: "No. Echorank measures a different outcome — being recommended rather than being ranked — so it sits alongside your existing SEO stack rather than replacing it. Much of the work overlaps in your favour: the structured data, citations and reputation signals that improve AI visibility are the same foundations good SEO already cares about.",
      },
      {
        q: "My CSV file isn't displaying correctly in Excel, why?",
        a: "Exports are UTF-8 with comma separators. If Excel shows everything in one column or garbles accents, use Data → From Text/CSV and pick UTF-8 — or open the file in Google Sheets, which detects it automatically.",
      },
      cancelFaq("en"),
      // The binding definition of the two support tiers. It exists because the
      // cards say "Email support" and "Priority support" and those are words a
      // reader otherwise prices with their own assumptions. Deliberately
      // promises no phone line, no chat and no weekend response — there is
      // nobody staffing any of the three, and a support promise is the cheapest
      // thing in the world to write and the most expensive to not honour.
      {
        q: "What support is included?",
        a: "Starter includes email support with a response within 48 hours on weekdays. Growth and Agency include priority support: email with a response within 24 hours on weekdays. Support is email-based on every plan — we do not offer a phone line or live chat, and response times are measured on weekdays only.",
      },
    ],
  },

  fr: {
    label: "QUESTIONS FRÉQUENTES",
    h2: "Ce qu'on nous demande avant de commencer",
    sub: "En bref : ce qu'est la visibilité IA, en quoi elle diffère de la recherche, et ce qu'Echorank fait concrètement.",
    items: [
      {
        q: "Qu'est-ce que la visibilité IA?",
        a: "La visibilité IA, c'est le fait que les assistants IA nomment votre entreprise quand on leur demande une recommandation. Quand un client demande à un assistant qui embaucher, la réponse est une courte liste — et vous y êtes, ou vous n'y êtes pas. La visibilité IA mesure à quelle fréquence vous apparaissez, sur quels moteurs et pour quelles questions.",
      },
      {
        q: "En quoi la visibilité IA diffère-t-elle du SEO?",
        a: "Un classement de recherche est une liste de liens; une réponse d'IA est un verdict. Le SEO optimise votre position sur une page de résultats pour qu'on puisse vous cliquer, tandis que la visibilité IA optimise le fait d'être l'entreprise que l'assistant nomme réellement. Les signaux diffèrent aussi : là où le SEO suit les mots-clés, les backlinks et la position SERP, la visibilité IA suit les citations, les signaux de confiance et votre part des réponses IA.",
      },
      {
        q: "Quels moteurs IA Echorank surveille-t-il?",
        a: "Nous surveillons six moteurs : ChatGPT, Google AI, Perplexity, Claude, Gemini et Microsoft Copilot. La couverture est continue plutôt qu'un audit ponctuel — les réponses sont suivies chaque jour et le risque est recalculé chaque heure. Vous recevez une alerte dès que votre couverture bascule sur un moteur.",
      },
      {
        q: "Comment le score de visibilité IA est-il calculé?",
        a: "Le score est une synthèse sur 100 des signaux que les moteurs IA pèsent pour décider qui recommander : avis, qualité du site, citations, confiance, autorité, fraîcheur, données structurées et mentions de marque. En dessous se trouvent cinq scores composants — score de citation IA, score d'autorité, santé des avis, cohérence des citations et écart concurrentiel — pour voir quel élément vous freine. Chaque composant est mesuré par moteur, puis combiné en un seul chiffre que vous suivez dans le temps.",
      },
      {
        q: "En combien de temps voit-on des résultats?",
        a: "Votre premier audit produit un score de référence, une carte de couverture des moteurs et un inventaire complet des signaux en moins de 60 secondes. Ensuite, le rythme dépend des correctifs que vous déployez et de la vitesse à laquelle les moteurs réexplorent vos signaux — les données structurées et les corrections de fiches se répercutent généralement plus vite que le travail sur la vélocité d'avis ou l'autorité, qui se construit sur des semaines. La trajectoire de 90 jours présentée plus haut est un exemple illustratif, pas une promesse.",
      },
      {
        q: "Dois-je remplacer mes outils SEO?",
        a: "Non. Echorank mesure un résultat différent — être recommandé plutôt qu'être classé — et s'ajoute donc à votre outillage SEO existant au lieu de le remplacer. Une bonne partie du travail se recoupe à votre avantage : les données structurées, les citations et les signaux de réputation qui améliorent la visibilité IA sont les mêmes fondations dont le bon SEO se soucie déjà.",
      },
      {
        q: "Mon fichier CSV ne s'affiche pas correctement dans Excel, pourquoi ?",
        a: "Les exports sont en UTF-8 avec des virgules comme séparateurs. Si Excel affiche tout dans une seule colonne ou déforme les accents, utilisez Données → À partir d'un fichier texte/CSV et choisissez UTF-8 — ou ouvrez le fichier dans Google Sheets, qui le détecte automatiquement.",
      },
      cancelFaq("fr"),
      {
        q: "Quel soutien est inclus ?",
        a: "Le forfait Démarrage comprend le soutien par courriel, avec une réponse en 48 heures les jours ouvrables. Les forfaits Croissance et Agence comprennent le soutien prioritaire : par courriel, avec une réponse en 24 heures les jours ouvrables. Le soutien se fait par courriel sur tous les forfaits — nous n'offrons ni ligne téléphonique ni clavardage en direct, et les délais de réponse ne comptent que les jours ouvrables.",
      },
    ],
  },
};
