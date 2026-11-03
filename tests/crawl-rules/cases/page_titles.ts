import { doc, page, pc, sc, siteCtx, stored, type RuleCase } from "../harness";

const titled = (t: string, body = "<h1>Something else entirely</h1>") => page(doc(`<title>${t}</title>`, body));
const GOOD = "Emergency plumbers in Leeds, open 24 hours";

const cases: RuleCase[] = [
  pc("page_titles.missing", "no title", true, page(doc("", "<p>x</p>"))),
  pc("page_titles.missing", "empty title", true, titled("  ")),
  pc("page_titles.missing", "title present", false, titled(GOOD)),
  pc("page_titles.missing", "non-HTML response is not checked", false, page(null, { contentType: "application/pdf" })),
  sc("page_titles.duplicate", "shared by 3 pages", true, stored(), siteCtx({ site: { duplicateTitleCount: 3 } })),
  sc("page_titles.duplicate", "unique", false, stored()),
  sc("page_titles.duplicate", "no title at all", false, stored({ title: null }), siteCtx({ site: { duplicateTitleCount: 3 } })),
  pc("page_titles.over_60_chars", "65 chars", true, titled("a".repeat(65)), { length: 65 }),
  pc("page_titles.over_60_chars", "60 chars", false, titled("a".repeat(60))),
  pc("page_titles.over_70_chars", "75 chars", true, titled("a".repeat(75))),
  pc("page_titles.over_70_chars", "65 chars", false, titled("a".repeat(65))),
  pc("page_titles.under_30_chars", "short", true, titled("Plumber")),
  pc("page_titles.under_30_chars", "long enough", false, titled(GOOD)),
  pc("page_titles.over_561_px", "wide capitals", true, titled("W".repeat(40))),
  pc("page_titles.over_561_px", "narrow letters, same count", false, titled("i".repeat(40))),
  pc("page_titles.under_200_px", "tiny", true, titled("Home")),
  pc("page_titles.under_200_px", "normal", false, titled(GOOD)),
  pc("page_titles.same_as_h1", "identical, case aside", true, titled(GOOD, `<h1>${GOOD.toUpperCase()}</h1>`)),
  pc("page_titles.same_as_h1", "different", false, titled(GOOD)),
  pc("page_titles.multiple", "two", true, page(doc(`<title>${GOOD}</title><title>Other</title>`, "")), { count: 2 }),
  pc("page_titles.multiple", "one", false, titled(GOOD)),
  pc("page_titles.outside_head", "in body", true, page(`<html><head></head><body><title>${GOOD}</title></body></html>`)),
  pc("page_titles.outside_head", "in head", false, titled(GOOD)),
];

export default cases;
