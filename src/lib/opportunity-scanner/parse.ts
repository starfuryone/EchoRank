// src/lib/opportunity-scanner/parse.ts
//
// Turning a paste-box or an uploaded CSV into a list of domains we are willing
// to point a server-side fetch at.
//
// PURE, AND NO PRISMA. Same rule csv-export.ts follows and for the same reason:
// the route calls it, the tests call it directly, and it must not need a
// database to answer "is this list acceptable".
//
// ── The input is hostile by construction ────────────────────────────────────
// Every other domain-shaped input in this app is a site the tenant registered
// and we verified. This one is a thousand lines an agency pasted out of a
// spreadsheet they bought. That inverts the usual posture: the job here is not
// to be lenient about formatting (though it is lenient), it is to make sure
// nothing that reaches the worker can aim the sidecar's fetch loop at something
// it should not touch.
//
// The guard is src/lib/bot-analytics/url-guard.ts, called WITHOUT a
// tenantDomain — its documented shape for a URL the tenant does not own. It
// stops file:, credentials, odd ports, IP literals, single-label hosts,
// RFC 6761/2606 suffixes and the cloud metadata endpoint. Its own header states
// what it does not stop: a public name whose DNS resolves private. That gap
// lands on the sidecar, which already carries it for every existing /audit
// caller, and closing it needs resolve-then-pin at the socket.
//
// ── Rejections are reported, never silently dropped ─────────────────────────
// A submit that accepts 812 of 1000 lines and says nothing looks identical to
// one that accepted all thousand. The agency needs to know which 188 went and
// why, because "this line was not a domain" is usually a broken export and
// "this line was an IP address" is usually someone testing us.

import { registrableDomain } from "@/lib/registrable-domain";
import { guardCheckUrl, type UrlRejection } from "@/lib/bot-analytics/url-guard";

/** Hard ceiling on one batch, per the spec. Enforced after dedupe. */
export const MAX_BATCH_ROWS = 1000;

/**
 * Ceiling on the raw text we will even tokenise, before any of it is parsed.
 *
 * 1000 rows at a generous 253 bytes (the DNS name limit) plus separators is
 * ~256KB; this is that, doubled, and it exists so a 40MB paste is rejected by
 * a length check rather than by the regex engine.
 */
export const MAX_INPUT_BYTES = 512 * 1024;

export type RejectionReason =
  | UrlRejection
  | "duplicate"
  | "over_limit"
  | "not_a_domain";

export interface RejectedLine {
  /** What the agency actually typed, trimmed and capped for display. */
  input: string;
  reason: RejectionReason;
}

export interface ParsedList {
  /** Registrable domains, deduped, in first-seen order. */
  domains: string[];
  rejected: RejectedLine[];
  /** Lines that produced something after tokenising — the honest denominator. */
  seen: number;
}

/** Longest input echoed back in a rejection. A whole pasted row is not useful. */
const MAX_ECHO = 120;

/**
 * Split a paste or a CSV into candidate tokens.
 *
 * ONE TOKENISER FOR BOTH INPUTS, which is the whole trick. A "CSV" from an
 * agency is as likely to be one column of domains with a header as it is to be
 * a real RFC 4180 file, and a paste is as likely to be comma-separated as
 * newline-separated. Splitting on every plausible separator and then validating
 * each token handles both, plus the tab-separated paste out of Excel and the
 * quoted single-column CSV, without a format sniffer that can guess wrong.
 *
 * Quotes are stripped rather than parsed: a domain never legitimately contains
 * a comma, so there is no field a naive split could tear in half.
 */
export function tokenize(raw: string): string[] {
  return (raw ?? "")
    .split(/[\r\n,;\t|]+/)
    .map((t) => t.trim().replace(/^["']+|["']+$/g, "").trim())
    .filter(Boolean);
}

/**
 * A header row, dropped when it is the first token and is not a domain.
 *
 * Only the FIRST token, and only when it fails domain validation anyway — so
 * this never eats a real domain, and a file whose first line is a domain keeps
 * it. "domain", "website", "url" and their translations all fail the dot check
 * or the guard, so in practice this is a nicety that keeps one bogus rejection
 * off the report rather than a load-bearing rule.
 */
function looksLikeHeader(token: string): boolean {
  return /^(domain|website|url|site|company|name|host|hostname)$/i.test(token.trim());
}

/**
 * Normalise one token to a registrable domain, or say why not.
 *
 * The order matters. registrableDomain() first, so the guard sees the same
 * string the worker will use — guarding the raw input and then normalising
 * would let "https://user:pass@evil.example/path" pass a guard on a URL that is
 * not the one we end up storing.
 */
export function normalizeCandidate(
  token: string,
): { ok: true; domain: string } | { ok: false; reason: RejectionReason } {
  const trimmed = (token ?? "").trim();
  if (!trimmed) return { ok: false, reason: "not_a_url" };

  const domain = registrableDomain(trimmed);
  if (!domain || !domain.includes(".")) {
    return { ok: false, reason: "not_a_domain" };
  }

  // The guard wants something URL-shaped; it adds https:// to a bare host
  // itself. No tenantDomain — these are strangers' sites by definition.
  const verdict = guardCheckUrl(domain);
  if (!verdict.ok) {
    return { ok: false, reason: verdict.reason ?? "not_a_url" };
  }

  return { ok: true, domain };
}

/**
 * Parse a submitted list.
 *
 * DEDUPE BEFORE THE LIMIT, deliberately. A list of 1,400 lines that is 900
 * unique domains is a normal export with duplicates in it, and rejecting the
 * whole thing for being "over 1000" would be wrong about what it actually
 * costs us. The limit bounds work, and duplicates are not work.
 */
export function parseDomainList(raw: string): ParsedList {
  const rejected: RejectedLine[] = [];
  const echo = (s: string) => s.slice(0, MAX_ECHO);

  if ((raw ?? "").length > MAX_INPUT_BYTES) {
    return {
      domains: [],
      rejected: [{ input: "", reason: "over_limit" }],
      seen: 0,
    };
  }

  const tokens = tokenize(raw);
  const seenDomains = new Set<string>();
  const domains: string[] = [];

  for (const [index, token] of tokens.entries()) {
    if (index === 0 && looksLikeHeader(token)) continue;

    const result = normalizeCandidate(token);
    if (!result.ok) {
      rejected.push({ input: echo(token), reason: result.reason });
      continue;
    }
    if (seenDomains.has(result.domain)) {
      rejected.push({ input: echo(token), reason: "duplicate" });
      continue;
    }
    if (domains.length >= MAX_BATCH_ROWS) {
      rejected.push({ input: echo(token), reason: "over_limit" });
      continue;
    }
    seenDomains.add(result.domain);
    domains.push(result.domain);
  }

  return { domains, rejected, seen: tokens.length };
}
