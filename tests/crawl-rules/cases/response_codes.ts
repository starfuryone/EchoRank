import { doc, page, pc, sc, siteCtx, stored, withFacts, type RuleCase } from "../harness";

const OK = doc("<title>Fine page</title>", "<p>Body</p>");
const checks = (clientErrors: number, serverErrors: number) =>
  withFacts(page(OK), (p) => {
    p.externalLinkChecks = { checked: 5, clientErrors, serverErrors, redirects: 0, sample: "https://gone.example/" };
  });

const cases: RuleCase[] = [
  pc("response_codes.internal_4xx", "404", true, page(null, { statusCode: 404 }), { status: 404 }),
  pc("response_codes.internal_4xx", "200", false, page(OK)),
  pc("response_codes.internal_5xx", "503", true, page(null, { statusCode: 503 }), { status: 503 }),
  pc("response_codes.internal_5xx", "404 is not 5xx", false, page(null, { statusCode: 404 })),
  pc("response_codes.external_4xx", "a checked link 404s", true, checks(1, 0), { count: 1 }),
  pc("response_codes.external_4xx", "all checked links fine", false, checks(0, 0)),
  pc("response_codes.external_4xx", "not checked at all", false, page(OK)),
  pc("response_codes.external_5xx", "a checked link 500s", true, checks(0, 2), { count: 2 }),
  pc("response_codes.external_5xx", "only 4xx", false, checks(1, 0)),
  pc("response_codes.no_response", "timeout", true, page(null, { statusCode: null, fetchError: "timeout" }), { reason: "timeout" }),
  pc("response_codes.no_response", "a response", false, page(OK)),
  pc("response_codes.internal_3xx", "one hop", true, page(OK, { redirectHops: 1, redirectTarget: "https://example.com/new" })),
  pc("response_codes.internal_3xx", "no hop", false, page(OK)),
  pc("response_codes.redirect_chain", "three hops", true, page(OK, { redirectHops: 3 }), { hops: 3 }),
  pc("response_codes.redirect_chain", "one hop", false, page(OK, { redirectHops: 1 })),
  sc("response_codes.redirect_loop", "loop found", true, stored(), siteCtx({ site: { redirectLoop: "/a → /b → /a" } })),
  sc("response_codes.redirect_loop", "no loop", false, stored()),
  pc("response_codes.meta_refresh", "refresh tag", true, page(doc('<meta http-equiv="refresh" content="0;url=/x">', "")), { content: "0;url=/x" }),
  pc("response_codes.meta_refresh", "none", false, page(OK)),
  pc("response_codes.redirect_to_error", "redirect lands on 404", true, page(null, { redirectHops: 1, statusCode: 404 })),
  pc("response_codes.redirect_to_error", "plain 404, no redirect", false, page(null, { statusCode: 404 })),
  pc("response_codes.redirect_to_error", "redirect lands on 200", false, page(OK, { redirectHops: 1 })),
  pc("response_codes.blocked_by_robots", "disallowed", true, page(null, { blockedByRobots: true, statusCode: null })),
  pc("response_codes.blocked_by_robots", "allowed", false, page(OK)),
  sc("response_codes.inlinks_to_3xx", "linked redirect", true, stored({ redirectTarget: "https://example.com/new", inlinkCount: 4 })),
  sc("response_codes.inlinks_to_3xx", "redirect nobody links to", false, stored({ redirectTarget: "https://example.com/new", inlinkCount: 0 })),
  sc("response_codes.inlinks_to_3xx", "linked, not a redirect", false, stored({ inlinkCount: 4 })),
];

export default cases;
