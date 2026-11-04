import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "ai.suggested_title_differs": {
    name: "AI suggests a different title",
    description: "The crawl's \"suggest title and description\" prompt proposed a title that differs from the page's current one. It is a suggestion, not a defect: compare the two and keep whichever describes the page better for searchers.",
    howToFix: "Read the suggestion on the Extraction tab next to the current title, and adopt it, adapt it or ignore it.",
  },
  "ai.grammar_issues": {
    name: "Grammar or spelling issues found by AI",
    description: "The crawl's grammar prompt listed mistakes in this page's visible text. The evidence shows how many and the first one; the full list is on the Extraction tab. AI can be wrong, so check each one.",
    howToFix: "Correct the confirmed mistakes in the page copy, then re-crawl.",
  },
};
