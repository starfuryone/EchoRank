// src/lib/explain/types.ts
//
// The shared vocabulary of the AI Competitor Reverse Engineer: what a factor
// is, what "we could not measure this" means, and what a fix can point at.
//
// ── Why `unavailable` is a first-class field ────────────────────────────────
// Four of the six gatherers can legitimately return nothing: two read tables
// whose writers are nightly/weekly jobs that may not have run yet, one needs a
// Places id a SaaS rival does not have, and one needs upstream budget that may
// be spent. The obvious design — omit the factor — is wrong, because "we did
// not measure your share of voice" and "your share of voice is fine" render
// identically as an absent row, and the customer cannot tell which they are
// looking at. Every factor is therefore ALWAYS present, and an unmeasured one
// says out loud why.
//
// This is the same bar `sources.brandCitations > 0` sets in Citation Finder: a
// derived truth the UI can state, never a silence the reader has to interpret.

import type { RecommendationType } from "@/generated/prisma";

/**
 * The six things a rival can be beating you at.
 *
 * A closed set, deliberately. The factors are what the six gatherers produce,
 * and a seventh would need a gatherer, a weight, a fix mapping and a copy key —
 * so an open string here would only let one be half-added.
 */
export type FactorKey =
  | "share_of_voice"
  | "cited_sources"
  | "authority"
  | "entities"
  | "site_readiness"
  | "reviews";

export const FACTOR_KEYS: readonly FactorKey[] = [
  "share_of_voice",
  "cited_sources",
  "authority",
  "entities",
  "site_readiness",
  "reviews",
] as const;

/**
 * Why a factor carries no numbers.
 *
 * Distinct reasons rather than one "unknown", because they call for different
 * copy and different customer action: a tenant whose first SOV rollup has not
 * run tonight should be told to wait, and one whose monthly DataForSEO budget
 * is spent should be told to raise it. Collapsing those into "unavailable"
 * turns an answerable question into a shrug.
 */
export type FactorUnavailable =
  /** sov_snapshots has no row for this brand profile yet — the nightly
   *  aggregation has not run since the feature shipped. */
  | "awaiting_first_aggregation"
  /** citation_opportunities is empty — the weekly sweep has not run. Only ever
   *  set on the fix link, never on a factor's numbers. */
  | "awaiting_first_sweep"
  /** The rival has no Places id, which a SaaS competitor never will. */
  | "no_place_id"
  /** No API key configured for the provider this factor needs. */
  | "not_configured"
  /** The tenant's monthly USD cap was already reached — checked BEFORE the
   *  call, so this costs nothing to report. */
  | "cap_reached"
  /** The provider was asked and failed. Distinct from the above: it means the
   *  answer is buyable, just not right now. */
  | "upstream_failed";

/**
 * What the customer should go do about a factor.
 *
 * Three shapes, in descending order of how specific they are:
 *
 *   opportunity  a real CitationOpportunity row — a named domain to go get
 *                listed on, already scored and sitting in their worklist. The
 *                only shape that carries a working link, because the
 *                Citation Opportunities worklist is the only fix surface that
 *                currently exists.
 *   roadmap      the KIND of work this factor calls for, as a
 *                RecommendationType. Deliberately carries no id and no href:
 *                the `recommendations` table has no writer and no page in this
 *                app, so a link would be a 404 and an id would always be null.
 *                It names the work; it does not pretend to route to it.
 *   none         nothing to point at. NOT a failure state on its own: an
 *                unavailable factor has no fix by definition, and neither does
 *                a factor the customer is already winning.
 */
export type LinkedFix =
  | { kind: "none" }
  | { kind: "opportunity"; opportunityId: string; domain: string }
  | { kind: "roadmap"; type: RecommendationType };

/**
 * One ranked row of the report.
 *
 * `them` / `you` / `gap` are in the factor's own unit (percentage points for
 * share of voice, whole counts for citations and referring domains, a 0-100
 * score for site readiness, stars for reviews). They are NOT normalised,
 * because the number the customer reads should be the number the provider
 * reported. `severity` carries the normalisation the ranking needs.
 */
