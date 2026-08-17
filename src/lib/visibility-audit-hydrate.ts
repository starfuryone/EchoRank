// src/lib/visibility-audit-hydrate.ts
//
// Decides whether a stored VisibilityAudit.raw blob is safe to hand back to the
// /visibility results panel.
//
// WHY A GUARD AND NOT A CAST. The panel dereferences audit.score, .grade, .url,
// .checks.map, .robots.bots and .rendering.likely_csr with no optional
// chaining. Give it a partial object and it does not degrade — it throws during
// render and blanks the page, which is a worse failure than showing nothing.
// `raw` is a nullable column that only started being written in d332e72, so
// "partial or absent" is a real state for older rows, not a hypothetical.
//
// Returning null means the page renders exactly as it did before this loader
// existed: no panel, no crash. Widen this only alongside the panel's own
// guards, and keep the two in step.

/** Every field the panel touches, and nothing it does not. */
const REQUIRED_PANEL_FIELDS = ["score", "checks", "rendering", "robots"] as const;

export interface HydrateRow {
  url: string;
  score: number;
  grade: string;
}

export function hydratableAudit(
  raw: unknown,
  row: HydrateRow,
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.score !== "number") return null;
  if (!Array.isArray(r.checks)) return null;
  if (!r.rendering || typeof r.rendering !== "object") return null;

  const robots = r.robots as { bots?: unknown } | undefined;
  if (!robots || typeof robots !== "object") return null;
  if (!robots.bots || typeof robots.bots !== "object") return null;

  return {
    ...r,
    // The columns win for these two: they are what the rest of the dashboard
    // (MonitorCard, the benchmark queries) reads, so the panel should agree.
    url: typeof r.url === "string" && r.url ? r.url : row.url,
    grade: typeof r.grade === "string" && r.grade ? r.grade : row.grade,
  };
}

export { REQUIRED_PANEL_FIELDS };
