import type { BacklinkFacts } from "@/lib/crawl-rules";
import { sc, siteCtx, stored, type RuleCase } from "../harness";

const b = (over: Partial<BacklinkFacts> = {}): BacklinkFacts => ({ referringDomains: 3, backlinks: 12, rank: 40, ...over });
const ctx = (backlinks: BacklinkFacts | null, capabilities: ("backlinks")[] = ["backlinks"]) => ({ ...siteCtx({ capabilities }), metrics: { backlinks } });

const cases: RuleCase[] = [
  sc("backlinks.page_with_links_is_broken", "404 with backlinks", true, stored({ statusCode: 404 }), ctx(b())),
  sc("backlinks.page_with_links_is_broken", "no response, backlinks", true, stored({ statusCode: null }), ctx(b())),
  sc("backlinks.page_with_links_is_broken", "404, no backlinks", false, stored({ statusCode: 404 }), ctx(b({ backlinks: 0, referringDomains: 0 }))),
  sc("backlinks.page_with_links_is_broken", "200 with backlinks", false, stored(), ctx(b())),
  sc("backlinks.page_with_links_is_broken", "not looked up", false, stored({ statusCode: 404 }), ctx(null, [])),
  sc("backlinks.page_with_links_redirects", "301 with backlinks", true, stored({ statusCode: 301, redirectTarget: "https://example.com/new" }), ctx(b())),
  sc("backlinks.page_with_links_redirects", "301, no backlinks", false, stored({ statusCode: 301 }), ctx(b({ backlinks: 0 }))),
  sc("backlinks.page_with_links_redirects", "200", false, stored(), ctx(b())),
];

export default cases;
