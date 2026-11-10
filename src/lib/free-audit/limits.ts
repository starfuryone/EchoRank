// src/lib/free-audit/limits.ts — the free AI Readiness Audit's fixed numbers,
// dependency-free so the page, its client components and the API all read the
// same values (ECHORANK-AI-VISIBILITY-PAGES.md Phase 2).

/** Successful free audits per IP address per 24 hours (src/lib/av-free-limit.ts enforces it). */
export const FREE_AUDITS_PER_DAY = 1;
/** The window starts at the first success and does not slide. */
export const FREE_AUDIT_WINDOW_HOURS = 24;

/** How long a result's permalink (/free-audit/r/{id}) stays readable. */
export const FREE_AUDIT_RESULT_DAYS = 7;

/** The benchmark line shows only once this many results of the same score version are stored. */
export const BENCHMARK_MIN_RESULTS = 200;

/** "Email me the PDF": per IP address per 24 hours, and once per result. */
export const FREE_AUDIT_EMAILS_PER_DAY = 3;

/** A result id: 24 url-safe characters (18 random bytes). */
export const RESULT_ID_RE = /^[A-Za-z0-9_-]{24}$/;
