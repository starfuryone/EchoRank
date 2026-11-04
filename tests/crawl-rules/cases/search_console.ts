import type { GscFacts } from "@/lib/crawl-rules";
import { sc, siteCtx, stored, type RuleCase } from "../harness";

const g = (over: Partial<GscFacts> = {}): GscFacts => ({ clicks: 0, impressions: 0, ctr: 0, position: null, ...over });
const ctx = (gsc: GscFacts | null, capabilities: ("gsc")[] = ["gsc"]) => ({ ...siteCtx({ capabilities }), metrics: { gsc } });

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
];

export default cases;
