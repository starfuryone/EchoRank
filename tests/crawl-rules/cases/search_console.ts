import type { GscFacts } from "@/lib/crawl-rules";
import { sc, siteCtx, stored, type RuleCase } from "../harness";

const g = (over: Partial<GscFacts> = {}): GscFacts => ({ clicks: 0, impressions: 0, ctr: 0, position: null, ...over });
const ctx = (gsc: GscFacts | null, capabilities: ("gsc")[] = ["gsc"]) => ({ ...siteCtx({ capabilities }), metrics: { gsc } });

const ins = (over: Partial<{ verdict: string | null; coverageState: string | null; robotsTxtState: string | null; googleCanonical: string | null }>, capabilities: ("gsc_inspection")[] = ["gsc_inspection"]) => ({
  ...siteCtx({ capabilities }),
  metrics: { inspection: { verdict: "PASS", coverageState: "Submitted and indexed", robotsTxtState: "ALLOWED", googleCanonical: null, ...over } },
});

const cases: RuleCase[] = [
  sc("gsc.indexed_zero_impressions", "indexable page, no impressions", true, stored(), ctx(g())),
  sc("gsc.indexed_zero_impressions", "has impressions", false, stored(), ctx(g({ impressions: 4 }))),
  sc("gsc.indexed_zero_impressions", "noindex page", false, stored({ noindex: true }), ctx(g())),
  sc("gsc.indexed_zero_impressions", "canonicalised elsewhere", false, stored({ canonical: "https://example.com/other" }), ctx(g())),
  sc("gsc.indexed_zero_impressions", "404", false, stored({ statusCode: 404 }), ctx(g())),
  sc("gsc.indexed_zero_impressions", "PDF", false, stored({ contentType: "application/pdf" }), ctx(g())),
  sc("gsc.indexed_zero_impressions", "no GSC join on this crawl", false, stored(), ctx(g(), [])),
  sc("gsc.traffic_low_inlinks", "impressions, one inlink", true, stored({ inlinkCount: 1 }), ctx(g({ impressions: 10, clicks: 1 }))),
  sc("gsc.traffic_low_inlinks", "impressions, no inlinks", true, stored({ inlinkCount: 0 }), ctx(g({ impressions: 10 }))),
  sc("gsc.traffic_low_inlinks", "impressions, two inlinks", false, stored({ inlinkCount: 2 }), ctx(g({ impressions: 10 }))),
  sc("gsc.traffic_low_inlinks", "no impressions", false, stored({ inlinkCount: 0 }), ctx(g())),
  sc("gsc.traffic_noindex", "clicks on a noindex page", true, stored({ noindex: true }), ctx(g({ clicks: 3, impressions: 40 }))),
  sc("gsc.traffic_noindex", "clicks, indexable", false, stored(), ctx(g({ clicks: 3 }))),
  sc("gsc.traffic_noindex", "noindex, impressions only", false, stored({ noindex: true }), ctx(g({ impressions: 40 }))),
  // Phase 4g: URL Inspection.
  { ...sc("gsc.not_indexed_with_inlinks", "not indexed, linked, indexable", true, stored({ inlinkCount: 4 }), ins({ verdict: "NEUTRAL", coverageState: "Crawled - currently not indexed" })), evidence: { verdict: "NEUTRAL", value: "Crawled - currently not indexed", inlinks: 4 } },
  sc("gsc.not_indexed_with_inlinks", "indexed", false, stored({ inlinkCount: 4 }), ins({})),
  sc("gsc.not_indexed_with_inlinks", "nothing links to it", false, stored({ inlinkCount: 0 }), ins({ verdict: "NEUTRAL" })),
  sc("gsc.not_indexed_with_inlinks", "noindex on purpose", false, stored({ inlinkCount: 4, noindex: true }), ins({ verdict: "NEUTRAL" })),
  sc("gsc.not_indexed_with_inlinks", "not inspected", false, stored({ inlinkCount: 4 }), ins({ verdict: "NEUTRAL" }, [])),
  sc("gsc.blocked_for_google", "robots.txt disallows Google", true, stored(), ins({ robotsTxtState: "DISALLOWED" })),
  sc("gsc.blocked_for_google", "allowed", false, stored(), ins({})),
  { ...sc("gsc.google_canonical_differs", "Google chose another URL", true, stored(), ins({ googleCanonical: "https://example.com/other" })), evidence: { value: "https://example.com/other", expected: "https://example.com/page" } },
  sc("gsc.google_canonical_differs", "same URL, trailing slash and host case aside", false, stored(), ins({ googleCanonical: "https://EXAMPLE.com/page/" })),
  sc("gsc.google_canonical_differs", "the declared canonical", false, stored({ canonical: "https://example.com/main" }), ins({ googleCanonical: "https://example.com/main" })),
  sc("gsc.google_canonical_differs", "no Google canonical reported", false, stored(), ins({ googleCanonical: null })),
];

export default cases;
