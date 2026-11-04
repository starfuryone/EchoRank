// search_console — Search Console data joined onto crawled pages (Phase 4d).
//
// Capability "gsc": the crawl joined the tenant's Search Console property
// for this host (page dimension, last 28 days). A page GSC returned no row
// for reads as zero clicks and zero impressions — that absence is the
// finding gsc.indexed_zero_impressions reports.

import { ev, siteRule } from "../engine";
import type { Rule, StoredPageFacts } from "../types";

const F = "search_console" as const;
const GSC = ["gsc"] as const;

/** 200, HTML, not noindex, and not canonicalised elsewhere. */
export function indexable(p: StoredPageFacts): boolean {
  if (p.statusCode !== 200 || p.noindex) return false;
  if (p.contentType && !/html/i.test(p.contentType)) return false;
  return p.canonical === null || p.canonical.replace(/\/+$/, "") === p.url.replace(/\/+$/, "");
}

export const RULES: Rule[] = [
  siteRule({
    id: "gsc.indexed_zero_impressions",
    family: F,
    kind: "opportunity",
    priority: "low",
    requires: [...GSC],
    detect: (p, ctx) => {
      const g = ctx.metrics?.gsc;
      return g && indexable(p) && g.impressions === 0 ? ev({ impressions: 0, days: 28 }) : null;
    },
  }),
  siteRule({
    id: "gsc.traffic_low_inlinks",
    family: F,
    kind: "warning",
    priority: "medium",
    requires: [...GSC],
    detect: (p, ctx) => {
      const g = ctx.metrics?.gsc;
      const inlinks = p.inlinkCount ?? 0;
      return g && g.impressions > 0 && inlinks <= 1 ? ev({ impressions: g.impressions, clicks: g.clicks, inlinks }) : null;
    },
  }),
  siteRule({
    id: "gsc.traffic_noindex",
    family: F,
    kind: "issue",
    priority: "high",
    requires: [...GSC],
    detect: (p, ctx) => {
      const g = ctx.metrics?.gsc;
      return g && g.clicks > 0 && p.noindex ? ev({ clicks: g.clicks, impressions: g.impressions }) : null;
    },
  }),
];
