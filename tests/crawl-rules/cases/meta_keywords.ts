import { doc, page, pc, type RuleCase } from "../harness";

const cases: RuleCase[] = [
  pc("meta_keywords.present", "tag present", true, page(doc('<meta name="keywords" content="plumber, leeds">', "")), {
    keywords: "plumber, leeds",
  }),
  pc("meta_keywords.present", "no tag", false, page(doc("<title>t</title>", ""))),
];

export default cases;
