// src/lib/partner/limits.ts
//
// Partner API allowances. Dependency-free so docs, tests and any future UI can
// read the numbers without pulling Redis or Prisma (CLAUDE.md, client/server
// boundary).

/** What one partner call is billed as. Each kind has its own monthly allowance. */
export type PartnerKind = "audit_quick" | "audit_full" | "query" | "benchmark";

export const PARTNER_KINDS: readonly PartnerKind[] = ["audit_quick", "audit_full", "query", "benchmark"];

/** Calls per key per UTC calendar month. */
export const PARTNER_MONTHLY_LIMITS: Readonly<Record<PartnerKind, number>> = {
  audit_quick: 2000,
  audit_full: 300,
  query: 3000,
  benchmark: 300,
};

/** Requests per subject (the partner's own customer) per UTC clock hour, every endpoint counted. */
export const PARTNER_SUBJECT_HOURLY_LIMIT = 60;

/** Competitor URLs per benchmark, on top of `you`. */
export const PARTNER_BENCHMARK_MAX_COMPETITORS = 5;

/** Engines the answer check can ask today. The sidecar's /track answers with Claude only. */
export const PARTNER_QUERY_ENGINES: readonly string[] = ["claude"];

/** x-partner-subject: an opaque id, never an email. */
export const PARTNER_SUBJECT_RE = /^[A-Za-z0-9_-]{1,64}$/;
