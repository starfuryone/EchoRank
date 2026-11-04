// response_codes — what the server answered, and how it got there.
//
// statusCode is the FINAL response after redirects; redirectHops counts the
// hops it took. "Internal" means the crawled URL itself (every crawled URL is
// on the site); "external" means the bounded HEAD checks of outbound links.

import { ev, pageRule, siteRule } from "../engine";
import type { Rule } from "../types";

const F = "response_codes" as const;

export const RULES: Rule[] = [
  pageRule({
    id: "response_codes.internal_4xx",
    family: F,
    kind: "issue",
    priority: "high",
    applies: "fetched",
    detect: (p) => (p.statusCode !== null && p.statusCode >= 400 && p.statusCode < 500 ? ev({ status: p.statusCode }) : null),
  }),
  pageRule({
    id: "response_codes.internal_5xx",
    family: F,
    kind: "issue",
    priority: "high",
    applies: "fetched",
    detect: (p) => (p.statusCode !== null && p.statusCode >= 500 ? ev({ status: p.statusCode }) : null),
  }),
  // Phase 4g: site rules over the crawl's stored outbound links, each URL's
  // status resolved once per crawl; foundOn = pages linking to the sample.
  siteRule({
    id: "response_codes.external_4xx",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (_p, ctx) => {
      const x = ctx.site.external;
      return x && x.clientErrors > 0 ? ev({ count: x.clientErrors, checked: x.checked, sample: x.sample, status: x.sampleStatus, foundOn: x.foundOn }) : null;
    },
  }),
  siteRule({
    id: "response_codes.external_5xx",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (_p, ctx) => {
      const x = ctx.site.external;
      return x && x.serverErrors > 0 ? ev({ count: x.serverErrors, checked: x.checked, sample: x.sample, status: x.sampleStatus, foundOn: x.foundOn }) : null;
    },
  }),
  pageRule({
    id: "response_codes.no_response",
    family: F,
    kind: "issue",
    priority: "high",
    applies: "fetched",
    detect: (p) => (p.statusCode === null && p.fetchError ? ev({ reason: p.fetchError }) : null),
  }),
  pageRule({
    id: "response_codes.internal_3xx",
    family: F,
    kind: "warning",
    priority: "low",
    applies: "fetched",
    detect: (p) => (p.redirectHops > 0 ? ev({ hops: p.redirectHops, target: p.redirectTarget }) : null),
  }),
  pageRule({
    id: "response_codes.redirect_chain",
    family: F,
    kind: "warning",
    priority: "medium",
    applies: "fetched",
    detect: (p) => (p.redirectHops > 1 ? ev({ hops: p.redirectHops, finalUrl: p.finalUrl }) : null),
  }),
  siteRule({
    id: "response_codes.redirect_loop",
    family: F,
    kind: "issue",
    priority: "high",
    detect: (_p, ctx) => (ctx.site.redirectLoop ? ev({ loop: ctx.site.redirectLoop }) : null),
  }),
  pageRule({
    id: "response_codes.meta_refresh",
    family: F,
    kind: "warning",
    priority: "medium",
    applies: "html",
    detect: (p) => (p.html!.metaRefresh !== null ? ev({ content: p.html!.metaRefresh }) : null),
  }),
  pageRule({
    id: "response_codes.redirect_to_error",
    family: F,
    kind: "issue",
    priority: "high",
    applies: "fetched",
    detect: (p) =>
      p.redirectHops > 0 && p.statusCode !== null && p.statusCode >= 400
        ? ev({ status: p.statusCode, finalUrl: p.finalUrl })
        : null,
  }),
  pageRule({
    id: "response_codes.blocked_by_robots",
    family: F,
    kind: "warning",
    priority: "low",
    applies: "any",
    detect: (p) => (p.blockedByRobots ? ev() : null),
  }),
  siteRule({
    id: "response_codes.inlinks_to_3xx",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) =>
      p.redirectTarget !== null && (p.inlinkCount ?? 0) > 0 ? ev({ inlinks: p.inlinkCount, target: p.redirectTarget }) : null,
  }),
];
