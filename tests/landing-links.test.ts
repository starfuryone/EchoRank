// tests/landing-links.test.ts
//
// Dead-link guard for the standalone landing payloads.
//
// A landing-html.ts is one String.raw blob of hand-written HTML: no components,
// no <Link>, no i18n, so nothing in the app ever resolves its hrefs and no other
// suite reads them. That is exactly how /setup-ai-search-tracking shipped its
// footer pointing at /en/terms, /en/privacy and /en/cookies — three 404s, when
// the pages have always lived under /en/legal/. Every sibling payload had the
// prefix right, which is the tell that this is a copy-paste class of bug rather
// than a one-off, and so worth a suite.
//
// Surfaces are derived from the filesystem, not listed, in the same style as
// tests/brand-casing.test.ts: a new landing page is covered the day it is added
// rather than the day someone remembers to extend this file.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALIZED_ROUTES, RETIRED_LOCALIZED_PATHS } from "@/lib/seo/registry";

const ROOT = process.cwd();
const LOCALE_APP = join(ROOT, "src", "app", "[locale]");

/**
 * Paths a link may legally point at: everything in the sitemap registry, plus
 * the retired paths, which still answer with a 301 rather than a 404.
 */
const REGISTERED = new Set<string>([
  ...LOCALIZED_ROUTES.map((r) => r.path),
  ...RETIRED_LOCALIZED_PATHS,
]);

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

/** Every locale-prefixed destination the payload links to, as registry paths. */
function localePaths(src: string): string[] {
  const hrefs = [...src.matchAll(/href="\/en([^"]*)"/g)].map((m) => m[1]);
  return [...new Set(hrefs.map((h) => h.split("#")[0].replace(/\/$/, "")))];
}

describe("landing payload links", () => {
  it("finds the payloads it is meant to guard", () => {
    // A filesystem-derived suite that silently matches nothing is worse than no
    // suite: it stays green after a refactor moves the pages somewhere else.
    expect(landingPayloads().length).toBeGreaterThan(0);
  });

  it.each(landingPayloads())("$slug links only to registered routes", ({ file }) => {
    const dead = localePaths(readFileSync(file, "utf8")).filter((p) => !REGISTERED.has(p));
    expect(dead, `unregistered destinations in ${file}`).toEqual([]);
  });

  it.each(landingPayloads())("$slug links legal pages under /legal/", ({ file }) => {
    // The specific shape of the bug above: the legal pages are /legal/terms,
    // never /terms. Asserted by name so the failure says what to fix.
    const src = readFileSync(file, "utf8");
    for (const doc of ["terms", "privacy", "cookies", "disclaimer"]) {
      expect(src, `${doc} must be linked as /en/legal/${doc}`).not.toContain(`href="/en/${doc}"`);
    }
  });
});

// NOTE: no "every registered route has a handler" suite here. Forty-six entries
// in LOCALIZED_ROUTES are served by dynamic segments (learn/[chapter],
// solutions/[category]/[item]) and have no directory of their own, and those
// families are already guarded against their configs by tests/learn-content.test.ts
// and tests/solutions-taxonomy.test.ts. A filesystem check would either duplicate
// those or re-implement Next's resolver badly.

describe("/setup-ai-search-tracking", () => {
  const PATH = "/setup-ai-search-tracking";
  const DIR = join(LOCALE_APP, "setup-ai-search-tracking");

  it("is registered in the sitemap at content-page priority", () => {
    const entry = LOCALIZED_ROUTES.find((r) => r.path === PATH);
    expect(entry, `${PATH} is not in LOCALIZED_ROUTES`).toBeDefined();
    expect(entry!.priority).toBe(0.6);
    expect(entry!.changeFrequency).toBe("monthly");
  });

  it("is served by a route handler, not a page", () => {
    // The markup is a complete document with its own <head>; the app shell would
    // double the chrome.
    expect(existsSync(join(DIR, "route.ts"))).toBe(true);
    expect(existsSync(join(DIR, "page.tsx"))).toBe(false);
  });

  it("serves a complete HTML document that canonicalises to itself", () => {
    const html = readFileSync(join(DIR, "landing-html.ts"), "utf8");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain(`<link rel="canonical" href="https://echorank360.com/en${PATH}">`);
  });

  it("carries no template placeholder that String.raw would interpolate", () => {
    // The payload is pasted verbatim into String.raw`...`. A backtick or a ${}
    // in the source would break out of the literal.
    const body = readFileSync(join(DIR, "landing-html.ts"), "utf8").split("String.raw`")[1];
    expect(body).toBeDefined();
    expect(body.slice(0, -3)).not.toContain("`");
    expect(body).not.toContain("${");
  });
});
