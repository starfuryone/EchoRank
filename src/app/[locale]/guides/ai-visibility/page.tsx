// /guides/ai-visibility — what AI visibility is and how to measure and improve it.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { solutionBase } from "@/lib/solutions-taxonomy";
import { GuideArticle, type GuideDoc } from "../_shared/GuideArticle";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const t =
    solutionBase(locale) === "fr"
      ? {
          title: "Visibilité IA : mesurer et améliorer ce que les assistants disent de vous",
          description:
            "Ce que ChatGPT, Perplexity et Gemini répondent quand on parle de votre marché — comment le mesurer, le suivre et l'améliorer, étape par étape.",
        }
      : {
          title: "AI visibility: measure and improve what assistants say about you",
          description:
            "What ChatGPT, Perplexity and Gemini answer when your market comes up — how to measure it, track it and improve it, step by step.",
        };
  return buildMetadata({ locale, path: "/guides/ai-visibility", ...t });
}

const EN: GuideDoc = {
  title: "AI visibility, from zero to tracked",
  lede: "A growing share of your next customers never see a results page: they ask ChatGPT, Perplexity or Gemini who to use, and pick from the answer. This guide shows how to find out what those answers currently say about you, turn that into a tracked number, and move it.",
  updated: "August 2026",
  minutes: 9,
  steps: [
    {
      t: "Understand what you're measuring",
      body: [
        "AI visibility is whether — and how — assistants bring you up when someone asks a question in your market: 'best accountant in Leeds', 'is <your brand> legit', 'alternatives to <competitor>'. Unlike a ranking, an answer has no fixed ten positions. What matters is being mentioned at all, being among the first names, being described positively, and being cited as a source.",
        "Assistants are also probabilistic: the same question asked twice can produce different answers. A single check tells you almost nothing — visibility is only meaningful as a rate over repeated runs. That's why this is a tracking discipline, not a one-off lookup.",
      ],
      tip: "Ask an assistant about your market right now, before any tooling. Whatever it answers is what a customer heard today.",
    },
    {
      t: "Run the free audit for your baseline",
      body: [
        "The free AI visibility audit is the fastest honest snapshot: it asks the major assistants about your business and your category, and reports where you appear, where you're absent, and who gets named instead. No account needed, and it takes about a minute.",
        "Treat the result as day zero, not a verdict. Most businesses that have never worked on this score low — which is the point: the gap between you and the names in the answers is the size of the opportunity, and the audit's findings become the first fix list.",
      ],
    },
    {
      t: "Build the prompt list",
      body: [
        "Prompts are to AI visibility what keywords are to rank tracking. Start from three groups: buying-intent questions ('best X in <city>', 'who should I hire for Y'), brand questions ('is <brand> good', '<brand> reviews'), and competitor questions ('alternatives to <competitor>', '<competitor> vs <brand>').",
        "Phrase them the way a customer talks, not the way a keyword tool abbreviates — assistants answer conversational questions. Ten to twenty prompts is plenty to start; the tracker checks each across the assistants on schedule, so every prompt you add is recurring work you're commissioning.",
      ],
      shot: "The AI Visibility dashboard: tracked prompts with per-assistant status — mentioned, cited, or absent.",
      shotSrc: "/guides/ai-visibility-prompts-en.svg",
    },
    {
      t: "Read what the answers record",
      body: [
        "For every run, four things get recorded: whether you were mentioned, your position among the names given, the sentiment of how you were described, and whether you (or someone else) were cited as a source — plus which websites the assistant leaned on for the answer.",
        "The citations are the actionable part. Assistants don't invent their recommendations; they synthesize them from sources — directories, review profiles, comparison pages, local press. When a competitor is named and you aren't, the cited sources are usually the explanation, and each one is a concrete place your absence can be fixed.",
      ],
      shot: "One answer, parsed: mention, position, sentiment, and the sources cited behind it.",
      shotSrc: "/guides/ai-visibility-answer-en.svg",
    },
    {
      t: "Improve the answer, then watch it move",
      body: [
        "The levers are unglamorous and effective: a consistent business identity everywhere (one name, one address, one description), a healthy review profile that keeps growing, presence on the sources the assistants actually cite for your prompts, and pages on your own site that answer the tracked questions directly.",
        "Work one prompt at a time. Pick a buying-intent prompt where you're absent, fix what its citations point at, and let the daily runs record the change. Movement typically shows in weeks, not days — the compounding is the reward: once you're in an answer, you tend to be served for every phrasing of the question.",
      ],
      tip: "Alerts do the watching between changes: you're notified when you drop out of an answer or a competitor takes a top recommendation — the day it happens.",
    },
  ],
  pitfalls: {
    title: "Common mistakes",
    items: [
      "Judging visibility from one manual check — assistants vary between runs; only repeated tracking is truthful.",
      "Tracking only brand prompts — 'is <brand> good' flatters you; the customers you're losing are asking category questions.",
      "Chasing every assistant equally — start where your customers actually ask, then widen.",
      "Ignoring the citations — the sources behind the answer are the to-do list; the answer itself is just the score.",
      "Expecting ad-speed results — AI visibility moves like SEO: weeks of nothing, then a step change that sticks.",
    ],
  },
  next: {
    title: "Keep going",
    links: [
      { href: "/guides/audit-your-website", label: "Audit your website" },
      { href: "/guides/track-rankings", label: "Track your rankings" },
      { href: "/guides/keyword-research", label: "Keyword research" },
      { href: "/learn", label: "The full course" },
    ],
  },
  faq: [
    {
      q: "Which assistants should I track?",
      a: "Start with ChatGPT, Perplexity and Gemini — between them they cover most consumer AI search today. Add others when your prompts show your audience uses them.",
    },
    {
      q: "How is this different from rank tracking?",
      a: "Rank tracking measures your position in a list of links; AI visibility measures whether you exist inside a synthesized answer. They share keywords and reinforce each other, but the answer has its own logic — sources, entities, reviews — and needs its own measurement.",
    },
    {
      q: "Can I directly influence what an assistant says?",
      a: "Not by asking it. You influence it the same way you influence search: by fixing what the assistants read — your site, your review profiles, and the third-party sources they cite for your market.",
    },
    {
      q: "How often are prompts checked?",
      a: "Daily by default. Because answers vary between runs, the dashboard shows rates over repeated checks rather than a single latest status.",
    },
  ],
};

