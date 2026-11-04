// src/lib/site-crawler/metrics-shared.ts
//
// Phase 4d: the shapes of crawl_page_metrics.data per source, the URL key the
// GSC and GA4 joins match on, and the metric columns the Pages tab, its CSV
// and the Overview tiles share. Dependency-free (the client imports it).

export const METRIC_SOURCES = ["gsc", "psi", "ga4", "backlinks"] as const;
export type MetricSource = (typeof METRIC_SOURCES)[number];

export interface GscMetric {
  clicks: number;
  impressions: number;
  /** 0–1, as Search Analytics returns it. */
  ctr: number;
  position: number;
}

/** One Lighthouse run, summarised for the join. Scores 0–100; null when not reported. */
export interface PsiRunSummary {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  /** Lab LCP, ms. */
  lcpMs: number | null;
  /** Lab CLS. */
  cls: number | null;
  /** CrUX field data (p75), present only when PSI returned it. */
  fieldLcpMs: number | null;
  fieldCls: number | null;
  fieldInpMs: number | null;
  fetchedAt: string;
}
export interface PsiMetric {
  mobile?: PsiRunSummary | { error: string };
  desktop?: PsiRunSummary | { error: string };
}

export interface Ga4Metric {
  sessions: number;
  totalUsers: number;
  /** 0–1. */
  engagementRate: number;
  keyEvents: number;
}

export interface BacklinkMetric {
  referringDomains: number;
  backlinks: number;
  /** DataForSEO page rank, 0–1000. */
  rank: number | null;
}

export type MetricData = { gsc: GscMetric; psi: PsiMetric; ga4: Ga4Metric; backlinks: BacklinkMetric };

/**
 * The join key: scheme dropped, host lowercased, fragment dropped, trailing
 * slashes on the path dropped (the root becomes the bare host). The query is
 * kept: ?page=2 is another page. "https://Example.com/a/" and
 * "http://example.com/a" share a key.
 */
export function urlKey(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const path = u.pathname.replace(/\/+$/, "");
  return `${u.hostname.toLowerCase()}${path}${u.search}`;
}

/** One metric column: its CSV header, the sort key the pages route accepts, and how to read it. */
export interface MetricColumn {
  source: MetricSource;
  key: string;
  header: string;
  /** Read from the source's data; null when absent. */
  value: (data: unknown) => number | null;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const field = (k: string) => (d: unknown) => num((d as Record<string, unknown> | null)?.[k]);
const run = (strategy: "mobile" | "desktop", k: keyof PsiRunSummary) => (d: unknown) => {
  const r = (d as PsiMetric | null)?.[strategy];
  return r && !("error" in r) ? num(r[k]) : null;
};

export const METRIC_COLUMNS: readonly MetricColumn[] = [
  { source: "gsc", key: "gsc.clicks", header: "GSC clicks (28 d)", value: field("clicks") },
  { source: "gsc", key: "gsc.impressions", header: "GSC impressions (28 d)", value: field("impressions") },
  { source: "gsc", key: "gsc.ctr", header: "GSC CTR", value: field("ctr") },
  { source: "gsc", key: "gsc.position", header: "GSC position", value: field("position") },
  { source: "psi", key: "psi.mobile.performance", header: "PSI performance (mobile)", value: run("mobile", "performance") },
  { source: "psi", key: "psi.desktop.performance", header: "PSI performance (desktop)", value: run("desktop", "performance") },
  { source: "psi", key: "psi.mobile.accessibility", header: "PSI accessibility (mobile)", value: run("mobile", "accessibility") },
  { source: "psi", key: "psi.mobile.bestPractices", header: "PSI best practices (mobile)", value: run("mobile", "bestPractices") },
  { source: "psi", key: "psi.mobile.seo", header: "PSI SEO (mobile)", value: run("mobile", "seo") },
  { source: "psi", key: "psi.mobile.lcpMs", header: "LCP ms (mobile, lab)", value: run("mobile", "lcpMs") },
  { source: "psi", key: "psi.mobile.cls", header: "CLS (mobile, lab)", value: run("mobile", "cls") },
  { source: "psi", key: "psi.mobile.fieldInpMs", header: "INP ms (field)", value: run("mobile", "fieldInpMs") },
  { source: "ga4", key: "ga4.sessions", header: "GA4 sessions (28 d)", value: field("sessions") },
  { source: "ga4", key: "ga4.totalUsers", header: "GA4 users (28 d)", value: field("totalUsers") },
  { source: "ga4", key: "ga4.engagementRate", header: "GA4 engagement rate", value: field("engagementRate") },
  { source: "ga4", key: "ga4.keyEvents", header: "GA4 key events (28 d)", value: field("keyEvents") },
  { source: "backlinks", key: "backlinks.referringDomains", header: "Referring domains", value: field("referringDomains") },
  { source: "backlinks", key: "backlinks.backlinks", header: "Backlinks", value: field("backlinks") },
  { source: "backlinks", key: "backlinks.rank", header: "Page rank (DataForSEO)", value: field("rank") },
];

export const METRIC_SORT_KEYS: ReadonlySet<string> = new Set(METRIC_COLUMNS.map((c) => c.key));

/** The jsonb path a sort key reads: "psi.mobile.lcpMs" → source psi, path ["mobile", "lcpMs"]. */
export function sortPath(key: string): { source: MetricSource; path: string[] } | null {
  if (!METRIC_SORT_KEYS.has(key)) return null;
  const [source, ...path] = key.split(".");
  return { source: source as MetricSource, path };
}
