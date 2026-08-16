// tests/brand-casing.test.ts
//
// THE BRAND IS "Echorank" / "Echorank360". CamelCase is banned in user-facing
// copy — CLAUDE.md states it, and several suites already assert it against the
// copy objects they own (seo-tools, ai-tools, devtools, gsc, competitors-i18n).
//
// Those suites all share a blind spot: they JSON.stringify a catalog. Copy that
// never passes through a catalog is invisible to them, and that is exactly
// where the CamelCase survived — public/llms.txt, the aria-label on the logo,
// two READMEs. The standalone landing pages are the same shape: a
// landing-html.ts payload is one String.raw blob of hand-written HTML with no
// i18n and no component boundary, so nothing else in the suite would ever read
// its brand strings.
//
// Surfaces are derived from the filesystem, not listed, so a new landing page
// is covered the day it is added rather than the day someone remembers to
// extend this file.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const LOCALE_APP = join(ROOT, "src", "app", "[locale]");

/**
 * Every spelling of the brand, however spaced or hyphenated.
 *
 * Deliberately wider than /EchoRank/: the point is to catch the next variant
 * nobody thought of ("Echo Rank", "echoRank"), not to re-ban the one already
 * known. Case-insensitive, so the allow-list below decides what is legal.
 */
const BRAND = /echo[\s-]*rank/gi;

/**
 * The three legal renderings.
 *
 * "ECHORANK" is the letterspaced wordmark (public/echorank-logo.svg, the OG
 * card generators) and is typographic, not camel-case. "echorank" covers URLs,
 * filenames and CSS class names. Everything else is a bug.
 */
const ALLOWED = new Set(["Echorank", "ECHORANK", "echorank"]);

function offenders(text: string): string[] {
  return [...new Set((text.match(BRAND) ?? []).filter((m) => !ALLOWED.has(m)))];
}

/** Standalone landing pages: src/app/[locale]/<slug>/landing-html.ts */
function landingPayloads(): { slug: string; file: string }[] {
  if (!existsSync(LOCALE_APP)) return [];
  const out: { slug: string; file: string }[] = [];
  for (const slug of readdirSync(LOCALE_APP)) {
    const full = join(LOCALE_APP, slug);
    if (!statSync(full).isDirectory()) continue;
    const file = join(full, "landing-html.ts");
    // .bak.* siblings are gitignored deploy backups, never imported.
    if (existsSync(file)) out.push({ slug, file });
  }
  return out;
}

describe("brand casing", () => {
  it("finds the landing pages it is meant to guard", () => {
    // A filesystem-derived suite that silently matches nothing is worse than no
    // suite: it stays green after a refactor moves the pages somewhere else.
    expect(landingPayloads().length).toBeGreaterThan(0);
  });

  it.each(landingPayloads())("$slug payload uses Echorank, never camel-case", ({ file }) => {
    expect(offenders(readFileSync(file, "utf8"))).toEqual([]);
  });

  it("keeps camel-case out of llms.txt", () => {
    // Served to model crawlers, so it is brand copy with an unusually long
    // memory — and it is a plain text file no catalog test would ever load.
    expect(offenders(readFileSync(join(ROOT, "public", "llms.txt"), "utf8"))).toEqual([]);
  });

  it("keeps camel-case out of SVG accessible names", () => {
    // The logo renders ECHORANK as a wordmark but carried aria-label="EchoRank",
    // so the one rendering a screen reader announced was the banned one.
    const dir = join(ROOT, "public");
    const svgs = readdirSync(dir).filter((f) => f.endsWith(".svg"));
    for (const name of svgs) {
      const src = readFileSync(join(dir, name), "utf8");
      const names = [...src.matchAll(/(?:aria-label|<title>)\s*=?\s*"?([^"<]*)/g)].map((m) => m[1]);
      expect(offenders(names.join(" ")), `${name} accessible name`).toEqual([]);
    }
  });
});