const FR: GuideDoc = {
  title: "La visibilité IA, de zéro au suivi",
  lede: "Une part croissante de vos prochains clients ne voit jamais de page de résultats : ils demandent à ChatGPT, Perplexity ou Gemini qui choisir, et décident dans la réponse. Ce guide montre comment découvrir ce que ces réponses disent de vous aujourd'hui, en faire un chiffre suivi, et le faire bouger.",
  updated: "Août 2026",
  minutes: 9,
  steps: [
    {
      t: "Comprendre ce que vous mesurez",
      body: [
        "La visibilité IA, c'est savoir si — et comment — les assistants vous citent quand on pose une question de votre marché : « meilleur comptable à Lyon », « <votre marque>, c'est sérieux ? », « alternatives à <concurrent> ». Contrairement à un classement, une réponse n'a pas dix positions fixes. Ce qui compte : être mentionné, figurer parmi les premiers noms, être décrit positivement, et être cité comme source.",
        "Les assistants sont aussi probabilistes : la même question posée deux fois peut produire deux réponses différentes. Une vérification isolée ne dit presque rien — la visibilité n'a de sens que comme taux sur des exécutions répétées. C'est une discipline de suivi, pas une consultation ponctuelle.",
      ],
      tip: "Posez dès maintenant une question de votre marché à un assistant, sans aucun outil. Sa réponse est ce qu'un client a entendu aujourd'hui.",
    },
    {
      t: "Lancer l'audit gratuit pour votre référence",
      body: [
        "L'audit de visibilité IA gratuit est l'instantané honnête le plus rapide : il interroge les principaux assistants sur votre entreprise et votre catégorie, et rapporte où vous apparaissez, où vous êtes absent, et qui est nommé à votre place. Sans compte, en une minute environ.",
        "Prenez le résultat comme un jour zéro, pas comme un verdict. La plupart des entreprises qui n'ont jamais travaillé le sujet obtiennent un score bas — c'est justement le point : l'écart entre vous et les noms des réponses est la taille de l'opportunité, et les constats de l'audit forment la première liste de corrections.",
      ],
    },
    {
      t: "Construire la liste de requêtes",
      body: [
        "Les requêtes sont à la visibilité IA ce que les mots-clés sont au suivi de positions. Partez de trois groupes : les questions d'achat (« meilleur X à <ville> », « qui engager pour Y »), les questions de marque (« <marque>, c'est bien ? », « avis <marque> »), et les questions concurrentielles (« alternatives à <concurrent> », « <concurrent> vs <marque> »).",
        "Formulez-les comme parle un client, pas comme abrège un outil de mots-clés — les assistants répondent à des questions conversationnelles. Dix à vingt requêtes suffisent pour démarrer ; le suivi vérifie chacune sur les assistants selon le calendrier, donc chaque requête ajoutée est un travail récurrent que vous commandez.",
      ],
      shot: "Le tableau Visibilité IA : requêtes suivies avec le statut par assistant — mentionné, cité ou absent.",
      shotSrc: "/guides/ai-visibility-prompts-fr.svg",
    },
    {
      t: "Lire ce que les réponses enregistrent",
      body: [
        "Pour chaque exécution, quatre choses sont enregistrées : votre mention, votre position parmi les noms donnés, le sentiment de la description, et votre citation (ou celle d'un autre) comme source — plus les sites sur lesquels l'assistant s'est appuyé.",
        "Les citations sont la partie actionnable. Les assistants n'inventent pas leurs recommandations ; ils les synthétisent depuis des sources — annuaires, profils d'avis, pages comparatives, presse locale. Quand un concurrent est nommé et pas vous, les sources citées sont généralement l'explication, et chacune est un endroit concret où corriger votre absence.",
      ],
      shot: "Une réponse, analysée : mention, position, sentiment, et les sources citées derrière.",
      shotSrc: "/guides/ai-visibility-answer-fr.svg",
    },
    {
      t: "Améliorer la réponse, puis la regarder bouger",
      body: [
        "Les leviers sont peu spectaculaires et efficaces : une identité d'entreprise cohérente partout (un nom, une adresse, une description), un profil d'avis sain qui continue de croître, une présence sur les sources que les assistants citent réellement pour vos requêtes, et des pages de votre site qui répondent directement aux questions suivies.",
        "Travaillez une requête à la fois. Choisissez une requête d'achat où vous êtes absent, corrigez ce que ses citations désignent, et laissez les exécutions quotidiennes enregistrer le changement. Le mouvement apparaît en semaines, pas en jours — la récompense est le cumul : une fois dans une réponse, vous êtes resservi pour chaque formulation de la question.",
      ],
      tip: "Les alertes surveillent entre vos interventions : vous êtes prévenu quand vous sortez d'une réponse ou qu'un concurrent prend une recommandation de tête — le jour même.",
    },
  ],
  pitfalls: {
    title: "Erreurs courantes",
    items: [
      "Juger la visibilité sur une vérification manuelle — les assistants varient entre exécutions ; seul le suivi répété dit vrai.",
      "Ne suivre que les requêtes de marque — « <marque>, c'est bien ? » vous flatte ; les clients que vous perdez posent des questions de catégorie.",
      "Courir tous les assistants à égalité — commencez là où vos clients demandent vraiment, puis élargissez.",
      "Ignorer les citations — les sources derrière la réponse sont la liste de tâches ; la réponse n'est que le score.",
      "Attendre des résultats à la vitesse de la pub — la visibilité IA bouge comme le SEO : des semaines de calme, puis un palier qui tient.",
    ],
  },
  next: {
    title: "Pour continuer",
    links: [
      { href: "/guides/audit-your-website", label: "Auditer votre site" },
      { href: "/guides/track-rankings", label: "Suivre vos positions" },
      { href: "/guides/keyword-research", label: "Recherche de mots-clés" },
      { href: "/learn", label: "Le cours complet" },
    ],
  },
  faq: [
    {
      q: "Quels assistants suivre ?",
      a: "Commencez par ChatGPT, Perplexity et Gemini — à eux trois, ils couvrent l'essentiel de la recherche IA grand public aujourd'hui. Ajoutez-en quand vos requêtes montrent que votre audience en utilise d'autres.",
    },
    {
      q: "En quoi est-ce différent du suivi de positions ?",
      a: "Le suivi de positions mesure votre place dans une liste de liens ; la visibilité IA mesure votre existence dans une réponse synthétisée. Les deux partagent les mots-clés et se renforcent, mais la réponse a sa propre logique — sources, entités, avis — et demande sa propre mesure.",
    },
    {
      q: "Peut-on influencer directement ce que dit un assistant ?",
      a: "Pas en le lui demandant. On l'influence comme on influence la recherche : en corrigeant ce que les assistants lisent — votre site, vos profils d'avis, et les sources tierces qu'ils citent pour votre marché.",
    },
    {
      q: "À quelle fréquence les requêtes sont-elles vérifiées ?",
      a: "Quotidiennement par défaut. Les réponses variant entre exécutions, le tableau montre des taux sur des vérifications répétées plutôt qu'un dernier statut isolé.",
    },
  ],
};

export default async function Page({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const doc = solutionBase(locale) === "fr" ? FR : EN;
  return <GuideArticle locale={locale} doc={doc} />;
}
