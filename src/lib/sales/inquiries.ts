import "server-only";

// src/lib/sales/inquiries.ts — sales inquiries from /{locale}/enterprise/contact.
//
// A valid inquiry from an allowed country is stored, every answer goes to
// support@ (reply-to the submitter), the submitter gets an acknowledgement in
// their language, and #echorank-alerts gets one line when Matrix is configured.
// A visitor in a blocked country (declared or Cloudflare's IP country) gets the
// "not available" message and nothing is stored. Staff move an inquiry
// new → contacted → closed (/admin/sales-inquiries); closed inquiries are
// deleted 24 months after closing (nightly, purgeClosedInquiries).

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { SUPPORT_EMAIL } from "@/lib/assistant/config";
import { isBlockedCountry, isSignupCountry } from "@/lib/geo/blocked-countries";
import { postMatrixAlert } from "@/lib/matrix/alert";
import { logger } from "@/infrastructure/observability/logger";
import { INQUIRY_NEEDS, INQUIRY_SIZES, cleanSource } from "./inquiry-options";
import { SALES_COPY, inquiryAcknowledgement, salesLocale } from "./inquiry-copy";

const log = logger.child({ module: "sales-inquiries" });

export const INQUIRY_RETENTION_MONTHS = 24;
export type InquiryStatusValue = "NEW" | "CONTACTED" | "CLOSED";

