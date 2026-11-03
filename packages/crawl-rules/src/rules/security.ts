// security — transport, mixed content and the response headers browsers use
// to protect visitors. Header rules apply to HTML pages served over HTTPS
// (HSTS on plain HTTP means nothing).

import { ev, pageRule } from "../engine";
import type { PageFacts, Rule } from "../types";

const F = "security" as const;

const https = (p: PageFacts) => /^https:/i.test(p.finalUrl);
const has = (p: PageFacts, h: string) => (p.headers[h] ?? "").trim() !== "";

const header = (id: string, name: string, priority: Rule["priority"], skip?: (p: PageFacts) => boolean) =>
  pageRule({
    id: `security.${id}`,
    family: F,
    kind: "warning",
    priority,
    detect: (p) => (https(p) && !has(p, name) && !(skip && skip(p)) ? ev({ header: name }) : null),
  });

export const RULES: Rule[] = [
  pageRule({
    id: "security.http_url",
    family: F,
    kind: "issue",
    priority: "high",
    applies: "fetched",
    detect: (p) => (p.statusCode !== null && /^http:/i.test(p.finalUrl) ? ev({ url: p.finalUrl }) : null),
  }),
  pageRule({
    id: "security.mixed_content",
    family: F,
    kind: "issue",
    priority: "high",
    applies: "html",
    detect: (p) => {
      if (!https(p)) return null;
      const hits = p.html!.resources.filter((r) => /^http:\/\//i.test(r));
      return hits.length ? ev({ count: hits.length, sample: hits[0] }) : null;
    },
  }),
  pageRule({
    id: "security.form_on_http",
    family: F,
    kind: "issue",
    priority: "high",
    applies: "html",
    detect: (p) => {
      const hits = p.html!.formActions.filter((a) => /^http:\/\//i.test(a));
      return hits.length ? ev({ count: hits.length, sample: hits[0] }) : null;
    },
  }),
  pageRule({
    id: "security.unsafe_target_blank",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) => {
      const hits = p.html!.anchors.filter(
        (a) => a.target === "_blank" && !a.internal && /^https?:/i.test(a.href) && !/\bno(opener|referrer)\b/.test(a.rel),
      );
      return hits.length ? ev({ count: hits.length, sample: hits[0]!.href }) : null;
    },
  }),
  header("missing_hsts", "strict-transport-security", "medium"),
  header("missing_csp", "content-security-policy", "low"),
  header("missing_x_content_type_options", "x-content-type-options", "low"),
  // frame-ancestors in a CSP supersedes X-Frame-Options.
  header("missing_x_frame_options", "x-frame-options", "low", (p) =>
    /frame-ancestors/i.test(p.headers["content-security-policy"] ?? ""),
  ),
  header("missing_referrer_policy", "referrer-policy", "low"),
  pageRule({
    id: "security.protocol_relative_resource",
    family: F,
    kind: "warning",
    priority: "low",
    applies: "html",
    detect: (p) => {
      const hits = p.html!.resources.filter((r) => r.startsWith("//"));
      return hits.length ? ev({ count: hits.length, sample: hits[0] }) : null;
    },
  }),
  pageRule({
    id: "security.bad_content_type",
    family: F,
    kind: "warning",
    priority: "medium",
    applies: "html",
    detect: (p) => {
      const ct = p.headers["content-type"] ?? p.contentType ?? "";
      return /^\s*(text\/html|application\/xhtml\+xml)/i.test(ct) ? null : ev({ contentType: ct || null });
    },
  }),
];
