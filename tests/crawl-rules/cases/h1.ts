import { doc, page, pc, sc, siteCtx, stored, type RuleCase } from "../harness";

const body = (b: string) => page(doc("<title>t</title>", b));

const cases: RuleCase[] = [
  pc("h1.missing", "no h1", true, body("<h2>Sub</h2>")),
  pc("h1.missing", "has h1", false, body("<h1>Main</h1>")),
  sc("h1.duplicate", "shared", true, stored(), siteCtx({ site: { duplicateH1Count: 4 } })),
  sc("h1.duplicate", "unique", false, stored()),
  sc("h1.duplicate", "no h1", false, stored({ h1First: null }), siteCtx({ site: { duplicateH1Count: 4 } })),
  pc("h1.over_70_chars", "long", true, body(`<h1>${"word ".repeat(16)}</h1>`)),
  pc("h1.over_70_chars", "short", false, body("<h1>Main</h1>")),
  pc("h1.multiple", "two", true, body("<h1>A</h1><h1>B</h1>"), { count: 2 }),
  pc("h1.multiple", "one", false, body("<h1>A</h1>")),
  sc("h1.matches_other_title", "another page's title", true, stored(), siteCtx({ site: { h1MatchesOtherTitleCount: 1 } })),
  sc("h1.matches_other_title", "no match", false, stored()),
  pc("h1.empty", "image without alt", true, body('<h1><img src="logo.png"></h1>')),
  pc("h1.empty", "heading with text", false, body("<h1>Main</h1>")),
];

export default cases;
