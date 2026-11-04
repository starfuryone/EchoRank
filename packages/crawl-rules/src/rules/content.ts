// content — the visible text: how much, how readable, how original, and
// whether the bytes can even be decoded reliably.

import { ev, pageRule, siteRule } from "../engine";
import type { PageFacts, Rule } from "../types";

const F = "content" as const;

export const LOW_WORD_COUNT = 200;
export const SOFT_404_WORDS = 50;
export const READABILITY_DIFFICULT = 50;
export const LOW_TEXT_RATIO = 10;

const SOFT_404_TITLE = /\b(404|not found|page not found|no longer available|introuvable|nicht gefunden|no encontrada)\b/i;

/** charset from the Content-Type header, lowercased; null when absent. */
const headerCharset = (p: PageFacts): string | null => {
  const m = /charset\s*=\s*"?([^;"\s]+)/i.exec(p.headers["content-type"] ?? p.contentType ?? "");
  return m ? m[1]!.toLowerCase() : null;
};

export const RULES: Rule[] = [
  pageRule({
    id: "content.low_word_count",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (p) => (p.html!.wordCount < LOW_WORD_COUNT ? ev({ words: p.html!.wordCount }) : null),
  }),
  siteRule({
    id: "content.exact_duplicate",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (_p, ctx) => (ctx.site.duplicateContentCount > 1 ? ev({ pages: ctx.site.duplicateContentCount }) : null),
  }),
  siteRule({
    id: "content.near_duplicate",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (_p, ctx) => (ctx.site.nearDuplicateCount > 0 ? ev({ pages: ctx.site.nearDuplicateCount }) : null),
  }),
  pageRule({
    id: "content.readability_difficult",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: (p) => {
      const s = p.html!.fleschReadingEase;
      return s !== null && s < READABILITY_DIFFICULT ? ev({ flesch: s }) : null;
    },
  }),
  pageRule({
    id: "content.placeholder_text",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (p) => (p.html!.placeholderText ? ev({ phrase: p.html!.placeholderText }) : null),
  }),
  pageRule({
    id: "content.soft_404",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (p) => {
      const title = p.html!.titles.find((t) => t !== "") ?? "";
      if (SOFT_404_TITLE.test(title)) return ev({ reason: "title", title });
      return p.html!.wordCount < SOFT_404_WORDS ? ev({ reason: "words", words: p.html!.wordCount }) : null;
    },
  }),
  pageRule({
    id: "content.low_text_ratio",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: (p) => (p.html!.textRatio < LOW_TEXT_RATIO ? ev({ ratio: p.html!.textRatio }) : null),
  }),
  pageRule({
    id: "content.missing_lang",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) => (p.html!.langAttr === null ? ev() : null),
  }),
  pageRule({
    id: "content.charset_missing",
    family: F,
    kind: "warning",
    priority: "medium",
    applies: "html",
    detect: (p) => (p.html!.charset === null && headerCharset(p) === null ? ev() : null),
  }),
  pageRule({
    id: "content.charset_not_utf8",
    family: F,
    kind: "warning",
    priority: "low",
    applies: "html",
    detect: (p) => {
      const declared = headerCharset(p) ?? p.html!.charset;
      return declared && !/^utf-?8$/.test(declared) ? ev({ charset: declared }) : null;
    },
  }),
  // Phase 4g: embeddings (opt-in, the tenant's OpenAI key) on the top N pages.
  siteRule({
    id: "content.semantic_duplicate",
    family: F,
    kind: "warning",
    priority: "medium",
    requires: ["semantic"],
    detect: (p, ctx) => {
      const s = ctx.metrics?.semantic;
      return s && s.nearestUrl && s.nearestScore !== null && s.nearestScore >= 0.95 ? ev({ value: s.nearestUrl, score: s.nearestScore }) : null;
    },
  }),
  siteRule({
    id: "content.off_topic",
    family: F,
    kind: "opportunity",
    priority: "low",
    requires: ["semantic"],
    detect: (p, ctx) => {
      const s = ctx.metrics?.semantic;
      return s && s.offTopic ? ev({ distance: s.distance }) : null;
    },
  }),
];
