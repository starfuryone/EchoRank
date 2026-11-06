import "server-only";

// src/lib/privacy/complaints.ts — data-protection complaints: stored, the
// complainant acknowledged by email at once, legal@ notified, and a status
// with a timestamp per step (received → in progress → answered).

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { logger } from "@/infrastructure/observability/logger";
import { LEGAL_EMAIL, acknowledgementEmail, complaintLocale } from "./complaint-copy";

const log = logger.child({ module: "privacy-complaints" });

export type ComplaintStatusValue = "RECEIVED" | "IN_PROGRESS" | "ANSWERED";

/** "PC-" + 6 characters from an unambiguous alphabet (no 0/O/1/I). */
export function complaintReference(bytes = randomBytes(6)): string {
  const A = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return "PC-" + [...bytes].map((b) => A[b % A.length]).join("");
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const asHtml = (text: string) =>
  `<div style="font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e2329">${esc(text).replace(/\n/g, "<br>")}</div>`;

export async function fileComplaint(input: { name: string; email: string; details: string; locale: string }) {
  const locale = complaintLocale(input.locale);
  let row = null;
  for (let attempt = 0; attempt < 3 && !row; attempt++) {
    try {
      row = await prisma.privacyComplaint.create({
        data: { reference: complaintReference(), name: input.name, email: input.email, details: input.details, locale },
      });
    } catch (err) {
      if (attempt === 2) throw err; // a reference collision is the only expected failure
    }
  }
  const c = row!;

  // The acknowledgement goes at once; acknowledgedAt is set only if it was sent.
  const ack = acknowledgementEmail(locale, c.name, c.reference);
  let acknowledged = false;
  try {
    acknowledged = await sendMail({ to: [c.email], subject: ack.subject, text: ack.text, html: asHtml(ack.text) });
  } catch (err) {
    log.error({ err, reference: c.reference }, "complaint acknowledgement could not be sent");
  }
  if (acknowledged) {
    await prisma.privacyComplaint.update({ where: { id: c.id }, data: { acknowledgedAt: new Date() } });
  }

  // legal@ gets the complaint itself, to act on.
  try {
    const body =
      `New data-protection complaint ${c.reference} (${locale}).\n\nFrom: ${c.name} <${c.email}>\nReceived: ${c.createdAt.toISOString()}\n` +
      `Acknowledgement sent: ${acknowledged ? "yes" : "NO — acknowledge by hand"}\n\n${c.details}\n\n` +
      `Reply within 30 days. Status: PATCH /api/admin/privacy-complaints/${c.id} {"status":"IN_PROGRESS"|"ANSWERED"}.`;
    await sendMail({ to: [LEGAL_EMAIL], subject: `Privacy complaint ${c.reference}`, text: body, html: asHtml(body) });
  } catch (err) {
    log.error({ err, reference: c.reference }, "legal@ could not be notified of a complaint");
  }

  log.info({ reference: c.reference, acknowledged }, "privacy complaint filed");
  return { id: c.id, reference: c.reference, acknowledged };
}

/** Move a complaint on. Each step's timestamp is set the first time it is reached and never moved. */
export async function setComplaintStatus(id: string, status: ComplaintStatusValue, answerNote?: string) {
  const row = await prisma.privacyComplaint.findUnique({ where: { id } });
  if (!row) return null;
  const now = new Date();
  const data: Record<string, unknown> = { status };
  if ((status === "IN_PROGRESS" || status === "ANSWERED") && !row.inProgressAt) data.inProgressAt = now;
  if (status === "ANSWERED" && !row.answeredAt) data.answeredAt = now;
  if (answerNote !== undefined) data.answerNote = answerNote;
  return prisma.privacyComplaint.update({ where: { id }, data });
}

export async function listComplaints(take = 200) {
  return prisma.privacyComplaint.findMany({ orderBy: { createdAt: "desc" }, take });
}
