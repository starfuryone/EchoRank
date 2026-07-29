// src/lib/backlinks/target.ts
//
// Target normalization for the Backlinks tool.
//
// Unlike Site Explorer, this tool has TWO modes, and they normalize
// differently because DataForSEO infers the target type from the string:
//
//   domain    -> bare hostname ("example.com"). www. and any path are
//                stripped, and include_subdomains=true widens it back out.
//   exact_url -> absolute URL ("https://www.example.com/pricing"). The scheme,
//                www. and path are LOAD-BEARING here: a different URL is a
//                different set of backlinks, so collapsing them the way domain
//                mode does would silently answer a question nobody asked.
//
// The normalized string is both what goes upstream and what the 24 h cache
// keys on, so the two modes cannot collide in the cache.

import { InvalidDomainError, normalizeDomain } from "@/lib/site-explorer/domain";

export const BACKLINKS_MODES = ["domain", "exact_url"] as const;
export type BacklinksMode = (typeof BACKLINKS_MODES)[number];

/** Longest target DataForSEO will sensibly take. */
const MAX_URL_LENGTH = 2000;

export class InvalidTargetError extends Error {
  readonly statusCode = 400;
  constructor(
    readonly input: string,
    readonly mode: BacklinksMode,
  ) {
    super(
      mode === "exact_url"
        ? "Enter a full page URL like https://example.com/pricing"
        : "Enter a domain like example.com",
    );
    this.name = "InvalidTargetError";
  }
}

/**
 * Exact-URL mode: keep everything that identifies the page, drop only what is
 * noise.
 *
 * Kept: scheme (defaulted to https when absent), www., path, query.
 * Dropped: fragment (never sent to a server, so never part of a backlink
 * target), surrounding whitespace, and a trailing "?" with no query.
 */
function normalizeUrl(input: string, mode: BacklinksMode): string {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) throw new InvalidTargetError(input, mode);

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new InvalidTargetError(input, mode);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidTargetError(input, mode);
  }

  // The hostname still has to be a real public host — reuse the domain
  // validator so "https://localhost/x" and "https://1.2.3.4/" are rejected in
  // both modes rather than only one. Its InvalidDomainError must NOT escape:
  // in this mode the user needs "enter a full page URL", not "enter a domain".
  try {
    normalizeDomain(url.hostname);
  } catch {
    throw new InvalidTargetError(input, mode);
  }

  url.hash = "";
  const rendered = url.toString();
  // URL.toString() appends "?" for an empty query string; that is not part of
  // the address and would split the cache.
  return rendered.endsWith("?") ? rendered.slice(0, -1) : rendered;
}

/**
 * Normalizes a user-entered target for the given mode.
 *
 * Throws InvalidTargetError (400) for anything unusable. Domain-mode failures
 * from normalizeDomain are re-thrown as InvalidTargetError so route handlers
 * have one error type to map.
 */
export function normalizeTarget(input: string, mode: BacklinksMode): string {
  if (mode === "exact_url") return normalizeUrl(input, mode);

  try {
    return normalizeDomain(input);
  } catch (err) {
    if (err instanceof InvalidDomainError) throw new InvalidTargetError(input, mode);
    throw err;
  }
}

/** Non-throwing form, for the client's submit-button enable check. */
export function isValidTarget(input: string, mode: BacklinksMode): boolean {
  try {
    normalizeTarget(input, mode);
    return true;
  } catch {
    return false;
  }
}

/**
 * Exact-URL targets are pages, and DataForSEO ignores include_subdomains for
 * them; domain targets want it on so subdomain links are counted.
 */
export function includeSubdomainsFor(mode: BacklinksMode): boolean {
  return mode === "domain";
}
