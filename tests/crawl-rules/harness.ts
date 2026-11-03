// tests/crawl-rules/harness.ts
//
// Fixture plumbing for the rule library. A family's cases live in
// tests/crawl-rules/cases/<family>.ts as a RuleCase[]; rules.test.ts runs
// every one, and registry.test.ts fails any rule without at least one case
// that fires and one that does not.
//
// Page cases go through the REAL extractor (src/lib/site-crawler/facts.ts),
// HTML in, PageFacts out, so a case tests the parse and the rule together.
// Site cases are StoredPageFacts plus aggregation results, which is all a site
// rule ever sees.

import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  RULE_BY_ID,
  evaluatePage,
  evaluateSite,
  type Capability,
  type Evidence,
  type JobFacts,
  type PageFacts,
  type PageSiteFacts,
  type SiteRuleCtx,
  type StoredPageFacts,
} from "@/lib/crawl-rules";
import { buildPageFacts, type PageFactsInput } from "@/lib/site-crawler/facts";

export const ROOT = "https://example.com/";
export const PAGE_URL = "https://example.com/page";

/** Every security header present, so a page case is not noisy by default. */
export const SECURE_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "strict-transport-security": "max-age=31536000",
  "content-security-policy": "default-src 'self'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
  "referrer-policy": "strict-origin-when-cross-origin",
};

/** A well-formed document around the given head and body markup. */
export function doc(head: string, body: string, opts: { lang?: string | null; doctype?: boolean } = {}): string {
  const lang = opts.lang === undefined ? "en" : opts.lang;
  return `${opts.doctype === false ? "" : "<!doctype html>"}<html${lang === null ? "" : ` lang="${lang}"`}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${head}</head><body>${body}</body></html>`;
}

export function page(html: string | null, over: Partial<PageFactsInput> = {}): PageFacts {
  const url = over.url ?? PAGE_URL;
  return buildPageFacts({
    url,
    finalUrl: over.finalUrl ?? url,
    rootUrl: ROOT,
    depth: 1,
    blockedByRobots: false,
    statusCode: 200,
    fetchError: null,
    redirectHops: 0,
    redirectTarget: null,
    contentType: "text/html; charset=utf-8",
    responseMs: 120,
    bytes: null,
    inSitemap: true,
    headers: SECURE_HEADERS,
    html,
    ...over,
  });
}

/** Mutate a built PageFacts (for facts the extractor cannot produce, e.g. HEAD-check results). */
export function withFacts(p: PageFacts, patch: (p: PageFacts) => void): PageFacts {
  patch(p);
  return p;
}

export function stored(over: Partial<StoredPageFacts> = {}): StoredPageFacts {
  return {
    url: PAGE_URL,
    rootUrl: ROOT,
    depth: 1,
    statusCode: 200,
    redirectTarget: null,
    contentType: "text/html; charset=utf-8",
    title: "A perfectly ordinary page title for testing",
    metaDescription: "An ordinary description.",
    h1First: "Ordinary heading",
    h2First: "Ordinary subheading",
    canonical: PAGE_URL,
    noindex: false,
    inSitemap: true,
    inlinkCount: 3,
    hreflang: [],
    langAttr: "en",
    relNext: null,
    relPrev: null,
    ...over,
  };
}

export function emptySite(): PageSiteFacts {
  return {
    duplicateTitleCount: 1,
    duplicateMetaCount: 1,
    duplicateH1Count: 1,
    duplicateH2Count: 1,
    duplicateContentCount: 1,
    nearDuplicateCount: 0,
    h1MatchesOtherTitleCount: 0,
    nofollowInlinkCount: 0,
    redirectLoop: null,
    outlinksToRedirect: 0,
    orphan: false,
    canonicalTarget: null,
    hreflang: { targets: 0, non200: 0, noindex: 0, notCanonical: 0, missingReturn: 0, langMismatch: 0, unlinked: 0, sample: null },
    pagination: { non200: 0, sequenceErrors: 0, sample: null },
  };
}

export function emptyJob(): JobFacts {
  return {
    pagesCrawled: 10,
    langsSeen: 1,
    sitemap: { found: true, urlCount: 10, largestFileUrls: 10, notCrawled: 0, notCrawledSample: null, declaredInRobots: true },
  };
}

export function siteCtx(
  over: { site?: Partial<PageSiteFacts>; job?: Partial<JobFacts>; isRoot?: boolean; capabilities?: Capability[] } = {},
): SiteRuleCtx {
  return {
    capabilities: over.capabilities ?? [],
    site: { ...emptySite(), ...over.site },
    job: { ...emptyJob(), ...over.job, sitemap: { ...emptyJob().sitemap, ...over.job?.sitemap } },
    isRoot: over.isRoot ?? false,
  };
}

export type RuleCase =
  | { rule: string; name: string; fires: boolean; page: PageFacts; capabilities?: Capability[]; evidence?: Evidence }
  | { rule: string; name: string; fires: boolean; stored: StoredPageFacts; ctx?: SiteRuleCtx; evidence?: Evidence };

/** Run only `c.rule` against the case. Null when it did not fire. */
export function run(c: RuleCase): Evidence | null {
  const rule = RULE_BY_ID.get(c.rule);
  if (!rule) throw new Error(`no rule ${c.rule}`);
  if ("page" in c) {
    return evaluatePage([rule], c.page, { capabilities: c.capabilities ?? [] })[0]?.evidence ?? null;
  }
  return evaluateSite([rule], c.stored, c.ctx ?? siteCtx())[0]?.evidence ?? null;
}

/** Shorthand for a page case: positive and negative in one call. */
export function pc(rule: string, name: string, fires: boolean, p: PageFacts, evidence?: Evidence): RuleCase {
  return { rule, name, fires, page: p, ...(evidence ? { evidence } : {}) };
}

export function sc(rule: string, name: string, fires: boolean, s: StoredPageFacts, ctx?: SiteRuleCtx): RuleCase {
  return { rule, name, fires, stored: s, ...(ctx ? { ctx } : {}) };
}
