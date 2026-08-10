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
          h: "Visibilité IA : mesurer et améliorer ce que les assistants disent de vous",
          description:
            "Ce que ChatGPT, Perplexity et Gemini répondent quand on parle de votre marché — comment le mesurer, le suivre et l'améliorer, étape par étape.",
        }
      : {
          h: "AI visibility: measure and improve what assistants say about you",
          description:
            "What ChatGPT, Perplexity and Gemini answer when your market comes up — how to measure it, track it and improve it, step by step.",
        };
  return buildMetadata({ locale, path: "/guides/ai-visibility", ...t });
}

const EN: GuideDoc = {
  title: "AI visibility, from zero to tracked",
  intro: "A growing share of your next customers never see a results page: they ask ChatGPT, Perplexity or Gemini who to use, and pick from the answer. This guide shows how to find out what those answers currently say about you, turn that into a tracked number, and move it.",
  needs: ["A live website for your business", "10 minutes for the audit and your first prompt list", "An Echorank account for ongoing tracking (the audit itself needs none)"],
  steps: [
    {
      h: "Understand what you're measuring",
      paras: [
        "AI visibility is whether — and how — assistants bring you up when someone asks a question in your market: 'best accountant in Leeds', 'is <your brand> legit', 'alternatives to <competitor>'. Unlike a ranking, an answer has no fixed ten positions. What matters is being mentioned at all, being among the first names, being described positively, and being cited as a source.",
        "Assistants are also probabilistic: the same question asked twice can produce different answers. A single check tells you almost nothing — visibility is only meaningful as a rate over repeated runs. That's why this is a tracking discipline, not a one-off lookup.",
      ],
      callout: { kind: "tip", body: "Ask an assistant about your market right now, before any tooling. Whatever it answers is what a customer heard today." },
    },
    {
      h: "Run the free audit for your baseline",
      paras: [
        "The free AI visibility audit is the fastest honest snapshot: it asks the major assistants about your business and your category, and reports where you appear, where you're absent, and who gets named instead. No account needed, and it takes about a minute.",
        "Treat the result as day zero, not a verdict. Most businesses that have never worked on this score low — which is the point: the gap between you and the names in the answers is the size of the opportunity, and the audit's findings become the first fix list.",
      ],
    },
    {
      h: "Build the prompt list",
      paras: [
        "Prompts are to AI visibility what keywords are to rank tracking. Start from three groups: buying-intent questions ('best X in <city>', 'who should I hire for Y'), brand questions ('is <brand> good', '<brand> reviews'), and competitor questions ('alternatives to <competitor>', '<competitor> vs <brand>').",
        "Phrase them the way a customer talks, not the way a keyword tool abbreviates — assistants answer conversational questions. Ten to twenty prompts is plenty to start; the tracker checks each across the assistants on schedule, so every prompt you add is recurring work you're commissioning.",
      ],
      shot: "The AI Visibility dashboard: tracked prompts with per-assistant status — mentioned, cited, or absent.",
      shotSrc: "/guides/ai-visibility-prompts-en.svg",
    },
    {
      h: "Read what the answers record",
      paras: [
        "For every run, four things get recorded: whether you were mentioned, your position among the names given, the sentiment of how you were described, and whether you (or someone else) were cited as a source — plus which websites the assistant leaned on for the answer.",
        "The citations are the actionable part. Assistants don't invent their recommendations; they synthesize them from sources — directories, review profiles, comparison pages, local press. When a competitor is named and you aren't, the cited sources are usually the explanation, and each one is a concrete place your absence can be fixed.",
      ],
      shot: "One answer, parsed: mention, position, sentiment, and the sources cited behind it.",
      shotSrc: "/guides/ai-visibility-answer-en.svg",
    },
    {
      h: "Improve the answer, then watch it move",
      paras: [
        "The levers are unglamorous and effective: a consistent business identity everywhere (one name, one address, one description), a healthy review profile that keeps growing, presence on the sources the assistants actually cite for your prompts, and pages on your own site that answer the tracked questions directly.",
        "Work one prompt at a time. Pick a buying-intent prompt where you're absent, fix what its citations point at, and let the daily runs record the change. Movement typically shows in weeks, not days — the compounding is the reward: once you're in an answer, you tend to be served for every phrasing of the question.",
      ],
      callout: { kind: "tip", body: "Alerts do the watching between changes: you're notified when you drop out of an answer or a competitor takes a top recommendation — the day it happens." },
    },
  ],
  next: [
    { href: "/guides/audit-your-website", label: "Audit your website" },
    { href: "/guides/track-rankings", label: "Track your rankings" },
    { href: "/guides/keyword-research", label: "Keyword research" },
    { href: "/learn", label: "The full course" },
  ],
};

