import type { SpellingFacts } from "@/lib/crawl-rules";
import { doc, page, withFacts, type RuleCase } from "../harness";

const spelled = (s: Partial<SpellingFacts>) =>
  withFacts(page(doc("<title>t</title>", "<p>text</p>")), (p) => {
    p.spelling = { lang: "en", supported: true, checked: 120, misspelled: 0, sample: [], ...s };
  });
const sp = (rule: string, name: string, fires: boolean, s: Partial<SpellingFacts>, capabilities = ["spell" as const]): RuleCase => ({
  rule,
  name,
  fires,
  page: spelled(s),
  capabilities,
});

const cases: RuleCase[] = [
  { ...sp("spelling.misspellings", "two words", true, { misspelled: 2, sample: ["teh", "recieve"] }), evidence: { misspelled: 2, sample: "teh, recieve" } },
  sp("spelling.misspellings", "clean", false, {}),
  sp("spelling.misspellings", "spell check off for the job", false, { misspelled: 2 }, []),
  sp("spelling.misspellings", "unsupported language is not a misspelling", false, { lang: "es", supported: false, misspelled: 0 }),
  sp("spelling.over_5_misspellings", "six", true, { misspelled: 6 }),
  sp("spelling.over_5_misspellings", "five is the line", false, { misspelled: 5 }),
  { ...sp("spelling.unsupported_language", "Spanish page", true, { lang: "es", supported: false }), evidence: { lang: "es" } },
  sp("spelling.unsupported_language", "French page", false, { lang: "fr" }),
];

export default cases;
