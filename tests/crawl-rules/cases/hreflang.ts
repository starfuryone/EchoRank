import { PAGE_URL, doc, page, pc, sc, siteCtx, stored, type RuleCase } from "../harness";

// Exactly three valid and three invalid tags (plus the x-default keyword).
const VALID = ["en-gb", "es-419", "zh-hant-tw"];
const INVALID = ["en-uk", "xx", "es-999"];

const alt = (lang: string, href: string) => `<link rel="alternate" hreflang="${lang}" href="${href}">`;
const set = (...links: string[]) => page(doc(`<title>t</title>${links.join("")}`, "<h1>x</h1>"));
const FULL = [alt(VALID[0]!, PAGE_URL), alt(VALID[1]!, "https://example.com/es/page"), alt("x-default", PAGE_URL)];
const hl = (o: Record<string, number>) =>
  siteCtx({ site: { hreflang: { targets: 3, non200: 0, noindex: 0, notCanonical: 0, missingReturn: 0, langMismatch: 0, unlinked: 0, sample: "https://example.com/es/page", ...o } } });
const tagged = stored({ hreflang: [{ lang: VALID[0]!, href: PAGE_URL }] });

const cases: RuleCase[] = [
  ...VALID.map((v) => pc("hreflang.invalid_code", `valid: ${v}`, false, set(alt(v, PAGE_URL), alt("x-default", PAGE_URL)))),
  ...INVALID.map((v) => pc("hreflang.invalid_code", `invalid: ${v}`, true, set(alt(v, PAGE_URL)), { value: v })),
  sc("hreflang.missing_return_links", "one-way", true, tagged, hl({ missingReturn: 1 })),
  sc("hreflang.missing_return_links", "reciprocal", false, tagged, hl({})),
  sc("hreflang.inconsistent_language", "target lang differs", true, tagged, hl({ langMismatch: 1 })),
  sc("hreflang.inconsistent_language", "consistent", false, tagged, hl({})),
  sc("hreflang.target_not_200", "target 404", true, tagged, hl({ non200: 1 })),
  sc("hreflang.target_not_200", "all live", false, tagged, hl({})),
  sc("hreflang.unlinked_target", "only annotated", true, tagged, hl({ unlinked: 2 })),
  sc("hreflang.unlinked_target", "linked", false, tagged, hl({})),
  pc("hreflang.missing_self_reference", "no self entry", true, set(alt(VALID[1]!, "https://example.com/es/page"))),
  pc("hreflang.missing_self_reference", "self present", false, set(...FULL)),
  pc("hreflang.missing_self_reference", "no hreflang at all", false, set()),
  sc("hreflang.not_using_canonical", "alternate not canonical", true, tagged, hl({ notCanonical: 1 })),
  sc("hreflang.not_using_canonical", "canonical", false, tagged, hl({})),
  pc("hreflang.multiple_entries_for_language", "one value, two URLs", true, set(alt(VALID[0]!, PAGE_URL), alt(VALID[0]!, "https://example.com/uk"))),
  pc("hreflang.multiple_entries_for_language", "one URL each", false, set(...FULL)),
  pc("hreflang.missing_x_default", "none", true, set(alt(VALID[0]!, PAGE_URL), alt(VALID[1]!, "https://example.com/es/page"))),
  pc("hreflang.missing_x_default", "present", false, set(...FULL)),
  pc("hreflang.outside_head", "in body", true, page(`<html><head><title>t</title></head><body>${alt(VALID[0]!, PAGE_URL)}</body></html>`)),
  pc("hreflang.outside_head", "in head", false, set(...FULL)),
  sc("hreflang.target_noindex", "alternate noindex", true, tagged, hl({ noindex: 1 })),
  sc("hreflang.target_noindex", "indexable", false, tagged, hl({})),
  sc("hreflang.missing_on_multilingual_site", "two languages, no annotations", true, stored(), siteCtx({ job: { langsSeen: 2 } })),
  sc("hreflang.missing_on_multilingual_site", "annotated", false, tagged, siteCtx({ job: { langsSeen: 2 } })),
  sc("hreflang.missing_on_multilingual_site", "one language", false, stored()),
];

export default cases;
