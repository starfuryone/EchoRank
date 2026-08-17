// src/lib/keyword-opportunity/prompts.ts
//
// Turning a keyword into the question a buyer would actually ask an assistant,
// and the one filter that is not negotiable.
//
// ── THE BRAND IS NEVER IN A KEYWORD-DERIVED PROMPT ──────────────────────────
//
// The Watcher learned this the expensive way and wrote it down in
// ai-monitor/wizard/suggest.ts: a live run had the generator ignore its own
// system prompt and return comparison questions naming the brand outright, and
// every "mention" the resulting checkup recorded came from those questions. A
// mention rate of 20% and a score of 24.7 were measuring our own typing. The
// customer would have read it as organic reach they did not have.
//
// The same failure here would be worse, because the number it corrupts is the
// aiGap component — a full quarter of the Opportunity Score — and it would
// corrupt it in the flattering direction. A prompt naming AcmeCRM gets AcmeCRM
// into the answer, aiGap collapses toward 0, and the keyword drops out of the
// recommendations it should have led. The tool would then be quietest about
// exactly the keywords it exists to find.
//
// So the rule is a filter, not an instruction, and it reuses the Watcher's:
// namesBrand() is whole-word matching over accent-folded text, which catches
// "Écho Rank 360" without catching "Ada" inside "Canada".
//
// NO BRAND_AWARENESS EXEMPTION HERE, and that is the one difference from
// withoutBrandNaming() next door. That function exempts the one category whose
// purpose is asking about the brand directly. This feature has no such
// category: every prompt is derived from a commercial keyword and exists to
// find out whether an assistant volunteers the brand unprompted. A named brand
// is always a bug here, so the filter is unconditional and a caller cannot opt
// out of it.

import { namesBrand } from "@/lib/ai-monitor/wizard/suggest";
import type { OpportunityPrompt } from "./types";

/**
 * Split candidates into the ones that may be asked and the ones that must not.
 *
 * DROPPED, NOT EDITED. A question with the brand cut out of it is a different
 * question, and one nobody checked reads naturally — the Watcher's note makes
 * the same call for the same reason.
 */
export function withoutBrandNamedPrompts<T extends { text: string }>(
  candidates: readonly T[],
  aliases: readonly string[],
): { kept: T[]; dropped: T[] } {
  const usable = aliases.filter((alias) => alias != null && alias.trim() !== "");
  const kept: T[] = [];
  const dropped: T[] = [];

  for (const candidate of candidates) {
    // An empty alias list cannot match anything, and treating that as "nothing
    // to filter" would let a misconfigured project through the one gate that
    // must not be optional. A brand with no name is a caller bug; refuse the
    // batch rather than pass it.
    if (usable.length === 0 || namesBrand(candidate.text, usable)) {
      dropped.push(candidate);
    } else {
      kept.push(candidate);
    }
  }

  return { kept, dropped };
}

/** Whether one prompt is safe to ask for a brand with these aliases. */
export function isAskablePrompt(prompt: OpportunityPrompt, aliases: readonly string[]): boolean {
  return withoutBrandNamedPrompts([prompt], aliases).kept.length === 1;
}
