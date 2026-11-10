// POST /api/av/audit/email — "Email me the PDF" for a stored free AI Readiness
// Audit result (ECHORANK-AI-VISIBILITY-PAGES.md Phase 2). Body:
// { resultId, email, marketingConsent?: boolean, locale? }.
//
// OPTIONAL, NEVER A GATE: the result and the PDF download work without it.
// Same-origin only; refused in a blocked country (EU/EEA/UK,
// src/lib/geo/blocked-countries.ts); one email per result, and
// FREE_AUDIT_EMAILS_PER_DAY per IP address per 24 hours, so the form cannot be
// used to send PDFs to strangers in bulk. The address is used for this email
// only. It is stored ONLY with `marketingConsent: true` (a separate, unticked
// box): one free_crawl_leads row, source "free-audit".

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { logger } from "@/infrastructure/observability/logger";
import { csrfProtection } from "@/lib/csrf-protection";
import { isBlockedCountry } from "@/lib/geo/blocked-countries";
import { sendMail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { FREE_AUDIT_EMAILS_PER_DAY, FREE_AUDIT_RESULT_DAYS, RESULT_ID_RE } from "@/lib/free-audit/limits";
import { getResult } from "@/lib/free-audit/store";
import { auditedHost, freeAuditEmail, pdfFilename, renderFreeAuditPdf } from "@/lib/free-audit/email";

const Body = z.object({
  resultId: z.string().regex(RESULT_ID_RE),
  email: z.string().trim().toLowerCase().email().max(254),
  marketingConsent: z.boolean().optional(),
  locale: z.string().max(10).optional(),
});

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const csrf = csrfProtection(req);
  if (csrf) return csrf;

  if (isBlockedCountry(req.headers.get("cf-ipcountry"))) {
    return NextResponse.json({ error: "country_not_available" }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { resultId, email, locale = "en" } = parsed.data;
  const consent = parsed.data.marketingConsent === true;

  const stored = await getResult(resultId);
  if (!stored) return NextResponse.json({ error: "expired", days: FREE_AUDIT_RESULT_DAYS }, { status: 410 });

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = await rateLimit(`free-audit-email:${ip}`, FREE_AUDIT_EMAILS_PER_DAY, DAY_MS);
  if (!limited.success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  // Once per result: the first request claims it; a second gets "already sent".
  try {
    const claimed = await getRedisConnection().set(`echorank:free-audit:emailed:${resultId}`, "1", "EX", FREE_AUDIT_RESULT_DAYS * 86_400, "NX");
    if (claimed !== "OK") return NextResponse.json({ error: "already_sent" }, { status: 409 });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const audit = stored.audit;
  const host = auditedHost(audit);
  const score = typeof audit.score === "number" ? Math.round(audit.score) : 0;
  try {
    const pdf = await renderFreeAuditPdf(audit);
    const mail = freeAuditEmail({ host, score, locale, resultId });
    const sent = await sendMail({
      to: [email],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: [{ filename: pdfFilename(host), content: pdf, contentType: "application/pdf" }],
    });
    if (!sent) throw new Error("mailer refused");
  } catch (err) {
    // Give the result back its one email so a retry can work.
    await getRedisConnection().del(`echorank:free-audit:emailed:${resultId}`).catch(() => {});
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "free audit: PDF email failed");
    return NextResponse.json({ error: "send_failed" }, { status: 503 });
  }

  if (consent) {
    await prisma.freeCrawlLead
      .upsert({
        where: { token_email: { token: resultId, email } },
        create: { email, token: resultId, domain: host, locale: locale.startsWith("fr") ? "fr" : "en", marketingConsent: true, source: "free-audit" },
        update: { marketingConsent: true },
      })
      .catch((err) => logger.warn({ err }, "free audit: consented lead not stored"));
  }

  return NextResponse.json({ sent: true });
}
