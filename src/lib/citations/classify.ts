// src/lib/citations/classify.ts
//
// What kind of publication a citing domain is.
//
// DATA, THEN RULES, THEN NOTHING. Three passes in a fixed order:
//   1. KNOWN_DOMAINS — an exact registrable-domain lookup. A curated fact
//      about a specific site always beats a pattern that happens to match it.
//   2. TLD rules — what the suffix guarantees. ".gov" is not a hint.
//   3. HEURISTICS — substring patterns over the domain label.
// Anything that survives all three is OTHER. That is a real answer, not a
// fallback bucket: a domain we cannot categorise should be visibly
// uncategorised, so the list of them is the backlog for pass 1.
//
// NO NETWORK, NO DATABASE, NO LLM. Classification runs once per domain per
// rollup over a table that grows without bound, and it has to be cheap enough
// that re-classifying every row is a script that finishes. It is also a pure
// function of the domain string, which is what makes the aggregator's
// re-run-safety claim true: changing a rule here re-runs over stored rows and
// changes nothing else.
//
// WHY NOT REUSE src/lib/attribution/classify.ts: that module answers a
// different question over a different input — which AI assistant sent a
// referral, from a referrer URL and a user agent. The overlap is the word
// "classify". Sharing a module would have coupled the citation taxonomy to the
// assistant list, which changes on a completely different schedule.

import type { CitationKind } from "@/generated/prisma";
import { registrableDomain } from "@/lib/registrable-domain";

// ─── Pass 1: curated domains ────────────────────────────────────────────────

/**
 * Registrable domains we have decided about, by hand.
 *
 * KEYED BY eTLD+1, so every locale of a site lands on one entry: g2.com covers
 * the whole property, and a citation of `www.g2.com/products/...` normalises to
 * the same key before it ever reaches this map.
 *
 * The country editions of a publication get their own entries rather than a
 * prefix rule — lemonde.fr and nytimes.com share nothing textually, and a rule
 * loose enough to catch both would catch far more than it should.
 */
export const KNOWN_DOMAINS: Readonly<Record<string, CitationKind>> = {
  // ── Review platforms ──
  "g2.com": "REVIEW_SITE",
  "capterra.com": "REVIEW_SITE",
  "getapp.com": "REVIEW_SITE",
  "softwareadvice.com": "REVIEW_SITE",
  "trustpilot.com": "REVIEW_SITE",
  "trustradius.com": "REVIEW_SITE",
  "gartner.com": "REVIEW_SITE",
  "sourceforge.net": "REVIEW_SITE",
  "slashdot.org": "REVIEW_SITE",
  "producthunt.com": "REVIEW_SITE",
  "consumeraffairs.com": "REVIEW_SITE",
  "sitejabber.com": "REVIEW_SITE",
  "yelp.com": "REVIEW_SITE",
  "tripadvisor.com": "REVIEW_SITE",

  // ── Directories and listings ──
  "crunchbase.com": "DIRECTORY",
  "pitchbook.com": "DIRECTORY",
  "yellowpages.com": "DIRECTORY",
  "yell.com": "DIRECTORY",
  "bbb.org": "DIRECTORY",
  "clutch.co": "DIRECTORY",
  "goodfirms.co": "DIRECTORY",
  "owler.com": "DIRECTORY",
  "zoominfo.com": "DIRECTORY",
  "angi.com": "DIRECTORY",
  "thumbtack.com": "DIRECTORY",
  "houzz.com": "DIRECTORY",
  "pagesjaunes.fr": "DIRECTORY",
  "local.ch": "DIRECTORY",
  "search.ch": "DIRECTORY",

  // ── News and trade press ──
  "nytimes.com": "NEWS",
  "wsj.com": "NEWS",
  "washingtonpost.com": "NEWS",
  "bbc.co.uk": "NEWS",
  "bbc.com": "NEWS",
  "theguardian.com": "NEWS",
  "reuters.com": "NEWS",
  "apnews.com": "NEWS",
  "bloomberg.com": "NEWS",
  "ft.com": "NEWS",
  "cnbc.com": "NEWS",
  "forbes.com": "NEWS",
  "businessinsider.com": "NEWS",
  "techcrunch.com": "NEWS",
  "theverge.com": "NEWS",
  "wired.com": "NEWS",
  "arstechnica.com": "NEWS",
  "zdnet.com": "NEWS",
  "cnet.com": "NEWS",
  "venturebeat.com": "NEWS",
  "theinformation.com": "NEWS",
  "axios.com": "NEWS",
  "lemonde.fr": "NEWS",
  "lefigaro.fr": "NEWS",
  "lesechos.fr": "NEWS",
  "nzz.ch": "NEWS",
  "srf.ch": "NEWS",
  "handelsblatt.com": "NEWS",
  "spiegel.de": "NEWS",

  // ── Social networks and forums ──
  "linkedin.com": "SOCIAL",
  "reddit.com": "SOCIAL",
  "x.com": "SOCIAL",
  "twitter.com": "SOCIAL",
  "facebook.com": "SOCIAL",
  "instagram.com": "SOCIAL",
  "youtube.com": "SOCIAL",
  "tiktok.com": "SOCIAL",
  "quora.com": "SOCIAL",
  "stackoverflow.com": "SOCIAL",
  "stackexchange.com": "SOCIAL",
  "news.ycombinator.com": "SOCIAL",
  "ycombinator.com": "SOCIAL",
  "discord.com": "SOCIAL",
  "threads.net": "SOCIAL",
  "mastodon.social": "SOCIAL",
  "pinterest.com": "SOCIAL",

  // ── Blogging platforms ──
  // The PLATFORM is a blog host, so anything cited on it is a blog post. This
  // is the one place a whole-domain verdict is doing real work: medium.com
  // carries a million authors and none of them make it a news outlet.
  "medium.com": "BLOG",
  "substack.com": "BLOG",
  "wordpress.com": "BLOG",
  "blogspot.com": "BLOG",
  "blogger.com": "BLOG",
  "ghost.io": "BLOG",
  "hashnode.dev": "BLOG",
  "dev.to": "BLOG",
  "tumblr.com": "BLOG",
  "svbtle.com": "BLOG",
  "typepad.com": "BLOG",

  // ── Reference works that are none of the above ──
  // Wikipedia is not news, not a blog, and not a directory of businesses. It
  // is OTHER on purpose, and it is here so that no heuristic below claims it.
  "wikipedia.org": "OTHER",
  "wikimedia.org": "OTHER",
};

