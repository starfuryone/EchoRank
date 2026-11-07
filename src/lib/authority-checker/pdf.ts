// src/lib/authority-checker/pdf.ts — the unlocked report as a PDF, rendered by
// the sidecar's POST /authority-report (av-service/pdf_report.py,
// build_authority_report), the same reportlab pipeline as every Echorank PDF.
// The PDF carries the free report's "Partial view" band and the "Track it
// monthly" CTA; the numbers are the stored check's, never fetched again.

import "server-only";

import { SITE_URL } from "@/lib/seo/constants";
import { AUTHORITY_SRC } from "./config";
import { authorityLocale } from "./copy";
import type { StoredCheck } from "./types";

const SIDECAR = () => process.env.AV_SIDECAR_URL || "http://127.0.0.1:4500";

/** The sidecar's three report languages; de-CH reads the "de" catalog (ss, never ß). */
export function pdfLang(locale: string | null | undefined): "en" | "fr" | "de" {
  const l = authorityLocale(locale);
  return l === "de-CH" ? "de" : l;
}

/** The body POSTed to /authority-report. Pure, for the test. */
export function authorityPdfPayload(check: StoredCheck, locale: string | null | undefined) {
  const base = authorityLocale(locale);
  return {
    lang: pdfLang(locale),
    domain: check.domain,
    checkedAt: check.createdAt,
    authority: check.authority[check.domain] ?? null,
    links: check.links,
    referringDomains: check.full?.referringDomains ?? [],
    comparison: check.full?.comparison ?? [],
    ctaUrl: `${SITE_URL}/${base}/pricing?src=${AUTHORITY_SRC}`,
  };
}

export async function renderAuthorityPdf(check: StoredCheck, locale: string | null | undefined): Promise<Buffer> {
  const res = await fetch(`${SIDECAR()}/authority-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Internal-Secret": process.env.INTERNAL_API_SECRET ?? "" },
    body: JSON.stringify(authorityPdfPayload(check, locale)),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new Error(`authority PDF failed: sidecar HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export function pdfFilename(domain: string): string {
  return `Echorank-Authority-${domain.replace(/[^a-z0-9.-]/gi, "_")}.pdf`;
}
