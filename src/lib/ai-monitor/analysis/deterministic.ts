// src/lib/ai-monitor/analysis/deterministic.ts
//
// Everything about an AI answer that can be established without asking another
// model: was the brand named, where in the list, who else was named, what was
// cited.
//
// DETERMINISTIC FIRST, AND IT RUNS ALWAYS. The LLM pass costs money, adds
// latency, and can disagree with itself between repetitions — which is fatal
// for a repeatability score, because it would measure OUR noise as if it were
// the provider's. Everything a regex can settle is settled here, so the LLM is
// left with only the genuinely subjective questions (is this a recommendation,
// what is the sentiment). It also means a checkup that hits the spend cap
// mid-run still has usable data for every response it did collect.
//
// ACCENT- AND CASE-INSENSITIVE, WITH THE INDICES PRESERVED. A French answer
// writes "Écho" where the brand registered "Echo", so matching has to fold
// accents; but the context snippets have to be cut from the ORIGINAL text or
// they would show the reader a mangled version of what the model said. The fold
// therefore carries an index map back to the source string.

import { registrableDomain } from "@/lib/registrable-domain";

/** Characters either side of a mention in a context snippet. */
export const SNIPPET_RADIUS = 120;
/** More than this and the dashboard panel is a wall of text, not context. */
export const MAX_SNIPPETS = 5;

export interface BrandMatcher {
  /** Display name, plus every alias the wizard collected. */
  names: string[];
  /** Registrable domain of the brand's own site, if known. */
  domain: string | null;
  /** Competitor names to look for in the same answer. */
  competitors: string[];
}

export interface DeterministicAnalysis {
  brandMentioned: boolean;
  mentionCount: number;
  listPosition: number | null;
  competitorNames: string[];
  citedOwnDomain: boolean;
  citedDomains: string[];
  contextSnippets: string[];
}

interface Folded {
  text: string;
  /** map[i] = index in the original string of folded character i. */
  map: number[];
}

/**
 * Lowercase and strip diacritics, keeping a map back to the original indices.
 *
 * Folding with a plain `normalize("NFD").replace(...)` would be one line, but
 * it changes the string's length, so every index computed against it points at
 * the wrong place in the source. Folding per code point and recording where
 * each output character came from keeps the snippets honest.
 */
export function foldWithMap(input: string): Folded {
  let text = "";
  const map: number[] = [];

  for (let i = 0; i < input.length; ) {
    const codePoint = input.codePointAt(i);
    if (codePoint === undefined) break;
    const char = String.fromCodePoint(codePoint);
    const stripped = char.normalize("NFD").replace(/\p{M}/gu, "");
    const folded = (stripped || char).toLowerCase();

    for (const outChar of folded) {
      text += outChar;
      map.push(i);
    }
    i += char.length;
  }

  return { text, map };
}

