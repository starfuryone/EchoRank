// Blog chrome copy, en/fr. Article BODIES live in content/blog/<base>/; this is
// everything around them — headings, labels, CTA wording and the per-tool
// pitches. Same en/fr model as the rest of the marketing site: de-CH and en-CA
// fold to en, fr-CA to fr, and a third catalog here would be unreachable code.

import type { BlogBase, BlogCategory, BlogTool } from "@/lib/blog/constants";

export interface BlogChrome {
  navLabel: string;
  hubEyebrow: string;
  hubH1: string;
  hubSub: string;
  searchPlaceholder: string;
  searchCount: (n: number) => string;
  searchNone: string;
  allCategories: string;
  featuredLabel: string;
  latest: string;
  readingTime: (m: number) => string;
  updatedOn: (d: string) => string;
  by: string;
  home: string;
  blog: string;
  faqH: string;
  tocH: string;
  relatedH: string;
  prevPage: string;
  nextPage: string;
  pageOf: (n: number, total: number) => string;
  emptyCategory: string;
  browseAll: string;
  bandH: string;
  bandSub: string;
  bandCta: string;
  bandGhost: string;
  categoryTitle: (c: string) => string;
  categoryDesc: (c: string) => string;
  pageTitle: (n: number) => string;
  /** The English-body notice, shown when a fr reader gets the en file. */
  englishBody: string;
}

/** The mid-article CTA. One entry per BLOG_TOOLS member — all real routes. */
export type ToolCopy = Record<BlogTool, { h: string; p: string; cta: string }>;

const CATEGORY_FR: Record<BlogCategory, string> = {
  "GEO Guides": "Guides GEO",
  "Best Practices": "Bonnes pratiques",
  "Use Cases": "Cas d'usage",
  "AI Visibility": "Visibilité IA",
  Research: "Recherche",
  Tools: "Outils",
};

/**
 * The reader-facing name of a category.
 *
 * The category is stored in frontmatter in English because it is also the URL
 * and the taxonomy key; only the label is translated. A French reader browsing
 * /fr/blog/category/geo-guides sees "Guides GEO" over the same set of articles.
 */
export function categoryLabel(category: BlogCategory, base: BlogBase): string {
  return base === "fr" ? CATEGORY_FR[category] : category;
}

export const BLOG_CHROME: Record<BlogBase, BlogChrome> = {
  en: {
    navLabel: "Echorank Blog",
    hubEyebrow: "THE BLOG",
    hubH1: "GEO, AI search visibility, and what actually moves them",
    hubSub:
      "Practical writing on generative engine optimization: how to measure AI visibility, how to earn citations, and which of your SEO habits still apply. Method over predictions.",
    searchPlaceholder: "Search articles, tags and topics…",
    searchCount: (n) => (n === 1 ? "1 matching article" : `${n} matching articles`),
    searchNone: "No articles match that. Try a broader term, or browse a category above.",
    allCategories: "All",
    featuredLabel: "FEATURED",
    latest: "LATEST",
    readingTime: (m) => `${m} min read`,
    updatedOn: (d) => `Updated ${d}`,
    by: "By",
    home: "Home",
    blog: "Blog",
    faqH: "Frequently asked",
    tocH: "On this page",
    relatedH: "KEEP READING",
    prevPage: "← Previous",
    nextPage: "Next →",
    pageOf: (n, total) => `Page ${n} of ${total}`,
    emptyCategory: "Nothing published in this category yet. Everything else is on the blog index.",
    browseAll: "Browse all articles ↗",
    bandH: "See what AI engines see about your site",
    bandSub:
      "A free audit of the signals in this article: which AI user-agents your robots.txt allows, whether your pages carry their substance in the HTML, and what structured data is there. No account, no card.",
    bandCta: "Run my free audit ↗",
    bandGhost: "See plans & pricing",
    categoryTitle: (c) => `${c} — Echorank Blog`,
    categoryDesc: (c) =>
      `Every ${c} article on the Echorank blog: practical writing on AI search visibility, GEO and what to measure.`,
    pageTitle: (n) => `Echorank Blog — page ${n}`,
    englishBody:
      "This article has not been translated yet, so the body below is in English. Everything around it is in your language.",
  },
  fr: {
    navLabel: "Blog Echorank",
    hubEyebrow: "LE BLOG",
    hubH1: "GEO, visibilité dans la recherche IA, et ce qui les fait bouger",
    hubSub:
      "Des articles concrets sur l'optimisation pour les moteurs génératifs : comment mesurer la visibilité IA, comment obtenir des citations, et lesquelles de vos habitudes SEO tiennent encore. De la méthode, pas des prédictions.",
    searchPlaceholder: "Rechercher un article, un tag, un sujet…",
    searchCount: (n) => (n === 1 ? "1 article correspondant" : `${n} articles correspondants`),
    searchNone:
      "Aucun article ne correspond. Essayez un terme plus large, ou parcourez une catégorie ci-dessus.",
    allCategories: "Tout",
    featuredLabel: "À LA UNE",
    latest: "DERNIERS ARTICLES",
    readingTime: (m) => `${m} min de lecture`,
    updatedOn: (d) => `Mis à jour le ${d}`,
    by: "Par",
    home: "Accueil",
    blog: "Blog",
    faqH: "Questions fréquentes",
    tocH: "Sur cette page",
    relatedH: "À LIRE ENSUITE",
    prevPage: "← Précédent",
    nextPage: "Suivant →",
    pageOf: (n, total) => `Page ${n} sur ${total}`,
    emptyCategory:
      "Rien de publié dans cette catégorie pour l'instant. Tout le reste se trouve sur l'index du blog.",
    browseAll: "Voir tous les articles ↗",
    bandH: "Voyez ce que les moteurs IA voient de votre site",
    bandSub:
      "Un audit gratuit des signaux décrits dans cet article : quels agents IA votre robots.txt autorise, si vos pages portent leur contenu dans le HTML, et quelles données structurées sont présentes. Sans compte, sans carte.",
    bandCta: "Lancer mon audit gratuit ↗",
    bandGhost: "Voir les tarifs",
    categoryTitle: (c) => `${c} — Blog Echorank`,
    categoryDesc: (c) =>
      `Tous les articles ${c} du blog Echorank : de la méthode sur la visibilité dans la recherche IA, le GEO et ce qu'il faut mesurer.`,
    pageTitle: (n) => `Blog Echorank — page ${n}`,
    englishBody:
      "Cet article n'est pas encore traduit : le corps ci-dessous est en anglais. Tout ce qui l'entoure est dans votre langue.",
  },
};

