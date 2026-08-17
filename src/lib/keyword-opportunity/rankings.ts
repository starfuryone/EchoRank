// src/lib/keyword-opportunity/rankings.ts
//
// Step 3: where the tenant already ranks, read from the Rank Tracker they are
// already paying for.
//
// ── NOTHING IS BOUGHT HERE ──────────────────────────────────────────────────
//
// A keyword we do not track gets a NULL rank, and null scores seoGapScore 100 —
// the widest possible gap. Buying a SERP check to fill that gap would cost
// $0.0006 a keyword across a hundred keywords, turn a $0.15 analysis into a
// $0.21 one, and buy an answer the scorer does not need: "we do not rank for
// this" and "we rank 87th for this" lead to the same recommendation. The
// tracker exists, its data is free to read, and what it does not know is itself
// a finding.
//
// ── TWO KINDS OF NULL, KEPT APART ───────────────────────────────────────────
//
// They score identically and they are not the same fact:
//
//   untracked  no RankKeyword row at all. We have never looked.
//   tracked    a RankKeyword row whose latest completed snapshot has
//              position null, which RankSnapshot documents as "the domain did
//              not appear in the top 100 — a real, meaningful result, NOT
//              missing data".
//
// The scorer takes both as null. The row stores which, so the detail panel can
// say "not tracked" rather than implying we checked and found nothing, and so
// a future "add these to your Rank Tracker" prompt can target the first set.
//
// ── LATEST COMPLETED, NOT LATEST ────────────────────────────────────────────
//
// RankSnapshot rows are written `queued` at task_post and completed by the
// shared sweep, so the newest row for a keyword is frequently a queued one with
// a null position that means "not answered yet". Reading it would report every
// freshly-scheduled keyword as unranked, which on a daily-frequency project is
// most of them every morning.

import { prisma } from "@/lib/prisma";

/** How a keyword's rank was resolved. See the header. */
export type RankSource = "untracked" | "tracked";

export interface RankLookup {
  /** 1-100, or null. Null from either source — check `source` for which. */
  rank: number | null;
  source: RankSource;
}

/** Keyed by lowercased keyword, matching discover.ts keywordKey(). */
export type RankIndex = ReadonlyMap<string, RankLookup>;

function key(keyword: string): string {
  return (keyword ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Every tracked keyword for one tenant's projects on one domain, with its
 * latest completed position.
 *
 * `domain` must already be normalised — RankProject.domain stores the
 * registrableDomain() form ("no scheme, no www., no path"), so the caller
 * passes the same. A tenant with two projects on one domain (different
 * location or device) contributes both; the BEST position wins, because a
 * customer ranking 4th on mobile and 40th on desktop has a page that works and
 * the opportunity is smaller than the worse number suggests.
 */
export async function rankingsForDomain(
  tenantId: string,
  domain: string,
): Promise<RankIndex> {
  const projects = await prisma.rankProject.findMany({
    where: { tenantId, domain },
    select: {
      keywords: {
        select: {
          keyword: true,
          snapshots: {
            where: { status: "completed" },
            orderBy: { runDate: "desc" },
            take: 1,
            select: { position: true },
          },
        },
      },
    },
  });

  const index = new Map<string, RankLookup>();

  for (const project of projects) {
    for (const tracked of project.keywords) {
      const k = key(tracked.keyword);
      if (k === "") continue;

      // No completed snapshot yet is still TRACKED — the tenant asked for this
      // keyword and we simply have not answered. Reporting it as untracked
      // would invite them to add a keyword they already have.
      const position = tracked.snapshots[0]?.position ?? null;
      const existing = index.get(k);

      if (!existing) {
        index.set(k, { rank: position, source: "tracked" });
        continue;
      }
      if (existing.rank === null) {
        index.set(k, { rank: position, source: "tracked" });
        continue;
      }
      if (position !== null && position < existing.rank) {
        index.set(k, { rank: position, source: "tracked" });
      }
    }
  }

  return index;
}

/** The rank for one keyword, defaulting to untracked. */
export function rankFor(index: RankIndex, keyword: string): RankLookup {
  return index.get(key(keyword)) ?? { rank: null, source: "untracked" };
}

/** Every keyword the tenant tracks on this domain, for the discovery merge. */
export function trackedKeywordsFrom(index: RankIndex): string[] {
  return [...index.keys()];
}
