// src/lib/static-paths.ts
//
// The first path segments that are FILES, not locales.
//
// proxy.ts decides what a URL's first segment means. It can be a supported
// locale ("/fr/pricing"), a registered marketing path ("/about"), an app route
// behind the auth gate ("/dashboard") — or a file sitting at the root of the
// site, which is the one case that carries a dot. This module is that last
// list, and it exists as its own module for two reasons: proxy.ts runs on the
// edge and must not import anything that reads the filesystem, and a test can
// import a constant where it cannot import the middleware's matcher.
//
// WHY A HAND-WRITTEN LIST AND NOT AN EXTENSION CHECK. "Any first segment ending
// in .svg/.png/.txt is a file" is shorter and wrong: it stands aside for
// "/nope.svg" too, which is not a file, so Next falls through to the [locale]
// route and renders the homepage under a garbage locale with a 200. That soft
// 404 is the same class of bug as the 500 this list was written to close — an
// unbounded set of URLs answering as a page. An exact list has no such tail:
// a first segment that is not on it and is not a locale is junk, and junk 404s.
//
// tests/proxy-static-paths.test.ts reads public/ from disk and fails when this
// list drifts, so adding a file to the ROOT of public/ is a two-line change
// with a red test in between rather than a silent 404 in production. Files in
// SUBDIRECTORIES of public/ ("/og/x.png", "/guides/y.svg") need no entry: their
// first segment carries no dot and the middleware matcher already skips them.

/**
 * Route handlers and framework files whose path is a name with an extension.
 * Not on disk under public/, so the drift test cannot derive them.
 *
 * favicon.ico is also named in the matcher's own exclusion list; it is repeated
 * here so this set answers "is this segment a file?" on its own, without the
 * caller having to know which of the two places happens to catch it.
 */
const GENERATED_FILES = [
  "sitemap.xml", // src/app/sitemap.ts
  "robots.txt", // src/app/robots.ts
  "favicon.ico", // src/app/favicon.ico
] as const;

/**
 * Every entry at the ROOT of public/ whose name contains a dot, verbatim.
 * Kept in sync by tests/proxy-static-paths.test.ts.
 *
 * ".well-known" is here rather than in GENERATED_FILES because it is a
 * directory, not a file, and it is the one directory name that contains a dot —
 * so without an entry the junk rule below would swallow every URL under it.
 * Caddy answers ACME challenges before the request ever reaches Next, but
 * security.txt, apple-app-site-association and anything else published under
 * that prefix later do reach it.
 */
const PUBLIC_ROOT_FILES = [
  ".well-known",
  "about-team.webp",
  "demo-poster.png",
  "EchorankIntroVid.mp4",
  "echorank-logo-dark.svg",
  "echorank-logo-light.svg",
  "echorank-logo.svg",
  "echorank-product-explainer.mp4",
  "echorank-product-explainer-poster.jpg",
  "file.svg",
  "FR_A_futuristic_AI_Repute.mp4",
  "globe.svg",
  "google53f8cfb2ee070790.html",
  "hero.mp4",
  "llms.txt",
  "methodology-team.webp",
  "next.svg",
  "og-home.png",
  "vercel.svg",
  "window.svg",
] as const;

/** Dotted first segments that Next itself serves. The proxy stands aside. */
export const STATIC_FIRST_SEGMENTS: ReadonlySet<string> = new Set([
  ...GENERATED_FILES,
  ...PUBLIC_ROOT_FILES,
]);

/** The names this list claims to mirror, for the drift test. */
export const PUBLIC_ROOT_FILE_NAMES: readonly string[] = PUBLIC_ROOT_FILES;

/** First path segment, e.g. "/fr/x" -> "fr", "/robots.txt" -> "robots.txt". */
export function firstSegment(pathname: string): string {
  return pathname.split("/")[1] ?? "";
}

/** A request for a file Next serves itself: stand aside, do no session work. */
export function isStaticPath(pathname: string): boolean {
  return STATIC_FIRST_SEGMENTS.has(firstSegment(pathname));
}

/**
 * A dotted first segment that is NOT one of the files above: "/foo.bar",
 * "/en.php", "/wp-login.php". No locale contains a dot and no app route does
 * either, so such a URL can never name a page, and the only thing downstream
 * of the proxy that will accept it is the [locale] catch-all — which is
 * exactly the bug. 404 it at the edge.
 */
export function isUnroutableDottedPath(pathname: string): boolean {
  const seg = firstSegment(pathname);
  return seg.includes(".") && !STATIC_FIRST_SEGMENTS.has(seg);
}
