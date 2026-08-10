import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { GuideArticle, baseOf, type GuideDoc } from "../_shared/GuideArticle";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

const EN: GuideDoc = {
  title: "Track rankings",
  intro:
    "Rank tracking is only useful if you track the right terms and read them over the right timescale. This guide covers choosing a stable basket, connecting Search Console for real query data, and reporting monthly without over-reacting to noise.",
  needs: [
    "A keyword list you have already filtered",
    "Access to Google Search Console for your domain",
    "About 20 minutes to set up",
  ],
  steps: [
    {
      h: "Pick a stable basket",
      paras: [
        "Choose ten to twenty-five terms and commit to them. A useful basket has three parts: your brand name, your core services paired with the places you serve, and the pages that actually make money.",
        "Resist adding every term you find interesting. A hundred tracked keywords is a list nobody reads, and the ones that matter get lost among the ones that do not.",
      ],
    },
    {
      h: "Add them to Rank Tracker",
      paras: [
        "Add the basket to Rank Tracker. Checks are queued rather than instant — results usually land within minutes, and the terms are then re-checked on a schedule without you asking.",
        "An empty result immediately after adding a term is normal. It means the check has not come back yet, not that you do not rank.",
      ],
      shot: "Rank Tracker with a basket of terms added, some still awaiting first results.",
      shotSrc: "/guides/rank-tracker-en.svg",
    },
    {
      h: "Read trends, not days",
      paras: [
        "Look at four weeks, not four days. Daily position numbers move for reasons that have nothing to do with you — personalisation, location, and ordinary result-page churn — and reacting to them means rewriting pages in response to noise.",
        "The useful question is whether a term has drifted up or down over a month, and whether a change lines up with something you actually shipped.",
      ],
      callout: {
        kind: "tip",
        body: "Note the date whenever you ship a change. A month later, a movement you can tie to a specific fix is evidence; a movement you cannot is a coincidence you might repeat for no reason.",
      },
    },
    {
      h: "Connect Search Console",
      paras: [
        "Rank Tracker tells you where you sit for terms you chose. Search Console tells you what people actually typed, how often you appeared, and how often anyone clicked — including queries you would never have thought to track.",
        "Connect it and use GSC Insights. The two together answer different halves of the same question: your basket says whether you are winning the terms you targeted, Search Console says whether you targeted the right ones.",
      ],
      shot: "GSC Insights showing queries, impressions and clicks for the connected property.",
      shotSrc: "/guides/gsc-insights-en.svg",
      callout: {
        kind: "note",
        body: "A newly connected property will look almost empty at first. Google withholds data below its own reporting thresholds and backfills slowly — that is Google's behaviour, not a fault in the connection.",
      },
    },
    {
      h: "Report monthly",
      paras: [
        "Once a month, export the trend from the Reporting group and put it beside what you shipped. That comparison is the whole point of tracking: it converts a list of positions into a decision about what to do next.",
        "Monthly is the right cadence for most businesses. Weekly reporting mostly documents noise, and quarterly is too slow to catch a problem while it is still cheap to fix.",
      ],
    },
  ],
  next: [
    { href: "/guides/keyword-research", label: "Keyword research" },
    { href: "/guides/competitive-analysis", label: "Competitive analysis" },
    { href: "/guides/ai-visibility", label: "AI visibility" },
  ],
};