/**
 * Per-tool CTA copy.
 *
 * Every key is a route that EXISTS — see the BLOG_TOOLS comment in
 * src/lib/blog/constants.ts for the four fictional tool pages this replaced.
 * The wording differs per tool because a generic "try our product" band under
 * every article is the thing readers learn to skip.
 */
export const BLOG_TOOL_COPY: Record<BlogBase, ToolCopy> = {
  en: {
    "free-audit": {
      h: "Check what AI crawlers can actually read",
      p: "The free audit reports which AI user-agents your robots.txt allows, whether your pages carry their substance in the HTML, what structured data is present, and whether you publish an llms.txt — itemized, with a recommendation each.",
      cta: "Run a free GEO audit ↗",
    },
    "free-tools": {
      h: "Free tools, no account",
      p: "SERP volatility, a content optimizer, share of search and a SERP simulator. Anonymous, rate-limited, and useful on their own.",
      cta: "Open the free tools ↗",
    },
    pricing: {
      h: "Track this continuously",
      p: "Scheduled prompt runs against a frozen set, weekly, with alerts when you drop out of an answer you used to hold.",
      cta: "See plans & pricing ↗",
    },
    "ai-assistant": {
      h: "Ask the assistant",
      p: "Put the question from this article to the public AI assistant and get an answer scoped to your own domain.",
      cta: "Open the AI assistant ↗",
    },
  },
  fr: {
    "free-audit": {
      h: "Vérifiez ce que les robots IA peuvent réellement lire",
      p: "L'audit gratuit indique quels agents IA votre robots.txt autorise, si vos pages portent leur contenu dans le HTML, quelles données structurées sont présentes, et si vous publiez un llms.txt — point par point, avec une recommandation à chaque fois.",
      cta: "Lancer un audit GEO gratuit ↗",
    },
    "free-tools": {
      h: "Outils gratuits, sans compte",
      p: "Volatilité des SERP, optimiseur de contenu, part de recherche et simulateur de SERP. Anonymes, limités par IP, et utiles en eux-mêmes.",
      cta: "Ouvrir les outils gratuits ↗",
    },
    pricing: {
      h: "Suivez-le en continu",
      p: "Des exécutions planifiées sur un jeu de prompts figé, chaque semaine, avec des alertes quand vous disparaissez d'une réponse que vous occupiez.",
      cta: "Voir les tarifs ↗",
    },
    "ai-assistant": {
      h: "Posez la question à l'assistant",
      p: "Soumettez la question de cet article à l'assistant IA public et obtenez une réponse cadrée sur votre propre domaine.",
      cta: "Ouvrir l'assistant IA ↗",
    },
  },
};
