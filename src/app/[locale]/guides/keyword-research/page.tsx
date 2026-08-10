import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { GuideArticle, baseOf, type GuideDoc } from "../_shared/GuideArticle";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

const EN: GuideDoc = {
  title: "Keyword research",
  intro:
    "Good keyword research starts with what customers already say, not with a tool. This guide goes from their language to a short, defensible list you can assign to pages and track — without burning your monthly search quota on curiosity.",
  needs: [
    "Your review history imported, or a folder of customer emails",
    "A paid plan for Keywords Explorer",
    "About 30 minutes",
  ],
  steps: [
    {
      h: "Start from customer language",
      paras: [
        "Before you open a keyword tool, read your own reviews and inquiry emails. Customers describe problems in words you would never invent at a desk — they ask for an emergency callout, not a 24-hour service provision.",
        "Write down the recurring phrases. This list is worth more than any expansion tool's output, because it is evidence of demand rather than an estimate of it.",
      ],
      callout: {
        kind: "tip",
        body: "Themes in negative reviews are keyword research too. If three people complain they could not tell whether you covered their area, \"[service] in [town]\" is a page you are missing.",
      },
    },
    {
      h: "Expand in Keywords Explorer",
      paras: [
        "Take your best five or ten phrases into Keywords Explorer and expand from there. Working from real phrases keeps the expansion anchored to your actual business rather than to a category.",
        "Searches count against your plan's monthly pool: 250 a month on Starter, 1,000 on Growth, and 5,000 on Agency. That is generous for deliberate research and easy to waste on idle typing, so batch your lookups.",
      ],
      shot: "Keywords Explorer with a seed phrase entered and expansions listed beneath.",
      shotSrc: "/guides/keywords-explorer-en.svg",
      callout: {
        kind: "note",
        body: "A search only counts against the quota when a result actually comes back. A query that returns nothing is not billed to your pool.",
      },
    },
    {
      h: "Filter by intent, not volume",
      paras: [
        "The highest-volume term in your category is usually the least useful. Somebody typing a broad category name is browsing; somebody typing a service and a place is deciding.",
        "Sort your expanded list into buying and browsing, and keep the buying half. A page ranking for a term with a tenth of the volume and ten times the intent is the better page.",
        "A quick test: for each term, ask what the person typing it wants in the next hour. If the honest answer is \"to read something\", it belongs in a blog post, not on a service page. If the answer is \"to hire someone\", it belongs on the page that lets them.",
      ],
    },
    {
      h: "Assign one primary keyword per page",
      paras: [
        "Each page gets one primary keyword. Two pages targeting the same term compete with each other, and the usual result is that neither ranks — you have split your own signals.",
        "If two of your pages genuinely deserve the same term, that is a sign they should be one page.",
      ],
      shot: "A simple mapping of pages to their assigned primary keywords.",
      shotSrc: "/guides/keyword-mapping-en.svg",
    },
    {
      h: "Add ten to twenty-five terms to Rank Tracker",
      paras: [
        "Move the surviving list into Rank Tracker. Ten to twenty-five is the range that stays readable: enough to see patterns, few enough that you will actually look at it each month.",
        "Keep the basket stable. Swapping terms in and out every few weeks destroys the trend line, which is the only part of rank tracking that tells you anything.",
      ],
    },
  ],
  next: [
    { href: "/guides/track-rankings", label: "Track rankings" },
    { href: "/guides/competitive-analysis", label: "Competitive analysis" },
    { href: "/guides/audit-your-website", label: "Audit your website" },
  ],
};

