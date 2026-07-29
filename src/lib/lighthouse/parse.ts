// src/lib/lighthouse/parse.ts
//
// PageSpeed Insights v5 response -> our persisted shapes. Pure functions, no
// I/O, so tests can run them against a recorded response with no network.
//
// PSI types almost everything as optional and omits whole blocks (notably
// CrUX) for ordinary pages, so every field lands through a coercion helper.
// Zero invented numbers: a missing score is null, never 0 — the difference
// between "scored zero" and "not scored" is the whole point of a gauge.

import { MAX_OPPORTUNITIES } from "./options";
import {
  LAB_METRICS,
  type CategoryScores,
  type CruxData,
  type CruxMetric,
  type LabMetric,
  type LabMetricKey,
  type Opportunity,
} from "./types";

// ─── Raw PSI shapes ─────────────────────────────────────────────────────────

interface RawAudit {
  id?: string;
  title?: string;
  description?: string;
  score?: number | null;
  displayValue?: string;
  numericValue?: number;
  details?: {
    type?: string;
    overallSavingsMs?: number;
    overallSavingsBytes?: number;
  };
}

interface RawCategory {
  id?: string;
  title?: string;
  score?: number | null;
}

interface RawCruxMetric {
  percentile?: number;
  category?: string;
  distributions?: { min?: number; max?: number; proportion?: number }[];
}

interface RawLoadingExperience {
  overall_category?: string;
  origin_fallback?: boolean;
  metrics?: Record<string, RawCruxMetric>;
}

