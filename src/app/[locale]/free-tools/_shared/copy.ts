// EN body copy for the free tools.
//
// FIRST PASS IS ENGLISH BODY / FIVE-LOCALE CHROME, per the brief. The chrome —
// nav, footer, locale switcher — already comes from CONTENT in
// src/lib/i18n/content.ts, which is a real five-locale catalog. Only the tool
// bodies are English, and they say so nowhere because a machine-translated
// first pass would be worse than an honest English one (the same rule the
// Knowledge Hub follows).
//
// Keyed by FreeToolId so a tool without copy is a type error rather than a
// blank page.

import type { FreeToolId } from "@/lib/free-tools";

export interface ToolCopy {
  name: string;
  /** Hub card blurb. */
  blurb: string;
  /** Page lede. */
  intro: string;
  /** Meta title, without the brand — buildMetadata appends it. */
  metaTitle: string;
  metaDescription: string;
  /** Shown under the form: what it costs the visitor. */
  limitNote: string;
  cta: string;
  /** Two or three FAQ pairs, used for the page and its FAQPage JSON-LD. */
  faq: { q: string; a: string }[];
}

export const HUB_COPY = {
  kicker: "FREE TOOLS",
  h1: "Free SEO tools, no account needed",
  intro:
    "Small, sharp tools that answer one question each. Nothing here asks for an email, and everything runs on the same data our paid product uses.",
  newBadge: "NEW",
  extensionName: "Browser extension",
  extensionBlurb:
    "Capture reviews straight from a Google or Facebook page and send them to your dashboard.",
  ctaTitle: "Want the full picture?",
  ctaBody:
    "These tools each answer one question. Echorank360 tracks your reputation and AI visibility continuously — and tells you what to fix first.",
  ctaButton: "Create a free account",
} as const;

