// src/lib/free-audit/email.ts — "Email me the PDF" for a free AI Readiness
// Audit result: the PDF (the sidecar's POST /audit/report, the same renderer
// as the download, partial-view band and CTA included) and a short email.
//
// Optional, never a gate: the result and the download do not depend on it.
// The address is used to send this one email. It is stored only when the
// visitor ticks the separate, unticked marketing box (free_crawl_leads, source
// "free-audit", marketingConsent true).

import "server-only";

import { avEmailHeader } from "@/lib/ai-visibility/brand";
import { SITE_URL } from "@/lib/seo/constants";
import { FREE_AUDIT_RESULT_DAYS } from "./limits";

const SIDECAR = () => process.env.AV_SIDECAR_URL || "http://127.0.0.1:4500";
const REPORT_PATH = () => process.env.AV_SIDECAR_REPORT_PATH ?? "/audit/report";

export async function renderFreeAuditPdf(audit: Record<string, unknown>): Promise<Buffer> {
  const res = await fetch(`${SIDECAR()}${REPORT_PATH()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Internal-Secret": process.env.INTERNAL_API_SECRET ?? "" },
    body: JSON.stringify(audit),
    signal: AbortSignal.timeout(35_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`free audit PDF failed: sidecar HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** The audited site's host, for the subject and the filename. Never HTML. */
export function auditedHost(audit: Record<string, unknown>): string {
  const raw = typeof audit.url === "string" ? audit.url : typeof audit.brand === "string" ? audit.brand : "";
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.slice(0, 253);
  } catch {
    return "your site";
  }
}

export function pdfFilename(host: string): string {
  return `Echorank-AI-Readiness-Audit-${host.replace(/[^a-z0-9.-]/gi, "_")}.pdf`;
}

export function freeAuditEmail(input: { host: string; score: number; locale: string; resultId: string | null }) {
  const fr = input.locale.startsWith("fr");
  const base = fr ? "fr" : "en";
  const link = input.resultId ? `${SITE_URL}/${base}/free-audit/r/${input.resultId}` : null;
  const host = esc(input.host);
  const subject = fr
    ? `Votre audit de préparation IA : ${input.host} (${input.score}/100)`
    : `Your AI Readiness Audit: ${input.host} (${input.score}/100)`;
  const lines = fr
    ? [
        `Voici le rapport PDF de l’audit de préparation IA de ${host} : score ${input.score}/100.`,
        link ? `Le résultat reste consultable ${FREE_AUDIT_RESULT_DAYS} jours à cette adresse : <a href="${link}">${link}</a>` : "",
        "Vous recevez ce courriel parce que vous l’avez demandé. Nous ne vous écrirons pas d’autre courriel sans votre accord.",
      ]
    : [
        `Here is the PDF report of the AI Readiness Audit of ${host}: score ${input.score}/100.`,
        link ? `The result stays online for ${FREE_AUDIT_RESULT_DAYS} days at: <a href="${link}">${link}</a>` : "",
        "You are getting this email because you asked for it. We will not email you again unless you agreed to it.",
      ];
  const html = `${avEmailHeader()}${lines.filter(Boolean).map((l) => `<p style="font:15px/1.6 system-ui,sans-serif;color:#111">${l}</p>`).join("")}`;
  const text = lines
    .filter(Boolean)
    .map((l) => l.replace(/<a href="([^"]+)">[^<]*<\/a>/g, "$1").replace(/&[a-z#0-9]+;/g, (e) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" })[e] ?? e))
    .join("\n\n");
  return { subject, html, text };
}
