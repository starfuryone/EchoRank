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
  /**
   * What the row shows on the right.
   *
   * A STATUS OR A METRIC, never the visitor's own prose. "Keyword in title"
   * used to echo the title back ("Italian food"), which reads as an answer to
   * a question nobody asked — the row is asking whether the keyword is in
   * there, so the value is "Yes" or "No".
   */
  value: string;
}

/**
 * Every threshold, named once.
 *
 * The target strings in CHECK_META are BUILT FROM THESE, so the band the
 * scorer applies and the sentence describing it to the visitor cannot drift
 * apart. Changing a number here changes the grading and the copy together.
 */
export const THRESHOLDS = {
  wordCount: { pass: 600, warn: 300 },
  /** 0.5–2.5% is the band editors aim for; past `stuffed` it is keyword spam. */
  density: { min: 0.5, max: 2.5, stuffed: 4 },
  headings: { pass: 3, warn: 1 },
  readability: { pass: 60, warn: 40 },
  questions: { pass: 2 },
  meta: { min: 120, max: 160 },
} as const;

export interface CheckMeta {
  /** Row label. Lived in the client as a second map until this pass. */
  label: string;
  /** Muted text beside the value. Null when the check is a plain yes/no. */
  target: string | null;
  /** Concrete instruction, surfaced on a warn or fail row. */
  hint: string;
}

/**
 * Label, target and fix for every check.
 *
 * MINIMAL EXTRACTION, DELIBERATELY. scoreContent() below still applies its
 * bands imperatively — moving the comparisons themselves into data would mean
 * inventing a predicate DSL for nine one-line rules, which is more machinery
 * than the problem has. What is centralised is everything the UI needed and
 * had nowhere to read from: the copy, the target, and the instruction. The
 * numbers those strings quote come from THRESHOLDS, which the scorer also
 * reads, so the two halves stay in step.
 */
export const CHECK_META: Record<string, CheckMeta> = {
  word_count: {
    label: "Word count",
    target: `aim ${THRESHOLDS.wordCount.pass}+`,
    hint: `Expand the draft past ${THRESHOLDS.wordCount.pass} words — cover the follow-up questions a reader would ask next.`,
  },
  keyword_in_title: {
    label: "Keyword in title",
    target: null,
    hint: "Put the exact keyword in your title tag, as near the front as reads naturally.",
  },
  keyword_in_h1: {
    label: "Keyword in first heading",
    target: null,
    hint: "Add the keyword to your first heading.",
  },
  keyword_first_100: {
    label: "Keyword in first 100 words",
    target: null,
    hint: "Work the keyword into the opening paragraph, inside the first 100 words.",
  },
  keyword_density: {
    label: "Keyword density",
    target: `aim ${THRESHOLDS.density.min}–${THRESHOLDS.density.max}%`,
    hint: `Aim for ${THRESHOLDS.density.min}–${THRESHOLDS.density.max}%. Below that, repeat the keyword where it reads naturally; above it, cut repetitions rather than adding filler.`,
  },
  heading_structure: {
    label: "Heading structure",
    target: `aim ${THRESHOLDS.headings.pass}+`,
    hint: `Break the draft up with at least ${THRESHOLDS.headings.pass} headings — start the line with # to mark one.`,
  },
  readability: {
    label: "Readability (Flesch)",
    target: `aim ${THRESHOLDS.readability.pass}+`,
    hint: "Shorten your sentences and prefer plainer words — both raise the Flesch score.",
  },
  question_coverage: {
    label: "Questions answered",
    target: `aim ${THRESHOLDS.questions.pass}+`,
    hint: `Answer at least ${THRESHOLDS.questions.pass} real questions outright, each on its own line ending in a question mark.`,
  },
  meta_length: {
    label: "Meta description length",
    target: `aim ${THRESHOLDS.meta.min}–${THRESHOLDS.meta.max}`,
    hint: `Write a meta description of ${THRESHOLDS.meta.min}–${THRESHOLDS.meta.max} characters.`,
  },
};

