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
  // White-Label Audit Funnel — a visitor on the agency's own site left an email
  "funnel_lead",
  // Prepaid lookup credits — a Stripe one-time checkout completed
  "credits_purchased",
  // AI Action Agent — a generator finished and a draft is waiting for a human
  "action_draft_ready",
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
  /**
   * NO EMAIL ADDRESS. The lead's address is the captured asset and it is not
   * put in a notification payload: this row is tenant-wide, so it renders in
   * the tray for every member of the agency including ones with no business
   * reading a prospect list, and it is the one payload here built entirely
   * from strings a stranger typed into a public form. The domain identifies
   * the lead well enough to decide whether to open the table, and the table is
   * where the address lives.
   *
   * `score` is NULLABLE because the email is captured before the audit runs and
   * the lead is stored either way — a funnel that captured an address for a
   * site the sidecar could not reach is still a lead. Null renders as "—"
   * through render.ts's MISSING, which is the honest reading.
   */
  funnel_lead: { funnelId: string; domain: string; score: number | null };
  /**
   * COUNTS OF LOOKUPS, NEVER DOLLARS. `credits` is what this purchase added and
   * `balance` is what the tenant holds after it — both are lookup counts, and
   * the copy renders them as such. A dollar figure here would be the only place
   * in the whole credits feature that prices a lookup after the sale, and it
   * would be wrong the moment a pack's price changes: this row is durable, the
   * price is not.
   *
   * NO SESSION ID. It is the ledger's `ref` and it belongs in the audit trail,
   * not in a tray row that every member of the tenant can read.
   */
  credits_purchased: { credits: number; balance: number };
  /**
   * ONE ROW PER DRAFT, and the payload is why. It carries the id of the single
   * ActionItem it is about, so the tray row deep-links straight to that draft
   * instead of to a queue the reader then has to search. A batch of five review
   * replies is therefore five rows — bounded by MAX_REVIEW_BATCH (10) in
   * src/lib/action-agent/generate.ts, which exists for exactly that reason.
   *
   * NO CONTENT IN THE PAYLOAD. Not the drafted reply, not the review it answers,
   * not the page title. This row is tenant-wide, so it renders for every member
   * including ones with no business reading a customer complaint, and the draft
   * is one click away behind the same tenant scoping the queue enforces.
   *
   * `kind` IS CARRIED AND THE COPY NEVER PRINTS IT — the same split
   * citation_opportunity.priority makes one field up. It is an enum value
   * ("review_reply"), and render.ts substitutes payload values verbatim with no
   * locale in hand, so a `{kind}` placeholder would put a raw snake_case token
   * in a French tray. It is stored so a consumer can filter or route on it, and
   * so the queue can preselect a tab when a row is opened.
   */
  action_draft_ready: { actionItemId: string; kind: string };
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
  funnel_lead: "/visibility/tools/funnels",
  // /billing, not /credits: the marketing page sells packs, the billing page is
  // where a buyer checks what they now hold and reads the ledger. Someone who
  // has just bought is asking "did it land", not "shall I buy".
  credits_purchased: "/billing",
  // The review queue. The adapter overrides this with ?item=<id> so the row
  // opens the draft it names; this bare path is the fallback for a row whose
  // href was not set, and it lands somewhere useful rather than nowhere.
  action_draft_ready: "/visibility/tools/action-agent",
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
