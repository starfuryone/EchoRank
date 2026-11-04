import type { Ga4Facts } from "@/lib/crawl-rules";
import { sc, siteCtx, stored, type RuleCase } from "../harness";

const g = (over: Partial<Ga4Facts> = {}): Ga4Facts => ({ sessions: 0, totalUsers: 0, engagementRate: 0, keyEvents: 0, ...over });
const ctx = (ga4: Ga4Facts | null, high = 0, capabilities: ("ga4")[] = ["ga4"]) => ({ ...siteCtx({ capabilities }), metrics: { ga4, highPriorityIssues: high } });

const cases: RuleCase[] = [
  sc("ga4.crawled_zero_sessions", "indexable, no sessions", true, stored(), ctx(g())),
  sc("ga4.crawled_zero_sessions", "has sessions", false, stored(), ctx(g({ sessions: 3 }))),
  sc("ga4.crawled_zero_sessions", "noindex", false, stored({ noindex: true }), ctx(g())),
  sc("ga4.crawled_zero_sessions", "redirect", false, stored({ statusCode: 301 }), ctx(g())),
  sc("ga4.crawled_zero_sessions", "no GA4 join", false, stored(), ctx(g(), 0, [])),
  sc("ga4.converting_page_has_issues", "key events and a high-priority issue", true, stored(), ctx(g({ sessions: 40, keyEvents: 2 }), 1)),
  sc("ga4.converting_page_has_issues", "key events, nothing high", false, stored(), ctx(g({ sessions: 40, keyEvents: 2 }), 0)),
  sc("ga4.converting_page_has_issues", "high issue, no key events", false, stored(), ctx(g({ sessions: 40 }), 3)),
];

export default cases;
