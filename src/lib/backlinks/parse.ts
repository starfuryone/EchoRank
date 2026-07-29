// src/lib/backlinks/parse.ts
//
// DataForSEO Backlinks result arrays -> our persisted section shapes. Pure
// functions, no I/O, so tests can run them against the recorded fixtures with
// no network and no database.
//
// Everything upstream is optional (DataForSEO types almost every field as
// nullable), so every field lands through a coercion helper rather than a cast.
// Zero invented numbers: a missing metric becomes 0 / "" / null, never a guess.
//
// The summary parser is NOT here — it lives in dataforseo/backlinks-summary.ts
// because Site Explorer reads the same endpoint.

import {
  ANCHORS_LIMIT,
  DOMAIN_PAGES_LIMIT,
  REFERRING_DOMAINS_LIMIT,
} from "./options";
import type {
  AnchorRow,
  AnchorsSection,
  HistoryPoint,
  HistorySection,
  LinkedPageRow,
  PagesSection,
  ReferringDomainRow,
  ReferringDomainsSection,
} from "./types";

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** ISO-ish timestamp, or null. DataForSEO uses "2019-01-15 23:22:06 +00:00". */
function date(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// ─── referring_domains/live ─────────────────────────────────────────────────

type RawReferringDomain = {
  domain?: string;
  rank?: number;
  backlinks?: number;
  backlinks_spam_score?: number;
  first_seen?: string;
  lost_date?: string | null;
};

export function parseReferringDomains(
  result: { items?: RawReferringDomain[]; total_count?: number }[] | undefined,
): ReferringDomainsSection {
  const first = result?.[0];
  const items: ReferringDomainRow[] = (first?.items ?? [])
    .map((item): ReferringDomainRow => ({
      domain: str(item.domain).toLowerCase().replace(/^www\./, ""),
      rank: num(item.rank),
      backlinks: num(item.backlinks),
      spamScore: num(item.backlinks_spam_score),
      firstSeen: date(item.first_seen),
      lostDate: date(item.lost_date),
    }))
    // A row with no domain is unrenderable — drop it rather than show a blank
    // cell with a real backlink count beside it.
    .filter((row) => row.domain.length > 0)
    .slice(0, REFERRING_DOMAINS_LIMIT);

  return { items, totalCount: num(first?.total_count) };
}

// ─── anchors/live ───────────────────────────────────────────────────────────

type RawAnchor = {
  /** Null is a REAL value: image links carry no anchor text. */
  anchor?: string | null;
  backlinks?: number;
  referring_domains?: number;
  referring_domains_nofollow?: number;
};

export function parseAnchors(
  result: { items?: RawAnchor[]; total_count?: number }[] | undefined,
): AnchorsSection {
  const first = result?.[0];
  const items: AnchorRow[] = (first?.items ?? [])
    .map((item): AnchorRow => ({
      // An empty anchor is REAL — image links carry no text — so unlike the
      // other tables this one does not filter on the label being present.
      anchor: str(item.anchor),
      backlinks: num(item.backlinks),
      referringDomains: num(item.referring_domains),
      dofollowDomains: Math.max(
        num(item.referring_domains) - num(item.referring_domains_nofollow),
        0,
      ),
    }))
    .filter((row) => row.backlinks > 0)
    .slice(0, ANCHORS_LIMIT);

  return {
    items,
    totalCount: num(first?.total_count),
    // Computed here rather than in the component: the proportional bar needs a
    // denominator, and deriving it at render time would silently change when
    // the table is sorted.
    maxBacklinks: items.reduce((max, row) => Math.max(max, row.backlinks), 0),
  };
}

// ─── domain_pages/live ──────────────────────────────────────────────────────

/**
 * domain_pages rows are page records, not metric records: the address is
 * `page` (NOT `url`/`page_address`, and NOT `meta.url` — `meta` holds page
 * metadata like title/canonical), and every backlink metric is nested under
 * `page_summary`. Reading them off the top level yields 20 rows of zeros that
 * then get filtered to nothing. Verified against the recorded envelope,
 * Jul 2026.
 */
type RawDomainPage = {
  page?: string;
  status_code?: number;
  meta?: { title?: string | null };
  page_summary?: {
    backlinks?: number;
    referring_domains?: number;
    rank?: number;
  };
};

export function parseLinkedPages(
  result: { items?: RawDomainPage[]; total_count?: number }[] | undefined,
): PagesSection {
  const first = result?.[0];
  const items: LinkedPageRow[] = (first?.items ?? [])
    .map((item): LinkedPageRow => {
      const summary = item.page_summary ?? {};
      return {
        url: str(item.page),
        title: str(item.meta?.title),
        backlinks: num(summary.backlinks),
        referringDomains: num(summary.referring_domains),
        rank: num(summary.rank),
        statusCode: typeof item.status_code === "number" ? item.status_code : null,
      };
    })
    .filter((row) => row.url.length > 0)
    // domain_pages rejects order_by, so its default ordering is all we get —
    // sort here to guarantee the "most linked" the UI claims.
    .sort((a, b) => b.backlinks - a.backlinks)
    .slice(0, DOMAIN_PAGES_LIMIT);

  return { items, totalCount: num(first?.total_count) };
}

// ─── history/live ───────────────────────────────────────────────────────────

type RawHistoryItem = {
  date?: string;
  year?: number;
  month?: number;
  backlinks?: number;
  referring_domains?: number;
  new_backlinks?: number;
  lost_backlinks?: number;
};

/** "2026-07-15 00:00:00 +00:00" | {year, month} -> "2026-07". */
function monthKey(item: RawHistoryItem): string {
  const raw = str(item.date);
  if (raw.length >= 7) return raw.slice(0, 7);
  if (typeof item.year === "number" && typeof item.month === "number") {
    return `${item.year}-${String(item.month).padStart(2, "0")}`;
  }
  return "";
}

export function parseHistory(
  result: { items?: RawHistoryItem[] }[] | undefined,
): HistorySection {
  const seen = new Set<string>();
  const points: HistoryPoint[] = (result?.[0]?.items ?? [])
    .map((item): HistoryPoint => ({
      month: monthKey(item),
      backlinks: num(item.backlinks),
      referringDomains: num(item.referring_domains),
      newBacklinks: num(item.new_backlinks),
      lostBacklinks: num(item.lost_backlinks),
    }))
    .filter((point) => {
      // An undated point cannot be placed on the x-axis, and a duplicate month
      // would draw the line back on itself.
      if (!point.month || seen.has(point.month)) return false;
      seen.add(point.month);
      return true;
    })
    // Oldest first — the chart reads left to right.
    .sort((a, b) => a.month.localeCompare(b.month));

  return { points };
}
