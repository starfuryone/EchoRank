// The proxy's file-vs-locale decision, and the guard that keeps its list honest.
//
// src/proxy.ts decides what a URL's first segment means, and until this suite
// existed it had a hole with a name: any path whose first segment carried a dot
// was excluded from the middleware matcher outright, so "/wp-login.php" skipped
// locale handling and reached the [locale] render with "wp-login.php" as the
// locale. The page 500'd on the first catalog lookup.
//
// Two things are asserted here, and they fail for different reasons:
//
//  - the CLASSIFICATION (isStaticPath / isUnroutableDottedPath) — junk 404s,
//    real root files do not;
//  - the DRIFT — STATIC_FIRST_SEGMENTS is a hand-written mirror of public/'s
//    root, which nothing propagates into. Dropping "hero-2026.mp4" into
//    public/ and forgetting the entry is a 404 on a real asset in production;
//    it is a red test here instead.
//
// The matcher regex is asserted directly rather than through Next: it is a
// string in `config.matcher` that only the framework ever compiles, so a typo
// in it is invisible to tsc, to eslint and to every other suite.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PUBLIC_ROOT_FILE_NAMES,
  STATIC_FIRST_SEGMENTS,
  isStaticPath,
  isUnroutableDottedPath,
} from "@/lib/static-paths";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));
const PROXY_SRC = fileURLToPath(new URL("../src/proxy.ts", import.meta.url));

/**
 * The matcher THE APP ships, lifted out of src/proxy.ts and compiled the way
 * Next compiles it.
 *
 * Read as text rather than imported: `import { config } from "@/proxy"` would
 * pull next-auth and the whole Prisma adapter into a suite that needs one
 * string. And a copy of the regex pasted here would guard nothing — it would
 * keep passing while the real matcher changed underneath it, which is exactly
 * how the dotted-path hole survived from July.
 */
function shippedMatcher(): RegExp {
  const src = readFileSync(PROXY_SRC, "utf8");
  const m = /matcher:\s*\[\s*"((?:[^"\\]|\\.)*)"\s*\]/.exec(src);
  if (!m) throw new Error("could not find `matcher: [\"...\"]` in src/proxy.ts");
  // The source is a JS string literal; JSON.parse applies the same unescaping
  // the bundler does, turning \\. back into the \. Next hands to RegExp.
  return new RegExp(`^${JSON.parse(`"${m[1]}"`)}$`);
}

const MATCHER = shippedMatcher();
const proxied = (pathname: string) => MATCHER.test(pathname);

describe("the middleware matcher", () => {
  it("passes a dotted FIRST segment to the proxy", () => {
    // The regression. Each of these used to be excluded and rendered [locale].
    for (const p of ["/foo.bar", "/en.php", "/wp-login.php", "/xmlrpc.php", "/.env"]) {
      expect(proxied(p), p).toBe(true);
    }
  });

  it("still skips a dot in any LATER segment", () => {
    // Nested assets and the dotted route handlers. /api/public/attribution.js in
    // particular is documented in proxy.ts as needing no publicPaths entry
    // *because* the matcher skips it — that argument has to keep holding.
    for (const p of [
      "/blog/rss.xml",
      "/guides/audit-checks-en.svg",
      "/og/link-building-playbook.png",
      "/help/img/cancel-step1.svg",
      "/guide/checklist-visibilite-ia.pdf",
      "/.well-known/security.txt",
      "/api/public/attribution.js",
      "/api/public/funnel.js",
      "/extension/howto-ai-visibility.html",
    ]) {
      expect(proxied(p), p).toBe(false);
    }
  });

  it("still skips the build output", () => {
    expect(proxied("/_next/static/chunks/main.js")).toBe(false);
    expect(proxied("/_next/image?url=%2Fhero.png")).toBe(false);
    expect(proxied("/favicon.ico")).toBe(false);
  });

  it("still proxies the pages", () => {
    for (const p of ["/", "/en", "/en/pricing", "/about", "/xx/pricing", "/dashboard"]) {
      expect(proxied(p), p).toBe(true);
    }
  });
});

