// src/lib/citations/aggregate.ts
//
// The Citation Finder arithmetic: many citations in, one row per domain out.
//
// PURE. No prisma, no clock, no config. ./store.ts hands it rows and writes
// what it returns, which is the same split sov/weighting.ts and sov/store.ts
// use — every decision worth arguing about is in here with a test around it,
// and what is left over there is SQL.
//
// ── "Cites you" is measured on the ANSWER, not the sentence ─────────────────
// Citation.supportsBrand already exists and asks a narrower question: was the
// specific claim this link was attached to about the brand. This module
// deliberately does not use it. The product question is "does this source ever
// put us in front of the reader", and an answer that recommends us in its
// opening line and cites g2.com three paragraphs later has put us in front of
// the reader via g2.com. Sentence-level attribution is also the sparsest field
// on the row — it is null-ish far more often than brandMentioned is wrong — so
// scoring on it would systematically UNDERCOUNT the brand and overstate the
// "never mentions you" list, which is the one list this tool exists to produce.
// Getting that list wrong in the alarming direction is the failure mode to
// avoid.
//
// ── The either/or ───────────────────────────────────────────────────────────
// A citation counts for the brand or for the rivals in its answer, never both.
// An answer naming us AND three rivals is an answer where we were present;
// counting it into citesCompetitors as well would make "sources that never
// mention you" match sources that mention us constantly.

import type { CitationKind } from "@/generated/prisma";
import { classifyDomain } from "./classify";
import { normalizeEngine } from "@/lib/sov/observations";

/**
 * One citation, with the answer-level facts it inherits from its run.
 *
 * Flat rather than nested so the aggregator never has to know how the join was
 * shaped — ./store.ts owns that, and the tests build these by hand.
 */
export interface CitationObservation {
  /** Registrable domain, already normalised by the writer. */
  domain: string;
  /** PromptRun.engine, in whatever case the writer left it. */
  engine: string;
  /** Did the ANSWER this citation appeared in name the tracked brand? */
  brandMentioned: boolean;
  /** Rivals named in that same answer, already filtered to real entities. */
  competitors: readonly string[];
  /** Citation.createdAt — drives firstSeenAt / lastSeenAt. */
  createdAt: Date;
}

/** One `sources` row, as the aggregator wants it written. */
export interface SourceRollupRow {
  domain: string;
  kind: CitationKind;
  /** Total citations of this domain in the scope. `seenCount`. */
  citationCount: number;
  /** { engine: citations }. Its key count is `distinctEngines`. */
  enginesSeen: Record<string, number>;
  distinctEngines: number;
  /** Citations from answers that named the brand. `citesYou` is this > 0. */
  brandCitations: number;
  /** Citations from answers that named a rival and NOT the brand. */
  competitorCitations: number;
  /** { rival: citations }, summing to competitorCitations. */
  citesCompetitors: Record<string, number>;
  /** Every distinct name this domain has been observed beside, brand included. */
  brandsSupported: string[];
  firstSeenAt: Date;
  lastSeenAt: Date;
}

/**
 * Roll observations up by registrable domain.
 *
 * ONE PASS, INSERTION-ORDERED. The Map preserves first-seen order so a caller
 * that wants a stable list without sorting gets one; the read model sorts for
 * display anyway, and the aggregator's own output order never reaches a user.
 *
 * Domains are NOT re-normalised here. They arrive already run through
 * registrableDomain() by the code that wrote the Citation row, and normalising
 * twice would let this module and the writer disagree about the join key that
 * Citation.domain and Source.domain are supposed to share. classifyDomain()
 * normalises internally for its own lookup, which is a different concern.
 */
