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
/** Scheme, host case, fragment and trailing slashes do not make two canonicals differ. */
function canonicalKey(u: string): string {
  try {
    const x = new URL(u);
    return `${x.host.toLowerCase()}${x.pathname.replace(/\/+$/, "")}${x.search}`;
  } catch {
    return u.trim();
  }
}

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
  // Phase 4g: URL Inspection on the top N pages (opt-in, Google's quota).
  siteRule({
    id: "gsc.not_indexed_with_inlinks",
    family: F,
    kind: "warning",
    priority: "medium",
    requires: ["gsc_inspection"],
    detect: (p, ctx) => {
      const x = ctx.metrics?.inspection;
      if (!x?.verdict || x.verdict === "PASS" || x.verdict === "VERDICT_UNSPECIFIED") return null;
      return (p.inlinkCount ?? 0) >= 1 && indexable(p) ? ev({ verdict: x.verdict, value: x.coverageState, inlinks: p.inlinkCount }) : null;
    },
  }),
  siteRule({
    id: "gsc.blocked_for_google",
    family: F,
    kind: "issue",
    priority: "high",
    requires: ["gsc_inspection"],
    detect: (_p, ctx) => (ctx.metrics?.inspection?.robotsTxtState === "DISALLOWED" ? ev({ value: "DISALLOWED" }) : null),
  }),
  siteRule({
    id: "gsc.google_canonical_differs",
    family: F,
    kind: "warning",
    priority: "medium",
    requires: ["gsc_inspection"],
    detect: (p, ctx) => {
      const g = ctx.metrics?.inspection?.googleCanonical;
      if (!g) return null;
      const declared = p.canonical ?? p.url;
      return canonicalKey(g) === canonicalKey(declared) ? null : ev({ value: g, expected: declared });
    },
  }),
];