export interface RawPsiResponse {
  loadingExperience?: RawLoadingExperience;
  originLoadingExperience?: RawLoadingExperience;
  lighthouseResult?: {
    requestedUrl?: string;
    finalUrl?: string;
    lighthouseVersion?: string;
    audits?: Record<string, RawAudit>;
    categories?: Record<string, RawCategory>;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Lighthouse scores are 0–1 floats; the UI works in 0–100.
 *
 * null (not 0) when the category is absent or unscored — "not measured" and
 * "scored zero" are different states and the gauge renders them differently.
 */
function toScore100(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 100)
    : null;
}

// ─── Category scores ────────────────────────────────────────────────────────

/** PSI's category ids -> our camelCase keys. */
const CATEGORY_IDS: Record<string, keyof CategoryScores> = {
  performance: "performance",
  accessibility: "accessibility",
  "best-practices": "bestPractices",
  seo: "seo",
};

export function parseScores(psi: RawPsiResponse): CategoryScores {
  const categories = psi.lighthouseResult?.categories ?? {};
  const scores: CategoryScores = {
    performance: null,
    accessibility: null,
    bestPractices: null,
    seo: null,
  };
  for (const [psiId, key] of Object.entries(CATEGORY_IDS)) {
    scores[key] = toScore100(categories[psiId]?.score);
  }
  return scores;
}

// ─── Lab metrics ────────────────────────────────────────────────────────────

/** Our metric keys -> the Lighthouse audit ids that carry them. */
const METRIC_AUDIT_IDS: Record<LabMetricKey, string> = {
  FCP: "first-contentful-paint",
  LCP: "largest-contentful-paint",
  TBT: "total-blocking-time",
  CLS: "cumulative-layout-shift",
  SI: "speed-index",
  TTI: "interactive",
};

export function parseMetrics(psi: RawPsiResponse): LabMetric[] {
  const audits = psi.lighthouseResult?.audits ?? {};
  return LAB_METRICS.map((key): LabMetric => {
    const audit = audits[METRIC_AUDIT_IDS[key]];
    return {
      key,
      // numericValue is absent when the metric could not be measured; null
      // keeps that distinct from a genuine 0 (which CLS legitimately reaches).
      value:
        typeof audit?.numericValue === "number" && Number.isFinite(audit.numericValue)
          ? audit.numericValue
          : null,
      // Lighthouse's own formatting is locale-agnostic and already correct
      // per metric ("2.4 s", "0.05"), so it is stored rather than re-derived.
      display: str(audit?.displayValue),
      score: toScore100(audit?.score),
    };
  });
}

// ─── Opportunities ──────────────────────────────────────────────────────────

/**
 * Audits Lighthouse classifies as opportunities, worst first.
 *
 * Selection is by `details.type === "opportunity"` rather than by walking
 * `categories.performance.auditRefs` for group "load-opportunities": the
 * details type is on the audit itself and survives Lighthouse regrouping its
 * categories, which it has done between major versions.
 *
 * Passing audits (score 1) are excluded — an opportunity with nothing to
 * improve is noise in a list meant to be a to-do.
 */
export function parseOpportunities(psi: RawPsiResponse): Opportunity[] {
  const audits = psi.lighthouseResult?.audits ?? {};

  return Object.entries(audits)
    .filter(([, audit]) => audit?.details?.type === "opportunity")
    .map(([id, audit]): Opportunity => ({
      id: str(audit.id) || id,
      title: str(audit.title),
      description: str(audit.description),
      savingsMs: num(audit.details?.overallSavingsMs),
      savingsBytes: num(audit.details?.overallSavingsBytes),
      display: str(audit.displayValue),
    }))
    .filter((row) => row.title.length > 0 && (row.savingsMs > 0 || row.savingsBytes > 0))
    // Time saved is what a user feels; bytes break the tie.
    .sort((a, b) => b.savingsMs - a.savingsMs || b.savingsBytes - a.savingsBytes)
    .slice(0, MAX_OPPORTUNITIES);
}

// ─── CrUX field data ────────────────────────────────────────────────────────

/** PSI's CrUX metric ids -> the abbreviations the UI shows. */
const CRUX_KEYS: Record<string, string> = {
  LARGEST_CONTENTFUL_PAINT_MS: "LCP",
  INTERACTION_TO_NEXT_PAINT: "INP",
  CUMULATIVE_LAYOUT_SHIFT_SCORE: "CLS",
  FIRST_CONTENTFUL_PAINT_MS: "FCP",
  EXPERIMENTAL_TIME_TO_FIRST_BYTE: "TTFB",
};

function verdict(value: unknown): CruxMetric["category"] {
  return value === "FAST" || value === "AVERAGE" || value === "SLOW" ? value : "NONE";
}

/**
 * CLS arrives from CrUX multiplied by 100 (a "0.05" shift is reported as 5),
 * unlike every other consumer of the number. Left as-is would render a layout
 * shift of 5, which is catastrophic rather than excellent.
 */
function cruxValue(key: string, percentile: number): number {
  return key === "CLS" ? percentile / 100 : percentile;
}

function parseExperience(
  experience: RawLoadingExperience | undefined,
  originFallback: boolean,
): CruxData | null {
  const metrics = experience?.metrics;
  if (!metrics || Object.keys(metrics).length === 0) return null;

  const parsed: CruxMetric[] = Object.entries(metrics)
    .filter(([psiKey]) => psiKey in CRUX_KEYS)
    .map(([psiKey, metric]): CruxMetric => {
      const key = CRUX_KEYS[psiKey];
      const buckets = metric.distributions ?? [];
      return {
        key,
        p75: cruxValue(key, num(metric.percentile)),
        category: verdict(metric.category),
        distribution: [
          num(buckets[0]?.proportion),
          num(buckets[1]?.proportion),
          num(buckets[2]?.proportion),
        ],
      };
    });

  if (parsed.length === 0) return null;

  return {
    overall: verdict(experience?.overall_category),
    originFallback,
    metrics: parsed,
  };
}

/**
 * Field data for the audited page, falling back to origin-level data.
 *
 * Returns null when neither exists — the normal case for a low-traffic page,
 * and why the UI has a dedicated "no field data" state instead of zeros.
 * `originFallback` tells the UI to say so: origin numbers describe the whole
 * site, not the page that was just audited.
 */
export function parseCrux(psi: RawPsiResponse): CruxData | null {
  const page = parseExperience(
    psi.loadingExperience,
    // PSI sets origin_fallback on loadingExperience when it substituted
    // origin-level data for a page it has too little traffic for.
    Boolean(psi.loadingExperience?.origin_fallback),
  );
  if (page) return page;
  return parseExperience(psi.originLoadingExperience, true);
}

// ─── Whole response ─────────────────────────────────────────────────────────

export interface ParsedAudit {
  scores: CategoryScores;
  metrics: LabMetric[];
  opportunities: Opportunity[];
  crux: CruxData | null;
  finalUrl: string;
  lighthouseVersion: string | null;
}

export function parsePsiResponse(raw: unknown): ParsedAudit {
  const psi = (raw ?? {}) as RawPsiResponse;
  return {
    scores: parseScores(psi),
    metrics: parseMetrics(psi),
    opportunities: parseOpportunities(psi),
    crux: parseCrux(psi),
    // The URL Lighthouse actually ended on, which differs from the requested
    // one whenever the site redirects (http -> https, or / -> /home).
    finalUrl: str(psi.lighthouseResult?.finalUrl) || str(psi.lighthouseResult?.requestedUrl),
    lighthouseVersion: str(psi.lighthouseResult?.lighthouseVersion) || null,
  };
}
