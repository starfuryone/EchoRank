// src/lib/free-tools/serp-preview.ts
//
// SERP Simulator: how a title and description actually truncate in Google.
//
// TRUNCATION IS BY PIXELS, NOT CHARACTERS. Google measures the rendered width,
// so "Illinois" and "lilliputian" are the same character count and nowhere near
// the same width. Every character-count "SEO title length" checker is wrong for
// exactly this reason, which is why this one measures width.
//
// The width table is an approximation of Arial at Google's rendering size,
// expressed as per-character ratios. It is not exact — no client-side estimate
// can be without loading the font and measuring — so the UI presents the result
// as "likely to truncate", never as a promise. Callers that want exactness can
// measure with canvas; this stays dependency-free and deterministic so it can
// be unit-tested.

/** Pixel budgets Google gives a desktop and a mobile result. */
export const TITLE_PIXELS_DESKTOP = 580;
export const TITLE_PIXELS_MOBILE = 460;
export const DESC_PIXELS_DESKTOP = 990;
export const DESC_PIXELS_MOBILE = 1300;

/**
 * Approximate width of one character at Google's title size, in pixels.
 *
 * Grouped rather than a full font table: narrow glyphs, wide glyphs, uppercase,
 * and everything else. Good to a few percent for Latin copy, which is all this
 * needs to answer "will this get cut off".
 */
const NARROW = new Set([..."iljtfrI.,;:!|'`()[]{}-/\\ "]);
const WIDE = new Set([..."mwMW@%"]);

export function charWidth(char: string, fontSize: number): number {
  if (NARROW.has(char)) return fontSize * 0.31;
  if (WIDE.has(char)) return fontSize * 0.87;
  if (char >= "A" && char <= "Z") return fontSize * 0.67;
  if (char >= "0" && char <= "9") return fontSize * 0.55;
  return fontSize * 0.52;
}

export function textWidth(text: string, fontSize: number): number {
  let total = 0;
  for (const char of text) total += charWidth(char, fontSize);
  return Math.round(total);
}

export interface TruncationResult {
  /** What Google would show, with an ellipsis when cut. */
  display: string;
  width: number;
  limit: number;
  truncated: boolean;
}

/**
 * Cut a string to a pixel budget, on a word boundary where possible.
 *
 * Google breaks at words and appends an ellipsis; breaking mid-word would
 * misrepresent what a searcher sees.
 */
export function truncateToPixels(
  text: string,
  limitPixels: number,
  fontSize: number,
): TruncationResult {
  const clean = text.trim().replace(/\s+/g, " ");
  const full = textWidth(clean, fontSize);
  if (full <= limitPixels) {
    return { display: clean, width: full, limit: limitPixels, truncated: false };
  }

  const ellipsisWidth = textWidth("…", fontSize);
  const budget = limitPixels - ellipsisWidth;

  let width = 0;
  let cut = 0;
  for (let i = 0; i < clean.length; i++) {
    const w = charWidth(clean[i]!, fontSize);
    if (width + w > budget) break;
    width += w;
    cut = i + 1;
  }

  const lastSpace = clean.lastIndexOf(" ", cut);
  const end = lastSpace > clean.length * 0.5 ? lastSpace : cut;
  const display = `${clean.slice(0, end).trimEnd()}…`;

  return {
    display,
    width: textWidth(display, fontSize),
    limit: limitPixels,
    truncated: true,
  };
}

export interface SnippetInput {
  title: string;
  description: string;
  url: string;
}

export interface SnippetPreview {
  title: TruncationResult;
  description: TruncationResult;
  /** Breadcrumb form Google renders instead of the raw URL. */
  breadcrumb: string;
}

/** example.com/a/b → example.com › a › b, Google's display form. */
export function breadcrumbFor(rawUrl: string): string {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const segments = url.pathname.split("/").filter(Boolean);
    return [url.hostname.replace(/^www\./, ""), ...segments].join(" › ");
  } catch {
    return trimmed;
  }
}

/** Desktop and mobile use different budgets and different type sizes. */
export function previewSnippet(input: SnippetInput, device: "desktop" | "mobile"): SnippetPreview {
  const titleSize = device === "desktop" ? 20 : 18;
  const descSize = device === "desktop" ? 14 : 14;

  return {
    title: truncateToPixels(
      input.title,
      device === "desktop" ? TITLE_PIXELS_DESKTOP : TITLE_PIXELS_MOBILE,
      titleSize,
    ),
    description: truncateToPixels(
      input.description,
      device === "desktop" ? DESC_PIXELS_DESKTOP : DESC_PIXELS_MOBILE,
      descSize,
    ),
    breadcrumb: breadcrumbFor(input.url),
  };
}
