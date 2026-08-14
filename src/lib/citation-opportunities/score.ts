// src/lib/citation-opportunities/score.ts
//
// The Citation Opportunity arithmetic and its how-to templates.
//
// PURE. No prisma, no clock, no config, no network — the same split
// citations/aggregate.ts and sov/weighting.ts use. Everything worth arguing
// about is in here with a test around it; what is left in ./store.ts is SQL and
// what is left in ./listed.ts is one metered HTTP call.
//
// ── What an opportunity IS ──────────────────────────────────────────────────
// A domain the engines cite when they answer about this market, that has cited
// the customer's rivals, and has never once named the customer. That predicate
// is Citation Finder's `opportunity` preset, lifted from the (brandProfileId,
// domain) grain to the (tenantId, domain) grain — see ./store.ts for why the
// lift happens before the scoring rather than after.
//
// ── Why the impact formula has this shape ───────────────────────────────────
//   impact = log(1 + citations) x engines x rivalCitations
//
//   log(1 + citations): a domain cited 200 times is a better bet than one cited
//     20 times, but it is not ten times better — both are clearly sources the
//     engines trust, and a linear term would let one prolific domain flatten
//     every other row in the list to a rounding error. log1p and not log
//     because a domain cited once must score above zero, not at negative
//     infinity.
//
//   engines (the spread): a domain three engines cite is worth more than one
//     cited three times by the same engine. LINEAR, deliberately: the ceiling is
//     the number of engines we ask, which is small, so there is no long tail for
//     a log to compress and dampening it would make the term nearly constant.
//
//   rivalCitations (the lift): how much ground this domain is currently giving
//     away to competitors. Linear for the same reason a backlink from a page
//     that already recommends three competitors is worth chasing three times as
//     hard as one that recommends one.
//
// Every term is >= its floor by construction (see `computeImpact`), so impact is
// MONOTONE NON-DECREASING in each of the three inputs independently. That is the
// property the ranking rests on and tests/citation-opportunities.test.ts asserts
// it directly rather than trusting the formula to keep it.
//
// ── The score is ordinal, not a number the customer should read ─────────────
// It has no unit. It is not dollars, not traffic, not a probability. The UI
// therefore RANKS by it and never prints it, and the copy never implies that
// getting listed causes a recommendation — see the method note in
// CITATION_OPPORTUNITIES_COPY, which exists for exactly that reason.
//
// ── NO AI CALLS IN v1 ───────────────────────────────────────────────────────
// The how-tos below are templates chosen by `kind`. That is a deliberate
// ceiling, not a placeholder: a generated paragraph per domain would cost money
// on a weekly sweep, would vary run to run for a row the customer is trying to
// work through, and is not obviously better than "claim your listing and make
// sure the name, address and phone match your other listings exactly".

import type { CitationKind } from "@/generated/prisma";

/** The three effort bands, in increasing order of work. */
export type OpportunityEffort = "LOW" | "MED" | "HIGH";

/** The customer-owned states. */
export type OpportunityStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "DISMISSED";

export const OPPORTUNITY_EFFORTS: readonly OpportunityEffort[] = ["LOW", "MED", "HIGH"];

export const OPPORTUNITY_STATUSES: readonly OpportunityStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "DONE",
  "DISMISSED",
];

/**
 * Effort by publication kind.
 *
 * The question each answer is really answering is "who has to say yes".
 *
 *   DIRECTORY  — nobody. You fill in a form and claim the listing.
 *   SOCIAL     — nobody. You create the profile.
 *   REVIEW_SITE— nobody to be listed, but the listing is worthless without
 *                reviews on it, and reviews come from customers. Hence MED
 *                rather than LOW: claiming the profile is the easy half.
 *   BLOG       — one editor, reachable by email, low stakes on their side.
 *   NEWS       — a journalist with a beat, a news hook and an inbox that is
 *                already full. Weeks, and most pitches fail.
 *   GOV        — an eligibility rule you either meet or do not. No amount of
 *                outreach moves a registry that has decided you do not qualify.
 *   OTHER      — unknown, so MED: the middle band is the honest answer when the
 *                classifier could not say what the page is, and it neither
 *                buries the row nor floats it to the top on no evidence.
 */
