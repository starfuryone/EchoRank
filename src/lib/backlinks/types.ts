// src/lib/backlinks/types.ts
//
// Wire shapes shared by the Backlinks routes and the client component. These
// are OUR normalized, persisted shapes; the DataForSEO-side shapes live beside
// each parser in parse.ts.

import type { BacklinksSummary } from "@/lib/dataforseo/backlinks-summary";
import type { BacklinksMode } from "./target";

/** The five sections an analysis is made of, in render order. */
export const BACKLINKS_SECTIONS = [
  "summary",
  "history",
  "referringDomains",
  "anchors",
  "pages",
] as const;

export type BacklinksSection = (typeof BACKLINKS_SECTIONS)[number];

/** completed = every APPLICABLE section loaded; partial = at least one failed. */
export type BacklinksStatus = "completed" | "partial";

/**
 * Sections that only exist for a whole domain.
 *
 * `history` charts a DOMAIN's link growth and `domain_pages` lists the pages
 * OF a domain — neither has a meaning for a single page, and DataForSEO errors
 * on both when `target` is an absolute URL (verified live, 2026-07-29). They
 * are skipped in exact-URL mode rather than called and reported as failures:
 * a "couldn't load" card for something that can never load is a bug, not a
 * status.
 */
export const DOMAIN_ONLY_SECTIONS: readonly BacklinksSection[] = ["history", "pages"];

export function sectionAppliesTo(section: BacklinksSection, mode: BacklinksMode): boolean {
  return mode === "domain" || !DOMAIN_ONLY_SECTIONS.includes(section);
}

/** The sections an analysis in this mode will actually contain. */
export function sectionsForMode(mode: BacklinksMode): BacklinksSection[] {
  return BACKLINKS_SECTIONS.filter((section) => sectionAppliesTo(section, mode));
}

/** Headline metrics — the shared backlinks/summary shape. */
export type SummarySection = BacklinksSummary;

/** One point on the growth chart. */
export interface HistoryPoint {
  /** YYYY-MM, UTC — DataForSEO reports history monthly. */
  month: string;
  backlinks: number;
  referringDomains: number;
  /** Links found for the first time in this month, when reported. */
  newBacklinks: number;
  /** Links that disappeared in this month, when reported. */
  lostBacklinks: number;
}

export interface HistorySection {
  points: HistoryPoint[];
}

/** One row of the referring-domains table. */
export interface ReferringDomainRow {
  domain: string;
  /** DataForSEO domain rank, 0–1000. */
  rank: number;
  backlinks: number;
  /** DataForSEO's 0-100 spam score for this domain; higher is worse. There is
   * no per-domain dofollow field upstream, so this is shown instead of one
   * inferred across mismatched bases. */
  spamScore: number;
  /** ISO timestamp, or null when upstream omits it. */
  firstSeen: string | null;
  /** Set when every link from this domain is gone. */
  lostDate: string | null;
}

export interface ReferringDomainsSection {
  items: ReferringDomainRow[];
  /** DataForSEO's own total, which is far larger than `items`. */
  totalCount: number;
}

/** One row of the anchors table. */
export interface AnchorRow {
  /** Anchor text. Empty string is a real value — image links have no text. */
  anchor: string;
  backlinks: number;
  referringDomains: number;
  /** Referring domains using this anchor WITHOUT rel=nofollow. Differenced
   * from referring_domains / referring_domains_nofollow — a directly reported
   * pair on one base. There is no `dofollow` field upstream. */
  dofollowDomains: number;
}

export interface AnchorsSection {
  items: AnchorRow[];
  totalCount: number;
  /** Largest `backlinks` in `items`, so the UI can size its bars without a
   * second pass and without assuming the list is sorted. */
  maxBacklinks: number;
}

/** One row of the most-linked-pages table. */
export interface LinkedPageRow {
  url: string;
  /** Page title when DataForSEO has one; often null for JS-rendered pages. */
  title: string;
  backlinks: number;
  referringDomains: number;
  /** DataForSEO page rank, 0–1000. */
  rank: number;
  /** HTTP status DataForSEO last saw for the page, when reported. */
  statusCode: number | null;
}

export interface PagesSection {
  items: LinkedPageRow[];
  totalCount: number;
}

/** Shape returned by all three Backlinks routes. */
export interface BacklinksAnalysisDto {
  id: string;
  target: string;
  mode: BacklinksMode;
  status: BacklinksStatus;
  costUsd: number;
  summary: SummarySection | null;
  history: HistorySection | null;
  referringDomains: ReferringDomainsSection | null;
  anchors: AnchorsSection | null;
  pages: PagesSection | null;
  /** Section keys that did not load. Each renders its own "couldn't load" card. */
  failedSections: BacklinksSection[];
  createdAt: string;
  /** True when the POST replayed a stored analysis instead of spending. */
  cached?: boolean;
  /** ms until this target can be re-analyzed; only set on a cache hit. */
  reRunAvailableInMs?: number;
}

/** One row of the history list — no section payloads, just the summary. */
export interface BacklinksHistoryRow {
  id: string;
  target: string;
  mode: BacklinksMode;
  status: BacklinksStatus;
  costUsd: number;
  createdAt: string;
}

export interface BacklinksUsage {
  used: number;
  limit: number;
  plan: string;
  /** False for STARTER / AI_VISIBILITY — the locked upsell card. */
  canAnalyze: boolean;
}
