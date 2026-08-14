// src/lib/sov/observations.ts
//
// Watcher run rows -> SovObservation. Pure; the query that produces the rows
// lives in ./store.ts.
//
// THIS IS THE ONLY PLACE THAT INTERPRETS WATCHER DATA, and it interprets it by
// the same rules the Watcher's own panels use. Where a choice here could
// disagree with src/lib/ai-monitor/metrics.ts — which name is a rival, how two
// spellings collapse into one entity — this file copies that module's rule
// rather than inventing a second one, because two answers to "how many
// competitors are there" on two pages of one product is a support ticket.

import { brandKey, type SovObservation } from "./weighting";

/**
 * One analysed run, as ./store.ts selects it.
 *
 * `analysis` is nullable because MentionAnalysis is written by a pass that can
 * fail or quarantine — a run with no analysis was answered but never read, and
 * contributes nothing rather than counting as an absence.
 */
export interface SovRunRow {
  engine: string;
  promptId: string;
  analysis: {
    brandMentioned: boolean;
    /** MentionAnalysis.recommendationPosition — the brand's rank. */
    recommendationPosition: number | null;
  } | null;
  competitorMentions: readonly {
    name: string;
    /** CompetitorMention.recommendationPosition — the rival's rank. */
    recommendationPosition: number | null;
    /** EntityClass, or null for a row written before the classifier existed. */
    classification: string | null;
  }[];
}

/**
 * Who counts as an entity in the universe.
 *
 * RIVAL and unclassified only. The exclusion is not a judgement call — it is
 * EntityClass's own documented contract ("RIVAL: the only class the rollup
 * counts") and the rule topCompetitors() already applies. A share of voice that
 * reports OpenAI owning 40% of a CRM vendor's category, because every answer
 * mentions ChatGPT, measures nothing anybody can act on.
 *
 * NULL IS INCLUDED, deliberately. Null means "not yet judged", not "not a
 * rival": every CompetitorMention written before the classifier shipped carries
 * it, and excluding them would silently empty the universe for the entire
 * history this feature's 28-day window reaches back into.
 */
export function countsAsEntity(classification: string | null): boolean {
  return classification === null || classification === "RIVAL";
}

/**
 * Provider ids, folded to one case.
 *
 * PromptRun.engine holds `EngineSpec.provider` ("CLAUDE", "PERPLEXITY") for
 * every row the checkup runner writes, but the column's default is the
 * lowercase "claude" the pre-checkup scheduler left on its rows. Without this
 * fold those legacy rows would stack up as a second engine called "claude"
 * beside "CLAUDE", and the page would render two Claude columns.
 */
export function normalizeEngine(engine: string): string {
  return engine.trim().toUpperCase();
}

export interface BrandIdentity {
  /** BrandProfile.name — the label every own-brand observation carries. */
  name: string;
  /** BrandProfile.aliases — other spellings that mean the same company. */
  aliases: readonly string[];
}

/**
 * Flatten runs into one observation per (run, entity).
 *
 * THE BRAND AND ITS RIVALS ARE MEASURED ON ONE SCALE. The brand's rank comes
 * from MentionAnalysis.recommendationPosition and a rival's from
 * CompetitorMention.recommendationPosition — the same field, written from the
 * same LLM ranking pass in one call (see metrics-store.ts persistRunAnalysis).
 * That symmetry is what makes the comparison fair, and it is why neither side
 * falls back to a field the other does not have: MentionAnalysis also carries
 * `listPosition`, which has no counterpart on CompetitorMention, and using it
 * for the brand alone would hand our own brand a real rank while every rival
 * kept the unpositioned 0.3 — a systematic thumb on the scale in the customer's
 * favour, on the one number the whole product is about.
 *
 * A competitor row naming the brand itself (or one of its aliases) is folded
 * into the brand rather than counted beside it: the analyzer occasionally lists
 * the monitored company among the alternatives, and a universe holding both
 * "Echorank360" the brand and "Echorank" the rival splits one company's share
 * in two and reports it as competition with itself.
 */
export function toObservations(
  runs: readonly SovRunRow[],
  brand: BrandIdentity,
): SovObservation[] {
  const ownKeys = new Set(
    [brand.name, ...brand.aliases].map(brandKey).filter((key) => key !== ""),
  );

  const observations: SovObservation[] = [];

  for (const run of runs) {
    const engine = normalizeEngine(run.engine);
    // Deduped per run: if a rival row and the brand's own alias both resolve to
    // the brand, the answer still named the brand exactly once.
    const seen = new Set<string>();

    if (run.analysis?.brandMentioned) {
      seen.add(brandKey(brand.name));
      observations.push({
        engine,
        promptId: run.promptId,
        brand: brand.name,
        rank: run.analysis.recommendationPosition,
      });
    }

    for (const mention of run.competitorMentions) {
      const name = mention.name.trim();
      if (name === "") continue;
      if (!countsAsEntity(mention.classification)) continue;

      const key = brandKey(name);
      // The brand under another spelling. Carries the brand's own label so it
      // lands in the brand's bucket, not in a bucket of its own.
      const isOwn = ownKeys.has(key);
      const label = isOwn ? brand.name : name;
      const dedupeKey = isOwn ? brandKey(brand.name) : key;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      observations.push({
        engine,
        promptId: run.promptId,
        brand: label,
        rank: mention.recommendationPosition,
      });
    }
  }

  return observations;
}
