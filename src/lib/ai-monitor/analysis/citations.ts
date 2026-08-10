// src/lib/ai-monitor/analysis/citations.ts
//
// Which sources an answer cited, in the order it cited them.
//
// DETERMINISTIC. No LLM touches this: a URL is a URL, and asking a model to
// repeat a list of links back is both a cost and a chance for it to invent one.
//
// STRUCTURED LINKS WIN WHEN THE PROVIDER RETURNS THEM. A search-grounded engine
// hands back its sources as data, with titles and without the truncation that
// prose applies to a long URL. Parsing the answer text is the fallback for the
// engines that only ever produce prose — and it is a genuine fallback, not a
// supplement: running both would double-count every link a provider both cites
// structurally and repeats in its text, which is most of them.
//
// ../deterministic.ts owns the two patterns. It needs them to MASK citations
// before scanning for prose mentions (so a link to the brand's own site is not
// also counted as someone saying the brand's name); this module needs the same
// matches with their offsets. One definition, imported.

import { registrableDomain } from "@/lib/registrable-domain";
import { BARE_DOMAIN_RE, URL_RE } from "./deterministic";

/** A source link as a provider hands it back. */
export interface SourceLink {
  url: string;
  title?: string | null;
}

export interface AnalyzedCitation {
  url: string;
  /** Registrable domain, via @/lib/registrable-domain — the join key to Source. */
  domain: string;
  title: string | null;
  /** 1-based order of appearance, renumbered after de-duplication. */
  citationPosition: number;
  /**
   * Registrable-domain match against the monitored site. www- and
   * subdomain-insensitive.
   *
   * IN MEMORY ONLY — there is deliberately no is_monitored_domain column on
   * Citation. It is a pure function of `domain`, and Citation's
   * (tenantId, domain, createdAt) index already serves "how often was my own
   * site cited". Storing it would buy nothing on read and would add a write-path
   * invariant: a brand that changes its website would silently leave every
   * historical row asserting the wrong thing.
   */
  isMonitoredDomain: boolean;
}

/**
 * Trailing sentence punctuation is not part of the URL.
 *
 * "…see https://example.com/docs." captures the full stop, which would make the
 * same link cited twice — once mid-sentence and once at the end of one — read
 * as two different sources.
 */
export function trimUrl(raw: string): string {
  return raw.trim().replace(/[.,;:!?]+$/, "");
}

/**
 * Does this actually look like a host?
 *
 * registrableDomain() is a PARSER, not a validator: handed "not a url" it
 * lowercases it, finds no dot to split on and hands the whole string back. That
 * is the right behaviour for its job and the wrong thing to store — an
 * unresolvable "domain" would sit in the citations table and never join to a
 * Source row, so the influence graph would be quietly incomplete rather than
 * visibly wrong. Structured links come from providers, so this guard is load
 * bearing: the text path can only produce strings the URL patterns matched.
 */
export function looksLikeDomain(domain: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(domain);
}

interface RawCitation {
  url: string;
  title: string | null;
}

/** Links found in the answer's prose, in the order they appear. */
export function parseCitationsFromText(answer: string): RawCitation[] {
  const found: { at: number; url: string }[] = [];

  for (const match of (answer ?? "").matchAll(URL_RE)) {
    if (match.index !== undefined) found.push({ at: match.index, url: trimUrl(match[0]) });
  }
  // The bare-domain pattern's lookbehind already refuses anything preceded by
  // "/" or ".", so a host inside a full URL cannot match here as well.
  for (const match of (answer ?? "").matchAll(BARE_DOMAIN_RE)) {
    if (match.index !== undefined) found.push({ at: match.index, url: trimUrl(match[1]) });
  }

  return found.sort((a, b) => a.at - b.at).map(({ url }) => ({ url, title: null }));
}

/**
 * Every source one answer cited.
 *
 * De-duplicated by URL — a model citing the same page twice cited one page,
 * which is also what the (promptRunId, url) uniqueness on the Citation table
 * requires — and renumbered afterwards, so positions are always 1..n with no
 * gaps where a repeat was dropped.
 */
export function extractCitations(
  answer: string,
  sources: readonly SourceLink[] | null | undefined,
  monitoredDomain: string | null,
): AnalyzedCitation[] {
  const raw: RawCitation[] =
    sources && sources.length > 0
      ? sources.map((source) => ({
          url: trimUrl(source.url ?? ""),
          title: source.title?.trim() ? source.title.trim() : null,
        }))
      : parseCitationsFromText(answer);

  const own = monitoredDomain ? registrableDomain(monitoredDomain) : null;
  const seen = new Set<string>();
  const citations: AnalyzedCitation[] = [];

  for (const entry of raw) {
    if (entry.url === "") continue;
    const domain = registrableDomain(entry.url);
    // A "URL" with no resolvable host is not a citation. Dropping it rather
    // than storing an unjoinable domain keeps the Source rollup total.
    if (!looksLikeDomain(domain)) continue;

    const key = entry.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    citations.push({
      url: entry.url,
      domain,
      title: entry.title,
      citationPosition: citations.length + 1,
      isMonitoredDomain: own !== null && domain === own,
    });
  }

  return citations;
}