// ─── Pass 2: what the suffix guarantees ─────────────────────────────────────

/**
 * Suffixes that DECIDE, rather than suggest.
 *
 * Matched as a dot-anchored suffix of the registrable domain, so ".gov" catches
 * `sec.gov` and never `notagov.com`. Kept short deliberately: a suffix belongs
 * here only when every domain under it is the kind claimed. `.org` is not on
 * this list and must not be — it is open registration, and treating it as
 * government or non-profit would misfile a large fraction of the web.
 */
const TLD_RULES: ReadonlyArray<readonly [suffix: string, kind: CitationKind]> = [
  [".gov", "GOV"],
  [".mil", "GOV"],
  [".gov.uk", "GOV"],
  [".gov.au", "GOV"],
  [".govt.nz", "GOV"],
  [".gov.br", "GOV"],
  [".gov.cn", "GOV"],
  [".gov.in", "GOV"],
  [".gob.mx", "GOV"],
  [".go.jp", "GOV"],
  [".gc.ca", "GOV"],
  [".admin.ch", "GOV"],
  [".europa.eu", "GOV"],
  [".gouv.fr", "GOV"],
];

// ─── Pass 3: heuristics ─────────────────────────────────────────────────────

/**
 * Substring patterns over the domain, tried in order.
 *
 * ORDER IS THE SPEC. "reviews" is checked before "news" because `reviewsnews`
 * is not a thing but `prnews` and `newsreview` both are, and a site calling
 * itself a review site is one. Anchored where anchoring is safe: the `blog`
 * pattern requires a boundary so that `bloglovin` (a directory) and, more to
 * the point, any brand with "blog" mid-word does not sweep in.
 *
 * These are GUESSES and they are ordered after the curated map for that reason.
 * A wrong guess here is visible and cheap to fix — add the domain to
 * KNOWN_DOMAINS and it never reaches this pass again.
 */
const HEURISTICS: ReadonlyArray<readonly [pattern: RegExp, kind: CitationKind]> = [
  [/(^|[.-])(reviews?|avis|bewertung)([.-]|$)/, "REVIEW_SITE"],
  [/(^|[.-])(directory|listing|annuaire|verzeichnis)([.-]|$)/, "DIRECTORY"],
  [/(^|[.-])(news|presse|zeitung|journal|times|herald|tribune|gazette)([.-]|$)/, "NEWS"],
  [/(^|[.-])(blog|blogue)([.-]|$)/, "BLOG"],
  [/(^|[.-])(forum|community|board)([.-]|$)/, "SOCIAL"],
];

// ─── The classifier ─────────────────────────────────────────────────────────

/**
 * The kind of publication `hostOrUrl` is.
 *
 * Accepts a bare host, a registrable domain, or a full URL — everything is
 * normalised through registrableDomain() first, so the caller never has to
 * remember which it holds and `https://WWW.G2.com/x` and `g2.com` cannot
 * disagree.
 *
 * Empty or unparseable input is OTHER rather than a throw. This runs inside a
 * rollup over rows a provider produced; one malformed domain must not fail the
 * night's aggregation for a whole brand.
 */
export function classifyDomain(hostOrUrl: string): CitationKind {
  const domain = registrableDomain(hostOrUrl ?? "");
  if (domain === "") return "OTHER";

  const known = KNOWN_DOMAINS[domain];
  if (known) return known;

  for (const [suffix, kind] of TLD_RULES) {
    // Dot-anchored: `.gov` must match `sec.gov`, never `notagov.com`. The bare
    // equality arm covers a suffix that is itself a registrable domain.
    if (domain === suffix.slice(1) || domain.endsWith(suffix)) return kind;
  }

  for (const [pattern, kind] of HEURISTICS) {
    if (pattern.test(domain)) return kind;
  }

  return "OTHER";
}

/** Every kind, in the order the UI's filter chips render them. */
export const CITATION_KINDS: readonly CitationKind[] = [
  "REVIEW_SITE",
  "DIRECTORY",
  "NEWS",
  "BLOG",
  "SOCIAL",
  "GOV",
  "OTHER",
];
