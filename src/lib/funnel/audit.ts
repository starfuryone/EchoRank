// src/lib/funnel/audit.ts
//
// Running one funnel audit, and trimming the result into what a visitor sees.
//
// ── The same internal path the free audit uses ──────────────────────────────
// sidecarPost() (src/lib/av-sidecar.ts) is the one place that holds
// AV_SIDECAR_URL and INTERNAL_API_SECRET, and POST /audit with
// {url, crawl:false} is the exact call src/app/api/av/audit/route.ts makes and
// the one the scanner worker makes. Going through it means this feature adds no
// new sidecar surface and no second copy of the secret plumbing.
//
// NOT through /api/av/audit itself, deliberately. That route owns the public
// widget's 1-per-IP-per-day counter, and a funnel submission is a different
// product with a different limit (src/lib/funnel/quota.ts). Proxying through it
// would make an agency's paid funnel audits consume the anonymous landing-page
// allowance of whatever IP happened to submit, and would silently cap every
// funnel on the internet at one audit per visitor per day.
//
// ── Nothing here adds sidecar code ──────────────────────────────────────────
// /audit already exists and already accepts exactly this body. av-visibility is
// not touched by this feature and does not need a deploy.

import { normalizeCandidate } from "@/lib/opportunity-scanner/parse";
import { gradeFor, topGaps, type TopGap } from "@/lib/opportunity-scanner/grade";
import { sidecarPost } from "@/lib/av-sidecar";

/**
 * Client-side ceiling on one funnel audit.
 *
 * Shorter than the scanner's 60s: a visitor is sitting in front of an iframe on
 * somebody's marketing site waiting for a number, not a worker draining a queue.
 * 45s matches the free widget's own timeout, which is the same interaction.
 */
const AUDIT_TIMEOUT_MS = 45_000;

interface RawAuditResponse {
  score?: number;
  checks?: unknown;
  error?: string;
}

/**
 * What the embed renders and what FunnelLead.summary stores.
 *
 * A TRIM, NOT THE WHOLE RESPONSE. The sidecar's /audit reply carries the full
 * per-check breakdown; the widget shows a score, a letter and three gaps, and
 * that is also all an agency reads back off a lead. Storing the rest would make
 * funnel_leads the widest table in the schema for data nobody opens twice —
 * the same call ScanRow.topGaps documents.
 */
export interface FunnelAuditSummary {
  score: number;
  grade: string;
  gaps: TopGap[];
}

export type FunnelAuditResult =
  | { ok: true; summary: FunnelAuditSummary }
  | { ok: false; reason: "invalid_domain" | "audit_failed" };

/**
 * Normalise a visitor-typed domain, or refuse it.
 *
 * normalizeCandidate() is the scanner's, and reusing it is the point: it runs
 * registrableDomain() and THEN guardCheckUrl() on the normalised result, so the
 * string we hand the sidecar is the same one the guard approved. This input is
 * typed by an anonymous stranger into a box on somebody else's website, which
 * makes it the least trusted string in the feature — a bare `new URL()` here
 * would be an SSRF hole pointed straight at 127.0.0.1, where the sidecar lives.
 */
export function normalizeFunnelDomain(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const result = normalizeCandidate(raw.slice(0, 253));
  return result.ok ? result.domain : null;
}

/**
 * Run one audit against an already-normalised domain.
 *
 * Never throws. The caller has taken an email address by this point and must
 * store the lead whichever way this goes — see the note on FunnelLead in the
 * schema.
 */
export async function runFunnelAudit(domain: string): Promise<FunnelAuditResult> {
  const { status, data } = await sidecarPost<RawAuditResponse>(
    "/audit",
    // crawl:false keeps this to the passive checks, matching the free widget.
    // A funnel audit must return while a visitor is still watching.
    { url: domain, crawl: false },
    { timeoutMs: AUDIT_TIMEOUT_MS },
  );

  if (status !== 200 || typeof data?.score !== "number" || !Number.isFinite(data.score)) {
    return { ok: false, reason: "audit_failed" };
  }

  const score = Math.max(0, Math.min(100, Math.round(data.score)));
  return {
    ok: true,
    summary: { score, grade: gradeFor(score), gaps: topGaps(data.checks) },
  };
}

// ─── Email ──────────────────────────────────────────────────────────────────

/** Bounded, so a pasted paragraph cannot become a database row. */
const MAX_EMAIL_LENGTH = 254;

/**
 * Syntax check only.
 *
 * DELIBERATELY NOT A DELIVERABILITY CHECK. We never send to this address — the
 * notification goes to the AGENCY's inbox — so an MX lookup would cost a DNS
 * round trip inside a request a visitor is waiting on, to enforce a standard
 * the agency is better placed to apply to its own leads. The one thing that
 * matters here is that a lead row cannot be created without something
 * email-shaped, because the email IS the capture.
 */
export function normalizeLeadEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LENGTH) return null;
  // One @, something either side, a dot in the domain, no whitespace.
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) return null;
  return email;
}
