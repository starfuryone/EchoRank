// src/lib/lighthouse/types.ts
//
// Wire shapes shared by the Lighthouse routes and the client component. These
// are OUR normalized, persisted shapes; the PSI-side shapes live beside the
// parser in parse.ts.

import type { LighthouseStrategy } from "./options";

/** The four Lighthouse categories, in the order Chrome shows them. */
export const LIGHTHOUSE_CATEGORIES = [
  "performance",
  "accessibility",
  "bestPractices",
  "seo",
] as const;

export type LighthouseCategory = (typeof LIGHTHOUSE_CATEGORIES)[number];

/** 0–100, or null when Lighthouse could not score that category. */
export type CategoryScores = Record<LighthouseCategory, number | null>;

/**
 * The six lab metrics, keyed by their standard abbreviation.
 *
 * Abbreviations are deliberately NOT translated anywhere in this feature: LCP
 * and CLS are the names of the things, identical in every locale and in every
 * other tool the user will read.
 */
export const LAB_METRICS = ["FCP", "LCP", "TBT", "CLS", "SI", "TTI"] as const;
export type LabMetricKey = (typeof LAB_METRICS)[number];

export interface LabMetric {
  key: LabMetricKey;
  /** Raw value: milliseconds for everything except CLS, which is unitless. */
  value: number | null;
  /** Lighthouse's own formatted string, e.g. "2.4 s" or "0.05". */
  display: string;
  /** Per-metric Lighthouse sub-score, 0–100. */
  score: number | null;
}

/** One row of the opportunities list. */
export interface Opportunity {
  id: string;
  title: string;
  description: string;
  /** Estimated milliseconds saved. 0 when the saving is byte-only. */
  savingsMs: number;
  /** Estimated bytes saved, when Lighthouse reports one. */
  savingsBytes: number;
  /** Lighthouse's formatted summary, e.g. "Potential savings of 320 KiB". */
  display: string;
}

/**
 * One CrUX metric distribution. `category` is Google's own verdict
 * (FAST/AVERAGE/SLOW) rather than one we compute, so it always agrees with
 * Search Console and PageSpeed's own UI.
 */
export interface CruxMetric {
  key: string;
  /** 75th percentile — the value Google judges the origin on. */
  p75: number;
  category: "FAST" | "AVERAGE" | "SLOW" | "NONE";
  /** Proportion in each bucket, 0–1, in [good, needsImprovement, poor] order. */
  distribution: [number, number, number];
}

/**
 * CrUX field data.
 *
 * Null for the whole section when the page has too little real-world traffic —
 * a completely normal state for most sites, and the reason the UI must say "no
 * field data available" rather than render zeros.
 */
export interface CruxData {
  /** Google's overall verdict for the page/origin. */
  overall: "FAST" | "AVERAGE" | "SLOW" | "NONE";
  /** True when the data describes the whole origin, not this exact URL. */
  originFallback: boolean;
  metrics: CruxMetric[];
}

/** Shape returned by all three Lighthouse routes. */
export interface LighthouseAuditDto {
  id: string;
  url: string;
  strategy: LighthouseStrategy;
  scores: CategoryScores;
  metrics: LabMetric[];
  opportunities: Opportunity[];
  /** Null when the page has no CrUX field data. */
  crux: CruxData | null;
  /** Lighthouse version that produced the run, for reproducibility. */
  lighthouseVersion: string | null;
  fetchedAt: string;
  /** True when the POST replayed a stored audit instead of running one. */
  cached?: boolean;
  /** ms until this (url, strategy) can be re-audited; only set on a cache hit. */
  reRunAvailableInMs?: number;
}

/** One row of the history list — no payloads, just the summary. */
export interface LighthouseHistoryRow {
  id: string;
  url: string;
  strategy: LighthouseStrategy;
  scores: CategoryScores;
  fetchedAt: string;
}

export interface LighthouseUsage {
  /** Audits used in the current rolling hour. */
  used: number;
  limit: number;
  /** Whether a PAGESPEED_API_KEY is configured on the server. */
  apiKeyConfigured: boolean;
}
