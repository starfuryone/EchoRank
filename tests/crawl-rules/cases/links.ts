import { doc, page, pc, sc, siteCtx, stored, withFacts, type RuleCase } from "../harness";

const body = (b: string) => page(doc("<title>t</title>", b));
const a = (href: string, text = "Our pricing guide", attrs = "") => `<a href="${href}" ${attrs}>${text}</a>`;
const NAV = a("/about", "About us");
const many = (n: number, base: string) => Array.from({ length: n }, (_, i) => a(`${base}${i}`, `Page ${i}`)).join("");
const redirectChecks = (redirects: number) =>
  withFacts(body(NAV), (p) => {
    p.externalLinkChecks = { checked: 4, clientErrors: 0, serverErrors: 0, redirects, sample: null };
  });

const cases: RuleCase[] = [
  pc("links.high_external_outlinks", "120 external", true, body(NAV + many(120, "https://other.org/p")), { count: 120 }),
  pc("links.high_external_outlinks", "a few", false, body(NAV + many(5, "https://other.org/p"))),
  pc("links.high_internal_outlinks", "600 internal", true, body(many(600, "/p"))),
  pc("links.high_internal_outlinks", "same link repeated counts once", false, body(a("/p").repeat(600))),
  pc("links.no_internal_outlinks", "only external and mailto", true, body(a("https://other.org/") + a("mailto:x@y.z"))),
  pc("links.no_internal_outlinks", "has one", false, body(NAV)),
  sc("links.inlinks_only_nofollow", "nofollow only", true, stored({ inlinkCount: 0 }), siteCtx({ site: { nofollowInlinkCount: 2 } })),
  sc("links.inlinks_only_nofollow", "also followed", false, stored({ inlinkCount: 3 }), siteCtx({ site: { nofollowInlinkCount: 2 } })),
  pc("links.non_descriptive_anchor", "click here", true, body(NAV + a("/x", "Click here!")), { sample: "Click here!" }),
  pc("links.non_descriptive_anchor", "French", true, body(NAV + a("/x", "En savoir plus »"))),
  pc("links.non_descriptive_anchor", "descriptive", false, body(NAV + a("/x"))),
  pc("links.localhost_links", "localhost", true, body(NAV + a("http://localhost:3000/x"))),
  pc("links.localhost_links", "production", false, body(NAV)),
  pc("links.internal_nofollow", "internal nofollow", true, body(NAV + a("/x", "X page", 'rel="nofollow"'))),
  pc("links.internal_nofollow", "external nofollow is fine", false, body(NAV + a("https://other.org/", "Other", 'rel="nofollow sponsored"'))),
  sc("links.outlinks_to_redirect", "links to redirects", true, stored(), siteCtx({ site: { outlinksToRedirect: 3 } })),
  sc("links.outlinks_to_redirect", "none", false, stored()),
  pc("links.internal_with_parameters", "?sort=", true, body(NAV + a("/shop?sort=price"))),
  pc("links.internal_with_parameters", "clean", false, body(NAV)),
  sc("links.only_one_inlink", "one", true, stored({ inlinkCount: 1 })),
  sc("links.only_one_inlink", "three", false, stored({ inlinkCount: 3 })),
  sc("links.deep_page", "depth 5", true, stored({ depth: 5 }), undefined),
  sc("links.deep_page", "depth 2", false, stored({ depth: 2 })),
  sc("links.orphan", "orphan", true, stored(), siteCtx({ site: { orphan: true } })),
  sc("links.orphan", "linked", false, stored()),
  pc("links.external_to_redirect", "two redirect", true, redirectChecks(2)),
  pc("links.external_to_redirect", "none", false, redirectChecks(0)),
  pc("links.anchor_over_100_chars", "whole paragraph linked", true, body(NAV + a("/x", "word ".repeat(30)))),
  pc("links.anchor_over_100_chars", "short", false, body(NAV)),
  pc("links.to_http", "http link", true, body(NAV + a("http://other.org/"))),
  pc("links.to_http", "https only", false, body(NAV + a("https://other.org/"))),
];

export default cases;
