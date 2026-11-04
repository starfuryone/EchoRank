// amp — AMP pages the crawl found through <link rel="amphtml"> (Phase 4e).
// The validator verdict needs capability "amp" (the worker loaded the
// official validator); the link and canonical checks read the HTML and the
// crawled target row, so they run on every crawl.

import { ev, pageRule, siteRule } from "../engine";
import type { Rule } from "../types";

const F = "amp" as const;
const bare = (u: string | null | undefined) => (u ?? "").replace(/#.*$/, "").replace(/\/+$/, "");

export const RULES: Rule[] = [
  siteRule({
    id: "amp.link_non_200",
    family: F,
    kind: "issue",
    priority: "high",
    detect: (p, ctx) => {
      const t = ctx.site.ampTarget;
      return t && t.statusCode !== 200 ? ev({ value: t.url, status: t.statusCode }) : null;
    },
  }),
  pageRule({
    id: "amp.invalid",
    family: F,
    kind: "issue",
    priority: "high",
    requires: ["amp"],
    detect: (p) =>
      p.amp && p.amp.status === "FAIL" ? ev({ count: p.amp.errorCount, value: p.amp.messages.join(" | ") }) : null,
  }),
  pageRule({
    id: "amp.missing_canonical",
    family: F,
    kind: "issue",
    priority: "high",
    detect: (p) => (p.html?.isAmp && p.html.canonicals.every((c) => !c) ? ev({}) : null),
  }),
  siteRule({
    id: "amp.canonical_mismatch",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (p, ctx) => {
      const t = ctx.site.ampTarget;
      if (!t || !t.isAmp || t.statusCode !== 200 || !t.canonical) return null;
      return bare(t.canonical) === bare(p.url) ? null : ev({ value: t.url, expected: p.url, found: t.canonical });
    },
  }),
  siteRule({
    id: "amp.non_amp_linked_as_amp",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (p, ctx) => {
      const t = ctx.site.ampTarget;
      return t && t.statusCode === 200 && !t.isAmp ? ev({ value: t.url }) : null;
    },
  }),
  siteRule({
    id: "amp.not_in_sitemap",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: (p, ctx) => (p.isAmp && p.statusCode === 200 && p.inSitemap === false && ctx.job.sitemap.found ? ev({}) : null),
  }),
];
