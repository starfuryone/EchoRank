// backlinks — DataForSEO Backlinks summary for the crawl's most-linked pages
// (Phase 4d, opt-in). Capability "backlinks" is per PAGE: only pages that
// were looked up are judged, so a page outside the top N never reads as
// "no backlinks".

import { ev, siteRule } from "../engine";
import type { Rule } from "../types";

const F = "backlinks" as const;
const BL = ["backlinks"] as const;

export const RULES: Rule[] = [
  siteRule({
    id: "backlinks.page_with_links_is_broken",
    family: F,
    kind: "issue",
    priority: "high",
    requires: [...BL],
    detect: (p, ctx) => {
      const b = ctx.metrics?.backlinks;
      const broken = p.statusCode === null || p.statusCode >= 400;
      return b && b.backlinks > 0 && broken ? ev({ status: p.statusCode, backlinks: b.backlinks, referringDomains: b.referringDomains }) : null;
    },
  }),
  siteRule({
    id: "backlinks.page_with_links_redirects",
    family: F,
    kind: "warning",
    priority: "medium",
    requires: [...BL],
    detect: (p, ctx) => {
      const b = ctx.metrics?.backlinks;
      const redirects = p.statusCode !== null && p.statusCode >= 300 && p.statusCode < 400;
      return b && b.backlinks > 0 && redirects ? ev({ status: p.statusCode, target: p.redirectTarget, backlinks: b.backlinks, referringDomains: b.referringDomains }) : null;
    },
  }),
];
