// javascript — what changes when the page's scripts run (Phase 3b).
//
// Most rules compare the raw HTML (what a non-rendering bot and Google's first
// wave see) with the rendered DOM, so they need render mode and a page that
// was actually rendered. Two read the raw HTML alone: the old AJAX crawling
// scheme, and the opportunity to turn rendering on for a crawl that has it off.

import { ev, pageRule } from "../engine";
import type { HtmlFacts, PageFacts, RenderFacts, Rule } from "../types";
import { collapse } from "../util/text";
import { addedWords, jsOnlyFacts, metaNoindex, renderedOnlyLinks } from "../util/render";

const F = "javascript" as const;
const RENDER = ["render" as const];

/** Raw and rendered HTML facts, or null when this page has no rendered DOM. */
function both(p: PageFacts): { raw: HtmlFacts; r: HtmlFacts; render: RenderFacts } | null {
  const r = p.render?.html;
  return p.html && r ? { raw: p.html, r, render: p.render! } : null;
}

const first = (xs: string[]) => collapse(xs[0] ?? "");

/** Raw-HTML signs of a client-rendered shell: no internal links and almost no text. */
export const SHELL_MAX_WORDS = 50;

function changedRule(
  id: string,
  key: "title" | "metaDesc" | "h1" | "canonical",
  pick: (h: HtmlFacts) => string[],
  kind: "issue" | "warning",
  priority: "high" | "medium" | "low",
): Rule {
  return pageRule({
    id,
    family: F,
    kind,
    priority,
    requires: RENDER,
    detect: (p) => {
      const b = both(p);
      if (!b || !jsOnlyFacts(b.raw, b.r)[key]) return null;
      return ev({ raw: first(pick(b.raw)) || null, rendered: first(pick(b.r)) });
    },
  });
}

export const RULES: Rule[] = [
  pageRule({
    id: "javascript.content_only_rendered",
    family: F,
    kind: "warning",
    priority: "high",
    requires: RENDER,
    detect: (p) => {
      const b = both(p);
      if (!b || !jsOnlyFacts(b.raw, b.r).content) return null;
      return ev({ rawWords: b.raw.wordCount, renderedWords: b.r.wordCount, added: addedWords(b.raw, b.r) });
    },
  }),
  pageRule({
    id: "javascript.links_only_rendered",
    family: F,
    kind: "warning",
    priority: "high",
    requires: RENDER,
    detect: (p) => {
      const b = both(p);
      if (!b) return null;
      const only = renderedOnlyLinks(b.raw, b.r);
      return only.length ? ev({ links: only.length, sample: only[0] }) : null;
    },
  }),
  changedRule("javascript.title_changed", "title", (h) => h.titles, "warning", "medium"),
  changedRule("javascript.meta_description_changed", "metaDesc", (h) => h.metaDescriptions, "warning", "low"),
  changedRule("javascript.h1_changed", "h1", (h) => h.h1, "warning", "medium"),
  changedRule("javascript.canonical_changed", "canonical", (h) => h.canonicals, "issue", "high"),
  pageRule({
    id: "javascript.noindex_only_original",
    family: F,
    kind: "issue",
    priority: "high",
    requires: RENDER,
    detect: (p) => {
      const b = both(p);
      return b && metaNoindex(b.raw) && !metaNoindex(b.r) ? ev({ raw: b.raw.metaRobots }) : null;
    },
  }),
  pageRule({
    id: "javascript.noindex_only_rendered",
    family: F,
    kind: "issue",
    priority: "high",
    requires: RENDER,
    detect: (p) => {
      const b = both(p);
      return b && !metaNoindex(b.raw) && metaNoindex(b.r) ? ev({ rendered: b.r.metaRobots }) : null;
    },
  }),
  pageRule({
    id: "javascript.js_redirect",
    family: F,
    kind: "warning",
    priority: "medium",
    requires: RENDER,
    detect: (p) => {
      const target = p.render?.jsRedirect;
      // A meta refresh also navigates after load; response_codes.meta_refresh owns it.
      if (!target || p.html?.metaRefresh) return null;
      return ev({ target });
    },
  }),
  pageRule({
    id: "javascript.ajax_crawling_scheme",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (p) => {
      if (p.url.includes("#!")) return ev({ url: p.url });
      const a = p.html!.anchors.find((x) => x.raw.includes("#!"));
      return a ? ev({ href: a.raw }) : null;
    },
  }),
  pageRule({
    id: "javascript.rendered_word_count_zero",
    family: F,
    kind: "issue",
    priority: "high",
    requires: RENDER,
    detect: (p) => {
      const b = both(p);
      return b && b.r.wordCount === 0 ? ev({ rawWords: b.raw.wordCount }) : null;
    },
  }),
  pageRule({
    id: "javascript.console_errors",
    family: F,
    kind: "warning",
    priority: "low",
    requires: RENDER,
    detect: (p) => {
      const r = p.render;
      return r && r.consoleErrors > 0 ? ev({ errors: r.consoleErrors, sample: r.consoleSample }) : null;
    },
  }),
  pageRule({
    id: "javascript.enable_rendering",
    family: F,
    kind: "opportunity",
    priority: "medium",
    detect: (p, ctx) => {
      if (ctx.capabilities.includes("render")) return null;
      const h = p.html!;
      const internal = h.anchors.filter((a) => a.internal).length;
      return internal === 0 && h.wordCount < SHELL_MAX_WORDS ? ev({ words: h.wordCount }) : null;
    },
  }),
];
