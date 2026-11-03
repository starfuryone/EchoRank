import { PAGE_URL, SECURE_HEADERS, doc, page, pc, type RuleCase } from "../harness";

const robots = (content: string, extra = "") => page(doc(`<title>t</title><meta name="robots" content="${content}">${extra}`, "<h1>x</h1>"));
const xrt = (value: string, html = doc("<title>t</title>", "<h1>x</h1>")) => page(html, { headers: { ...SECURE_HEADERS, "x-robots-tag": value } });
const plain = page(doc("<title>t</title>", "<h1>x</h1>"));

const cases: RuleCase[] = [
  pc("directives.noindex", "meta", true, robots("noindex, follow"), { source: "meta" }),
  pc("directives.noindex", "header, non-HTML", true, page(null, { contentType: "application/pdf", headers: { "x-robots-tag": "noindex" } }), { source: "header" }),
  pc("directives.noindex", "googlebot-addressed header", true, xrt("googlebot: noindex")),
  pc("directives.noindex", "other bot's header is not ours", false, xrt("otherbot: noindex")),
  pc("directives.noindex", "none implies noindex", true, robots("none")),
  pc("directives.noindex", "index", false, robots("index, follow")),
  pc("directives.noindex", "a 404 is not judged", false, page(doc('<meta name="robots" content="noindex">', ""), { statusCode: 404 })),
  pc("directives.nofollow", "meta", true, robots("index, nofollow")),
  pc("directives.nofollow", "follow", false, robots("index, follow")),
  pc("directives.none", "none", true, robots("none")),
  pc("directives.none", "noindex only", false, robots("noindex")),
  pc("directives.noarchive", "present", true, robots("noarchive")),
  pc("directives.noarchive", "absent", false, plain),
  pc("directives.nosnippet", "present", true, robots("nosnippet")),
  pc("directives.nosnippet", "absent", false, plain),
  pc("directives.max_snippet", "limit", true, robots("max-snippet:50")),
  pc("directives.max_snippet", "header form", true, xrt("max-snippet: 20")),
  pc("directives.max_snippet", "absent", false, plain),
  pc("directives.noimageindex", "present", true, robots("noimageindex")),
  pc("directives.noimageindex", "absent", false, plain),
  pc("directives.notranslate", "present", true, robots("notranslate")),
  pc("directives.notranslate", "absent", false, plain),
  pc("directives.unavailable_after", "header", true, xrt("unavailable_after: 2027-01-01")),
  pc("directives.unavailable_after", "absent", false, plain),
  pc("directives.noindex_canonical_conflict", "noindex + canonical elsewhere", true, robots("noindex", '<link rel="canonical" href="https://example.com/main">')),
  pc("directives.noindex_canonical_conflict", "noindex + self canonical", false, robots("noindex", `<link rel="canonical" href="${PAGE_URL}">`)),
  pc("directives.noindex_canonical_conflict", "canonical elsewhere, indexable", false, robots("index", '<link rel="canonical" href="https://example.com/main">')),
  pc("directives.noindex_in_sitemap", "listed", true, page(doc('<meta name="robots" content="noindex">', ""), { inSitemap: true })),
  pc("directives.noindex_in_sitemap", "not listed", false, page(doc('<meta name="robots" content="noindex">', ""), { inSitemap: false })),
  pc("directives.noindex_in_sitemap", "listed, indexable", false, plain),
  pc("directives.outside_head", "in body", true, page('<html><head></head><body><meta name="robots" content="noindex"></body></html>')),
  pc("directives.outside_head", "in head", false, robots("noindex")),
  pc("directives.header_meta_conflict", "header noindex, meta index", true, xrt("noindex", doc('<meta name="robots" content="index, follow">', ""))),
  pc("directives.header_meta_conflict", "both noindex", false, xrt("noindex", doc('<meta name="robots" content="noindex">', ""))),
  pc("directives.header_meta_conflict", "header only", false, xrt("noindex")),
];

export default cases;
