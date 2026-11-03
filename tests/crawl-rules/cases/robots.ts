import { doc, page, pc, type RuleCase } from "../harness";

const P = (liveAllowed: boolean, customAllowed: boolean) => ({
  ...page(doc("<title>t</title>", "<h1>x</h1>")),
  robotsTest: { liveAllowed, customAllowed, liveLine: liveAllowed ? null : 2, customLine: customAllowed ? null : 3 },
});

const cases: RuleCase[] = [
  pc("robots.would_block", "draft disallows a crawlable URL", true, P(true, false), { customLine: 3 }),
  pc("robots.would_block", "both allow", false, P(true, true)),
  pc("robots.would_block", "no test running", false, page(doc("<title>t</title>", "<h1>x</h1>"))),

  pc("robots.would_allow", "draft opens a blocked URL", true, P(false, true), { liveLine: 2 }),
  pc("robots.would_allow", "both block", false, P(false, false)),
  pc("robots.would_allow", "both allow", false, P(true, true)),
];

export default cases;
