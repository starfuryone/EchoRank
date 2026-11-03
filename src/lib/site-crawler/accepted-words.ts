// src/lib/site-crawler/accepted-words.ts
//
// The workspace's accepted words for the spell check (Phase 3c): limits and
// the clean-up of what a user typed. Dependency-free, so the route and the
// client can import it without pulling the dictionaries along.

/** Accepted words per workspace. */
export const MAX_ACCEPTED_WORDS = 500;
export const MAX_ACCEPTED_WORD_LENGTH = 60;

/** Trimmed, deduplicated case-insensitively, bounded. Over-long entries are dropped. */
export function normalizeAcceptedWords(words: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of words) {
    const w = raw.trim();
    if (!w || w.length > MAX_ACCEPTED_WORD_LENGTH || seen.has(w.toLowerCase())) continue;
    seen.add(w.toLowerCase());
    out.push(w);
    if (out.length >= MAX_ACCEPTED_WORDS) break;
  }
  return out;
}

/** One word per line, or comma-separated. */
export function parseAcceptedWords(input: string): string[] {
  return normalizeAcceptedWords(input.split(/[\n,]+/));
}
