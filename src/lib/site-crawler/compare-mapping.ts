// src/lib/site-crawler/compare-mapping.ts
//
// Crawl comparison URL mapping (Phase 4c): ordered { find, replace } pairs
// applied to crawl B's URLs before matching, e.g. staging → production.
//
// The mapping runs IN POSTGRES (regexp_replace), because comparison is SQL set
// operations only. So a pattern passes two screens:
//   1. the 4a screening (regexProblem: no nested quantifiers, no
//      backreferences, compiles as a JS RegExp) — the ReDoS guard;
//   2. no JS-only syntax Postgres's ARE dialect lacks (lookbehind, named
//      groups, \p{…} classes, sticky/unicode escapes) — a pattern that means
//      something in the browser and something else, or nothing, in SQL.
// Each pair replaces the FIRST match, like String.prototype.replace with a
// non-global RegExp. Replacements use $1–$9 and $& as in JavaScript; they are
// translated to Postgres's \1–\9 and \& here.
//
// The mapped URLs are only compared, never fetched, so the SSRF guard has
// nothing to guard on this path.
//
// Dependency-free: the Compare tab validates with the same code.

import { z } from "zod";
import { regexProblem } from "./crawl-config";

export const MAPPING_MAX_PAIRS = 10;
export const MAPPING_EXPR_MAX = 500;

export const MappingPairSchema = z.object({
  find: z.string().min(1).max(MAPPING_EXPR_MAX),
  replace: z.string().max(MAPPING_EXPR_MAX),
});
export const MappingSchema = z.array(MappingPairSchema).max(MAPPING_MAX_PAIRS);
export type MappingPair = z.infer<typeof MappingPairSchema>;

/** Syntax JavaScript accepts that Postgres regular expressions do not. */
const PG_UNSUPPORTED = /\(\?<[=!]|\(\?<[A-Za-z]|\\k<|\\[pPu]\{|\\u[0-9A-Fa-f]{4}|\\c[A-Za-z]|\(\?[imsx-]+[:)]/;

export type MappingProblem = { index: number; code: "unsafe_regex" | "invalid_regex" | "unsupported_regex" };

/** Problems per pair, in order; empty = every pair may run. */
export function mappingProblems(mapping: readonly MappingPair[]): MappingProblem[] {
  const out: MappingProblem[] = [];
  mapping.forEach((m, index) => {
    const p = regexProblem(m.find);
    if (p === "unsafe_regex" || p === "invalid_regex") out.push({ index, code: p });
    else if (PG_UNSUPPORTED.test(m.find)) out.push({ index, code: "unsupported_regex" });
  });
  return out;
}

/** A JavaScript replacement string ($1, $&, $$) as Postgres's (\1, \&, $), with literal backslashes doubled. */
export function toPgReplacement(js: string): string {
  let out = "";
  for (let i = 0; i < js.length; i++) {
    const ch = js[i]!;
    const next = js[i + 1];
    if (ch === "\\") out += "\\\\";
    else if (ch === "$" && next !== undefined && /[1-9]/.test(next)) {
      out += `\\${next}`;
      i++;
    } else if (ch === "$" && next === "&") {
      out += "\\&";
      i++;
    } else if (ch === "$" && next === "$") {
      out += "$";
      i++;
    } else out += ch;
  }
  return out;
}

/** The mapping applied in JavaScript: the reference the SQL must agree with (tests, and a preview in the tab). */
export function applyMapping(url: string, mapping: readonly MappingPair[]): string {
  return mapping.reduce((u, m) => u.replace(new RegExp(m.find), m.replace), url);
}