export interface ExplainFactor {
  factor: FactorKey;
  /** The rival's value, in the factor's own unit. Null when unavailable. */
  them: number | null;
  /** The tenant's own value, same unit. Null when unavailable. */
  you: number | null;
  /** them - you, in the same unit. Positive means the rival is ahead. Null
   *  when unavailable. */
  gap: number | null;
  /** 0..1, how far ahead the rival is on this factor after normalising its
   *  unit away. The input to the ranking; see factors.ts for each formula. */
  severity: number;
  /** severity x the factor's weight. The sort key. Negative for unavailable
   *  factors so they sink below every measured one. */
  score: number;
  /** Set only when the factor could not be measured. Its presence is what the
   *  UI keys the "not measured yet" state on. */
  unavailable?: FactorUnavailable;
  /**
   * English evidence line — "otterly.ai is cited by 4 sources that never cite
   * you". A FALLBACK, exactly like Notification.title and
   * CitationOpportunity.howTo: the UI renders the localized template keyed on
   * `factor`, and reads this only for a shape the catalog does not know.
   * Stored anyway because it is what an API consumer or a PDF export gets.
   */
  detail: string;
  linkedFix: LinkedFix;
}

/** What one gatherer hands back before ranking turns it into a factor. */
export type GatherOutcome<T> =
  | { ok: true; value: T; costUsd: number }
  | { ok: false; reason: FactorUnavailable; costUsd: number };

/** Per-prompt-and-engine place where the rival outranks the tenant. */
export interface SovGap {
  engine: string;
  /** Share in percentage points, 0..100. */
  theirShare: number;
  yourShare: number;
  promptCount: number;
}

/** A domain that cites the rival, with the tenant's own standing on it. */
export interface RivalSource {
  domain: string;
  /** Citations of this domain supporting the rival. Always > 0 — a source
   *  that never cites them is not evidence about them. */
  rivalCitations: number;
  /** Citations supporting the tenant's brand. Zero is the interesting case. */
  brandCitations: number;
  distinctEngines: number;
}

/** Places review standing for one business. */
export interface ReviewStanding {
  rating: number | null;
  reviewCount: number | null;
}

/** The av-visibility sidecar's passive read of a site. */
export interface SiteReadiness {
  /** 0-100 composite the sidecar reports. */
  score: number | null;
  /** Named checks that failed, for the evidence line. */
  failures: string[];
}

/** DataForSEO backlinks standing, the fields this feature ranks on. */
export interface AuthorityStanding {
  referringDomains: number;
  /** DataForSEO domain rank, 0-1000. */
  rank: number;
}

/** Which knowledge-graph entities exist for a domain's brand. */
export interface EntityPresence {
  wikipedia: boolean;
  wikidata: boolean;
  crunchbase: boolean;
}

/** Everything the six gatherers produced, before ranking. */
export interface ExplainGather {
  sovGaps: GatherOutcome<SovGap[]>;
  rivalSources: GatherOutcome<RivalSource[]>;
  reviews: GatherOutcome<{ them: ReviewStanding; you: ReviewStanding }>;
  site: GatherOutcome<{ them: SiteReadiness; you: SiteReadiness }>;
  authority: GatherOutcome<{ them: AuthorityStanding; you: AuthorityStanding }>;
  entities: GatherOutcome<{ them: EntityPresence; you: EntityPresence }>;
}

/** A stored report, as the API and the PDF both read it. */
export interface ExplainReportView {
  id: string;
  rivalDomain: string;
  rivalName: string;
  brandProfileId: string;
  factors: ExplainFactor[];
  costUsd: number;
  createdAt: string;
  /** True when this was served from storage rather than gathered now. */
  cached: boolean;
  /** ISO timestamp after which a re-run is permitted. */
  rerunAllowedAt: string;
}
