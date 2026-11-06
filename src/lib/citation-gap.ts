// src/lib/citation-gap.ts
//
// The citation gap: the domains AI answers cite when they name a competitor
// and not you. Those are the sources deciding answers you are missing from,
// so they are where to get listed, reviewed or discussed first.
//
// Ranked by how many such answers cited them, typed without a model call
// (citations/classify.ts plus a forum rule): review site, directory, forum,
// news, your own site, or other. Your own site can be in the gap: an engine
// cites your page and still names a rival instead of you.
//
// Pure and dependency-light: the free check's report and the paid dashboard
// both build their rows here, so the two cannot disagree on what a gap is.

import { classifyDomain } from "@/lib/citations/classify";
import { registrableDomain } from "@/lib/registrable-domain";

export type GapSourceType = "review_site" | "directory" | "forum" | "news" | "own_site" | "other";

export interface GapAnswer {
  brandMentioned: boolean;
  /** Competitors the answer names (any spelling; only "any?" matters here). */
  competitorsNamed: readonly string[];
  /** Domains or URLs the answer cites. */
  citedDomains: readonly string[];
}

export interface CitationGapRow {
  domain: string;
  /** Answers that named a competitor, not you, and cited this domain. */
  count: number;
  type: GapSourceType;
  /** The competitors named in those answers, most frequent first (up to 3). */
  competitors: string[];
}

/** Communities that classify.ts files under SOCIAL or OTHER but are forums here. */
const FORUM = /(^|\.)(reddit\.com|quora\.com|stackexchange\.com|stackoverflow\.com|tripadvisor\.[a-z.]+)$|forum|community|discourse|boards?\./;

export function gapSourceType(domain: string, ownDomain: string | null): GapSourceType {
  const d = registrableDomain(domain);
  if (ownDomain && d === registrableDomain(ownDomain)) return "own_site";
  if (FORUM.test(d)) return "forum";
  switch (classifyDomain(d)) {
    case "REVIEW_SITE":
      return "review_site";
    case "DIRECTORY":
      return "directory";
    case "NEWS":
      return "news";
    default:
      return "other";
  }
}

/** Every gap domain, most-cited first (ties alphabetical). */
export function citationGap(answers: readonly GapAnswer[], ownDomain: string | null): CitationGapRow[] {
  const byDomain = new Map<string, { count: number; competitors: Map<string, number> }>();
  for (const answer of answers) {
    if (answer.brandMentioned || answer.competitorsNamed.length === 0) continue;
    const domains = new Set(answer.citedDomains.map((d) => registrableDomain(d)).filter(Boolean));
    for (const domain of domains) {
      const bucket = byDomain.get(domain) ?? { count: 0, competitors: new Map<string, number>() };
      bucket.count += 1;
      for (const name of new Set(answer.competitorsNamed.map((n) => n.trim()).filter(Boolean))) {
        bucket.competitors.set(name, (bucket.competitors.get(name) ?? 0) + 1);
      }
      byDomain.set(domain, bucket);
    }
  }
  return [...byDomain.entries()]
    .map(([domain, b]) => ({
      domain,
      count: b.count,
      type: gapSourceType(domain, ownDomain),
      competitors: [...b.competitors.entries()]
        .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
        .slice(0, 3)
        .map(([name]) => name),
    }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
}

/** How many rows the free check shows; the paid dashboard shows them all. */
export const FREE_GAP_ROWS = 3;
