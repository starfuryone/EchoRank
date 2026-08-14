// One adapter per alert-producing surface. Each is a single call the emitting
// code makes after it has already done its own work, so no source had to be
// refactored to gain a notification.
//
// Every adapter is fire-and-forget: recordNotification never throws, and none
// of these returns anything a caller is expected to branch on. If the
// notification write fails, the alert it mirrors has already been stored and
// emailed.
//
// SEVERITY IS MAPPED HERE, NOT COPIED. The sources speak in their own
// vocabularies — AlertEvent has a binary warning/critical, EscalationAlert has
// a four-level RiskLevel, and two sources had no severity at all because they
// stored nothing. Each mapping below says why it landed where it did.

import { recordNotification } from "./store";
import type { NotificationSeverity } from "./types";

/** UTC day stamp, matching the dedupeKey convention the sources already use. */
function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10).replace(/-/g, "");
}

// ─── 1. Answer tracking: prompt mention transitions ─────────────────────────

export interface PromptTransitionInput {
  promptId: string;
  promptText: string;
  kind: "visibility_lost" | "visibility_rank_drop" | "visibility_regained";
  prevRank: number | null;
  newRank: number | null;
}

/**
 * Mirrors the AlertEvent rows recordPromptAlerts() has just written.
 *
 * Severity diverges from the source deliberately: AlertEvent files "regained"
 * under `warning` because it only has two levels, but being recommended again
 * is good news and must not sit in the dashboard wearing a warning colour.
 */
export async function notifyPromptTransitions(
  tenantId: string,
  transitions: PromptTransitionInput[],
  title: (t: PromptTransitionInput) => string,
): Promise<void> {
  const day = utcDay();
  for (const t of transitions) {
    const severity: NotificationSeverity =
      t.kind === "visibility_lost"
        ? "critical"
        : t.kind === "visibility_rank_drop"
          ? "warning"
          : "info";

    if (t.kind === "visibility_lost") {
      await recordNotification({
        tenantId,
        type: "visibility_lost",
        severity,
        title: title(t),
        payload: { promptText: t.promptText, prevRank: t.prevRank },
        dedupeKey: `notif:vis-${t.kind}-${t.promptId}-${day}`,
      });
    } else if (t.kind === "visibility_rank_drop") {
      await recordNotification({
        tenantId,
        type: "visibility_rank_drop",
        severity,
        title: title(t),
        payload: { promptText: t.promptText, prevRank: t.prevRank, newRank: t.newRank },
        dedupeKey: `notif:vis-${t.kind}-${t.promptId}-${day}`,
      });
    } else {
      await recordNotification({
        tenantId,
        type: "visibility_regained",
        severity,
        title: title(t),
        payload: { promptText: t.promptText, newRank: t.newRank },
        dedupeKey: `notif:vis-${t.kind}-${t.promptId}-${day}`,
      });
    }
  }
}

// ─── 2. Risk engine (signals spine) ─────────────────────────────────────────

export interface RiskAlertInput {
  id: string;
  kind: string;
  severity: "warning" | "critical";
  title: string;
  body: string | null;
  dedupeKey: string;
  payload?: Record<string, unknown> | null;
}

/**
 * Mirrors one AlertEvent from evaluateAlerts(). Severity passes through — the
 * risk engine's warning/critical already means what this page means by it.
 *
 * `kind` is trusted only when it is one of the three the engine emits; anything
 * else is filed as critical_signal rather than invented as a new type, so a new
 * kind appearing upstream degrades to a real row with a real link instead of
 * an unrenderable one.
 */
export async function notifyRiskAlert(
  tenantId: string,
  alert: RiskAlertInput,
): Promise<void> {
  const payload = alert.payload ?? {};
  const sourceRef = `AlertEvent:${alert.id}`;
  const dedupeKey = `notif:${alert.dedupeKey}`;

  if (alert.kind === "risk_threshold") {
    await recordNotification({
      tenantId,
      type: "risk_threshold",
      severity: alert.severity,
      title: alert.title,
      body: alert.body,
      sourceRef,
      dedupeKey,
      payload: {
        score: Number(payload.score ?? 0),
        grade: typeof payload.grade === "string" ? payload.grade : null,
      },
    });
    return;
  }

  if (alert.kind === "risk_spike") {
    const score = Number(payload.score ?? 0);
    const previousScore =
      payload.previousScore === null || payload.previousScore === undefined
        ? null
        : Number(payload.previousScore);
    await recordNotification({
      tenantId,
      type: "risk_spike",
      severity: alert.severity,
      title: alert.title,
      body: alert.body,
      sourceRef,
      dedupeKey,
      payload: {
        score,
        previousScore,
        delta: previousScore === null ? 0 : score - previousScore,
      },
    });
    return;
  }

  await recordNotification({
    tenantId,
    type: "critical_signal",
    severity: alert.severity,
    title: alert.title,
    body: alert.body,
    sourceRef,
    dedupeKey,
    payload: {
      signalTitle: typeof payload.signalTitle === "string" ? payload.signalTitle : alert.title,
      source: typeof payload.source === "string" ? payload.source : null,
    },
  });
}

