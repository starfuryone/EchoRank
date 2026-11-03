import { SECURE_HEADERS, doc, page, pc, type RuleCase } from "../harness";

const OK = doc("<title>t</title>", "<h1>x</h1>");
const body = (b: string, over = {}) => page(doc("<title>t</title>", b), over);
const without = (name: string, extra: Record<string, string> = {}) => {
  const h = { ...SECURE_HEADERS, ...extra };
  delete h[name];
  return page(OK, { headers: h });
};
const HTTP = { url: "http://example.com/page" };

const cases: RuleCase[] = [
  pc("security.http_url", "http", true, page(OK, HTTP)),
  pc("security.http_url", "https", false, page(OK)),
  pc("security.mixed_content", "http script", true, body('<script src="http://cdn.example.org/a.js"></script>'), { count: 1 }),
  pc("security.mixed_content", "https script", false, body('<script src="https://cdn.example.org/a.js"></script>')),
  pc("security.mixed_content", "page itself on http: http_url covers it", false, body('<img src="http://x.org/a.png" alt="">', HTTP)),
  pc("security.form_on_http", "http action", true, body('<form action="http://example.com/post"></form>')),
  pc("security.form_on_http", "no action on an http page", true, body("<form></form>", HTTP)),
  pc("security.form_on_http", "https", false, body('<form action="/post"></form>')),
  pc("security.unsafe_target_blank", "no rel", true, body('<a href="https://other.org/" target="_blank">x</a>')),
  pc("security.unsafe_target_blank", "noopener", false, body('<a href="https://other.org/" target="_blank" rel="noopener">x</a>')),
  pc("security.unsafe_target_blank", "internal", false, body('<a href="/x" target="_blank">x</a>')),
  pc("security.missing_hsts", "absent", true, without("strict-transport-security")),
  pc("security.missing_hsts", "present", false, page(OK)),
  pc("security.missing_hsts", "http page: not applicable", false, page(OK, { ...HTTP, headers: {} })),
  pc("security.missing_csp", "absent", true, without("content-security-policy")),
  pc("security.missing_csp", "present", false, page(OK)),
  pc("security.missing_x_content_type_options", "absent", true, without("x-content-type-options")),
  pc("security.missing_x_content_type_options", "present", false, page(OK)),
  pc("security.missing_x_frame_options", "absent", true, without("x-frame-options")),
  pc("security.missing_x_frame_options", "CSP frame-ancestors instead", false, without("x-frame-options", { "content-security-policy": "frame-ancestors 'self'" })),
  pc("security.missing_referrer_policy", "absent", true, without("referrer-policy")),
  pc("security.missing_referrer_policy", "present", false, page(OK)),
  pc("security.protocol_relative_resource", "//cdn", true, body('<script src="//cdn.example.org/a.js"></script>')),
  pc("security.protocol_relative_resource", "explicit", false, body('<script src="https://cdn.example.org/a.js"></script>')),
  pc("security.bad_content_type", "text/plain", true, page(OK, { headers: { ...SECURE_HEADERS, "content-type": "text/plain" }, contentType: "text/plain" })),
  pc("security.bad_content_type", "text/html", false, page(OK)),
];

export default cases;
