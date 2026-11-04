import type { AmpValidationFacts } from "@/lib/crawl-rules";
import { doc, page, sc, siteCtx, stored, withFacts, type RuleCase } from "../harness";

const AMP_URL = "https://example.com/page/amp";
const target = (over: Partial<{ statusCode: number | null; isAmp: boolean; canonical: string | null }> = {}) =>
  siteCtx({ site: { ampTarget: { url: AMP_URL, statusCode: 200, isAmp: true, canonical: "https://example.com/page", ...over } } });

/** An AMP document (parsed by the real extractor, so <html amp> detection is exercised). */
const ampPage = (head: string, attr = "amp") =>
  page(doc(head, "<p>x</p>").replace(/<html([^>]*)>/i, `<html$1 ${attr}>`));
const fail: AmpValidationFacts = { status: "FAIL", errorCount: 4, messages: ["1:1 a", "2:1 b", "3:1 c"] };
const amp = (facts: AmpValidationFacts) => withFacts(ampPage('<title>t</title><link rel="canonical" href="https://example.com/page">'), (p) => void (p.amp = facts));

const cases: RuleCase[] = [
  sc("amp.link_non_200", "AMP target 404", true, stored(), target({ statusCode: 404 })),
  sc("amp.link_non_200", "AMP target no response", true, stored(), target({ statusCode: null })),
  sc("amp.link_non_200", "AMP target 200", false, stored(), target()),
  sc("amp.link_non_200", "no amphtml", false, stored(), siteCtx()),

  { rule: "amp.invalid", name: "validator FAIL", fires: true, page: amp(fail), capabilities: ["amp"], evidence: { count: 4, value: "1:1 a | 2:1 b | 3:1 c" } },
  { rule: "amp.invalid", name: "validator PASS", fires: false, page: amp({ status: "PASS", errorCount: 0, messages: [] }), capabilities: ["amp"] },
  { rule: "amp.invalid", name: "no validator", fires: false, page: amp(fail), capabilities: [] },

  { rule: "amp.missing_canonical", name: "<html amp>, no canonical", fires: true, page: ampPage("<title>t</title>") },
  { rule: "amp.missing_canonical", name: "<html ⚡>, no canonical", fires: true, page: ampPage("<title>t</title>", "⚡") },
  { rule: "amp.missing_canonical", name: "AMP with canonical", fires: false, page: ampPage('<title>t</title><link rel="canonical" href="https://example.com/page">') },
  { rule: "amp.missing_canonical", name: "regular page, no canonical", fires: false, page: page(doc("<title>t</title>", "<p>x</p>")) },

  sc("amp.canonical_mismatch", "AMP canonical names another page", true, stored(), target({ canonical: "https://example.com/other" })),
  sc("amp.canonical_mismatch", "points back (trailing slash)", false, stored(), target({ canonical: "https://example.com/page/" })),
  sc("amp.canonical_mismatch", "AMP has no canonical (missing_canonical's job)", false, stored(), target({ canonical: null })),
  sc("amp.canonical_mismatch", "target not AMP", false, stored(), target({ isAmp: false, canonical: "https://example.com/other" })),

  sc("amp.non_amp_linked_as_amp", "target is a regular page", true, stored(), target({ isAmp: false })),
  sc("amp.non_amp_linked_as_amp", "target is AMP", false, stored(), target()),
  sc("amp.non_amp_linked_as_amp", "target 404 (link_non_200's job)", false, stored(), target({ isAmp: false, statusCode: 404 })),

  sc("amp.not_in_sitemap", "AMP page outside the sitemap", true, stored({ isAmp: true, inSitemap: false }), siteCtx()),
  sc("amp.not_in_sitemap", "AMP page in the sitemap", false, stored({ isAmp: true, inSitemap: true }), siteCtx()),
  sc("amp.not_in_sitemap", "no sitemap found", false, stored({ isAmp: true, inSitemap: false }), siteCtx({ job: { sitemap: { found: false } as never } })),
  sc("amp.not_in_sitemap", "regular page", false, stored({ isAmp: false, inSitemap: false }), siteCtx()),
];

export default cases;
