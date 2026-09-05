// Portions adapted from every-app/open-seo (MIT)
//
// src/lib/backlinks/filters.ts
//
// Turning the Full tier's filter toolbar into DataForSEO `filters`
// expressions.
//
// ── EIGHT CONDITIONS, AND THE CAP IS ENFORCED HERE ─────────────────────────
// DataForSEO accepts at most 8 filter conditions per request. Over the cap it
// rejects the call — HAVING BILLED IT — so the budget is asserted before the
// request goes out. The client surfaces the same count and disables Apply, so
// reaching the cap here means a client that ignored it; that is a 400, not a
// silent truncation, because truncating produces an answer to a question the
// customer did not ask and cannot tell apart from the one they did.
//
// ── ILIKE TERMS ARE ESCAPED ────────────────────────────────────────────────
// `%` and `_` are wildcards in an ilike pattern. An anchor filter for "50%
// off" would otherwise match anything containing "50", which is WIDER than
// asked — and a wider answer still looks like an answer, so nobody notices.
//
// PURE. Imported by the client component for its condition counter, so it must
// stay free of server imports.

/** One condition tuple, or a nested group of them. */
export type FilterClause = unknown[];

/** The provider's hard limit. */
export const MAX_FILTER_CONDITIONS = 8;

export class TooManyFilterConditionsError extends Error {
  readonly statusCode = 400;
  readonly code = "TOO_MANY_FILTERS";
  constructor(readonly used: number) {
    super(`Too many filter conditions (${used} of ${MAX_FILTER_CONDITIONS} max).`);
    this.name = "TooManyFilterConditionsError";
  }
}

export function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/** Split a comma- or plus-separated term list into trimmed lowercase terms. */
export function parseFilterTerms(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .split(/[,+]/)
    .map((term) => term.trim())
    .filter(Boolean);
}

export function joinClauses(clauses: FilterClause[], operator: "and" | "or"): unknown[] {
  const expression: unknown[] = [];
  for (const clause of clauses) {
    if (expression.length > 0) expression.push(operator);
    expression.push(clause);
  }
  return expression;
}

export function collectNumericRange(
  out: FilterClause[],
  field: string,
  min: number | undefined,
  max: number | undefined,
): void {
  if (typeof min === "number" && Number.isFinite(min)) out.push([field, ">=", min]);
  if (typeof max === "number" && Number.isFinite(max)) out.push([field, "<=", max]);
}

/**
 * One ilike condition per include term, OR'd into a single group.
 *
 * MATCH-ANY, deliberately: a customer typing "blog, news" means "either", and
 * AND-ing them would return nothing for a set of terms that each match plenty.
 * Exclude terms are the mirror image and are AND'd — "drop all of these".
 */
export function buildIncludeOrGroup(
  field: string,
  include: string | undefined | null,
): { clause: FilterClause; conditionCount: number } | null {
  const conditions = parseFilterTerms(include).map((term) => [
    field,
    "ilike",
    `%${escapeLikeTerm(term)}%`,
  ]);
  if (conditions.length === 0) return null;
  if (conditions.length === 1) return { clause: conditions[0], conditionCount: 1 };
  return { clause: joinClauses(conditions, "or"), conditionCount: conditions.length };
}

function collectExcludeConditions(
  out: FilterClause[],
  field: string,
  exclude: string | undefined | null,
): void {
  for (const term of parseFilterTerms(exclude)) {
    out.push([field, "not_ilike", `%${escapeLikeTerm(term)}%`]);
  }
}

/** The Full tier's backlinks-list filters, as the UI presents them. */
export interface BacklinksListFilters {
  /** Match any of these in the linking URL. */
  include?: string | null;
  /** Drop rows matching any of these. */
  exclude?: string | null;
  /** dofollow | nofollow | undefined for both. */
  linkType?: "dofollow" | "nofollow" | null;
  minDomainRank?: number;
  maxDomainRank?: number;
  /** Top-level domain of the linking site, e.g. "edu". */
  tld?: string | null;
  hideLost?: boolean;
  hideBroken?: boolean;
}

/**
 * Count the conditions a filter set consumes, WITHOUT building it.
 *
 * Exported for the client's counter, which is why this file is pure: the
 * toolbar has to be able to say "6 of 8" before it submits, and a second
 * counting implementation in the component is how the two come apart.
 */
export function countFilterConditions(filters: BacklinksListFilters): number {
  return buildBacklinksListFilters(filters, { count: true }).conditionCount;
}

/**
 * Build the expression, and its condition count.
 *
 * `count: true` skips assembly and only counts — same code path, so the number
 * the client shows is the number the server enforces.
 */
export function buildBacklinksListFilters(
  filters: BacklinksListFilters,
  opts?: { count?: boolean },
): { filters: unknown[]; conditionCount: number } {
  const conditions: FilterClause[] = [];

  collectExcludeConditions(conditions, "url_from", filters.exclude);
  collectNumericRange(conditions, "domain_from_rank", filters.minDomainRank, filters.maxDomainRank);
  if (filters.linkType) conditions.push(["dofollow", "=", filters.linkType === "dofollow"]);
  if (filters.tld) {
    // The TLD sits at the end of the linking domain, so an anchored suffix
    // match is what "only .edu links" means.
    conditions.push(["domain_from", "like", `%.${escapeLikeTerm(filters.tld.replace(/^\./, ""))}`]);
  }
  if (filters.hideLost) conditions.push(["is_lost", "=", false]);
  if (filters.hideBroken) conditions.push(["is_broken", "=", false]);

  const includeGroup = buildIncludeOrGroup("url_from", filters.include);
  const conditionCount = conditions.length + (includeGroup?.conditionCount ?? 0);

  if (conditionCount > MAX_FILTER_CONDITIONS) {
    throw new TooManyFilterConditionsError(conditionCount);
  }
  if (opts?.count) return { filters: [], conditionCount };

  const all = includeGroup ? [...conditions, includeGroup.clause] : conditions;
  return { filters: all.length === 0 ? [] : joinClauses(all, "and"), conditionCount };
}

/** Sort fields the referring-domains table offers, mapped to provider names. */
export const REFERRING_DOMAIN_SORTS = {
  rank: "rank",
  backlinks: "backlinks",
  spamScore: "backlinks_spam_score",
  firstSeen: "first_seen",
} as const;

export type ReferringDomainSort = keyof typeof REFERRING_DOMAIN_SORTS;

export function buildOrderBy(
  field: ReferringDomainSort,
  order: "asc" | "desc",
): string[] {
  return [`${REFERRING_DOMAIN_SORTS[field]},${order}`];
}
