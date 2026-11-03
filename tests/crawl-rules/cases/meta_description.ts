import { doc, page, pc, sc, siteCtx, stored, type RuleCase } from "../harness";

const withDesc = (d: string) => page(doc(`<title>t</title><meta name="description" content="${d}">`, ""));
const GOOD = "Round-the-clock emergency plumbers across Leeds, at your door within the hour.";

const cases: RuleCase[] = [
  pc("meta_description.missing", "none", true, page(doc("<title>t</title>", ""))),
  pc("meta_description.missing", "empty", true, withDesc("")),
  pc("meta_description.missing", "present", false, withDesc(GOOD)),
  sc("meta_description.duplicate", "shared", true, stored(), siteCtx({ site: { duplicateMetaCount: 2 } })),
  sc("meta_description.duplicate", "unique", false, stored()),
  pc("meta_description.over_155_chars", "160", true, withDesc("a ".repeat(80)), { length: 159 }),
  pc("meta_description.over_155_chars", "fine", false, withDesc(GOOD)),
  pc("meta_description.under_70_chars", "short", true, withDesc("Plumbers.")),
  pc("meta_description.under_70_chars", "fine", false, withDesc(GOOD)),
  pc("meta_description.over_985_px", "wide", true, withDesc("W".repeat(80))),
  pc("meta_description.over_985_px", "narrow, same length", false, withDesc("i".repeat(80))),
  pc("meta_description.multiple", "two", true, page(doc(`<meta name="description" content="a"><meta name="description" content="b">`, ""))),
  pc("meta_description.multiple", "one", false, withDesc(GOOD)),
  pc("meta_description.outside_head", "in body", true, page(`<html><head></head><body><meta name="description" content="x"></body></html>`)),
  pc("meta_description.outside_head", "in head", false, withDesc(GOOD)),
];

export default cases;
