import type { AiFacts } from "@/lib/crawl-rules";
import { sc, siteCtx, stored, type RuleCase } from "../harness";

const ctx = (ai: Partial<AiFacts> | null, capabilities: ("ai")[] = ["ai"]) => ({
  ...siteCtx({ capabilities }),
  metrics: { ai: ai === null ? null : { suggestedTitle: null, grammarIssues: null, ...ai } },
});

const cases: RuleCase[] = [
  sc("ai.suggested_title_differs", "a different title", true, stored({ title: "Home" }), ctx({ suggestedTitle: "Handmade oak tables | Acme" })),
  sc("ai.suggested_title_differs", "same title, other case and quotes", false, stored({ title: "Handmade Oak Tables" }), ctx({ suggestedTitle: "“handmade oak tables.”" })),
  sc("ai.suggested_title_differs", "page has no title", true, stored({ title: null }), ctx({ suggestedTitle: "Oak tables" })),
  sc("ai.suggested_title_differs", "title preset did not run", false, stored({ title: "Home" }), ctx({ grammarIssues: [] })),
  sc("ai.suggested_title_differs", "prompts did not run on this page", false, stored({ title: "Home" }), ctx({ suggestedTitle: "Oak" }, [])),
  sc("ai.grammar_issues", "two issues", true, stored(), ctx({ grammarIssues: ["teh → the", "its → it's"] })),
  sc("ai.grammar_issues", "none found", false, stored(), ctx({ grammarIssues: [] })),
  sc("ai.grammar_issues", "grammar preset did not run", false, stored(), ctx({ suggestedTitle: "x" })),
  sc("ai.grammar_issues", "no capability", false, stored(), ctx({ grammarIssues: ["a → b"] }, [])),
];

export default cases;
