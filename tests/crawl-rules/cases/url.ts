import { doc, page, pc, type RuleCase } from "../harness";

const OK = doc("<title>Fine page</title>", "<p>Body</p>");
const at = (url: string, html: string | null = OK) => page(html, { url });
const canon = (href: string, url: string) => page(doc(`<link rel="canonical" href="${href}">`, ""), { url });

const cases: RuleCase[] = [
  pc("url.non_ascii", "accented slug", true, at("https://example.com/caf%C3%A9")),
  pc("url.non_ascii", "ascii slug", false, at("https://example.com/cafe")),
  pc("url.underscores", "underscore", true, at("https://example.com/red_shoes")),
  pc("url.underscores", "hyphen", false, at("https://example.com/red-shoes")),
  pc("url.uppercase", "capital", true, at("https://example.com/Shoes")),
  pc("url.uppercase", "encoded bytes are not uppercase", false, at("https://example.com/caf%C3%A9")),
  pc("url.uppercase", "on a 404 too", true, page(null, { url: "https://example.com/Gone", statusCode: 404 })),
  pc("url.parameters", "query", true, at("https://example.com/shoes?color=red"), { params: 1 }),
  pc("url.parameters", "none", false, at("https://example.com/shoes")),
  pc("url.over_115_chars", "long", true, at(`https://example.com/${"a".repeat(100)}`)),
  pc("url.over_115_chars", "short", false, at("https://example.com/shoes")),
  pc("url.multiple_slashes", "double slash", true, at("https://example.com/shop//shoes")),
  pc("url.multiple_slashes", "single", false, at("https://example.com/shop/shoes")),
  pc("url.repetitive_path", "repeat", true, at("https://example.com/shop/shoes/shop/shoes"), { segment: "shop" }),
  pc("url.repetitive_path", "distinct", false, at("https://example.com/shop/shoes/red")),
  pc("url.contains_space", "%20", true, at("https://example.com/my%20page")),
  pc("url.contains_space", "hyphen", false, at("https://example.com/my-page")),
  pc("url.internal_search", "?q=", true, at("https://example.com/search?q=shoes"), { param: "q" }),
  pc("url.internal_search", "other params", false, at("https://example.com/shoes?page=2")),
  pc("url.trailing_slash_variant", "canonical adds the slash", true, canon("/shoes/", "https://example.com/shoes")),
  pc("url.trailing_slash_variant", "self-canonical", false, canon("/shoes", "https://example.com/shoes")),
  pc("url.trailing_slash_variant", "canonical elsewhere", false, canon("/boots/", "https://example.com/shoes")),
];

export default cases;
