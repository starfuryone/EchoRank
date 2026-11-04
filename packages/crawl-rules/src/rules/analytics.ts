// analytics — GA4 landing-page data joined onto crawled pages (Phase 4d).
//
// Capability "ga4": the crawl joined the GA4 property the tenant picked
// (hostName + landingPagePlusQueryString, last 28 days). A crawled page GA4
// returned no row for reads as zero sessions.

import { ev, siteRule } from "../engine";
import type { Rule } from "../types";
import { indexable } from "./search_console";

const F = "analytics" as const;
const GA4 = ["ga4"] as const;

export const RULES: Rule[] = [
  siteRule({
    id: "ga4.crawled_zero_sessions",
    family: F,
    kind: "opportunity",
    priority: "low",
    requires: [...GA4],
    detect: (p, ctx) => {
      const g = ctx.metrics?.ga4;
      return g && indexable(p) && g.sessions === 0 ? ev({ sessions: 0, days: 28 }) : null;
    },
  }),
  siteRule({
    id: "ga4.converting_page_has_issues",
    family: F,
    kind: "warning",
    priority: "medium",
    requires: [...GA4],
    detect: (_p, ctx) => {
      const g = ctx.metrics?.ga4;
      const high = ctx.metrics?.highPriorityIssues ?? 0;
      return g && g.keyEvents > 0 && high > 0 ? ev({ keyEvents: g.keyEvents, sessions: g.sessions, highPriorityIssues: high }) : null;
    },
  }),
];