const FR: GuideDoc = {
  title: "Recherche de mots-clés",
  intro:
    "Une bonne recherche de mots-clés commence par ce que disent déjà vos clients, pas par un outil. Ce guide va de leur vocabulaire à une liste courte et défendable, à affecter à vos pages et à suivre — sans gaspiller votre quota mensuel par curiosité.",
  needs: [
    "Votre historique d'avis importé, ou un dossier de courriels clients",
    "Un forfait payant pour Keywords Explorer",
    "Environ 30 minutes",
  ],
  steps: [
    {
      h: "Partez du vocabulaire de vos clients",
      paras: [
        "Avant d'ouvrir un outil, relisez vos propres avis et vos courriels de demande. Les clients décrivent leurs problèmes avec des mots que vous n'inventeriez jamais à votre bureau : ils demandent un dépannage d'urgence, pas une prestation continue sur 24 heures.",
        "Notez les formulations récurrentes. Cette liste vaut plus que la sortie de n'importe quel outil d'expansion, parce qu'elle est une preuve de la demande et non une estimation.",
      ],
      callout: {
        kind: "tip",
        body: "Les thèmes des avis négatifs sont aussi de la recherche de mots-clés. Si trois personnes se plaignent de ne pas avoir su si vous desserviez leur secteur, « [service] à [ville] » est une page qui vous manque.",
      },
    },
    {
      h: "Élargissez dans Keywords Explorer",
      paras: [
        "Reprenez vos cinq à dix meilleures expressions dans Keywords Explorer et élargissez à partir de là. Partir d'expressions réelles garde l'expansion ancrée à votre activité plutôt qu'à une catégorie.",
        "Les recherches sont décomptées du pool mensuel de votre forfait : 250 par mois sur Starter, 1 000 sur Croissance et 5 000 sur Agence. C'est généreux pour une recherche réfléchie et facile à gaspiller en saisies distraites : regroupez vos requêtes.",
      ],
      shot: "Keywords Explorer, une expression de départ saisie et les expansions listées en dessous.",
      shotSrc: "/guides/keywords-explorer-fr.svg",
      callout: {
        kind: "note",
        body: "Une recherche n'est décomptée du quota que lorsqu'un résultat revient réellement. Une requête sans résultat n'est pas facturée à votre pool.",
      },
    },
    {
      h: "Filtrez par intention, pas par volume",
      paras: [
        "Le terme au plus fort volume de votre catégorie est généralement le moins utile. Qui tape un nom de catégorie large est en train de parcourir ; qui tape un service et un lieu est en train de décider.",
        "Triez votre liste élargie entre « achat » et « exploration », et gardez la moitié « achat ». Une page positionnée sur un terme au dixième du volume mais dix fois plus intentionnel est la meilleure page.",
      ],
    },
    {
      h: "Affectez un mot-clé principal par page",
      paras: [
        "Chaque page reçoit un seul mot-clé principal. Deux pages visant le même terme se concurrencent, et le résultat habituel est qu'aucune ne se positionne : vous avez divisé vos propres signaux.",
        "Si deux de vos pages méritent vraiment le même terme, c'est le signe qu'elles devraient n'en faire qu'une.",
      ],
      shot: "Une correspondance simple entre les pages et leur mot-clé principal.",
      shotSrc: "/guides/keyword-mapping-fr.svg",
    },
    {
      h: "Ajoutez dix à vingt-cinq termes au Rank Tracker",
      paras: [
        "Faites passer la liste retenue dans le Rank Tracker. Dix à vingt-cinq est la fourchette qui reste lisible : assez pour voir des tendances, assez peu pour que vous la consultiez vraiment chaque mois.",
        "Gardez le panier stable. Changer les termes toutes les quelques semaines détruit la courbe de tendance, seule partie du suivi de position qui vous apprenne quelque chose.",
      ],
    },
  ],
  next: [
    { href: "/guides/track-rankings", label: "Suivre les positions" },
    { href: "/guides/competitive-analysis", label: "Analyse concurrentielle" },
    { href: "/guides/audit-your-website", label: "Auditer votre site web" },
  ],
};

const DOCS = { en: EN, fr: FR };
const META = {
  en: {
    title: "Keyword research — from customer language to a tracked list",
    description:
      "Start from what customers actually say, expand in Keywords Explorer within your plan's search quota, filter by intent, and assign one primary keyword per page.",
  },
  fr: {
    title: "Recherche de mots-clés — du vocabulaire client à une liste suivie",
    description:
      "Partez de ce que disent vos clients, élargissez dans Keywords Explorer selon le quota de votre forfait, filtrez par intention et affectez un mot-clé principal par page.",
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
    path: "/guides/keyword-research",
    title: m.title,
    description: m.description,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  return <GuideArticle locale={locale} doc={DOCS[baseOf(locale)]} />;
}