/** Worst first: a visitor should read what to fix before what already works. */
const STATUS_ORDER: Record<CheckStatus, number> = { fail: 0, warn: 1, pass: 2 };

/**
 * Failed, then partial, then passed — stable within each band.
 *
 * A copy: `checks` belongs to the report the caller is holding.
 */
export function orderChecks(checks: ContentCheck[]): ContentCheck[] {
  return [...checks].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

export type Grade = "poor" | "fair" | "good";

/** 0–39 poor, 40–69 fair, 70–100 good. Same shape as volatility-severity.ts. */
export function gradeOf(score: number): Grade {
  if (score >= 70) return "good";
  if (score >= 40) return "fair";
  return "poor";
}

/** Binance tokens the marketing theme defines on .page, with literal fallbacks. */
export const GRADE_COLOR: Record<Grade, string> = {
  poor: "var(--red, #F6465D)",
  fair: "var(--goldDeep, #F0B90B)",
  good: "var(--green, #0ECB81)",
};

export const GRADE_LABEL: Record<Grade, string> = {
  poor: "Needs work",
  fair: "Getting there",
  good: "Well optimized",
};

/** Icon per status. Paired with colour, never colour alone. */
export const STATUS_ICON: Record<CheckStatus, string> = {
  pass: "✓",
  warn: "!",
  fail: "✕",
};

/** Spoken status, for the screen reader that cannot see the glyph. */
export const STATUS_WORD: Record<CheckStatus, string> = {
  pass: "Passed",
  warn: "Partial",
  fail: "Failed",
};

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

  const T = THRESHOLDS;
  /** Yes/No for the binary checks, so the row answers its own question. */
  const yn = (ok: boolean) => (ok ? "Yes" : "No");

  add(
    "word_count",
    wordCount >= T.wordCount.pass ? "pass" : wordCount >= T.wordCount.warn ? "warn" : "fail",
    String(wordCount),
  );

  add(
    "keyword_in_title",
    input.title ? (containsKeyword(input.title, keyword) ? "pass" : "fail") : "warn",
    // Used to print the title itself. A visitor typing "Italian food" saw
    // "Italian food" in the status column and could not tell whether that was
    // a pass, a warning or an echo.
    input.title ? yn(containsKeyword(input.title, keyword)) : "Not set",
  );

  add(
    "keyword_in_h1",
    heads.length === 0
      ? "warn"
      : containsKeyword(heads[0]!, keyword)
        ? "pass"
        : "fail",
    heads.length === 0 ? "No headings" : yn(containsKeyword(heads[0]!, keyword)),
  );

  add(
    "keyword_first_100",
    containsKeyword(first100, keyword) ? "pass" : "fail",
    yn(containsKeyword(first100, keyword)),
  );

  // Below the band reads as unfocused, above it as stuffed — and stuffing is
  // the failure this check exists to catch.
  add(
    "keyword_density",
    density >= T.density.min && density <= T.density.max
      ? "pass"
      : density > 0 && density < T.density.stuffed
        ? "warn"
        : "fail",
    `${density}%`,
  );

  add(
    "heading_structure",
    heads.length >= T.headings.pass ? "pass" : heads.length >= T.headings.warn ? "warn" : "fail",
    String(heads.length),
  );

  add(
    "readability",
    readability >= T.readability.pass ? "pass" : readability >= T.readability.warn ? "warn" : "fail",
    String(readability),
  );

  const questions = questionCount(text);
  add(
    "question_coverage",
    questions >= T.questions.pass ? "pass" : questions === 1 ? "warn" : "fail",
    String(questions),
  );

  const metaLength = (input.metaDescription ?? "").trim().length;
  add(
    "meta_length",
    metaLength === 0
      ? "fail"
      : metaLength >= T.meta.min && metaLength <= T.meta.max
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
