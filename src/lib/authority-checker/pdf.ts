// src/lib/authority-checker/pdf.ts — a paying workspace's Link Authority
// report as a PDF, rendered by the sidecar's POST /authority-report
// (av-service/pdf_report.py, build_authority_report), the same reportlab
// pipeline as every Echorank PDF.
//
// PAID (2026-11-10): `paid: true`, so the PDF has its own title and none of
// the old free report's "Partial view" band or "Track it monthly" CTA. The
// numbers come from the 7-day domain cache the check just filled
// (service.ts, cachedLinkAuthorityReport): the PDF never buys anything.

import "server-only";

import { authorityLocale } from "./copy";
import type { LinkAuthorityReport } from "./types";

const SIDECAR = () => process.env.AV_SIDECAR_URL || "http://127.0.0.1:4500";

/** The report fields the PDF prints. */
export type PdfReport = Pick<LinkAuthorityReport, "domain" | "checkedAt" | "authority" | "links" | "comparison" | "referringDomains">;

/** The sidecar's three report languages; de-CH reads the "de" catalog (ss, never ß). */
export function pdfLang(locale: string | null | undefined): "en" | "fr" | "de" {
  const l = authorityLocale(locale);
  return l === "de-CH" ? "de" : l;
}

/** The body POSTed to /authority-report. Pure, for the test. */
export function authorityPdfPayload(report: PdfReport, locale: string | null | undefined) {
  return {
    lang: pdfLang(locale),
    paid: true,
    domain: report.domain,
    checkedAt: report.checkedAt,
    authority: report.authority,
    links: report.links,
    referringDomains: report.referringDomains,
    comparison: report.comparison,
  };
}

export async function renderAuthorityPdf(report: PdfReport, locale: string | null | undefined): Promise<Buffer> {
  const res = await fetch(`${SIDECAR()}/authority-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Internal-Secret": process.env.INTERNAL_API_SECRET ?? "" },
    body: JSON.stringify(authorityPdfPayload(report, locale)),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new Error(`authority PDF failed: sidecar HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const DAY_MS = 86_400_000;

/**
 * The check's date as the page sent it, when it is a real date inside the
 * cache window (with a day's slack); otherwise now. Only printed as "Data from".
 */
export function pdfCheckedAt(raw: string | undefined, now = new Date()): string {
  const t = raw ? Date.parse(raw) : NaN;
  if (Number.isFinite(t) && t <= now.getTime() && now.getTime() - t <= 8 * DAY_MS) return new Date(t).toISOString();
  return now.toISOString();
}

export function pdfFilename(domain: string): string {
  return `Echorank-Link-Authority-${domain.replace(/[^a-z0-9.-]/gi, "_")}.pdf`;
}
