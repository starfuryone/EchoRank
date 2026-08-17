// src/lib/keyword-opportunity/types.ts
//
// The shapes the Keyword Opportunity Finder's read layer returns, and the ones
// the UI renders.
//
// DECLARED HERE RATHER THAN IN ./fixtures.ts SO THE DEMO CANNOT DRIFT. Phase 2
// ships the whole user-facing flow against a fixture; Phase 3 swaps the fixture
// for a Prisma read and must not change one prop on the client component. That
// only holds if the fixture is typed against the contract rather than being the
// contract, which is what this module is for.
//
// THE UNIT IS A "DOMAIN ANALYSIS". Not a search, not a scan, not a lookup —
// one run over one domain that discovers commercial keywords, scores them and
// AI-tests the top of the list. `seoSearchesPerMonth` already means something
// else in this codebase (the pooled DataForSEO allowance) and the two must
// never be spoken of in the same words.

import type { KeywordIntent, ScoredOpportunity } from "./score";

/**
 * An analysis's lifecycle.
 *
 * The same async-persisted shape as Checkup/CheckupStatus: the customer starts
 * one, leaves, and comes back to a finished result. NOT a synchronous endpoint
 * — a domain analysis buys keyword data, reads rankings and makes fifteen AI
 * calls, and none of that fits inside a request.
 */
export type AnalysisStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

/**
 * The steps the progress view names, in order.
 *
 * Exported as data rather than hardcoded in the component so the worker in
 * Phase 3 can report which one it is on against the same list, instead of the
 * UI inventing a narrative the backend does not share.
 */
export const ANALYSIS_STEPS = [
  "discover",
  "demand",
  "rankings",
  "ai",
  "score",
] as const;

export type AnalysisStep = (typeof ANALYSIS_STEPS)[number];

/**
 * A buyer question derived from one keyword.
 *
 * NEVER CONTAINS THE BRAND NAME. Prompts here are keyword-derived and exist to
 * find out whether an assistant volunteers the brand unprompted; one that names
 * it measures our own typing. The drop is enforced in code by
 * ai-monitor/wizard/suggest.ts namesBrand(), not by asking a model nicely —
 * see the note in ./prompts.ts.
 */
export interface OpportunityPrompt {
  text: string;
  intent: KeywordIntent;
}

/** One competitor as it appeared in one answer. */
export interface AnsweredCompetitor {
  name: string;
  /** 1-based place in that answer's ranked list. */
  position: number;
}

/** What one provider said when asked one prompt. */
export interface OpportunityPromptResult {
  provider: string;
  model: string;
  brandMentioned: boolean;
  /** 1-based. Null when the brand was named in prose but never ranked. */
  brandPosition: number | null;
  /**
   * The answer, as text.
   *
   * RENDERED AS TEXT AND ONLY AS TEXT. This string was written by another
   * vendor's model and is untrusted input — the same posture ai-monitor takes
   * when it feeds an answer to the extraction pass. No component may put it
   * through dangerouslySetInnerHTML, and none does.
   */
  answerSnapshot: string;
  competitors: AnsweredCompetitor[];
  /** ISO 8601. */
  checkedAt: string;
}

/**
 * The actions offered on a keyword, as ids rather than sentences.
 *
 * The wording lives in the i18n catalogs like every other user-facing string;
 * storing prose on the row would put English in the database and make the
 * French dashboard render it.
 */
export const RECOMMENDED_ACTIONS = [
  "landing_page",
  "competitor_comparison",
  "pricing_proof",
  "external_citations",
  "rerun",
] as const;

export type RecommendedActionId = (typeof RECOMMENDED_ACTIONS)[number];

/** One scored keyword with everything the detail panel needs. */
export interface OpportunityRow extends ScoredOpportunity {
  id: string;
  /** Null when the keyword fell outside the AI-tested top 15. */
  prompt: OpportunityPrompt | null;
  /** Null for the same reason. */
  result: OpportunityPromptResult | null;
  actions: RecommendedActionId[];
}

/**
 * A rival's presence across the analysis's AI answers.
 *
 * ACROSS THE ANALYSIS, NOT WITHIN ONE KEYWORD. Each keyword is asked once, so
 * a per-keyword percentage could only ever be 0 or 100 and would be a worse
 * number than the boolean it came from. The share that means something is "this
 * rival was named in 12 of the 15 answers we bought", and that is what the
 * detail panel shows beside the keyword.
 */
export interface CompetitorVisibility {
  name: string;
  /** Share of AI-tested answers naming them, 0-100. */
  sharePercent: number;
  /** Mean rank over the answers that ranked them. Null when none did. */
  averagePosition: number | null;
}

/**
 * Where the tenant stands before starting a domain analysis.
 *
 * SHAPE ONLY IN THIS PHASE. Nothing here is enforced yet — Phase 3 wires the
 * allowance counter, the credit ledger and the cache probe. What is fixed now
 * is the ORDER, because it is the part that is expensive to change later: a
 * cache hit is free, then the monthly allowance, then credits. See
 * ./entitlement.ts.
 */
export interface AnalysisEntitlement {
  /** The tier's monthly allowance. Null = unlimited. */
  allowanceTotal: number | null;
  allowanceUsed: number;
  /** Null when the allowance is unlimited. */
  allowanceRemaining: number | null;
  /** Prepaid domain-analysis credits. A pool of its own, not Places credits. */
  credits: number;
  /**
   * True when a completed analysis for this domain exists inside the 24h
   * window. A cache hit consumes neither allowance nor credits.
   */
  cacheHit: boolean;
}

/** One domain analysis, as the page renders it. */
export interface KeywordOpportunityAnalysis {
  id: string;
  domain: string;
  brandName: string;
  status: AnalysisStatus;
  /** The step in flight. Null unless status is RUNNING. */
  currentStep: AnalysisStep | null;
  scoreVersion: number;
  /** ISO 8601. */
  requestedAt: string;
  /** ISO 8601. Null until the analysis finishes. */
  completedAt: string | null;
  /** True when this result was served from the 24h cache. */
  fromCache: boolean;
  keywordCount: number;
  aiTestedCount: number;
  /** Distinct keywords found before the brand/navigational filter. */
  discoveredCount: number;
  /** Of those, how many were the customer's own brand or navigational. */
  brandedCount: number;
  /**
   * Why a COMPLETED analysis has no opportunities.
   *
   * "no_keywords_found" | "no_unbranded_keywords" | "ai_cap_reached", or null
   * on an ordinary run. NOT an error — a COMPLETED analysis with zero
   * opportunities is a result, and this says which result it is so the UI can
   * render the finding rather than a blank table.
   */
  emptyReason: string | null;
  /** Provider spend for this analysis, USD. */
  costUsd: number;
  rows: OpportunityRow[];
  competitors: CompetitorVisibility[];
  /** Set only when status is FAILED. */
  error: string | null;
}

/** Everything the tool page renders from. */
export interface KeywordOpportunityPageData {
  brandProfileId: string;
  brandName: string;
  domain: string;
  entitlement: AnalysisEntitlement;
  /** The most recent analysis, or null when the tenant has never run one. */
  analysis: KeywordOpportunityAnalysis | null;
}