export function aggregateCitations(
  observations: readonly CitationObservation[],
  brandName: string,
): SourceRollupRow[] {
  const byDomain = new Map<string, SourceRollupRow>();

  for (const observation of observations) {
    const domain = observation.domain;
    // A citation with no domain has no rollup to belong to. extractCitations()
    // already drops these upstream; this is the belt to that's braces, because
    // an empty-string key would collect every malformed row into one fake
    // source and put it at the top of a list sorted by count.
    if (!domain) continue;

    let row = byDomain.get(domain);
    if (!row) {
      row = {
        domain,
        kind: classifyDomain(domain),
        citationCount: 0,
        enginesSeen: {},
        distinctEngines: 0,
        brandCitations: 0,
        competitorCitations: 0,
        citesCompetitors: {},
        brandsSupported: [],
        firstSeenAt: observation.createdAt,
        lastSeenAt: observation.createdAt,
      };
      byDomain.set(domain, row);
    }

    row.citationCount += 1;

    const engine = normalizeEngine(observation.engine);
    if (engine) {
      row.enginesSeen[engine] = (row.enginesSeen[engine] ?? 0) + 1;
    }

    if (observation.brandMentioned) {
      row.brandCitations += 1;
      if (!row.brandsSupported.includes(brandName)) row.brandsSupported.push(brandName);
    } else {
      // Deduped within the answer: a rival named four times in one answer was
      // named by one answer, and this counts CITATIONS attributable to it, not
      // mentions. Without this a verbose answer would outweigh four terse ones.
      for (const rival of new Set(observation.competitors)) {
        const name = rival.trim();
        if (!name || name === brandName) continue;
        row.citesCompetitors[name] = (row.citesCompetitors[name] ?? 0) + 1;
        if (!row.brandsSupported.includes(name)) row.brandsSupported.push(name);
      }
      // One per CITATION, not per rival: three rivals in one answer is one
      // citation that went to the competition. This is what keeps
      // brandCitations + competitorCitations <= citationCount, which is the
      // invariant the "cites you / cites them" ratio is read against.
      if (observation.competitors.length > 0) row.competitorCitations += 1;
    }

    if (observation.createdAt < row.firstSeenAt) row.firstSeenAt = observation.createdAt;
    if (observation.createdAt > row.lastSeenAt) row.lastSeenAt = observation.createdAt;
  }

  for (const row of byDomain.values()) {
    row.distinctEngines = Object.keys(row.enginesSeen).length;
  }

  return [...byDomain.values()];
}

/**
 * Merge a freshly-computed row into the one already stored.
 *
 * WHY THIS EXISTS: the nightly job aggregates a WINDOW, not all of history, so
 * its rows are a delta over a table that already holds earlier windows. Writing
 * them straight would make a domain's count fall every time it aged out of the
 * window — a source cited fifty times last year would read as cited twice.
 *
 * ADDITIVE ON EVERY COUNTER, MAX ON lastSeenAt, MIN ON firstSeenAt. The counts
 * add because they are counts of distinct citation rows, and the job's window
 * is chosen (see store.ts) so that consecutive runs do not overlap — a citation
 * is counted by exactly one night's job.
 */
export function mergeRollup(
  stored: Pick<
    SourceRollupRow,
    | "citationCount"
    | "enginesSeen"
    | "brandCitations"
    | "competitorCitations"
    | "citesCompetitors"
    | "brandsSupported"
    | "firstSeenAt"
    | "lastSeenAt"
  >,
  fresh: SourceRollupRow,
): SourceRollupRow {
  const enginesSeen = { ...stored.enginesSeen };
  for (const [engine, count] of Object.entries(fresh.enginesSeen)) {
    enginesSeen[engine] = (enginesSeen[engine] ?? 0) + count;
  }

  const citesCompetitors = { ...stored.citesCompetitors };
  for (const [rival, count] of Object.entries(fresh.citesCompetitors)) {
    citesCompetitors[rival] = (citesCompetitors[rival] ?? 0) + count;
  }

  return {
    domain: fresh.domain,
    // Re-classified from the current rules on every merge, so a change to
    // classify.ts takes effect on the next rollup without a separate backfill.
    kind: fresh.kind,
    citationCount: stored.citationCount + fresh.citationCount,
    enginesSeen,
    distinctEngines: Object.keys(enginesSeen).length,
    brandCitations: stored.brandCitations + fresh.brandCitations,
    competitorCitations: stored.competitorCitations + fresh.competitorCitations,
    citesCompetitors,
    brandsSupported: [...new Set([...stored.brandsSupported, ...fresh.brandsSupported])],
    firstSeenAt:
      stored.firstSeenAt < fresh.firstSeenAt ? stored.firstSeenAt : fresh.firstSeenAt,
    lastSeenAt: stored.lastSeenAt > fresh.lastSeenAt ? stored.lastSeenAt : fresh.lastSeenAt,
  };
}