// ─── 3-5. Escalation alerts ─────────────────────────────────────────────────

export interface EscalationAlertInput {
  alertId: string;
  alertType: string;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | string;
  probability: number;
  title: string;
  description: string | null;
}

/**
 * Mirrors an EscalationAlert from any of its three writers.
 *
 * RiskLevel collapses to three levels: CRITICAL is critical, HIGH and MODERATE
 * are both warnings (the escalation threshold already filters out the noise
 * below them, so a HIGH here is "look at this today", not "drop everything"),
 * and LOW is informational.
 *
 * Note this does NOT touch EscalationAlert.acknowledged. That flag is
 * tenant-wide shared state and stays exactly as broken as it was; the read
 * state for this notification lives per-user in NotificationRead.
 */
export async function notifyEscalationAlert(
  tenantId: string,
  alert: EscalationAlertInput,
): Promise<void> {
  const severity: NotificationSeverity =
    alert.riskLevel === "CRITICAL"
      ? "critical"
      : alert.riskLevel === "LOW"
        ? "info"
        : "warning";

  const type = alert.alertType === "ai_risk" ? "ai_risk" : "escalation_risk";
  const payload = {
    riskLevel: alert.riskLevel,
    probability: alert.probability,
    alertId: alert.alertId,
  };

  if (type === "ai_risk") {
    await recordNotification({
      tenantId,
      type: "ai_risk",
      severity,
      title: alert.title,
      body: alert.description,
      sourceRef: `EscalationAlert:${alert.alertId}`,
      // The alert id is already unique per event, and the source dedupes
      // before it creates. One notification per alert row is the right grain.
      dedupeKey: `notif:escalation-${alert.alertId}`,
      payload,
    });
    return;
  }

  await recordNotification({
    tenantId,
    type: "escalation_risk",
    severity,
    title: alert.title,
    body: alert.description,
    sourceRef: `EscalationAlert:${alert.alertId}`,
    dedupeKey: `notif:escalation-${alert.alertId}`,
    payload,
  });
}

// ─── 6. AI visibility monitoring ────────────────────────────────────────────

export interface VisibilityAlertNotificationInput {
  tenantId: string;
  url: string;
  prevScore: number;
  newScore: number;
  newGrade: string;
  blockedBots: string[];
}

/**
 * The first durable record this alert has ever had — sendVisibilityAlert()
 * emails and returns, storing nothing. Additive: the email still goes, and
 * this does not suppress or duplicate it.
 *
 * A newly-blocked AI crawler is filed critical rather than warning: it is not a
 * score moving, it is the site becoming invisible to the crawler, and it is
 * usually an accident someone made in a CDN dashboard minutes earlier.
 */
export async function notifyVisibilityAlert(
  input: VisibilityAlertNotificationInput,
): Promise<void> {
  const day = utcDay();

  if (input.blockedBots.length > 0) {
    await recordNotification({
      tenantId: input.tenantId,
      type: "visibility_crawler_blocked",
      severity: "critical",
      title: `AI crawler blocked on ${input.url}`,
      dedupeKey: `notif:vis-blocked-${input.url}-${day}`,
      payload: { url: input.url, bots: input.blockedBots },
    });
  }

  // Only a real drop is notification-worthy. A score that went up is already
  // visible on /visibility and does not need to interrupt anyone.
  if (input.newScore < input.prevScore) {
    await recordNotification({
      tenantId: input.tenantId,
      type: "visibility_score_drop",
      severity: "warning",
      title: `AI visibility score dropped: ${input.prevScore} -> ${input.newScore} (${input.url})`,
      dedupeKey: `notif:vis-score-${input.url}-${day}`,
      payload: {
        url: input.url,
        prevScore: input.prevScore,
        newScore: input.newScore,
        grade: input.newGrade,
      },
    });
  }
}

// ─── 7. Reputation scoring ──────────────────────────────────────────────────

export interface ReputationScoreChangeInput {
  tenantId: string;
  previousScore: number;
  newScore: number;
  location: string | null;
}

/**
 * Also a first durable record: reputation-scoring.worker.ts logged a line to
 * the console and moved on, so a swing past the ±10 threshold reached nobody.
 *
 * Filed `warning` in both directions. A 10-point rise is not bad news, but it
 * is the same magnitude of surprise as a 10-point fall and belongs in the same
 * tray; the copy says which way it went.
 */
export async function notifyReputationScoreChange(
  input: ReputationScoreChangeInput,
): Promise<void> {
  const day = utcDay();
  const direction: "up" | "down" = input.newScore >= input.previousScore ? "up" : "down";

  await recordNotification({
    tenantId: input.tenantId,
    type: "reputation_score_change",
    severity: "warning",
    title: `Reputation score ${direction === "up" ? "rose" : "fell"}: ${input.previousScore} -> ${input.newScore}`,
    dedupeKey: `notif:rep-score-${input.location ?? "all"}-${day}`,
    payload: {
      previousScore: input.previousScore,
      newScore: input.newScore,
      direction,
      location: input.location,
    },
  });
}
