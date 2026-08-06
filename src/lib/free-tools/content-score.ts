// src/lib/free-tools/content-score.ts
//
// The SEO Content Optimizer's heuristics. Pure functions, no network, no
// server — the whole tool runs in the visitor's browser, which is why it has no
// API route and costs nothing to offer.
//
// DELIBERATELY HEURISTIC, AND SAYS SO. These are the rules an editor can check
// by eye, mechanised: they do not model ranking, and the copy on the page must
// not imply they do. The "get AI rewrite suggestions" button is a signup CTA
// precisely because the interesting half — actually rewriting the text — is
// the part that costs money to run.

export type CheckStatus = "pass" | "warn" | "fail";

export interface ContentCheck {
  id: string;
  status: CheckStatus;
  /** The measured value, for the UI to render next to the label. */
  value: string;
}

export interface ContentReport {
  score: number;
  checks: ContentCheck[];
  wordCount: number;
  density: number;
  readability: number;
}

export interface ContentInput {
  text: string;
  keyword: string;
  title?: string;
  metaDescription?: string;
}

const WORD_RE = /[\p{L}\p{N}']+/gu;
/** A heading is a markdown ATX heading or a line in Title Case under 80 chars. */
const HEADING_RE = /^\s{0,3}#{1,6}\s+\S/;

export function words(text: string): string[] {
  return text.match(WORD_RE) ?? [];
}

export function sentences(text: string): string[] {
  return text
    .split(/[.!?]+[\s\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Vowel-group syllable estimate — the standard approximation for Flesch. */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const groups = w
    .replace(/(?:es|ed|[^l]e)$/, "")
    .match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

/**
 * Flesch Reading Ease, approximated.
 *
 * 0–100, higher is easier. Clamped because the formula happily returns negative
 * numbers for dense prose and >100 for very short sentences, and neither reads
 * as a score to anyone.
 */
export function fleschReadingEase(text: string): number {
  const w = words(text);
  const s = sentences(text);
  if (w.length === 0 || s.length === 0) return 0;

  const syllableTotal = w.reduce((sum, word) => sum + syllables(word), 0);
  const raw = 206.835 - 1.015 * (w.length / s.length) - 84.6 * (syllableTotal / w.length);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/** Keyword occurrences as a share of total words, as a percentage. */
export function keywordDensity(text: string, keyword: string): number {
  const w = words(text).map((x) => x.toLowerCase());
  const kw = words(keyword).map((x) => x.toLowerCase());
  if (w.length === 0 || kw.length === 0) return 0;

  let hits = 0;
  for (let i = 0; i + kw.length <= w.length; i++) {
    let match = true;
    for (let j = 0; j < kw.length; j++) {
      if (w[i + j] !== kw[j]) {
        match = false;
        break;
      }
    }
    if (match) hits++;
  }
  return Math.round((hits / w.length) * 10_000) / 100;
}

function containsKeyword(haystack: string, keyword: string): boolean {
  const h = haystack.toLowerCase();
  const k = keyword.trim().toLowerCase();
  return k.length > 0 && h.includes(k);
}

/** Lines that look like headings, markdown or otherwise. */
export function headings(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => HEADING_RE.test(l));
}

/** Questions the copy answers — a proxy for "does this cover real queries". */
export function questionCount(text: string): number {
  return text.split("\n").filter((l) => l.trim().endsWith("?")).length;
}

/**
 * Grade one draft.
 *
 * The score is the share of checks passed, with warns counting half — a simple
 * rule the page can state out loud, rather than a weighting nobody can verify.
 */
export function scoreContent(input: ContentInput): ContentReport {
  const text = input.text ?? "";
  const keyword = (input.keyword ?? "").trim();
  const allWords = words(text);
  const wordCount = allWords.length;
  const density = keywordDensity(text, keyword);
  const readability = fleschReadingEase(text);
  const heads = headings(text);
  const first100 = allWords.slice(0, 100).join(" ");

  const checks: ContentCheck[] = [];
  const add = (id: string, status: CheckStatus, value: string) =>
    checks.push({ id, status, value });

  add(
    "word_count",
    wordCount >= 600 ? "pass" : wordCount >= 300 ? "warn" : "fail",
    String(wordCount),
  );

  add(
    "keyword_in_title",
    input.title ? (containsKeyword(input.title, keyword) ? "pass" : "fail") : "warn",
    input.title ? input.title.slice(0, 60) : "—",
  );

  add(
    "keyword_in_h1",
    heads.length === 0
      ? "warn"
      : containsKeyword(heads[0]!, keyword)
        ? "pass"
        : "fail",
    heads[0]?.replace(/^#+\s*/, "").slice(0, 60) ?? "—",
  );

  add(
    "keyword_first_100",
    containsKeyword(first100, keyword) ? "pass" : "fail",
    containsKeyword(first100, keyword) ? "yes" : "no",
  );

  // 0.5–2.5% is the band editors aim for. Below reads as unfocused, above as
  // stuffed — and stuffing is the failure this check exists to catch.
  add(
    "keyword_density",
    density >= 0.5 && density <= 2.5 ? "pass" : density > 0 && density < 4 ? "warn" : "fail",
    `${density}%`,
  );

  add(
    "heading_structure",
    heads.length >= 3 ? "pass" : heads.length >= 1 ? "warn" : "fail",
    String(heads.length),
  );

  add(
    "readability",
    readability >= 60 ? "pass" : readability >= 40 ? "warn" : "fail",
    String(readability),
  );

  const questions = questionCount(text);
  add("question_coverage", questions >= 2 ? "pass" : questions === 1 ? "warn" : "fail", String(questions));

  const metaLength = (input.metaDescription ?? "").trim().length;
  add(
    "meta_length",
    metaLength === 0
      ? "fail"
      : metaLength >= 120 && metaLength <= 160
        ? "pass"
        : "warn",
    String(metaLength),
  );

  const earned = checks.reduce(
    (sum, c) => sum + (c.status === "pass" ? 1 : c.status === "warn" ? 0.5 : 0),
    0,
  );
  const score = Math.round((earned / checks.length) * 100);

  return { score, checks, wordCount, density, readability };
}
