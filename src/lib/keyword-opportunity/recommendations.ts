// src/lib/keyword-opportunity/recommendations.ts
//
// What to actually do about a keyword, derived from the same facts that scored
// it.
//
// DERIVED, NOT STORED AS PROSE. The actions are ids; the sentences live in the
// i18n catalogs beside every other user-facing string. Storing the wording on
// the row would put English in the database and render it on the French
// dashboard, and it would freeze advice that should follow the row's state —
// a keyword that starts ranking should stop being told to build a page for it.
//
// EVERY ACTION HAS A CONDITION EXCEPT THE LAST. "Re-run the domain analysis
// after you ship" is always offered because it is always true and it is the
// step that closes the loop; the other four are only offered when the row
// actually supports them. A recommendation list that is the same five bullets
// on every row is a list nobody reads twice.

import type { OpportunityRow, RecommendedActionId } from "./types";

/** Below this Google rank there is no page of ours worth improving yet. */
export const LANDING_PAGE_RANK_THRESHOLD = 20;

/**
 * The actions offered on one keyword, in the order they should be worked.
 *
 * Takes the row's facts rather than the row itself so it can be called before
 * the row is assembled — ./fixtures.ts does exactly that.
 */
export function recommendedActions(input: {
  googleRank: number | null;
  intent: string;
  aiTested: boolean;
  aiMentioned: boolean | null;
  rivalsInAnswer: number;
}): RecommendedActionId[] {
  const actions: RecommendedActionId[] = [];

  // Nothing to improve means something to build. Null rank covers both the
  // untracked keyword and the one ranking past 100 — in either case there is no
  // position to defend.
  if (input.googleRank === null || input.googleRank > LANDING_PAGE_RANK_THRESHOLD) {
    actions.push("landing_page");
  }

  // Only worth suggesting when we know who is being recommended instead. On an
  // untested keyword we have no rivals to compare against and would be guessing.
  if (input.rivalsInAnswer > 0) {
    actions.push("competitor_comparison");
  }

  // Assistants quote figures they can find. A buying-intent keyword whose
  // answer omits the brand usually omits it because there is nothing quotable.
  if (input.intent === "transactional" || input.intent === "commercial_investigation") {
    actions.push("pricing_proof");
  }

  // The one action aimed at the answer rather than the site: an assistant that
  // never names the brand is reading sources that never name it either.
  if (input.aiTested && input.aiMentioned === false) {
    actions.push("external_citations");
  }

  actions.push("rerun");
  return actions;
}

/** Convenience wrapper for a row that is already assembled. */
export function actionsForRow(row: OpportunityRow): RecommendedActionId[] {
  return recommendedActions({
    googleRank: row.googleRank,
    intent: row.intent,
    aiTested: row.aiTested,
    aiMentioned: row.ai === null ? null : row.ai.mentioned,
    rivalsInAnswer: row.result?.competitors.length ?? 0,
  });
}