/** "example.com" or a full URL → "https://example.com" (path kept). Null if it is not a web address. */
export function normalizeWebsite(raw: string): string | null {
  const s = raw.trim();
  if (!s || s.length > 300 || /\s/.test(s)) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".") || u.hostname.startsWith(".") || u.hostname.endsWith(".")) return null;
    if (u.username || u.password) return null;
    return `${u.origin}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return null;
  }
}

const trimmed = (max: number) => z.string().trim().min(1).max(max);

/** The request body. `hp` is the honeypot: a field people never see, so it must arrive empty. */
export const InquiryBody = z.object({
  name: trimmed(200),
  email: z.string().trim().max(254).email(),
  company: trimmed(200),
  website: z.string().transform((v, ctx) => {
    const w = normalizeWebsite(v);
    if (!w) ctx.addIssue({ code: "custom", message: "website" });
    return w ?? "";
  }),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .refine((c) => isSignupCountry(c), "country"),
  size: z.enum(INQUIRY_SIZES),
  needs: z.array(z.enum(INQUIRY_NEEDS)).max(INQUIRY_NEEDS.length).default([]),
  message: z.string().trim().max(5000).optional(),
  marketingConsent: z.boolean().optional(),
  locale: z.string().max(10).optional(),
  src: z.string().max(200).optional(),
  referrer: z.string().max(1000).optional(),
  hp: z.string().max(500).optional(),
  turnstileToken: z.string().max(2048).optional(),
});
export type InquiryInput = z.infer<typeof InquiryBody>;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const asHtml = (text: string) =>
  `<div style="font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e2329">${esc(text).replace(/\n/g, "<br>")}</div>`;

/** A referrer worth keeping: an http(s) URL, without its query string. */
function cleanReferrer(r: string | undefined): string | null {
  if (!r) return null;
  try {
    const u = new URL(r);
    return u.protocol === "https:" || u.protocol === "http:" ? `${u.origin}${u.pathname}`.slice(0, 500) : null;
  } catch {
    return null;
  }
}

export type SubmitOutcome =
  | { status: "blocked" }
  | { status: "stored"; id: string; notified: boolean; acknowledged: boolean; alerted: boolean };

export async function submitInquiry(input: InquiryInput, ctx: { ipCountry: string | null }): Promise<SubmitOutcome> {
  // Same rule as signup: the declared country or the IP's. Nothing is stored.
  if (isBlockedCountry(input.country) || isBlockedCountry(ctx.ipCountry)) {
    log.info({ declared: input.country, ipCountry: ctx.ipCountry }, "sales inquiry refused: blocked country");
    return { status: "blocked" };
  }

  const locale = salesLocale(input.locale);
  const row = await prisma.salesInquiry.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      company: input.company,
      website: input.website,
      country: input.country,
      ipCountry: ctx.ipCountry,
      size: input.size,
      needs: [...new Set(input.needs)],
      message: input.message || null,
      marketingConsent: input.marketingConsent === true,
      locale,
      source: cleanSource(input.src),
      referrer: cleanReferrer(input.referrer),
    },
  });

  // support@ gets every answer, in English; replying goes to the submitter.
  const en = SALES_COPY.en;
  const body = [
    `New sales inquiry (${row.createdAt.toISOString()}).`,
    "",
    `${en.name}: ${row.name}`,
    `${en.email}: ${row.email}`,
    `${en.company}: ${row.company}`,
    `${en.website}: ${row.website}`,
    `${en.country}: ${row.country}${row.ipCountry && row.ipCountry !== row.country ? ` (IP: ${row.ipCountry})` : ""}`,
    `${en.size} ${en.sizes[row.size as keyof typeof en.sizes] ?? row.size}`,
    `${en.needs} ${row.needs.map((n) => en.needOptions[n as keyof typeof en.needOptions] ?? n).join(", ") || "—"}`,
    `${en.message}: ${row.message ?? "—"}`,
    `Marketing opt-in: ${row.marketingConsent ? "yes" : "no"}`,
    `Language: ${row.locale}`,
    `Source: ${row.source ?? "—"}`,
    `Referrer: ${row.referrer ?? "—"}`,
    "",
    "Reply to this email to answer them. Status: /admin/sales-inquiries",
  ].join("\n");
  let notified = false;
  try {
    notified = await sendMail({
      to: [SUPPORT_EMAIL],
      replyTo: row.email,
      subject: `Sales inquiry: ${row.company} (${row.size})`,
      text: body,
      html: asHtml(body),
    });
  } catch (err) {
    log.error({ err, id: row.id }, "support@ could not be sent a sales inquiry");
  }

  const ack = inquiryAcknowledgement(locale, row.name);
  let acknowledged = false;
  try {
    acknowledged = await sendMail({ to: [row.email], subject: ack.subject, text: ack.text, html: asHtml(ack.text) });
  } catch (err) {
    log.error({ err, id: row.id }, "sales inquiry acknowledgement could not be sent");
  }

  const now = new Date();
  if (notified || acknowledged) {
    await prisma.salesInquiry.update({
      where: { id: row.id },
      data: { ...(notified ? { notifiedAt: now } : {}), ...(acknowledged ? { acknowledgedAt: now } : {}) },
    });
  }

  // One line, no personal data: company, size, needs, where it came from.
  const alerted = await postMatrixAlert(
    `Sales inquiry: ${row.company} · ${row.size} · ${row.needs.join(", ") || "no needs ticked"} · ${row.country} · src=${row.source ?? "direct"}`,
  );

  log.info({ id: row.id, notified, acknowledged, alerted, source: row.source }, "sales inquiry stored");
  return { status: "stored", id: row.id, notified, acknowledged, alerted };
}

/** Move an inquiry. contactedAt is set the first time it is contacted (or closed); closedAt while it is closed. */
export async function setInquiryStatus(id: string, status: InquiryStatusValue) {
  const row = await prisma.salesInquiry.findUnique({ where: { id } });
  if (!row) return null;
  const now = new Date();
  const data: Record<string, unknown> = { status };
  if (status !== "NEW" && !row.contactedAt) data.contactedAt = now;
  // Reopening clears closedAt, so the 24-month purge never takes an open inquiry.
  data.closedAt = status === "CLOSED" ? (row.closedAt ?? now) : null;
  return prisma.salesInquiry.update({ where: { id }, data });
}

export async function listInquiries(status?: InquiryStatusValue, take = 500) {
  return prisma.salesInquiry.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Deletes inquiries closed more than 24 months ago. */
export async function purgeClosedInquiries(now = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - INQUIRY_RETENTION_MONTHS);
  const { count } = await prisma.salesInquiry.deleteMany({ where: { status: "CLOSED", closedAt: { lt: cutoff } } });
  log.info({ count, cutoff: cutoff.toISOString() }, "closed sales inquiries purged");
  return count;
}
