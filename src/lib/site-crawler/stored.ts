// src/lib/site-crawler/stored.ts
//
// PageFacts (in memory, rich) → the narrow crawl_pages columns the site rules
// read later, and rule Issues → crawl_issues rows. The inverse,
// toStoredFacts(), turns a page row back into the package's StoredPageFacts
// for the aggregation step.

import "server-only";
import { jsOnlyFacts, type Issue, type PageFacts, type StoredPageFacts, type HreflangFact } from "@/lib/crawl-rules";
import { SEVERITY_OF_KIND } from "./legacy-map";

const NOINDEX = /\b(noindex|none)\b/i;

function linkHeaderCanonical(link: string | undefined): string | null {
  if (!link) return null;
  const m = /<([^>]+)>\s*;[^,]*\brel\s*=\s*"?[^",;]*\bcanonical\b/i.exec(link);
  return m ? m[1]!.trim() : null;
}

export function isNoindex(facts: PageFacts): boolean {
  return NOINDEX.test(facts.html?.metaRobots ?? "") || NOINDEX.test(facts.headers["x-robots-tag"] ?? "");
}

/** The Phase 3a crawl_pages columns, from one page's facts. */
export function storedColumns(f: PageFacts) {
  const h = f.html;
  const https = /^https:/i.test(f.finalUrl);
  const hdr = (n: string) => (f.headers[n] ?? "").trim() !== "";
  return {
    h1First: h?.h1[0] ?? null,
    h2First: h?.h2[0] ?? null,
    h2Count: h ? h.h2.length : null,
    imgCount: h ? h.images.length : null,
    imgMissingAltCount: h ? h.images.filter((i) => i.alt === null).length : null,
    canonicalHeader: linkHeaderCanonical(f.headers["link"]),
    xRobotsTag: f.headers["x-robots-tag"]?.toLowerCase() ?? null,
    noindex: isNoindex(f),
    hreflang: h ? (h.hreflang as unknown as object) : undefined,
    relNext: h?.relNext[0] ?? null,
    relPrev: h?.relPrev[0] ?? null,
    ampHtml: h?.amphtml?.[0] ?? null,
    isAmp: h ? (h.isAmp ?? false) : null,
    bytes: f.bytes,
    textRatio: h ? h.textRatio : null,
    langAttr: h?.langAttr ?? null,
    hasViewport: h ? h.hasViewport : null,
    charset: h?.charset ?? null,
    securityHeaders: h
      ? {
          hsts: hdr("strict-transport-security"),
          csp: hdr("content-security-policy"),
          xcto: hdr("x-content-type-options"),
          xfo: hdr("x-frame-options"),
          refpol: hdr("referrer-policy"),
        }
      : undefined,
    mixedContentCount: h && https ? h.resources.filter((r) => /^http:\/\//i.test(r)).length : null,
    insecureFormCount: h ? h.formActions.filter((a) => /^http:\/\//i.test(a)).length : null,
    externalOutlinks: h ? new Set(h.anchors.filter((a) => !a.internal && /^https?:/i.test(a.href)).map((a) => a.href)).size : null,
    nofollowOutlinks: h ? h.anchors.filter((a) => /\bnofollow\b/.test(a.rel)).length : null,
    jsonLdTypes: h ? [...new Set(h.jsonLd.flatMap((b) => b.items.map((i) => i.type)))].slice(0, 20) : [],
    jsonLdErrors: h ? h.jsonLd.filter((b) => !b.ok).length : null,
  };
}

/** The Phase 3b render columns; all null when the page was not rendered. */
export function renderColumns(f: PageFacts) {
  const r = f.render;
  if (!r) return {};
  const rh = r.html;
  return {
    renderedWordCount: rh ? rh.wordCount : null,
    renderedLinkCount: rh ? new Set(rh.anchors.filter((a) => a.internal).map((a) => a.href)).size : null,
    jsOnly: rh && f.html ? (jsOnlyFacts(f.html, rh) as unknown as object) : undefined,
    axeViolations: r.axe
      ? (Object.fromEntries(Object.entries(r.axe).map(([id, v]) => [id, v.nodes])) as unknown as object)
      : undefined,
    consoleErrors: r.consoleErrors,
  };
}

/** crawl_issues rows for one page's findings. `type` mirrors the rule id so Phase 2 panels still read them. */
export function issueRows(issues: Issue[], crawlJobId: string) {
  return issues.map((i) => ({
    crawlJobId,
    type: i.ruleId,
    severity: SEVERITY_OF_KIND[i.kind],
    detail: null,
    ruleId: i.ruleId,
    kind: i.kind,
    priority: i.priority,
    evidence: i.evidence,
  }));
}

export interface StoredPageRow {
  url: string;
  depth: number;
  statusCode: number | null;
  redirectTarget: string | null;
  contentType: string | null;
  title: string | null;
  metaDescription: string | null;
  h1First: string | null;
  h2First: string | null;
  canonical: string | null;
  canonicalHeader: string | null;
  noindex: boolean | null;
  metaRobots: string | null;
  inSitemap: boolean | null;
  inlinkCount: number | null;
  hreflang: unknown;
  langAttr: string | null;
  relNext: string | null;
  relPrev: string | null;
  ampHtml?: string | null;
  isAmp?: boolean | null;
}

/** A crawl_pages row → the package's StoredPageFacts. Pre-3a rows fill what they can. */
export function toStoredFacts(row: StoredPageRow, rootUrl: string): StoredPageFacts {
  return {
    url: row.url,
    rootUrl,
    depth: row.depth,
    statusCode: row.statusCode,
    redirectTarget: row.redirectTarget,
    contentType: row.contentType,
    title: row.title,
    metaDescription: row.metaDescription,
    h1First: row.h1First,
    h2First: row.h2First,
    canonical: row.canonical ?? row.canonicalHeader,
    noindex: row.noindex ?? NOINDEX.test(row.metaRobots ?? ""),
    inSitemap: row.inSitemap,
    inlinkCount: row.inlinkCount,
    hreflang: Array.isArray(row.hreflang) ? (row.hreflang as HreflangFact[]) : [],
    langAttr: row.langAttr,
    relNext: row.relNext,
    relPrev: row.relPrev,
    ampHtml: row.ampHtml ?? null,
    isAmp: row.isAmp ?? null,
  };
}
