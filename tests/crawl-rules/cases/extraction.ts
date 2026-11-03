import { doc, page, pc, type RuleCase } from "../harness";

const P = (custom: { extractorsEmpty: string[]; extractorsFound: number; searchMatches: { name: string; count: number }[] }) => ({
  ...page(doc("<title>t</title>", "<h1>x</h1>")),
  custom,
});
const none = { extractorsEmpty: [], extractorsFound: 0, searchMatches: [] };

const cases: RuleCase[] = [
  pc("extraction.empty", "one extractor empty, another found", true, P({ ...none, extractorsEmpty: ["Price", "SKU"], extractorsFound: 1 }), {
    empty: "Price, SKU",
    count: 2,
  }),
  pc("extraction.empty", "every extractor empty: another kind of page", false, P({ ...none, extractorsEmpty: ["Price"], extractorsFound: 0 })),
  pc("extraction.empty", "every extractor found something", false, P({ ...none, extractorsFound: 2 })),
  pc("extraction.empty", "no extractors on the crawl", false, page(doc("<title>t</title>", "<h1>x</h1>"))),

  pc("search.match", "two searches matched", true, P({ ...none, searchMatches: [{ name: "staging", count: 2 }, { name: "UA-", count: 1 }] }), {
    searches: "staging (2), UA- (1)",
    matches: 3,
  }),
  pc("search.match", "searches ran, none matched", false, P(none)),
  pc("search.match", "no searches on the crawl", false, page(doc("<title>t</title>", "<h1>x</h1>"))),
];

export default cases;
