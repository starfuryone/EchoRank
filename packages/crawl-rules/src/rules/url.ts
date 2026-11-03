// url — the shape of the crawled URL itself. Applies to every fetched URL,
// whatever it answered: a 404 with an uppercase path is still an uppercase path.
//
// The consumer hands URLs over normalised (lowercased host, default port and
// fragment dropped), so these read the path and query, never the host.

import { ev, pageRule } from "../engine";
import type { PageFacts, Rule } from "../types";

const F = "url" as const;

/** Query parameter names that mean "this is an internal site-search results page". */
const SEARCH_PARAMS = new Set(["q", "s", "search", "query", "keyword", "keywords", "k", "term"]);

function parts(url: string): { path: string; query: string; params: string[] } | null {
  try {
    const u = new URL(url);
    return { path: u.pathname, query: u.search, params: [...u.searchParams.keys()] };
  } catch {
    return null;
  }
}

/** The path with %XX escapes removed, so encoded bytes are not mistaken for uppercase letters. */
const unescaped = (path: string) => path.replace(/%[0-9a-f]{2}/gi, "");

const urlRule = (
  id: string,
  kind: Rule["kind"],
  priority: Rule["priority"],
  test: (u: NonNullable<ReturnType<typeof parts>>, p: PageFacts) => ReturnType<typeof ev> | null,
) =>
  pageRule({
    id: `url.${id}`,
    family: F,
    kind,
    priority,
    applies: "fetched",
    detect: (p) => {
      const u = parts(p.url);
      return u ? test(u, p) : null;
    },
  });

export const RULES: Rule[] = [
  urlRule("non_ascii", "warning", "low", (u, p) =>
    /%[89a-f][0-9a-f]/i.test(u.path) || /[^\x00-\x7f]/.test(u.path) ? ev({ url: p.url }) : null,
  ),
  urlRule("underscores", "opportunity", "low", (u, p) => (u.path.includes("_") ? ev({ url: p.url }) : null)),
  urlRule("uppercase", "warning", "low", (u, p) => (/[A-Z]/.test(unescaped(u.path)) ? ev({ url: p.url }) : null)),
  urlRule("parameters", "opportunity", "low", (u, p) =>
    u.params.length > 0 ? ev({ url: p.url, params: u.params.length }) : null,
  ),
  urlRule("over_115_chars", "opportunity", "low", (_u, p) => (p.url.length > 115 ? ev({ length: p.url.length }) : null)),
  urlRule("multiple_slashes", "warning", "low", (u, p) => (u.path.includes("//") ? ev({ url: p.url }) : null)),
  urlRule("repetitive_path", "warning", "low", (u, p) => {
    const segs = u.path.split("/").filter(Boolean).map((s) => s.toLowerCase());
    const dup = segs.find((s, i) => segs.indexOf(s) !== i);
    return dup ? ev({ segment: dup, url: p.url }) : null;
  }),
  urlRule("contains_space", "warning", "low", (u, p) =>
    /%20|\+| /.test(u.path) ? ev({ url: p.url }) : null,
  ),
  urlRule("internal_search", "warning", "medium", (u, p) => {
    const hit = u.params.find((k) => SEARCH_PARAMS.has(k.toLowerCase()));
    return hit ? ev({ param: hit, url: p.url }) : null;
  }),
  pageRule({
    id: "url.trailing_slash_variant",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (p) => {
      // The page answered 200 at a URL whose canonical is the same path with
      // the trailing slash flipped: the site serves both variants.
      const raw = p.html!.canonicals[0];
      if (!raw) return null;
      let canonical: string;
      try {
        canonical = new URL(raw, p.finalUrl).pathname;
      } catch {
        return null;
      }
      const own = parts(p.finalUrl)?.path;
      if (!own || own === canonical || own === "/" || canonical === "/") return null;
      const strip = (s: string) => s.replace(/\/+$/, "");
      return strip(own) === strip(canonical) ? ev({ url: p.finalUrl, canonical: raw }) : null;
    },
  }),
];
