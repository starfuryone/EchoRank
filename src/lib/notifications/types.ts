// The notification vocabulary: one `type` per alert-producing surface, the
// payload each type carries, and where each one deep-links to.
//
// `type` + `payload` ARE THE RENDERED CONTENT. The `title`/`body` stored on the
// row are English, written by whichever worker emitted the alert, and are only
// read back when a row carries a `type` this catalog does not know (an older
// row, or a source added ahead of its copy). Everything else renders from these
// payloads through NOTIFICATION_COPY in src/lib/i18n/dashboard.ts, which is why
// every new emission has to carry a well-typed payload — a title-only emission
// is an English string in a French dashboard, permanently.

export const NOTIFICATION_TYPES = [
  // Answer tracking — prompt mention transitions (recordPromptAlerts)
  "visibility_lost",
  "visibility_rank_drop",
  "visibility_regained",
  // Risk engine — the signals spine (evaluateAlerts)
  "risk_threshold",
  "risk_spike",
  "critical_signal",
  // Escalation — EscalationAlert writers
  "escalation_risk",
  "ai_risk",
  // AI visibility monitoring — previously email-only, no durable row
  "visibility_score_drop",
  "visibility_crawler_blocked",
  // Reputation scoring — previously console.log only, no durable row
  "reputation_score_change",
  // AI Share of Voice — the nightly rollup's week-over-week drop check
  "sov_share_drop",
  // Citation Opportunity Engine — the weekly sweep's top-quartile finds
  "citation_opportunity",
  // Agency Opportunity Scanner — a bulk prospect batch finished
  "scan_complete",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationSeverity = "info" | "warning" | "critical";

export const NOTIFICATION_SEVERITIES: readonly NotificationSeverity[] = [
  "info",
  "warning",
  "critical",
];

/**
 * What each type interpolates. Keep these flat and primitive: they are stored
 * as JSON and read back by a client component, so a Date or a Decimal here
 * becomes a string somewhere unhelpful.
 */
export interface NotificationPayloads {
  visibility_lost: { promptText: string; prevRank: number | null };
  visibility_rank_drop: { promptText: string; prevRank: number | null; newRank: number | null };
  visibility_regained: { promptText: string; newRank: number | null };
  risk_threshold: { score: number; grade: string | null };
  risk_spike: { score: number; previousScore: number | null; delta: number };
  critical_signal: { signalTitle: string; source: string | null };
  escalation_risk: { riskLevel: string; probability: number; alertId: string };
  ai_risk: { riskLevel: string; probability: number; alertId: string };
  visibility_score_drop: { url: string; prevScore: number; newScore: number; grade: string };
  visibility_crawler_blocked: { url: string; bots: string[] };
  reputation_score_change: {
    previousScore: number;
    newScore: number;
    direction: "up" | "down";
    location: string | null;
  };
  /**
   * PERCENTAGE POINTS, both of them — 12.4 means 12.4% of that engine's
   * answers, not 0.124. SovSnapshot.share stores the 0..1 fraction and the
   * adapter converts once; a payload carrying the fraction would render "your
   * share fell from 0.2 to 0.1" in the tray.
   */
  sov_share_drop: { engine: string; before: number; after: number };
  /**
   * `priority` is the OPPORTUNITY SCORE, which has no unit — see
   * src/lib/citation-opportunities/score.ts. It is carried so a consumer can
   * rank two of these against each other, and for exactly that reason the copy
   * below never prints it. A number in the tray that the customer cannot
   * interpret is worse than no number.
   */
  citation_opportunity: { domain: string; priority: number };
  /**
   * `done` COUNTS FAILED ROWS, because it counts rows that reached a terminal
   * state — which is what ScanBatch.done increments on. So done === total on
   * every completed batch, including one where every prospect was unreachable,
   * and the copy must never read it as "succeeded". It is carried anyway: a
   * batch that completed at 1,000 of 1,000 and one that completed at 1,000 of
   * 1,000 having failed 400 look identical in the tray, and the second one is
   * the reader's cue to open the table.
   */
  scan_complete: { batchId: string; total: number; done: number };
}

export type PayloadFor<T extends NotificationType> = NotificationPayloads[T];

/**
 * Where a row of each type sends you. These are the pages that already render
 * the underlying data: /intelligence lists escalation alerts, /intelligence/risk
 * is the risk engine, /analytics holds reputation scores.
 *
 * A notification whose href goes nowhere useful is worse than no notification,
 * so this map is exhaustive by construction — adding a type without an href is
 * a compile error, not a dead link discovered by a user.
 */
export const NOTIFICATION_HREF: Record<NotificationType, string> = {
  visibility_lost: "/visibility",
  visibility_rank_drop: "/visibility",
  visibility_regained: "/visibility",
  risk_threshold: "/intelligence/risk",
  risk_spike: "/intelligence/risk",
  critical_signal: "/intelligence/risk",
  escalation_risk: "/intelligence",
  ai_risk: "/intelligence",
  visibility_score_drop: "/visibility",
  visibility_crawler_blocked: "/visibility",
  reputation_score_change: "/analytics",
  sov_share_drop: "/visibility/tools/share-of-voice",
  citation_opportunity: "/visibility/tools/citation-opportunities",
  scan_complete: "/visibility/tools/opportunity-scanner",
};

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export function isNotificationSeverity(value: string): value is NotificationSeverity {
  return (NOTIFICATION_SEVERITIES as readonly string[]).includes(value);
}

/** The shape the page and the badge consume. Prisma rows are mapped to this. */
export interface NotificationDto {
  id: string;
  type: string;
  severity: string;
  /** English fallback; the client prefers the catalog keyed on `type`. */
  title: string;
  body: string | null;
  href: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  read: boolean;
}
