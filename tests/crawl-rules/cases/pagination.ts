import { doc, page, pc, sc, siteCtx, stored, type RuleCase } from "../harness";

const URL2 = "https://example.com/blog?p=2";
const p2 = (head: string, body = "") => page(doc(`<title>t</title>${head}`, body), { url: URL2 });
const PAGER = '<a href="/blog?p=1">Previous</a><a href="/blog?p=3">Next</a>';
const LINKS = '<link rel="prev" href="/blog?p=1"><link rel="next" href="/blog?p=3">';
const pag = (o: Record<string, unknown>) => siteCtx({ site: { pagination: { non200: 0, sequenceErrors: 0, sample: "https://example.com/blog?p=9", ...o } } });

const cases: RuleCase[] = [
  sc("pagination.target_not_200", "next 404s", true, stored(), pag({ non200: 1 })),
  sc("pagination.target_not_200", "fine", false, stored(), pag({})),
  sc("pagination.sequence_error", "not reciprocal", true, stored(), pag({ sequenceErrors: 1 })),
  sc("pagination.sequence_error", "fine", false, stored(), pag({})),
  pc("pagination.url_not_linked", "no pager", true, p2(LINKS)),
  pc("pagination.url_not_linked", "pager links both", false, p2(LINKS, PAGER)),
  pc("pagination.multiple", "two next", true, p2('<link rel="next" href="/a"><link rel="next" href="/b">')),
  pc("pagination.multiple", "one each", false, p2(LINKS, PAGER)),
  pc("pagination.outside_head", "in body", true, page(`<html><head><title>t</title></head><body><link rel="next" href="/b"></body></html>`)),
  pc("pagination.outside_head", "in head", false, p2(LINKS, PAGER)),
  pc("pagination.canonicalised_to_first", "page 2 → page 1", true, p2(`${LINKS}<link rel="canonical" href="/blog?p=1">`, PAGER)),
  pc("pagination.canonicalised_to_first", "self-canonical", false, p2(`${LINKS}<link rel="canonical" href="${URL2}">`, PAGER)),
  pc("pagination.canonicalised_to_first", "first page: no prev", false, page(doc('<link rel="next" href="/blog?p=2"><link rel="canonical" href="/blog">', ""))),
];

export default cases;