export const TOOL_COPY: Record<FreeToolId, ToolCopy> = {
  serp_location: {
    name: "SERP Location Changer",
    blurb: "See the top 10 for any keyword, as searched from another country.",
    intro:
      "Search results differ by country. Enter a keyword, pick a market, and see what Google actually returns there — not what your own location shows you.",
    metaTitle: "Free SERP location checker — see Google results by country",
    metaDescription:
      "Check the top 10 Google results for any keyword as searched from another country. Free, no account needed.",
    limitNote: "3 free checks a day. Results usually take a few minutes.",
    cta: "Track rankings daily",
    faq: [
      {
        q: "Why do results take a few minutes?",
        a: "The check is queued with our search data provider rather than run live, which is what keeps it free. The page updates itself when the results land — you can leave and come back.",
      },
      {
        q: "Why can I only see the first three results?",
        a: "The full top 10 is available on a paid plan. The free tool shows the first three positions and how many results were found.",
      },
      {
        q: "Which countries can I check?",
        a: "The seven markets we hold verified location data for. City-level checks are a paid feature.",
      },
    ],
  },
  reddit_threads: {
    name: "Reddit Threads Finder",
    blurb: "Find the Reddit discussions ranking for a keyword, with scores and comment counts.",
    intro:
      "Reddit threads rank for a lot of commercial queries. Find the ones discussing your keyword, sorted by relevance, so you can see what people actually say.",
    metaTitle: "Free Reddit thread finder for any keyword",
    metaDescription:
      "Find Reddit discussions about any keyword, with scores, comment counts and links. Free, no account needed.",
    limitNote: "10 free searches a day.",
    cta: "Monitor mentions automatically",
    faq: [
      {
        q: "Where does this data come from?",
        a: "Reddit's own public search, fetched server-side. We do not post, vote or read anything that is not already public.",
      },
      {
        q: "Why did my search return nothing?",
        a: "Either no threads matched in the last year, or Reddit declined our request. If it is the second, waiting a few minutes usually works — and it does not use up one of your daily searches.",
      },
    ],
  },
  serp_volatility: {
    name: "SERP Volatility Checker",
    blurb: "How much Google's results moved today, across five industries.",
    intro:
      "We sample a fixed basket of 30 keywords every day and measure how much the top 10 changed. A quiet day scores near zero; an algorithm update shows up as a spike.",
    metaTitle: "Free SERP volatility tracker — daily Google ranking flux",
    metaDescription:
      "Daily Google SERP volatility across ecommerce, local, finance, health and tech. Updated every day, free to read.",
    limitNote: "Free to read, updated daily. No limit.",
    cta: "Track your own rankings",
    faq: [
      {
        q: "How is the score calculated?",
        a: "For each keyword we compare today's top 10 with yesterday's and add up how far every domain moved, counting an entry or exit as a move of eleven places. That total is scaled to a 0–10 range, then averaged per category.",
      },
      {
        q: "What counts as high volatility?",
        a: "Below 1 is an ordinary day. Three to five usually means a broad update is rolling out. The scale leaves headroom above that on purpose, so a genuinely extreme day still has somewhere to go.",
      },
      {
        q: "Which keywords do you track?",
        a: "A fixed basket of 30 head terms — six each across ecommerce, local, finance, health and tech, all in the US index. The basket never changes, because swapping a keyword would look like volatility that no search engine caused.",
      },
    ],
  },
  ai_search_grader: {
    name: "AI Search Grader",
    blurb: "An A–F grade for how ready your site is to be quoted by AI assistants.",
    intro:
      "ChatGPT, Claude and Perplexity can only recommend what their crawlers can read. Enter a domain for a letter grade and the three things holding it back.",
    metaTitle: "Free AI search readiness grader — get your A–F grade",
    metaDescription:
      "Grade any domain on how readable it is to AI assistants: crawler access, structured data and rendering. Free, no account needed.",
    limitNote: "1 free grade a day.",
    cta: "Get the full AI visibility report",
    faq: [
      {
        q: "What does the grade measure?",
        a: "Whether AI crawlers are allowed in, whether your content exists in the raw HTML, and whether the page carries the structured data assistants rely on. It does not measure whether assistants currently mention you — that is answer tracking, which needs an account.",
      },
      {
        q: "Is this the same as the full audit?",
        a: "It uses the same scoring, on a single page rather than a crawl of the site. The full audit checks every page and gives you the fix list.",
      },
    ],
  },
  content_optimizer: {
    name: "SEO Content Optimizer",
    blurb: "Paste a draft and a target keyword for an instant on-page score.",
    intro:
      "Nine checks an editor would run by eye: length, keyword placement and density, headings, readability, question coverage and meta length. Everything happens in your browser — the text never leaves it.",
    metaTitle: "Free SEO content optimizer — score any draft instantly",
    metaDescription:
      "Paste your draft and target keyword for an instant on-page SEO score: keyword placement, density, readability, headings and meta length.",
    limitNote: "Unlimited. Runs entirely in your browser — nothing is uploaded.",
    cta: "Get AI rewrite suggestions",
    faq: [
      {
        q: "Does my text get sent anywhere?",
        a: "No. This tool has no server endpoint at all — the analysis runs in your browser, so the draft never leaves your machine.",
      },
      {
        q: "What is a good keyword density?",
        a: "Between roughly 0.5% and 2.5%. Below that the page reads as unfocused; above it starts to look like stuffing, which is what the check is really for.",
      },
    ],
  },
  share_of_search: {
    name: "Share of Search",
    blurb: "How much of your category's search demand each brand owns.",
    intro:
      "Share of search tracks brand demand better than most brand-awareness surveys. Compare two to five brands and see who owns the category.",
    metaTitle: "Free share of search calculator — compare brand demand",
    metaDescription:
      "Compare search volume across two to five brands and see each one's share of category demand. Free, no account needed.",
    limitNote: "2 free comparisons a day.",
    cta: "Track share of search over time",
    faq: [
      {
        q: "What is share of search?",
        a: "Each brand's search volume as a percentage of the total across the brands you compare. It moves ahead of market share, which is why marketers watch it.",
      },
      {
        q: "Why is one of my brands showing zero?",
        a: "The volume source had no data for that exact spelling in the country you picked. Try the brand's most common search form.",
      },
    ],
  },
  serp_simulator: {
    name: "SERP Simulator",
    blurb: "Preview how your title and description look in Google — before you publish.",
    intro:
      "Google truncates by pixel width, not character count, which is why character counters get it wrong. Type a title and description to see exactly where they get cut on desktop and mobile.",
    metaTitle: "Free Google SERP snippet preview tool",
    metaDescription:
      "Preview how your title tag and meta description appear in Google, with accurate pixel-width truncation for desktop and mobile.",
    limitNote: "Unlimited. Runs entirely in your browser.",
    cta: "Audit every page at once",
    faq: [
      {
        q: "Why pixels and not characters?",
        a: "Google measures rendered width. 'Illinois' and 'lilliputian' are eleven characters each and nowhere near the same width, so a character counter will tell you a title fits when it does not.",
      },
      {
        q: "How accurate is the preview?",
        a: "It is a close approximation of Google's rendering, not a pixel-exact copy — treat a result near the limit as 'likely to truncate' rather than a guarantee either way.",
      },
    ],
  },
};
