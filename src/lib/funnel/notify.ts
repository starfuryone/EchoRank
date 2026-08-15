// src/lib/funnel/notify.ts
//
// Telling the agency a lead arrived: an in-app Notification row and, when the
// funnel names an inbox, an email through the shared Brevo relay.
//
// ── NOTHING HERE MAY FAIL THE REQUEST ───────────────────────────────────────
// A visitor is waiting on a score on somebody else's marketing site. The lead
// is already committed to Postgres by the time this runs, so every outcome
// below — Redis down, SMTP refusing, the notifications table unreachable — is a
// delivery problem with a record that already exists, not a reason to hand the
// visitor an error and the agency nothing. recordNotification() is documented
// as never throwing; sendMail() is not, so its call is wrapped, and the whole
// thing is invoked without being awaited by the route.
//
// ── Brevo is real, and this is not a TODO-log ───────────────────────────────
// src/lib/mailer.ts is a live Brevo SMTP relay already used by the signals
// notifier and the visibility alerts. It is NOT the stub that
// sendTrialEndingEmail() is — that one logs because its TEMPLATE was never
// built, not because sending is unavailable. So this sends for real, with one
// caveat inherited from sendMail: it returns false rather than throwing when
// SMTP_HOST is unset, and that case is logged at warn so a misconfigured box
// looks different in the logs from a quiet one.

import { logger } from "@/infrastructure/observability/logger";
import { sendMail } from "@/lib/mailer";
import { recordNotification } from "@/lib/notifications/store";

export interface FunnelLeadNotice {
  tenantId: string;
  funnelId: string;
  funnelLabel: string;
  leadId: string;
  email: string;
  domain: string;
  /** Null when the audit failed after the email was captured. */
  score: number | null;
  notifyEmail: string | null;
}

/** Minimal, and deliberately plain. This lands in an agency's inbox, not a page. */
function emailHtml(notice: FunnelLeadNotice): string {
  const score =
    notice.score === null ? "no score (the audit did not complete)" : `${notice.score}/100`;
  return [
    `<p>A new lead came in through your <strong>${escapeHtml(notice.funnelLabel)}</strong> audit funnel.</p>`,
    "<ul>",
    `<li><strong>Email:</strong> ${escapeHtml(notice.email)}</li>`,
    `<li><strong>Domain:</strong> ${escapeHtml(notice.domain)}</li>`,
    `<li><strong>Score:</strong> ${escapeHtml(score)}</li>`,
    "</ul>",
  ].join("");
}

/**
 * The lead's own values are interpolated into this HTML, and every one of them
 * is a string a stranger typed into a form on a public page.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Fan a captured lead out to both channels. Never throws, never rejects.
 *
 * The two are independent on purpose: an agency that has not set notifyEmail
 * still gets the in-app row, and an SMTP outage does not cost them the row
 * either.
 */
export async function notifyFunnelLead(notice: FunnelLeadNotice): Promise<void> {
  // ── 1. The durable in-app record. Documented as never throwing. ───────────
  await recordNotification({
    tenantId: notice.tenantId,
    type: "funnel_lead",
    severity: "info",
    // English fallback, read back only if `funnel_lead` ever leaves the catalog.
    title: `New funnel lead — ${notice.domain}`,
    body: `Captured by the ${notice.funnelLabel} funnel.`,
    payload: {
      funnelId: notice.funnelId,
      domain: notice.domain,
      score: notice.score,
    },
    // One row per lead. A retried notify must not produce a second row, and the
    // lead id is the only value here that is unique per capture — two visitors
    // from the same domain on the same day are two leads and deserve two rows.
    dedupeKey: `funnel_lead:${notice.leadId}`,
    sourceRef: `FunnelLead:${notice.leadId}`,
  });

  // ── 2. The email. Optional, and best-effort. ──────────────────────────────
  if (!notice.notifyEmail) return;

  try {
    const sent = await sendMail({
      to: [notice.notifyEmail],
      subject: `New audit lead: ${notice.domain}`,
      html: emailHtml(notice),
    });
    if (!sent) {
      logger.warn(
        { tenantId: notice.tenantId, funnelId: notice.funnelId, leadId: notice.leadId },
        "funnel lead email not sent - SMTP_HOST unset; the in-app notification was still written",
      );
    }
  } catch (err) {
    logger.error(
      {
        tenantId: notice.tenantId,
        funnelId: notice.funnelId,
        leadId: notice.leadId,
        err: err instanceof Error ? err.message : String(err),
      },
      "funnel lead email failed - the lead itself is stored and unaffected",
    );
  }
}
