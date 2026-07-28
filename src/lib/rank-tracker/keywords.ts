// src/lib/rank-tracker/keywords.ts
//
// Textarea -> the keyword list we persist. Pure, so the UI can run the exact
// same function to show a live counter that matches what the server will
// accept — a counter that disagrees with the server is worse than none.

import { MAX_KEYWORDS_PER_REQUEST } from "./options";

/** Longest keyword DataForSEO accepts for a SERP task. */
const MAX_KEYWORD_CHARS = 200;

export interface ParsedKeywords {
  keywords: string[];
  /** Duplicates removed, so the UI can say "3 duplicates ignored". */
  duplicates: number;
  /** Lines dropped for being empty or too long. */
  dropped: number;
}

/**
 * One keyword per line. Trimmed, inner whitespace collapsed, lowercased, and
 * deduped.
 *
 * Lowercasing is deliberate: Google returns the same SERP for "Plumber Toronto"
 * and "plumber toronto", so treating them as two keywords would double the
 * spend and the cap usage for identical data. Dedupe is case-insensitive for
 * the same reason.
 */
export function parseKeywords(input: string): ParsedKeywords {
  const seen = new Set<string>();
  const keywords: string[] = [];
  let duplicates = 0;
  let dropped = 0;

  for (const rawLine of input.split(/\r?\n/)) {
    const keyword = rawLine.trim().replace(/\s+/g, " ").toLowerCase();
    if (!keyword || keyword.length > MAX_KEYWORD_CHARS) {
      if (rawLine.trim()) dropped++;
      continue;
    }
    if (seen.has(keyword)) {
      duplicates++;
      continue;
    }
    seen.add(keyword);
    // Stop collecting past the request cap but keep counting what was dropped,
    // so the UI can say how much was ignored instead of silently truncating.
    if (keywords.length >= MAX_KEYWORDS_PER_REQUEST) {
      dropped++;
      continue;
    }
    keywords.push(keyword);
  }

  return { keywords, duplicates, dropped };
}