export const EFFORT_BY_KIND: Record<CitationKind, OpportunityEffort> = {
  DIRECTORY: "LOW",
  SOCIAL: "LOW",
  REVIEW_SITE: "MED",
  BLOG: "MED",
  OTHER: "MED",
  NEWS: "HIGH",
  GOV: "HIGH",
};

/**
 * The denominator of `priority`.
 *
 * 1 / 2 / 3, matching Recommendation.effort's "1 (an afternoon) to 5 (a
 * quarter)" scale at the three points this feature can actually distinguish.
 * Priority is impact / weight, the same shape Recommendation.priority uses, so
 * the two ranked lists in this product are ranked by comparable arithmetic.
 */
export const EFFORT_WEIGHT: Record<OpportunityEffort, number> = {
  LOW: 1,
  MED: 2,
  HIGH: 3,
};

/** The three measurements one domain contributes, already summed per tenant. */
export interface OpportunitySignals {
  /** Total citations of this domain across the tenant's brand profiles. */
  seenCount: number;
  /** Distinct engines that have cited it. `engineSpread`. */
  engineSpread: number;
  /** Sum of the per-rival citation counts from this domain. `rivalLift`. */
  rivalLift: number;
}

/**
 * impact = log(1 + citations) x engines x rivalCitations.
 *
 * Every input is floored at its minimum meaningful value rather than trusted:
 * these are summed out of JSON columns written by a different feature, and a
 * negative or NaN term would produce a silently mis-ranked list rather than a
 * loud failure. The floors are 0 for the count (log1p(0) = 0) and 1 for the two
 * multipliers, so a domain that qualified as an opportunity — which requires at
 * least one engine and at least one rival citation — can never score zero
 * because a column was missing.
 */
export function computeImpact(signals: OpportunitySignals): number {
  const seen = Math.max(0, finite(signals.seenCount));
  const engines = Math.max(1, finite(signals.engineSpread));
  const rivals = Math.max(1, finite(signals.rivalLift));
  return Math.log1p(seen) * engines * rivals;
}

/** impact / effort weight. The number the worklist sorts on. */
export function computePriority(impact: number, effort: OpportunityEffort): number {
  return impact / EFFORT_WEIGHT[effort];
}

export function effortForKind(kind: CitationKind): OpportunityEffort {
  return EFFORT_BY_KIND[kind] ?? "MED";
}

/** NaN/Infinity/undefined all collapse to 0 rather than poisoning the product. */
function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * The 75th percentile of a set of priorities, by nearest-rank.
 *
 * NEAREST-RANK, NOT INTERPOLATED, and the difference matters here. The
 * notification fires on `priority > p75`, and an interpolated p75 sits between
 * two observed values, so with three rows it would fire for the top one on
 * essentially every sweep. Nearest-rank returns a value that IS in the set, and
 * a strict `>` against it means a tenant with fewer than five opportunities
 * gets at most one alert — which is the right volume for a weekly job whose
 * whole output is a list the customer is about to read anyway.
 *
 * Returns null for an empty set: there is no p75 of nothing, and a caller that
 * substituted 0 would alert on every row of a tenant's first sweep.
 */
export function p75(values: readonly number[]): number | null {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  // ceil(0.75 n) is the nearest-rank index, 1-based; clamped for n = 1.
  const rank = Math.max(1, Math.ceil(0.75 * sorted.length));
  return sorted[rank - 1]!;
}

// ─── How-to templates ───────────────────────────────────────────────────────

/**
 * What the English `howTo` column gets. See the schema comment on that column:
 * this is the FALLBACK and the durable record, not what the dashboard renders —
 * the UI reads the localized catalog keyed on the same `kind`, so a French
 * customer gets French. Storing it anyway is what makes an export, an API
 * consumer and next year's audit see the advice as it was given this week.
 *
 * `{domain}` and `{theme}` are the only placeholders, and both are interpolated
 * here rather than at read time so the stored string is complete prose.
 */
export interface HowToInput {
  domain: string;
  kind: CitationKind;
  /** One of the brand's own topics, for the kinds whose template pitches. */
  theme?: string | null;
}

/** Kinds whose template interpolates `{theme}`. The rest ignore it. */
export const THEME_KINDS: readonly CitationKind[] = ["NEWS", "BLOG"];

