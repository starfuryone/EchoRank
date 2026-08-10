// src/lib/ai-monitor/runner/normalize.ts
//
// The stored form of an answer, and the hash change detection compares.
//
// WHY NORMALISE AT ALL. PromptRun keeps the raw answer verbatim, but the hash
// has to answer "did this engine change its mind since last week", and a model
// that reflowed its own markdown — swapped `*` bullets for `-`, added a blank
// line, wrapped at a different width — has not changed its mind. Hashing the
// raw text would report every one of those as a moved answer, and the trend
// worker would re-analyse a checkup's worth of unchanged responses.
//
// AND WHY NOT MORE THAN THIS. The normaliser strips formatting, never words. It
// does not lowercase, de-punctuate or sort: those would make genuinely
// different answers hash alike, and a missed change is far worse here than a
// spurious one — the spurious one costs an analysis call, the missed one means
// a brand's disappearance from an answer never registers.

import { createHash } from "node:crypto";

/**
 * Markdown formatting reduced to plain prose, whitespace collapsed.
 *
 * Emphasis, headings, list bullets, block quotes and fences go; link TEXT stays
 * and its URL is kept too, because a cited source is content rather than
 * formatting and ../analysis/citations.ts reads it out of this same string.
 */
export function normalizeAnswer(answer: string): string {
  return (answer ?? "")
    // Fences, but not the code inside them.
    .replace(/```[a-z]*\n?/gi, " ")
    // [text](url) -> text url, so the link survives both halves.
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1 $2")
    // Leading list markers and block quotes, at the start of a line only, so a
    // hyphen inside a sentence is left alone.
    .replace(/^[ \t]*(?:[-*+•]|\d+[.)])[ \t]+/gm, "")
    .replace(/^[ \t]*>+[ \t]?/gm, "")
    // Heading hashes.
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
    // Emphasis and inline code marks.
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** SHA-256 of the normalised answer — what change detection compares. */
export function answerHash(normalized: string): string {
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
