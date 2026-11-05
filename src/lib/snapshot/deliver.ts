// src/lib/snapshot/deliver.ts
//
// After an email unlock: the report email (with the PDF attached) and, with
// consent only, the Brevo list subscription. Runs in the workers process as a
// `snapshot-email` job, so a relay or sidecar hiccup is retried and a final
// failure reaches the support@ queue alert.
//
// The PDF comes from the sidecar's report pipeline (POST /snapshot-report),
// the same reportlab renderer every other Echorank PDF goes through.
import "server-only";

import { sendMail } from "@/lib/mailer";
import { SITE_URL } from "@/lib/seo/constants";
import { avEmailHeader } from "@/lib/ai-visibility/brand";
import { logger } from "@/infrastructure/observability/logger";
import { ENGINE_LABEL, type SnapshotReport } from "./types";

const SIDECAR = () => process.env.AV_SIDECAR_URL || "http://127.0.0.1:4500";
const BREVO_CONTACTS_URL = "https://api.brevo.com/v3/contacts";

export const shareUrl = (locale: string, token: string) => `${SITE_URL}/${locale}/ai-visibility-check/r/${token}`;

export async function renderSnapshotPdf(report: SnapshotReport, locale: string, link: string): Promise<Buffer> {
  const res = await fetch(`${SIDECAR()}/snapshot-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Internal-Secret": process.env.INTERNAL_API_SECRET ?? "" },
    body: JSON.stringify({ ...report, lang: locale.startsWith("fr") ? "fr" : "en", shareUrl: link }),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new Error(`snapshot PDF failed: sidecar HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

export function reportEmail(report: SnapshotReport, locale: string, link: string) {
  const fr = locale.startsWith("fr");
  const rates = report.engines
    .map((e) => `${ENGINE_LABEL[e.engine]}: ${pct(e.mentionRate)} ${fr ? "de mentions" : "mention rate"}`)
    .join(" · ");
  const subject = fr
    ? `Votre vérification de visibilité IA pour ${report.domain}`
    : `Your AI visibility check for ${report.domain}`;
  const lines = fr
    ? [
        `Voici le rapport complet pour ${report.brand} (${report.domain}), en PDF joint.`,
        rates,
        `Le rapport en ligne (questions, réponses, sources) reste disponible 30 jours :`,
        link,
        `— Echorank360`,
      ]
    : [
        `Here is the full report for ${report.brand} (${report.domain}), attached as a PDF.`,
        rates,
        `The online report (questions, answers, sources) stays available for 30 days:`,
        link,
        `— Echorank360`,
      ];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // The AI Visibility logo heads the email (on its dark strip: avEmailHeader).
  const html =
    avEmailHeader() +
    "\n" +
    lines.map((l) => (l === link ? `<p><a href="${esc(link)}">${esc(link)}</a></p>` : `<p>${esc(l)}</p>`)).join("\n");
  return { subject, text: lines.join("\n\n"), html };
}

/** Add to BREVO_SNAPSHOT_LIST_ID. Only ever called for a lead that ticked the consent box. */
export async function subscribeToList(email: string, locale: string, domain: string): Promise<"added" | "skipped"> {
  const apiKey = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_SNAPSHOT_LIST_ID);
  if (!apiKey || !Number.isInteger(listId) || listId <= 0) {
    logger.warn({ queue: "visibility-monitoring" }, "Brevo snapshot list not configured; consented lead not subscribed");
    return "skipped";
  }
  if (process.env.NODE_ENV !== "production" || process.env.MAIL_DRY_RUN === "1") {
    logger.warn({ email, listId }, "DRY RUN: Brevo list subscription logged instead of sent");
    return "skipped";
  }
  const res = await fetch(BREVO_CONTACTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json", "api-key": apiKey },
    body: JSON.stringify({
      email,
      listIds: [listId],
      updateEnabled: true,
      attributes: { SOURCE: "ai-visibility-check", LOCALE: locale, CHECKED_DOMAIN: domain },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  // 204 on update, 201 on create.
  if (!res.ok) throw new Error(`Brevo contact add failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return "added";
}

export async function sendReport(input: {
  email: string;
  locale: string;
  report: SnapshotReport;
  token: string;
}): Promise<boolean> {
  const link = shareUrl(input.locale, input.token);
  const pdf = await renderSnapshotPdf(input.report, input.locale, link);
  const { subject, text, html } = reportEmail(input.report, input.locale, link);
  return sendMail({
    to: [input.email],
    subject,
    text,
    html,
    attachments: [
      { filename: `AI-Visibility-Check-${input.report.domain}.pdf`, content: pdf, contentType: "application/pdf" },
    ],
  });
}