const FR: GuideDoc = {
  title: "Suivre les positions",
  intro:
    "Le suivi de position n'est utile que si vous suivez les bons termes sur la bonne échelle de temps. Ce guide couvre le choix d'un panier stable, la connexion de Search Console pour des données de requêtes réelles, et un rapport mensuel sans surréagir au bruit.",
  needs: [
    "Une liste de mots-clés déjà filtrée",
    "L'accès à Google Search Console pour votre domaine",
    "Environ 20 minutes de configuration",
  ],
  steps: [
    {
      h: "Choisissez un panier stable",
      paras: [
        "Retenez dix à vingt-cinq termes et tenez-vous-y. Un panier utile comporte trois parties : votre marque, vos services principaux associés aux lieux que vous desservez, et les pages qui rapportent vraiment.",
        "Résistez à l'envie d'ajouter chaque terme intéressant. Cent mots-clés suivis forment une liste que personne ne lit, et ceux qui comptent s'y perdent.",
      ],
    },
    {
      h: "Ajoutez-les au Rank Tracker",
      paras: [
        "Ajoutez le panier au Rank Tracker. Les vérifications sont mises en file plutôt qu'instantanées : les résultats arrivent généralement en quelques minutes, puis les termes sont re-vérifiés selon une planification, sans intervention.",
        "Un résultat vide juste après l'ajout est normal. Cela signifie que la vérification n'est pas encore revenue, pas que vous n'êtes pas positionné.",
      ],
      shot: "Le Rank Tracker avec un panier de termes ajoutés, certains en attente de premier résultat.",
      shotSrc: "/guides/rank-tracker-fr.svg",
    },
    {
      h: "Lisez des tendances, pas des journées",
      paras: [
        "Regardez quatre semaines, pas quatre jours. Les positions quotidiennes bougent pour des raisons qui n'ont rien à voir avec vous — personnalisation, localisation, remous ordinaires des pages de résultats — et y réagir revient à réécrire des pages en réponse à du bruit.",
        "La bonne question est de savoir si un terme a dérivé vers le haut ou le bas sur un mois, et si ce mouvement coïncide avec quelque chose que vous avez réellement livré.",
      ],
      callout: {
        kind: "tip",
        body: "Notez la date à chaque changement livré. Un mois plus tard, un mouvement rattachable à un correctif précis est une preuve ; un mouvement inexplicable est une coïncidence que vous risquez de reproduire sans raison.",
      },
    },
    {
      h: "Connectez Search Console",
      paras: [
        "Le Rank Tracker vous dit où vous êtes sur les termes que vous avez choisis. Search Console vous dit ce que les gens ont réellement tapé, à quelle fréquence vous êtes apparu et combien ont cliqué — y compris des requêtes auxquelles vous n'auriez jamais pensé.",
        "Connectez-le et utilisez GSC Insights. Les deux répondent à des moitiés différentes de la même question : votre panier dit si vous gagnez les termes visés, Search Console dit si vous avez visé les bons.",
      ],
      shot: "GSC Insights : requêtes, impressions et clics pour la propriété connectée.",
      shotSrc: "/guides/gsc-insights-fr.svg",
      callout: {
        kind: "note",
        body: "Une propriété fraîchement connectée paraîtra presque vide au début. Google masque les données sous ses propres seuils de reporting et les complète lentement — c'est le comportement de Google, pas un défaut de la connexion.",
      },
    },
    {
      h: "Faites un rapport mensuel",
      paras: [
        "Une fois par mois, exportez la tendance depuis le groupe Rapports et placez-la à côté de ce que vous avez livré. Cette comparaison est tout l'intérêt du suivi : elle transforme une liste de positions en décision sur la suite.",
        "Le rythme mensuel convient à la plupart des entreprises. Un rapport hebdomadaire documente surtout du bruit, et le trimestre est trop lent pour attraper un problème tant qu'il est encore peu coûteux à corriger.",
      ],
    },
  ],
  next: [
    { href: "/guides/keyword-research", label: "Recherche de mots-clés" },
    { href: "/guides/competitive-analysis", label: "Analyse concurrentielle" },
    { href: "/guides/ai-visibility", label: "Visibilité IA" },
  ],
};

const DOCS = { en: EN, fr: FR };
const META = {
  en: {
    title: "Track rankings — a stable basket and a monthly read",
    description:
      "Pick ten to twenty-five terms, add them to Rank Tracker, read trends over four weeks rather than four days, and connect Search Console for the queries you never thought to track.",
  },
  fr: {
    title: "Suivre les positions — un panier stable et une lecture mensuelle",
    description:
      "Choisissez dix à vingt-cinq termes, ajoutez-les au Rank Tracker, lisez les tendances sur quatre semaines et connectez Search Console pour les requêtes auxquelles vous n'aviez pas pensé.",
  },
};

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const m = META[baseOf(locale)];
  return buildMetadata({
    locale: locale as Locale,
    path: "/guides/track-rankings",
    title: m.title,
    description: m.description,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  return <GuideArticle locale={locale} doc={DOCS[baseOf(locale)]} />;
}