describe("junk with a dotted first segment", () => {
  it("is unroutable, and 404s", () => {
    for (const p of [
      "/foo.bar",
      "/en.php",
      "/wp-login.php",
      "/xmlrpc.php",
      "/index.php",
      "/.env",
      "/nope.svg", // a real extension is not a real file
      "/config.json",
    ]) {
      expect(isUnroutableDottedPath(p), p).toBe(true);
      expect(isStaticPath(p), p).toBe(false);
    }
  });

  it("does not swallow a real root file", () => {
    for (const p of [
      "/sitemap.xml",
      "/robots.txt",
      "/favicon.ico",
      "/llms.txt",
      "/echorank-logo.svg",
      "/hero.mp4",
      "/og-home.png",
      "/google53f8cfb2ee070790.html",
      "/.well-known/security.txt",
    ]) {
      expect(isStaticPath(p), p).toBe(true);
      expect(isUnroutableDottedPath(p), p).toBe(false);
    }
  });

  it("leaves every locale and every dot-free path to the rest of the proxy", () => {
    // The catch-all below this branch in proxy.ts is the AUTH GATE. A dot-free
    // unknown segment is an app route until the session says otherwise, and
    // 404ing it here would take the signed-in app down.
    for (const l of SUPPORTED_LOCALES) {
      expect(isUnroutableDottedPath(`/${l}`)).toBe(false);
      expect(isUnroutableDottedPath(`/${l}/pricing`)).toBe(false);
    }
    for (const p of ["/", "/about", "/dashboard", "/customers", "/xx/pricing", "/blog/some-slug"]) {
      expect(isUnroutableDottedPath(p), p).toBe(false);
      expect(isStaticPath(p), p).toBe(false);
    }
  });

  it("classifies a dotted first segment even with more path after it", () => {
    // "/foo.bar/pricing" is 308'd to /en/pricing one block earlier in proxy.ts;
    // "/foo.bar/nothing" falls to this branch. Both are dotted-first.
    expect(isUnroutableDottedPath("/foo.bar/nothing")).toBe(true);
  });
});

describe("STATIC_FIRST_SEGMENTS mirrors public/", () => {
  // Backup copies live in this tree (see the deploy rules in CLAUDE.md) and are
  // deliberately NOT served: leaving them off the list is what 404s
  // "/llms.txt.bak.20260816-185552" instead of publishing it.
  const onDisk = readdirSync(PUBLIC_DIR)
    .filter((name) => name.includes("."))
    .filter((name) => !/\.bak[._-]/.test(name))
    .sort();

  it("lists every dotted entry at the root of public/", () => {
    const listed = PUBLIC_ROOT_FILE_NAMES.filter((n) => n !== ".well-known").sort();
    expect(listed).toEqual(onDisk);
  });

  it("lists nothing that is not there", () => {
    for (const name of PUBLIC_ROOT_FILE_NAMES) {
      if (name === ".well-known") continue;
      expect(onDisk, `${name} is listed but not in public/`).toContain(name);
    }
  });

  it("covers the route handlers that public/ cannot", () => {
    // Generated by src/app/sitemap.ts, robots.ts and favicon.ico — never on
    // disk under public/, so the mirror above can never derive them.
    for (const name of ["sitemap.xml", "robots.txt", "favicon.ico"]) {
      expect(STATIC_FIRST_SEGMENTS.has(name), name).toBe(true);
    }
  });

  it("keeps .well-known routable", () => {
    // It is the one dotted DIRECTORY. Without an entry the junk rule would 404
    // security.txt and anything else published under the prefix.
    expect(isStaticPath("/.well-known/security.txt")).toBe(true);
    expect(isStaticPath("/.well-known/acme-challenge/token-with-no-dot")).toBe(true);
  });
});
