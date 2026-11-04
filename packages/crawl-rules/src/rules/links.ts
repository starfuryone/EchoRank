// links — the page's <a href> anchors, and (site rules) the links that point
// at it. Only http(s) anchors count as links: mailto:, tel:, javascript: and
// bare fragments are not navigation a crawler follows.

import { ev, pageRule, siteRule } from "../engine";
import type { AnchorFact, PageFacts, Rule } from "../types";
import { indexable } from "./search_console";

const F = "links" as const;

export const HIGH_EXTERNAL = 100;
export const HIGH_INTERNAL = 500;
export const ANCHOR_MAX = 100;
export const DEEP = 3;

/** Generic anchor text in English and French; compared after trimming punctuation. */
const NON_DESCRIPTIVE = new Set([
  "click here", "click", "here", "read more", "more", "learn more", "link", "this", "this page", "go", "continue",
  "cliquez ici", "ici", "en savoir plus", "lire la suite", "plus",
]);

const isHttp = (a: AnchorFact) => /^https?:\/\//i.test(a.href);
const links = (p: PageFacts) => p.html!.anchors.filter(isHttp);
const distinct = (as: AnchorFact[]) => new Set(as.map((a) => a.href)).size;
const nofollow = (a: AnchorFact) => a.rel.split(/\s+/).includes("nofollow");

function hostOf(href: string): string {
  try {
    return new URL(href).hostname.toLowerCase();
  } catch {
    return "";
  }
}

const anyAnchor = (
  id: string,
  kind: Rule["kind"],
  priority: Rule["priority"],
  match: (a: AnchorFact) => boolean,
  show: (a: AnchorFact) => string = (a) => a.href,
) =>
  pageRule({
    id: `links.${id}`,
    family: F,
    kind,
    priority,
    detect: (p) => {
      const hits = p.html!.anchors.filter(match);
      return hits.length ? ev({ count: hits.length, sample: show(hits[0]!) }) : null;
    },
  });

export const RULES: Rule[] = [
  pageRule({
    id: "links.high_external_outlinks",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: (p) => {
      const n = distinct(links(p).filter((a) => !a.internal));
      return n > HIGH_EXTERNAL ? ev({ count: n }) : null;
    },
  }),
  pageRule({
    id: "links.high_internal_outlinks",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) => {
      const n = distinct(links(p).filter((a) => a.internal));
      return n > HIGH_INTERNAL ? ev({ count: n }) : null;
    },
  }),
  pageRule({
    id: "links.no_internal_outlinks",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (p) => (links(p).some((a) => a.internal) ? null : ev()),
  }),
  siteRule({
    id: "links.inlinks_only_nofollow",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (p, ctx) =>
      ctx.site.nofollowInlinkCount > 0 && (p.inlinkCount ?? 0) === 0 ? ev({ nofollowInlinks: ctx.site.nofollowInlinkCount }) : null,
  }),
  anyAnchor(
    "non_descriptive_anchor",
    "opportunity",
    "low",
    (a) => isHttp(a) && NON_DESCRIPTIVE.has(a.text.toLowerCase().replace(/[.…!?»›→\s]+$/u, "").trim()),
    (a) => a.text,
  ),
  anyAnchor("localhost_links", "issue", "medium", (a) => /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\])$/.test(hostOf(a.href))),
  anyAnchor("internal_nofollow", "warning", "low", (a) => isHttp(a) && a.internal && nofollow(a)),
  siteRule({
    id: "links.outlinks_to_redirect",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (_p, ctx) => (ctx.site.outlinksToRedirect > 0 ? ev({ count: ctx.site.outlinksToRedirect }) : null),
  }),
  anyAnchor("internal_with_parameters", "opportunity", "low", (a) => isHttp(a) && a.internal && a.href.includes("?")),
  siteRule({
    id: "links.only_one_inlink",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: (p) => (p.inlinkCount === 1 ? ev() : null),
  }),
  siteRule({
    id: "links.deep_page",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: (p) => (p.depth > DEEP ? ev({ depth: p.depth }) : null),
  }),
  siteRule({
    id: "links.orphan",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (_p, ctx) => (ctx.site.orphan ? ev() : null),
  }),
  pageRule({
    id: "links.external_to_redirect",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: (p) =>
      p.externalLinkChecks && p.externalLinkChecks.redirects > 0
        ? ev({ count: p.externalLinkChecks.redirects, checked: p.externalLinkChecks.checked })
        : null,
  }),
  anyAnchor("anchor_over_100_chars", "opportunity", "low", (a) => a.text.length > ANCHOR_MAX, (a) => a.text),
  anyAnchor("to_http", "warning", "low", (a) => /^http:\/\//i.test(a.href) && !/^(localhost|127\.)/.test(hostOf(a.href))),
  // Phase 4g: an indexable page the site links to, but whose internal PageRank is in the crawl's bottom decile.
  siteRule({
    id: "links.low_link_score",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: (p, ctx) => {
      const t = ctx.job.linkScoreP10;
      if (t === undefined || t === null || p.linkScore === undefined || p.linkScore === null) return null;
      if ((p.inlinkCount ?? 0) < 1 || !indexable(p) || p.linkScore >= t) return null;
      return ev({ score: p.linkScore, threshold: t, inlinks: p.inlinkCount });
    },
  }),
];
