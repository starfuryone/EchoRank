// sitemaps — the XML sitemap against what the crawl found. All site rules:
// they need the sitemap membership stored per page, and the job-level ones
// (missing, too large, undeclared, URLs never crawled) attach to the root
// page so they show up once per crawl.

import { ev, isOk, siteRule } from "../engine";
import type { Rule, StoredPageFacts } from "../types";

const F = "sitemaps" as const;

export const SITEMAP_MAX_URLS = 50_000;

const strip = (u: string) => u.replace(/\/+(?=$|\?)/, "");
const canonicalised = (p: StoredPageFacts) => p.canonical !== null && strip(p.canonical) !== strip(p.url);
const isHtml = (p: StoredPageFacts) => /html/i.test(p.contentType ?? "");

export const RULES: Rule[] = [
  siteRule({
    id: "sitemaps.url_not_crawled",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (_p, ctx) =>
      ctx.isRoot && ctx.job.sitemap.notCrawled > 0
        ? ev({ count: ctx.job.sitemap.notCrawled, sample: ctx.job.sitemap.notCrawledSample })
        : null,
  }),
  siteRule({
    id: "sitemaps.page_not_in_sitemap",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: (p) =>
      p.inSitemap === false && isOk(p.statusCode) && isHtml(p) && !p.noindex && !canonicalised(p) ? ev() : null,
  }),
  siteRule({
    id: "sitemaps.non_indexable_listed",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (p) =>
      p.inSitemap === true && isOk(p.statusCode) && (p.noindex || canonicalised(p))
        ? ev({ reason: p.noindex ? "noindex" : "canonicalised", canonical: p.canonical })
        : null,
  }),
  siteRule({
    id: "sitemaps.redirect_listed",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (p) => (p.inSitemap === true && p.redirectTarget !== null ? ev({ target: p.redirectTarget }) : null),
  }),
  siteRule({
    id: "sitemaps.error_listed",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (p) => (p.inSitemap === true && p.statusCode !== null && p.statusCode >= 400 ? ev({ status: p.statusCode }) : null),
  }),
  siteRule({
    id: "sitemaps.missing",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (_p, ctx) => (ctx.isRoot && !ctx.job.sitemap.found ? ev() : null),
  }),
  siteRule({
    id: "sitemaps.too_large",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (_p, ctx) =>
      ctx.isRoot && ctx.job.sitemap.largestFileUrls > SITEMAP_MAX_URLS ? ev({ urls: ctx.job.sitemap.largestFileUrls }) : null,
  }),
  siteRule({
    id: "sitemaps.not_in_robots",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: (_p, ctx) => (ctx.isRoot && ctx.job.sitemap.found && !ctx.job.sitemap.declaredInRobots ? ev() : null),
  }),
];
