// src/lib/content-explorer/types.ts
//
// DTOs for Content Explorer. These are what the route returns and the client
// renders — deliberately not the DataForSEO shapes, because the envelope nests
// half the useful fields under `content_info` and names sentiment
// `connotation_types`, neither of which should leak into JSX.

/** The three angle presets. Labels only — every one runs the same code path. */
export const SEARCH_ANGLES = ["brand", "competitor", "topic"] as const;
export type SearchAngle = (typeof SEARCH_ANGLES)[number];

/**
 * Sentiment as the API actually reports it: a distribution over three keys,
 * each 0..1, summing to roughly 1. NOT a label.
 *
 * This matters for honesty. There is no "this article is positive" field — there
 * is a mix, and a page at positive 0.41 / neutral 0.46 is genuinely ambiguous
 * rather than neutral-by-decision. The UI shows the dominant key but keeps the
 * numbers, and the help modal says the scoring is automated and directional.
 */
export interface Sentiment {
  positive: number;
  negative: number;
  neutral: number;
}

export type SentimentLabel = "positive" | "negative" | "neutral";

/** One page that mentions the phrase. */
export interface Mention {
  url: string;
  domain: string;
  title: string | null;
  snippet: string | null;
  /** DataForSEO domain rank, 0..1000. Drives the high-authority badge. */
  domainRank: number | null;
  /** 0..100; high values mean the domain looks spammy. Suppresses the badge. */
  spamScore: number | null;
  /**
   * Best available date, ISO. `content_info.date_published` when present,
   * otherwise the crawl's `fetch_time` — the former is null on ~40% of items,
   * and a mentions table sorted by date needs something for every row.
   */
  date: string | null;
  /** True when `date` came from the crawl rather than the page itself. */
  dateIsCrawl: boolean;
  language: string | null;
  /** Null on ~58% of items — render as unknown, never as a default country. */
  country: string | null;
  sentiment: Sentiment | null;
  /** Dominant sentiment key, or null when no sentiment was returned. */
  sentimentLabel: SentimentLabel | null;
}

export interface TopDomain {
  domain: string;
  count: number;
}

/** Totals across every match, not just the page of mentions we fetched. */
export interface ContentSummary {
  /** Matches in the whole index. Routinely millions for a generic phrase. */
  totalCount: number;
  sentiment: Sentiment | null;
  topDomains: TopDomain[];
  /** Sorted desc by count. Keys are ISO-ish codes the API supplies. */
  countries: Array<{ code: string; count: number }>;
  languages: Array<{ code: string; count: number }>;
  pageTypes: Array<{ type: string; count: number }>;
}

export interface ContentSearchDto {
  id: string;
  query: string;
  angle: SearchAngle;
  /** Matches across the index; 0 means the phrase is not written about. */
  totalCount: number;
  /** The page of mentions we retrieved and stored (up to MENTIONS_LIMIT). */
  mentions: Mention[];
  /** Null when the search found nothing — see the note on the Prisma model. */
  summary: ContentSummary | null;
  costUsd: number;
  createdAt: string;
  /** True when served from a stored search rather than a fresh pair of calls. */
  cached: boolean;
  /** Milliseconds until a fresh run is allowed again. Only set when cached. */
  reRunAvailableInMs?: number;
}

export interface ContentSearchListItem {
  id: string;
  query: string;
  angle: SearchAngle;
  totalCount: number;
  mentionCount: number;
  costUsd: number;
  createdAt: string;
}

export interface ContentExplorerUsage {
  used: number;
  limit: number;
  plan: string;
  canSearch: boolean;
}
