// directives — meta robots / googlebot and the X-Robots-Tag header.
//
// KINDS (decided, pinned in the registry test): a directive merely being
// PRESENT is a warning — noindex on a thank-you page is a choice, not a bug.
// Conflicts and misplacement are issues: they mean the site says two things
// at once, or says it where crawlers do not listen.
//
// Only 2xx responses are judged; a directive on a 404 changes nothing.

import { ev, isOk, pageRule } from "../engine";
import type { PageFacts, Rule } from "../types";
import { comparable, canonicalFromHeader } from "./canonicals";

const F = "directives" as const;

/** Directive tokens, lowercased. Header tokens addressed to another bot are dropped. */
function tokens(value: string | null | undefined, header = false): string[] {
  if (!value) return [];
  const out: string[] = [];
  for (const part of value.toLowerCase().split(",")) {
    let t = part.trim();
    // X-Robots-Tag allows "googlebot: noindex"; "otherbot: …" is not for search engines we model.
    const m = header ? /^([a-z0-9_-]+)\s*:\s*(.+)$/.exec(t) : null;
    if (m && !/^(max-snippet|max-image-preview|max-video-preview|unavailable_after)$/.test(m[1]!)) {
      if (m[1] !== "googlebot") continue;
      t = m[2]!.trim();
    }
    if (t) out.push(t);
  }
  return out;
}

const meta = (p: PageFacts) => tokens(p.html?.metaRobots ?? null);
const header = (p: PageFacts) => tokens(p.headers["x-robots-tag"], true);
const all = (p: PageFacts) => [...meta(p), ...header(p)];

export const isNoindex = (t: string[]) => t.includes("noindex") || t.includes("none");
const isNofollow = (t: string[]) => t.includes("nofollow") || t.includes("none");
const where = (p: PageFacts, test: (t: string[]) => boolean) =>
  test(meta(p)) && test(header(p)) ? "both" : test(meta(p)) ? "meta" : "header";

const present = (id: string, test: (t: string[]) => boolean, priority: Rule["priority"] = "low") =>
  pageRule({
    id: `directives.${id}`,
    family: F,
    kind: "warning",
    priority,
    applies: "fetched",
    detect: (p) => (isOk(p.statusCode) && test(all(p)) ? ev({ source: where(p, test) }) : null),
  });

export const RULES: Rule[] = [
  present("noindex", isNoindex, "high"),
  present("nofollow", isNofollow, "medium"),
  present("none", (t) => t.includes("none"), "high"),
  present("noarchive", (t) => t.includes("noarchive")),
  present("nosnippet", (t) => t.includes("nosnippet"), "medium"),
  present("max_snippet", (t) => t.some((x) => x.startsWith("max-snippet"))),
  present("noimageindex", (t) => t.includes("noimageindex")),
  present("notranslate", (t) => t.includes("notranslate")),
  present("unavailable_after", (t) => t.some((x) => x.startsWith("unavailable_after"))),
  pageRule({
    id: "directives.noindex_canonical_conflict",
    family: F,
    kind: "issue",
    priority: "high",
    detect: (p) => {
      if (!isNoindex(all(p))) return null;
      const raw = p.html!.canonicals[0] ?? canonicalFromHeader(p.headers["link"]);
      const target = raw ? comparable(raw, p.finalUrl) : null;
      return target && target !== comparable(p.finalUrl, p.finalUrl) ? ev({ canonical: target }) : null;
    },
  }),
  pageRule({
    id: "directives.noindex_in_sitemap",
    family: F,
    kind: "issue",
    priority: "high",
    applies: "fetched",
    detect: (p) => (isOk(p.statusCode) && p.inSitemap === true && isNoindex(all(p)) ? ev() : null),
  }),
  pageRule({
    id: "directives.outside_head",
    family: F,
    kind: "issue",
    priority: "high",
    applies: "html",
    detect: (p) => (p.html!.metaRobotsOutsideHead > 0 ? ev({ count: p.html!.metaRobotsOutsideHead }) : null),
  }),
  pageRule({
    id: "directives.header_meta_conflict",
    family: F,
    kind: "issue",
    priority: "medium",
    applies: "html",
    detect: (p) => {
      const m = meta(p);
      const h = header(p);
      if (!m.length || !h.length) return null;
      if (isNoindex(m) !== isNoindex(h) || isNofollow(m) !== isNofollow(h)) {
        return ev({ meta: m.join(", "), header: h.join(", ") });
      }
      return null;
    },
  }),
];
