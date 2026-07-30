// src/lib/content-explorer/parse.ts
//
// DataForSEO Content Analysis envelopes → our DTOs. Pure, so every shape quirk
// below is testable against the recorded fixtures with no network and no spend.
//
// The envelope is defensive-parsing territory. From the recorded 50-item sample:
//   country                     null on 29/50 items
//   content_info.date_published null on 20/50 items
//   ratings, social_metrics     null on every item
// and `sentiment_connotations` (anger/happiness/love/…) is a DIFFERENT thing
// from `connotation_types` (positive/negative/neutral). We use the latter; the
// former is emotion scoring we do not surface, because "your brand scores 0.31
// on happiness" is not an actionable sentence.

import type {
  ContentSummary,
  Mention,
  Sentiment,
  SentimentLabel,
  TopDomain,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * DataForSEO dates look like "2024-02-25 22:02:23 +00:00" — a space instead of
 * the ISO "T" and a spaced offset, which `new Date()` parses inconsistently
 * across runtimes. Normalized here once so sorting is reliable.
 */
export function parseApiDate(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const iso = raw.trim().replace(" ", "T").replace(/\s+([+-]\d{2}:?\d{2})$/, "$1");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
  }
  return d.toISOString();
}

/** Reads {positive, negative, neutral} when all three are present and finite. */
export function parseSentiment(value: unknown): Sentiment | null {
  const r = asRecord(value);
  const positive = asNumber(r.positive);
  const negative = asNumber(r.negative);
  const neutral = asNumber(r.neutral);
  if (positive === null || negative === null || neutral === null) return null;
  // An all-zero distribution is what a zero-result phrase returns. That is not
  // "neutral" — it is no data — so it is not a sentiment.
  if (positive === 0 && negative === 0 && neutral === 0) return null;
  return { positive, negative, neutral };
}

/** Dominant key. Ties resolve to neutral, which is the honest reading. */
export function sentimentLabel(s: Sentiment | null): SentimentLabel | null {
  if (!s) return null;
  if (s.positive > s.negative && s.positive > s.neutral) return "positive";
  if (s.negative > s.positive && s.negative > s.neutral) return "negative";
  return "neutral";
}

/** One `items[]` entry from content_analysis/search/live. */
export function parseMention(raw: unknown): Mention | null {
  const it = asRecord(raw);
  const url = asString(it.url);
  // A mention with no URL is not a link opportunity and cannot be opened.
  if (!url) return null;
  const ci = asRecord(it.content_info);

  const published = parseApiDate(ci.date_published);
  const fetched = parseApiDate(it.fetch_time);
  const sentiment = parseSentiment(ci.connotation_types);

  return {
    url,
    domain: asString(it.domain) ?? asString(it.main_domain) ?? "",
    title: asString(ci.title) ?? asString(ci.main_title),
    snippet: asString(ci.snippet),
    domainRank: asNumber(it.domain_rank),
    spamScore: asNumber(it.spam_score),
    date: published ?? fetched,
    dateIsCrawl: published === null && fetched !== null,
    language: asString(ci.language) ?? asString(it.language),
    country: asString(it.country),
    sentiment,
    sentimentLabel: sentimentLabel(sentiment),
  };
}

export interface ParsedSearch {
  totalCount: number;
  mentions: Mention[];
}

/**
 * content_analysis/search/live. `data` is the parsed `result` array the client
 * hands back (postTask returns tasks[0].result).
 */
export function parseSearchResult(data: unknown): ParsedSearch {
  const first = asRecord(Array.isArray(data) ? data[0] : data);
  const items = Array.isArray(first.items) ? first.items : [];
  return {
    totalCount: asNumber(first.total_count) ?? 0,
    mentions: items.map(parseMention).filter((m): m is Mention => m !== null),
  };
}

/** `{ "US": 1234, "GB": 99 }` → sorted array. The API returns an object here. */
function countMapToList(value: unknown): Array<{ code: string; count: number }> {
  const r = asRecord(value);
  return Object.entries(r)
    .map(([code, count]) => ({ code, count: asNumber(count) ?? 0 }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

function parseTopDomains(value: unknown): TopDomain[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const e = asRecord(entry);
      const domain = asString(e.domain);
      return domain ? { domain, count: asNumber(e.count) ?? 0 } : null;
    })
    .filter((d): d is TopDomain => d !== null)
    .sort((a, b) => b.count - a.count);
}

/** content_analysis/summary/live. */
export function parseSummaryResult(data: unknown): ContentSummary {
  const first = asRecord(Array.isArray(data) ? data[0] : data);
  const pageTypes = countMapToList(first.page_types).map((e) => ({
    type: e.code,
    count: e.count,
  }));
  return {
    totalCount: asNumber(first.total_count) ?? 0,
    sentiment: parseSentiment(first.connotation_types),
    topDomains: parseTopDomains(first.top_domains),
    countries: countMapToList(first.countries),
    languages: countMapToList(first.languages),
    pageTypes,
  };
}

/**
 * Normalized cache/history key for a phrase. Trimmed, collapsed whitespace,
 * lowercased — "Echorank360" and " echorank360 " are one search, not two, and
 * at ~5 cents a search that distinction is worth enforcing.
 */
export function normalizeQuery(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}
