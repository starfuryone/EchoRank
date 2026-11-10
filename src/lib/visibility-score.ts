// src/lib/visibility-score.ts
//
// The AI readiness score's version, and the rules that keep scores from two
// versions apart. PURE and dependency-free: the monitoring worker, the API
// routes and Client Components (MonitorCard, the free check) all import it.
//
// WHY VERSIONS. The av-visibility sidecar's score changed in Nov 2026 (v2, the
// AI readiness score: av-service ai_readiness.py). v2 is stricter: a site that
// scored 90 under v1 can score 60 under v2 without anything on it changing.
// Comparing across that line would email tenants a "your score dropped"
// alert about our change, and draw a cliff in every history chart. So:
//   - every stored audit carries scoreVersion (prisma VisibilityAudit);
//   - monitoring compares only audits of the same version; the first audit
//     after the change is a silent new baseline;
//   - charts break the line at a version change, with a one-line note.
// Old audits keep their stored score and version; nothing is rescored.

/**
 * The sidecar's current SCORE_VERSION (av-service ai_readiness.py). v3
 * (2026-11-10): llms.txt and FAQ markup informational, Organization schema
 * 12 → 8. Its first audit per monitor is a silent re-baseline, like v2's.
 */
export const CURRENT_SCORE_VERSION = 3;

/** A drop of this many points or more, within one version, alerts. */
export const SCORE_DROP_ALERT_POINTS = 5;

/**
 * The version an audit response was scored with. A response without
 * `score_version` came from a sidecar that predates it: version 1.
 */
export function scoreVersionOf(audit: unknown): number {
  const v = (audit as { score_version?: unknown } | null | undefined)?.score_version;
  return typeof v === "number" && Number.isInteger(v) && v >= 1 ? v : 1;
}

export type BotMap = Record<string, { status?: string; detail?: string } | undefined>;

export interface MonitorPoint {
  score: number;
  scoreVersion: number;
  bots?: BotMap | null;
}

export interface BotFlip {
  bot: string;
  detail: string;
}

export interface AlertDecision {
  /** baseline: first audit; rebaseline: first audit of a new score version; compare: same version. */
  kind: "baseline" | "rebaseline" | "compare";
  dropped: boolean;
  flippedBlocked: BotFlip[];
  flippedAllowed: string[];
  alert: boolean;
}

/**
 * What a monitoring run should do with its previous audit.
 *
 * A version change is a SILENT re-baseline: no score-drop alert and no
 * crawler-flip alert either, since the email reports both side by side and
 * v2 also reads more crawler tokens than v1 did. The next run compares
 * against this one.
 */
export function monitorAlertDecision(prev: MonitorPoint | null, next: MonitorPoint): AlertDecision {
  const quiet = { dropped: false, flippedBlocked: [], flippedAllowed: [], alert: false };
  if (!prev) return { kind: "baseline", ...quiet };
  if (prev.scoreVersion !== next.scoreVersion) return { kind: "rebaseline", ...quiet };

  const prevBots = prev.bots ?? {};
  const flippedBlocked: BotFlip[] = [];
  const flippedAllowed: string[] = [];
  for (const [bot, info] of Object.entries(next.bots ?? {})) {
    if (!info) continue;
    const was = prevBots[bot]?.status;
    if (was === "ALLOWED" && info.status !== "ALLOWED") {
      flippedBlocked.push({ bot, detail: info.detail || info.status || "" });
    } else if (was && was !== "ALLOWED" && info.status === "ALLOWED") {
      flippedAllowed.push(bot);
    }
  }
  const dropped = prev.score - next.score >= SCORE_DROP_ALERT_POINTS;
  return {
    kind: "compare",
    dropped,
    flippedBlocked,
    flippedAllowed,
    alert: dropped || flippedBlocked.length > 0,
  };
}

/**
 * Consecutive runs of one version, oldest first: one line segment each. A
 * chart draws each segment separately and never joins two of them.
 */
export function versionSegments<T extends { scoreVersion?: number | null }>(points: T[]): T[][] {
  const out: T[][] = [];
  let prev: number | undefined;
  for (const p of points) {
    const v = p.scoreVersion ?? 1;
    if (out.length === 0 || v !== prev) out.push([]);
    out[out.length - 1].push(p);
    prev = v;
  }
  return out;
}

export function crossesVersions(points: { scoreVersion?: number | null }[]): boolean {
  return versionSegments(points).length > 1;
}
