// src/lib/blog-agent/sources.ts
//
// Where topics come from. Typed config, verified against the live web on
// 2026-08-21 — every URL below was fetched from this box and its status code
// recorded. A source that does not resolve is not listed as if it does.
//
// The FETCH ALLOWLIST derives from this file: discover fetches these origins,
// research fetches a page one of them linked to, and nothing else is ever
// fetched. There is no path by which user input reaches the fetcher.

/** Score weighting: how much we trust a source to be on-topic at all. */
export type SourceKind = "rss" | "hn";

export interface FeedSource {
  id: string;
  kind: "rss";
  /** Display name, used in the draft's attribution line. */
  name: string;
  url: string;
  /**
   * Multiplier on the topic score. A GEO-specific publication earns more than
   * a general SEO feed, which earns more than a vendor's own news page.
   */
  weight: number;
}

export interface HnSource {
  id: string;
  kind: "hn";
  name: string;
  /** Query passed to the Algolia search API. */
  query: string;
  weight: number;
}

export type BlogSource = FeedSource | HnSource;

/**
 * Sources that were specified and DO NOT WORK, kept as data.
 *
 * This list exists so the next person does not spend an afternoon rediscovering
 * that Reddit's public JSON is gone. Each entry records what was tried and what
 * came back. Nothing reads this at runtime; the sources-config test asserts no
 * disabled id has crept into ACTIVE_SOURCES.
 */
export interface DisabledSource {
  id: string;
  name: string;
  attempted: string[];
  reason: string;
  /** ISO date the check was run. */
  verifiedAt: string;
}

export const DISABLED_SOURCES: DisabledSource[] = [
  {
    id: "reddit_seo",
    name: "Reddit r/SEO and r/bigseo",
    attempted: [
      "https://www.reddit.com/r/SEO/top.json?t=day",
      "https://old.reddit.com/r/SEO/top.json?t=day",
      "https://www.reddit.com/r/SEO/.rss",
    ],
    reason:
      "The public .json endpoints return 403 to every user-agent from this box — Reddit now requires OAuth for programmatic reads from datacenter IPs. The .rss endpoints answered 200 once and then 429'd at four seconds' spacing, which is not a source a daily job can rely on. Re-enable only behind a registered script-type app and a REDDIT_CLIENT_ID/SECRET pair.",
    verifiedAt: "2026-08-21",
  },
  {
    id: "perplexity_blog",
    name: "Perplexity blog",
    attempted: [
      "https://www.perplexity.ai/hub/blog",
      "https://www.perplexity.ai/hub/rss.xml",
      "https://www.perplexity.ai/rss.xml",
    ],
    reason: "403 to every user-agent tried, and no feed is published at any conventional path.",
    verifiedAt: "2026-08-21",
  },
  {
    id: "anthropic_news",
    name: "Anthropic news",
    attempted: [
      "https://www.anthropic.com/rss.xml",
      "https://www.anthropic.com/news/rss.xml",
      "https://www.anthropic.com/news/feed.xml",
    ],
    reason:
      "The news index serves HTML and publishes no feed at any conventional path. Scraping the index would mean parsing a marketing page's markup on a schedule, which breaks silently on the next redesign — worse than not having the source.",
    verifiedAt: "2026-08-21",
  },
];

/**
 * The live sources. Every URL here returned 200 with a parseable body on
 * 2026-08-21.
 *
 * Note the Google Search Central URL: the obvious Blogger-style path
 * (/search/blog/feeds/posts/default) 404s. This one is the working feed.
 */
export const ACTIVE_SOURCES: BlogSource[] = [
  {
    id: "google_search_central",
    kind: "rss",
    name: "Google Search Central Blog",
    url: "https://developers.google.com/search/blog/feed.xml",
    // The only first-party source for how the dominant search engine states its
    // own rules. An announcement here IS the story, not commentary on one.
    weight: 1.4,
  },
  {
    id: "search_engine_land",
    kind: "rss",
    name: "Search Engine Land",
    url: "https://searchengineland.com/feed",
    weight: 1.0,
  },
  {
    id: "search_engine_journal",
    kind: "rss",
    name: "Search Engine Journal",
    url: "https://www.searchenginejournal.com/feed/",
    weight: 0.9,
  },
  {
    id: "ahrefs_blog",
    kind: "rss",
    name: "Ahrefs Blog",
    url: "https://ahrefs.com/blog/feed/",
    // Long-form and research-led, but it is a competitor's content marketing.
    // Worth reading, worth weighting below the neutral trade press.
    weight: 0.85,
  },
  {
    id: "openai_news",
    kind: "rss",
    name: "OpenAI News",
    url: "https://openai.com/news/rss.xml",
    // First-party for the engine most of our readers mean by "AI search".
    weight: 1.2,
  },
  { id: "hn_geo", kind: "hn", name: "Hacker News", query: "GEO generative engine optimization", weight: 0.7 },
  { id: "hn_ai_search", kind: "hn", name: "Hacker News", query: "AI search", weight: 0.7 },
  { id: "hn_llms_txt", kind: "hn", name: "Hacker News", query: "llms.txt", weight: 0.9 },
  { id: "hn_ai_crawler", kind: "hn", name: "Hacker News", query: "AI crawler", weight: 0.9 },
  { id: "hn_answer_engine", kind: "hn", name: "Hacker News", query: "answer engine", weight: 0.8 },
];

/** Origins the fetcher will talk to at all. Derived, never hand-listed. */
export function allowedFeedOrigins(): string[] {
  const origins = new Set<string>(["https://hn.algolia.com"]);
  for (const s of ACTIVE_SOURCES) {
    if (s.kind === "rss") origins.add(new URL(s.url).origin);
  }
  return [...origins];
}

/**
 * The topic map: what this blog is about, and how much each signal counts.
 *
 * Matching is on the normalized title and summary. Phrases are deliberately
 * lowercase and space-separated so "AI Crawlers" and "ai crawler" both hit —
 * see topicScore().
 */
export const TOPIC_MAP: ReadonlyArray<{ terms: readonly string[]; weight: number }> = [
  { terms: ["geo", "generative engine optimization", "generative engine"], weight: 3.0 },
  { terms: ["ai citation", "ai citations", "cited by ai", "citation share"], weight: 3.0 },
  { terms: ["llms.txt", "llms txt"], weight: 3.0 },
  { terms: ["ai crawler", "ai crawlers", "gptbot", "claudebot", "perplexitybot", "ccbot"], weight: 2.6 },
  { terms: ["answer engine", "answer engines", "ai overview", "ai overviews", "ai mode"], weight: 2.4 },
  { terms: ["agentic browsing", "agentic browser", "browser agent", "computer use"], weight: 2.0 },
  { terms: ["chatgpt", "gemini", "perplexity", "claude", "copilot"], weight: 1.6 },
  { terms: ["ai visibility", "brand visibility", "share of voice"], weight: 2.2 },
  { terms: ["robots.txt", "structured data", "schema.org", "json-ld", "rendering"], weight: 1.4 },
  { terms: ["seo", "search console", "serp", "ranking", "organic search"], weight: 1.0 },
  { terms: ["crawl budget", "indexing", "sitemap", "canonical"], weight: 1.0 },
];

/**
 * Terms that mean "this is a story about something else that happens to use
 * one of our words". A funding round is not a GEO story.
 */
export const NEGATIVE_TERMS: readonly string[] = [
  "funding round",
  "series a",
  "series b",
  "acquisition",
  "lawsuit",
  "earnings",
  "stock",
  "hiring",
  "webinar",
  "conference agenda",
  "sponsored",
];
