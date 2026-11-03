// canonicals — rel=canonical in the HTML and in the Link response header.
// Where the canonical points (a redirect, an error, a noindex page) needs the
// target's own row, so those three are site rules reading ctx.site.canonicalTarget.

import { ev, pageRule, siteRule } from "../engine";
import type { PageFacts, Rule } from "../types";

const F = "canonicals" as const;

/** rel=canonical from a Link header: `<https://x/>; rel="canonical"`. */
export function canonicalFromHeader(link: string | undefined): string | null {
  if (!link) return null;
  for (const part of link.split(/,(?=\s*<)/)) {
    const m = /<([^>]+)>\s*;(.*)$/.exec(part.trim());
    if (m && /\brel\s*=\s*"?[^";]*\bcanonical\b/i.test(m[2]!)) return m[1]!.trim();
  }
  return null;
}

/** Comparable form: resolved, no fragment, no trailing slash on the path. */
export function comparable(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    u.hash = "";
    return u.toString().replace(/\/+(?=$|\?)/, "");
  } catch {
    return null;
  }
}

const htmlCanonical = (p: PageFacts) => p.html!.canonicals[0] ?? null;

export const RULES: Rule[] = [
  pageRule({
    id: "canonicals.missing",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) => (htmlCanonical(p) === null && canonicalFromHeader(p.headers["link"]) === null ? ev() : null),
  }),
  pageRule({
    id: "canonicals.canonicalised",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (p) => {
      const raw = htmlCanonical(p) ?? canonicalFromHeader(p.headers["link"]);
      if (!raw) return null;
      const target = comparable(raw, p.finalUrl);
      return target && target !== comparable(p.finalUrl, p.finalUrl) ? ev({ canonical: target }) : null;
    },
  }),
  pageRule({
    id: "canonicals.multiple",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (p) => (p.html!.canonicals.length > 1 ? ev({ count: p.html!.canonicals.length }) : null),
  }),
  siteRule({
    id: "canonicals.to_redirect",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (p, ctx) => (ctx.site.canonicalTarget?.redirects ? ev({ canonical: p.canonical }) : null),
  }),
  siteRule({
    id: "canonicals.to_error",
    family: F,
    kind: "issue",
    priority: "high",
    detect: (p, ctx) => {
      const s = ctx.site.canonicalTarget?.statusCode ?? null;
      return s !== null && s >= 400 ? ev({ canonical: p.canonical, status: s }) : null;
    },
  }),
  siteRule({
    id: "canonicals.to_noindex",
    family: F,
    kind: "issue",
    priority: "high",
    detect: (p, ctx) => (ctx.site.canonicalTarget?.noindex ? ev({ canonical: p.canonical }) : null),
  }),
  pageRule({
    id: "canonicals.relative",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) => {
      const raw = htmlCanonical(p);
      return raw !== null && raw !== "" && !/^https?:\/\//i.test(raw) ? ev({ canonical: raw }) : null;
    },
  }),
  pageRule({
    id: "canonicals.header_html_mismatch",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (p) => {
      const header = canonicalFromHeader(p.headers["link"]);
      const html = htmlCanonical(p);
      if (!header || !html) return null;
      const a = comparable(header, p.finalUrl);
      const b = comparable(html, p.finalUrl);
      return a !== b ? ev({ header, html }) : null;
    },
  }),
  pageRule({
    id: "canonicals.outside_head",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (p) => (p.html!.canonicalsOutsideHead > 0 ? ev({ count: p.html!.canonicalsOutsideHead }) : null),
  }),
  pageRule({
    id: "canonicals.to_http_from_https",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (p) => {
      if (!/^https:/i.test(p.finalUrl)) return null;
      const raw = htmlCanonical(p) ?? canonicalFromHeader(p.headers["link"]);
      const target = raw ? comparable(raw, p.finalUrl) : null;
      return target && /^http:/i.test(target) ? ev({ canonical: target }) : null;
    },
  }),
];
