// Raw vs rendered: what JavaScript added or changed. Shared by the javascript
// rules and by consumers that store the summary (the crawler's jsOnly column),
// so the stored flags and the verdicts can never disagree.

import type { HtmlFacts, JsOnlyFacts } from "../types";
import { collapse } from "./text";

/** Rendered content counts as JS-only when JS added at least this many words… */
export const JS_CONTENT_MIN_WORDS = 50;
/** …and they are at least this share of the rendered page's words. */
export const JS_CONTENT_MIN_SHARE = 0.1;

const first = (xs: string[]) => collapse(xs[0] ?? "");

/** True when the rendered value is set and is not what the raw HTML said. */
function changed(raw: string, rendered: string): boolean {
  return rendered !== "" && rendered !== raw;
}

/** Internal link targets in the rendered DOM that the raw HTML does not have. */
export function renderedOnlyLinks(raw: HtmlFacts, rendered: HtmlFacts): string[] {
  const before = new Set(raw.anchors.filter((a) => a.internal).map((a) => a.href));
  return [...new Set(rendered.anchors.filter((a) => a.internal && !before.has(a.href)).map((a) => a.href))];
}

export function addedWords(raw: HtmlFacts, rendered: HtmlFacts): number {
  return Math.max(0, rendered.wordCount - raw.wordCount);
}

export function jsOnlyFacts(raw: HtmlFacts, rendered: HtmlFacts): JsOnlyFacts {
  const added = addedWords(raw, rendered);
  return {
    title: changed(first(raw.titles), first(rendered.titles)),
    metaDesc: changed(first(raw.metaDescriptions), first(rendered.metaDescriptions)),
    h1: changed(first(raw.h1), first(rendered.h1)),
    canonical: changed(first(raw.canonicals), first(rendered.canonicals)),
    content: added >= JS_CONTENT_MIN_WORDS && added >= rendered.wordCount * JS_CONTENT_MIN_SHARE,
    links: renderedOnlyLinks(raw, rendered).length > 0,
  };
}

const NOINDEX = /\b(noindex|none)\b/;

/** noindex in meta robots/googlebot. The X-Robots-Tag header is the same for both, so it is not compared. */
export function metaNoindex(h: HtmlFacts): boolean {
  return NOINDEX.test(h.metaRobots ?? "");
}
