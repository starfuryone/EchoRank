import { doc, page, pc, sc, siteCtx, stored, type RuleCase } from "../harness";

const body = (b: string) => page(doc("<title>t</title>", `<h1>Main</h1>${b}`));

const cases: RuleCase[] = [
  pc("h2.missing", "none", true, body("<p>x</p>")),
  pc("h2.missing", "present", false, body("<h2>Section</h2>")),
  sc("h2.duplicate", "shared", true, stored(), siteCtx({ site: { duplicateH2Count: 9 } })),
  sc("h2.duplicate", "unique", false, stored()),
  pc("h2.over_70_chars", "long", true, body(`<h2>${"word ".repeat(16)}</h2>`)),
  pc("h2.over_70_chars", "short", false, body("<h2>Section</h2>")),
  pc("h2.repeated_on_page", "same twice, case aside", true, body("<h2>Prices</h2><h2>prices</h2>"), { h2: "prices" }),
  pc("h2.repeated_on_page", "distinct", false, body("<h2>Prices</h2><h2>Reviews</h2>")),
  pc("h2.repeated_on_page", "two empties are the empty rule's business", false, body("<h2></h2><h2></h2>")),
  pc("h2.non_sequential", "h3 first", true, body("<h3>Detail</h3><h2>Section</h2>")),
  pc("h2.non_sequential", "in order", false, body("<h2>Section</h2><h3>Detail</h3>")),
  pc("h2.empty", "empty", true, body("<h2> </h2>")),
  pc("h2.empty", "text", false, body("<h2>Section</h2>")),
];

export default cases;