const FR: GuideDoc = {
  title: "La visibilité IA, de zéro au suivi",
  intro: "Une part croissante de vos prochains clients ne voit jamais de page de résultats : ils demandent à ChatGPT, Perplexity ou Gemini qui choisir, et décident dans la réponse. Ce guide montre comment découvrir ce que ces réponses disent de vous aujourd'hui, en faire un chiffre suivi, et le faire bouger.",
  needs: ["Un site web en ligne pour votre entreprise", "10 minutes pour l'audit et votre première liste de requêtes", "Un compte Echorank pour le suivi continu (l'audit lui-même n'en demande aucun)"],
  steps: [
    {
      h: "Comprendre ce que vous mesurez",
      paras: [
        "La visibilité IA, c'est savoir si — et comment — les assistants vous citent quand on pose une question de votre marché : « meilleur comptable à Lyon », « <votre marque>, c'est sérieux ? », « alternatives à <concurrent> ». Contrairement à un classement, une réponse n'a pas dix positions fixes. Ce qui compte : être mentionné, figurer parmi les premiers noms, être décrit positivement, et être cité comme source.",
        "Les assistants sont aussi probabilistes : la même question posée deux fois peut produire deux réponses différentes. Une vérification isolée ne dit presque rien — la visibilité n'a de sens que comme taux sur des exécutions répétées. C'est une discipline de suivi, pas une consultation ponctuelle.",
      ],
      callout: { kind: "tip", body: "Posez dès maintenant une question de votre marché à un assistant, sans aucun outil. Sa réponse est ce qu'un client a entendu aujourd'hui." },
    },
    {
      h: "Lancer l'audit gratuit pour votre référence",
      paras: [
        "L'audit de visibilité IA gratuit est l'instantané honnête le plus rapide : il interroge les principaux assistants sur votre entreprise et votre catégorie, et rapporte où vous apparaissez, où vous êtes absent, et qui est nommé à votre place. Sans compte, en une minute environ.",
        "Prenez le résultat comme un jour zéro, pas comme un verdict. La plupart des entreprises qui n'ont jamais travaillé le sujet obtiennent un score bas — c'est justement le point : l'écart entre vous et les noms des réponses est la taille de l'opportunité, et les constats de l'audit forment la première liste de corrections.",
      ],
    },
    {
      h: "Construire la liste de requêtes",
      paras: [
        "Les requêtes sont à la visibilité IA ce que les mots-clés sont au suivi de positions. Partez de trois groupes : les questions d'achat (« meilleur X à <ville> », « qui engager pour Y »), les questions de marque (« <marque>, c'est bien ? », « avis <marque> »), et les questions concurrentielles (« alternatives à <concurrent> », « <concurrent> vs <marque> »).",
        "Formulez-les comme parle un client, pas comme abrège un outil de mots-clés — les assistants répondent à des questions conversationnelles. Dix à vingt requêtes suffisent pour démarrer ; le suivi vérifie chacune sur les assistants selon le calendrier, donc chaque requête ajoutée est un travail récurrent que vous commandez.",
      ],
      shot: "Le tableau Visibilité IA : requêtes suivies avec le statut par assistant — mentionné, cité ou absent.",
      shotSrc: "/guides/ai-visibility-prompts-fr.svg",
    },
    {
      h: "Lire ce que les réponses enregistrent",
      paras: [
        "Pour chaque exécution, quatre choses sont enregistrées : votre mention, votre position parmi les noms donnés, le sentiment de la description, et votre citation (ou celle d'un autre) comme source — plus les sites sur lesquels l'assistant s'est appuyé.",
        "Les citations sont la partie actionnable. Les assistants n'inventent pas leurs recommandations ; ils les synthétisent depuis des sources — annuaires, profils d'avis, pages comparatives, presse locale. Quand un concurrent est nommé et pas vous, les sources citées sont généralement l'explication, et chacune est un endroit concret où corriger votre absence.",
      ],
      shot: "Une réponse, analysée : mention, position, sentiment, et les sources citées derrière.",
      shotSrc: "/guides/ai-visibility-answer-fr.svg",
    },
    {
      h: "Améliorer la réponse, puis la regarder bouger",
      paras: [
        "Les leviers sont peu spectaculaires et efficaces : une identité d'entreprise cohérente partout (un nom, une adresse, une description), un profil d'avis sain qui continue de croître, une présence sur les sources que les assistants citent réellement pour vos requêtes, et des pages de votre site qui répondent directement aux questions suivies.",
        "Travaillez une requête à la fois. Choisissez une requête d'achat où vous êtes absent, corrigez ce que ses citations désignent, et laissez les exécutions quotidiennes enregistrer le changement. Le mouvement apparaît en semaines, pas en jours — la récompense est le cumul : une fois dans une réponse, vous êtes resservi pour chaque formulation de la question.",
      ],
      callout: { kind: "tip", body: "Les alertes surveillent entre vos interventions : vous êtes prévenu quand vous sortez d'une réponse ou qu'un concurrent prend une recommandation de tête — le jour même." },
    },
  ],
  next: [
    { href: "/guides/audit-your-website", label: "Auditer votre site" },
    { href: "/guides/track-rankings", label: "Suivre vos positions" },
    { href: "/guides/keyword-research", label: "Recherche de mots-clés" },
    { href: "/learn", label: "Le cours complet" },
  ],
};

export default async function Page({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const doc = solutionBase(locale) === "fr" ? FR : EN;
  return <GuideArticle locale={locale} doc={doc} />;
}
