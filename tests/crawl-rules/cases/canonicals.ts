import { PAGE_URL, SECURE_HEADERS, doc, page, pc, sc, siteCtx, stored, type RuleCase } from "../harness";

const canon = (href: string) => `<link rel="canonical" href="${href}">`;
const head = (h: string, over = {}) => page(doc(`<title>t</title>${h}`, "<h1>x</h1>"), over);
const linkHeader = (url: string) => ({ headers: { ...SECURE_HEADERS, link: `<${url}>; rel="canonical"` } });
const target = (t: { statusCode?: number | null; redirects?: boolean; noindex?: boolean }) =>
  siteCtx({ site: { canonicalTarget: { statusCode: 200, redirects: false, noindex: false, ...t } } });

const cases: RuleCase[] = [
  pc("canonicals.missing", "none", true, head("")),
  pc("canonicals.missing", "in HTML", false, head(canon(PAGE_URL))),
  pc("canonicals.missing", "in Link header only", false, head("", linkHeader(PAGE_URL))),
  pc("canonicals.canonicalised", "points elsewhere", true, head(canon("https://example.com/other")), { canonical: "https://example.com/other" }),
  pc("canonicals.canonicalised", "self, trailing slash aside", false, head(canon(`${PAGE_URL}/`))),
  pc("canonicals.multiple", "two", true, head(canon(PAGE_URL) + canon("https://example.com/b"))),
  pc("canonicals.multiple", "one", false, head(canon(PAGE_URL))),
  sc("canonicals.to_redirect", "target redirects", true, stored({ canonical: "https://example.com/old" }), target({ redirects: true })),
  sc("canonicals.to_redirect", "target fine", false, stored(), target({})),
  sc("canonicals.to_redirect", "self-canonical: no target", false, stored()),
  sc("canonicals.to_error", "target 404", true, stored(), target({ statusCode: 404 })),
  sc("canonicals.to_error", "target 200", false, stored(), target({})),
  sc("canonicals.to_noindex", "target noindex", true, stored(), target({ noindex: true })),
  sc("canonicals.to_noindex", "target indexable", false, stored(), target({})),
  pc("canonicals.relative", "relative", true, head(canon("/page"))),
  pc("canonicals.relative", "absolute", false, head(canon(PAGE_URL))),
  pc("canonicals.header_html_mismatch", "disagree", true, head(canon(PAGE_URL), linkHeader("https://example.com/other"))),
  pc("canonicals.header_html_mismatch", "agree", false, head(canon(PAGE_URL), linkHeader(PAGE_URL))),
  pc("canonicals.outside_head", "in body", true, page(`<html><head><title>t</title></head><body>${canon(PAGE_URL)}</body></html>`)),
  pc("canonicals.outside_head", "in head", false, head(canon(PAGE_URL))),
  pc("canonicals.to_http_from_https", "http target", true, head(canon("http://example.com/page"))),
  pc("canonicals.to_http_from_https", "https target", false, head(canon(PAGE_URL))),
  pc("canonicals.to_http_from_https", "page itself on http", false, head(canon("http://example.com/page"), { url: "http://example.com/page" })),
];

export default cases;