export function usesTheme(kind: CitationKind): boolean {
  return THEME_KINDS.includes(kind);
}

const HOW_TO_TEMPLATES: Record<CitationKind, string> = {
  // NAP is the one thing a directory listing can get wrong in a way that costs
  // you elsewhere, so it is named explicitly rather than left to "fill it in".
  DIRECTORY:
    "Claim or create your listing on {domain}. Use exactly the same name, address and phone number as your other listings — a directory that disagrees with the rest of the web is worse than no listing, because it splits the record of who you are.",
  REVIEW_SITE:
    "Claim your profile on {domain}, then ask recent customers to review you there. A profile with no reviews is rarely quoted. The Campaigns tool at /campaigns can send the ask to customers you already have.",
  NEWS:
    "Pitch {domain} a story, not a company. The angle with the best odds is the one your buyers already ask about — {theme} — told with a number or a case only you have. Find the reporter who covers that beat and mail them directly.",
  BLOG:
    "Offer {domain} a guest post or a contribution on {theme}. Independent blogs answer email far more often than newsrooms do, and a single post that genuinely answers the question is enough to become the page an engine reads.",
  GOV:
    "Check whether you qualify for a listing or register on {domain}. Public-sector sources are eligibility, not outreach: if you meet the criteria the listing is close to automatic, and if you do not, no amount of pitching will change it. Read the criteria before you spend time here.",
  SOCIAL:
    "Create or complete your presence on {domain}, and make sure it describes what you actually sell. Engines quote these because they are public and current, so a profile that is three years stale is a source arguing against you.",
  OTHER:
    "Work out what {domain} is before you act on it. Open the page the engines cited, see whether it accepts submissions, listings, guest posts or corrections, and treat it as whichever of those it turns out to be.",
};

/** The English how-to for one row. Never returns an empty string. */
export function buildHowTo(input: HowToInput): string {
  const template = HOW_TO_TEMPLATES[input.kind] ?? HOW_TO_TEMPLATES.OTHER;
  return template
    .replace(/\{domain\}/g, input.domain)
    // A brand with no topics configured falls back to prose that still parses:
    // "the questions your buyers ask" is what {theme} is a specific case of, so
    // the sentence stays true rather than reading "...ask about — undefined".
    .replace(/\{theme\}/g, input.theme?.trim() || "the questions your buyers ask");
}

// ─── The scored row ─────────────────────────────────────────────────────────

/** One domain, aggregated to the tenant grain, ready to score. */
export interface OpportunityCandidate extends OpportunitySignals {
  domain: string;
  kind: CitationKind;
}

/** What ./store.ts writes. */
export interface ScoredOpportunity {
  domain: string;
  kind: CitationKind;
  impact: number;
  priority: number;
  effort: OpportunityEffort;
  howTo: string;
  theme: string | null;
}

/**
 * Score one candidate.
 *
 * `theme` is stored only for the kinds that actually interpolate it, so a
 * DIRECTORY row does not carry a topic its advice never mentions — a column
 * with a value nothing reads is a column somebody eventually reads by mistake.
 */
export function scoreCandidate(
  candidate: OpportunityCandidate,
  theme?: string | null,
): ScoredOpportunity {
  const effort = effortForKind(candidate.kind);
  const impact = computeImpact(candidate);
  const applicableTheme = usesTheme(candidate.kind) ? (theme?.trim() || null) : null;

  return {
    domain: candidate.domain,
    kind: candidate.kind,
    impact,
    priority: computePriority(impact, effort),
    effort,
    howTo: buildHowTo({ domain: candidate.domain, kind: candidate.kind, theme: applicableTheme }),
    theme: applicableTheme,
  };
}

/**
 * Score a whole sweep, best first.
 *
 * Ties broken by domain so two rows with identical signals — which happens the
 * week a brand is first tracked and every source has been seen once — land in a
 * stable order rather than whatever the database returned.
 */
export function scoreAll(
  candidates: readonly OpportunityCandidate[],
  theme?: string | null,
): ScoredOpportunity[] {
  return candidates
    .map((candidate) => scoreCandidate(candidate, theme))
    .sort((a, b) => b.priority - a.priority || a.domain.localeCompare(b.domain));
}
