// Text measurements every consumer must compute identically, so they live here
// rather than in each consumer's parser. Pure, no globals.

import { EVIDENCE_VALUE_MAX } from "../types";

export function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function truncate(value: string, max = EVIDENCE_VALUE_MAX): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/** Whitespace-separated tokens, the word-count definition the crawler has always used. */
export function countWords(text: string): number {
  const t = collapse(text);
  return t ? t.split(" ").length : 0;
}

/** Placeholder phrases a published page should never carry. */
const PLACEHOLDER_RE = /\b(lorem ipsum|coming soon|under construction)\b/i;

export function findPlaceholder(text: string): string | null {
  const m = PLACEHOLDER_RE.exec(text);
  return m ? m[1]!.toLowerCase() : null;
}

/** Syllables in one English word — the usual vowel-group heuristic. */
export function syllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Below this many words a readability score is noise, not a measurement. */
export const READABILITY_MIN_WORDS = 100;

/**
 * Flesch reading ease. Only meaningful for English; the caller decides that.
 * Returns null under READABILITY_MIN_WORDS.
 */
export function fleschReadingEase(text: string): number | null {
  const words = collapse(text)
    .split(" ")
    .filter((w) => /[a-z]/i.test(w));
  if (words.length < READABILITY_MIN_WORDS) return null;
  const sentences = Math.max(1, (text.match(/[.!?]+(\s|$)/g) ?? []).length);
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentences) - 84.6 * (syl / words.length);
  return Math.round(score * 10) / 10;
}

/** True when a lang attribute says English. */
export function isEnglish(lang: string | null): boolean {
  return !!lang && /^en(-|$)/i.test(lang.trim());
}

/** UTF-8 byte length without TextEncoder (not in the ES lib). */
export function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}
