// src/lib/site-crawler/site-health.ts
//
// Site health, 0–100: one number per crawl, stable and comparable across
// crawls, computed once in the crawl summary (aggregation, and again when a
// post-crawl step re-tallies) and read everywhere else — Results hero, Recent
// crawls, History, Compare deltas, the PDF.
//
//   weighted = 3 × high-priority findings + 1 × medium + 0.25 × low
//   density  = weighted / pages crawled
//   health   = round(100 − min(100, 10 × density))
//
// So a crawl averaging one high-priority finding per page scores 70, one
// medium finding per page 90, and the penalty is capped at 100 (health 0).
// Every kind counts (issue, warning, opportunity): priority is what carries
// the weight. Dependency-free: Client Components import it.

export const HEALTH_VERSION = 1;
export const HEALTH_WEIGHTS = { high: 3, medium: 1, low: 0.25 } as const;
/** Penalty points per weighted finding per page. */
export const HEALTH_SCALE = 10;

export type PriorityCounts = { high: number; medium: number; low: number };

export interface SiteHealth {
  score: number;
  /** Inputs, kept with the score so it can be re-derived and explained. */
  weighted: number;
  pages: number;
  version: number;
}

export function siteHealth(counts: PriorityCounts, pages: number): SiteHealth | null {
  if (!(pages > 0)) return null;
  const weighted = HEALTH_WEIGHTS.high * counts.high + HEALTH_WEIGHTS.medium * counts.medium + HEALTH_WEIGHTS.low * counts.low;
  const penalty = Math.min(100, HEALTH_SCALE * (weighted / pages));
  return { score: Math.round(100 - penalty), weighted: Math.round(weighted * 100) / 100, pages, version: HEALTH_VERSION };
}

/** Findings per priority from the summary's per-rule tallies. */
export function priorityCounts(issues: Record<string, { count: number; priority: string }> | null | undefined): PriorityCounts {
  const out: PriorityCounts = { high: 0, medium: 0, low: 0 };
  for (const t of Object.values(issues ?? {})) if (t.priority in out) out[t.priority as keyof PriorityCounts] += t.count;
  return out;
}

/** The score stored on a crawl's summary, or null (not settled, or a crawl from before health). */
export function healthOf(summary: unknown): number | null {
  const h = (summary as { health?: { score?: unknown } } | null)?.health;
  return typeof h?.score === "number" ? h.score : null;
}

// ─── Fix first ───────────────────────────────────────────────────────────────

export interface FixFirstItem {
  ruleId: string;
  pages: number;
  count: number;
}

/** The top `n` high-priority rules by pages affected (findings, then id, break ties). */
export function fixFirst(issues: Record<string, { count: number; priority: string; pages?: number }> | null | undefined, n = 5): FixFirstItem[] {
  return Object.entries(issues ?? {})
    .filter(([, t]) => t.priority === "high" && t.count > 0)
    .map(([ruleId, t]) => ({ ruleId, pages: t.pages ?? t.count, count: t.count }))
    .sort((a, b) => b.pages - a.pages || b.count - a.count || a.ruleId.localeCompare(b.ruleId))
    .slice(0, n);
}