export function fold(input: string): string {
  return foldWithMap(input).text;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A whole-word matcher for one name, in folded space.
 *
 * Lookarounds on letters and digits rather than `\b`: `\b` is ASCII-only in
 * practice and a brand like "Echorank360" would otherwise match inside
 * "Echorank3600". This is also what stops "Ada" matching "Canada" — the single
 * most common false positive in brand-mention detection, and one that would
 * silently inflate every visibility score.
 */
function nameRegExp(name: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(fold(name))}(?![\\p{L}\\p{N}])`, "gu");
}

export interface NameHit {
  start: number;
  end: number;
}

/** Every whole-word occurrence of any of `names`, in folded-index space. */
export function findNameHits(folded: string, names: readonly string[]): NameHit[] {
  const hits: NameHit[] = [];

  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    for (const match of folded.matchAll(nameRegExp(trimmed))) {
      if (match.index === undefined) continue;
      hits.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  // Overlapping aliases ("Echorank" and "Echorank360") must not each count the
  // same sentence: sort and drop any hit that starts inside the previous one.
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: NameHit[] = [];
  for (const hit of hits) {
    const last = merged[merged.length - 1];
    if (last && hit.start < last.end) continue;
    merged.push(hit);
  }
  return merged;
}

const LIST_ITEM = /^\s*(?:\d+[.)]|[-*•])\s+/;

/**
 * 1-based position of the brand in the answer's FIRST list, or null.
 *
 * The first list only. A model that ranks five tools and then lists five
 * unrelated caveats would otherwise let the caveat list overwrite a genuine
 * rank-1 placement. Answers that mention the brand purely in prose return null,
 * which the scorer treats as present-but-unranked rather than as position zero.
 */
export function firstListPosition(answer: string, names: readonly string[]): number | null {
  const lines = answer.split(/\r?\n/);
  let items: string[] | null = null;
  const current: string[] = [];

  for (const line of lines) {
    if (LIST_ITEM.test(line)) {
      current.push(line);
    } else if (current.length > 0) {
      // A blank line inside a list is common; only a non-empty, non-item line
      // ends it.
      if (line.trim() === "") continue;
      items = current;
      break;
    }
  }
  if (!items && current.length > 0) items = current;
  if (!items || items.length === 0) return null;

  for (let i = 0; i < items.length; i++) {
    if (findNameHits(maskCitations(fold(items[i])), names).length > 0) return i + 1;
  }
  return null;
}

/**
 * Exported for ./citations.ts, which needs the same two patterns with the
 * match POSITIONS rather than just the domains. Two copies of a URL regex is
 * two definitions of what counts as a citation, and they would drift.
 *
 * Safe to share despite the `g` flag: every use here and there is `matchAll`,
 * which operates on an internal clone and never advances this object's
 * lastIndex.
 */
export const URL_RE = /https?:\/\/[^\s<>()[\]"']+/gi;
/** Bare domains: "see example.com/docs" — models cite these as often as URLs. */
export const BARE_DOMAIN_RE =
  /(?<![\w@/.-])((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})(?![\w@-])/gi;

/**
 * Blank out URLs and bare domains, preserving the string's length.
 *
 * A CITATION IS NOT A PROSE MENTION. Without this, "see https://echorank360.com"
 * matches the alias "Echorank360" and counts as a mention — so a single link
 * would raise the prominence component on top of the 15 points the citation
 * component already awards it, scoring the same fact twice. Blanking rather
 * than deleting keeps every later index lined up with the original text, so
 * context snippets still cut in the right place.
 */
export function maskCitations(folded: string): string {
  let masked = folded;
  const blank = (match: string, index: number) => {
    masked = masked.slice(0, index) + " ".repeat(match.length) + masked.slice(index + match.length);
  };

  for (const match of folded.matchAll(URL_RE)) {
    if (match.index !== undefined) blank(match[0], match.index);
  }
  for (const match of masked.matchAll(BARE_DOMAIN_RE)) {
    if (match.index !== undefined) blank(match[0], match.index);
  }
  return masked;
}

/** Registrable domains cited anywhere in the answer, deduped, in order. */
export function citedDomainsIn(answer: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const push = (candidate: string) => {
    const domain = registrableDomain(candidate);
    if (!domain || seen.has(domain)) return;
    seen.add(domain);
    found.push(domain);
  };

  for (const match of answer.matchAll(URL_RE)) push(match[0]);
  for (const match of answer.matchAll(BARE_DOMAIN_RE)) push(match[1]);

  return found;
}

/** Text either side of each mention, cut from the ORIGINAL string. */
export function snippetsAround(answer: string, hits: readonly NameHit[], map: readonly number[]): string[] {
  return hits.slice(0, MAX_SNIPPETS).map((hit) => {
    const origStart = map[hit.start] ?? 0;
    const origEnd = (map[hit.end - 1] ?? origStart) + 1;
    const from = Math.max(0, origStart - SNIPPET_RADIUS);
    const to = Math.min(answer.length, origEnd + SNIPPET_RADIUS);
    const body = answer.slice(from, to).replace(/\s+/g, " ").trim();
    return `${from > 0 ? "…" : ""}${body}${to < answer.length ? "…" : ""}`;
  });
}

/**
 * The full deterministic pass over one provider answer.
 *
 * An empty or whitespace answer is "not mentioned" with zero of everything —
 * a provider that returned nothing is a real outcome and must not throw.
 */
export function analyseDeterministic(answer: string, brand: BrandMatcher): DeterministicAnalysis {
  const text = answer ?? "";
  const { text: folded, map } = foldWithMap(text);
  // Same length as `folded`, so `map` stays valid for snippet extraction.
  const searchable = maskCitations(folded);
  const hits = findNameHits(searchable, brand.names);
  const citedDomains = citedDomainsIn(text);
  const ownDomain = brand.domain ? registrableDomain(brand.domain) : null;

  return {
    brandMentioned: hits.length > 0,
    mentionCount: hits.length,
    listPosition: hits.length > 0 ? firstListPosition(text, brand.names) : null,
    competitorNames: brand.competitors.filter(
      (name) => name.trim() !== "" && findNameHits(searchable, [name]).length > 0,
    ),
    citedOwnDomain: ownDomain !== null && citedDomains.includes(ownDomain),
    citedDomains,
    contextSnippets: snippetsAround(text, hits, map),
  };
}
