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

/**
 * ── FOUR SCOPES NOW, AND THE FIRST TWO KEEP THEIR OLD SPELLING ─────────────
 *
 * "domain" and "exact_url" are the original two modes. Their strings are
 * UNCHANGED because they are persisted in BacklinksAnalysis.mode and in the
 * cache key: renaming either would orphan every stored analysis and silently
 * re-buy every cached one.
 *
 * The two new scopes are what the Full tier adds:
 *
 *   domain     — the hostname and its subdomains (include_subdomains=true).
 *                Kept as the widest scope for backward compatibility with
 *                every row already written under this name.
 *   subdomain  — that exact hostname only, subdomains excluded.
 *   prefix     — a path and everything under it. The provider's summary and
 *                history endpoints cannot answer this, so it is served by
 *                filtered total_count reads of the backlinks list — see
 *                buildPrefixOverview in ./service.ts.
 *   exact_url  — one page.
 */
export const BACKLINKS_MODES = ["domain", "subdomain", "prefix", "exact_url"] as const;
export type BacklinksMode = (typeof BACKLINKS_MODES)[number];

/** The two scopes the Basic tier may use. Basic is domain-only. */
export const BASIC_BACKLINKS_MODES: readonly BacklinksMode[] = ["domain"];

/** Scopes whose target carries a path, and which therefore need one. */
export const PATH_BACKLINKS_MODES: readonly BacklinksMode[] = ["prefix", "exact_url"];

export function modeNeedsPath(mode: BacklinksMode): boolean {
  return PATH_BACKLINKS_MODES.includes(mode);
}

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
        : mode === "prefix"
          ? "Enter a URL with a path like https://example.com/blog"
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
  if (modeNeedsPath(mode)) {
    const url = normalizeUrl(input, mode);
    // A prefix over "/" is the whole domain wearing a more expensive costume:
    // it would run the filtered-total_count path to answer a question the
    // cheap summary endpoint answers directly. Rejected so the customer picks
    // the scope that is actually free.
    if (mode === "prefix" && new URL(url).pathname.replace(/\/+$/, "") === "") {
      throw new InvalidTargetError(input, mode);
    }
    return url;
  }

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
 * Only the widest scope includes subdomains.
 *
 * "domain" keeps subdomains for backward compatibility — that is what every
 * analysis already stored under this name means, and narrowing it now would
 * change the answer to a question customers have already asked. "subdomain" is
 * the new, narrower scope for anyone who wants the hostname alone. The
 * provider ignores the flag for page-shaped targets entirely.
 */
export function includeSubdomainsFor(mode: BacklinksMode): boolean {
  return mode === "domain";
}

/**
 * The provider-side target for a scope.
 *
 * Prefix scope sends the HOSTNAME upstream and narrows with a filter, because
 * the Backlinks endpoints take a domain or a page and nothing in between. The
 * path is applied by buildPrefixFilters below.
 */
export function apiTargetFor(target: string, mode: BacklinksMode): string {
  if (mode !== "prefix") return target;
  return new URL(target).hostname.replace(/^www\./, "");
}

/**
 * The DataForSEO filter that narrows a backlinks-list read to a path prefix.
 *
 * `url_to` is the linked page. `ilike '<origin><path>%'` catches the path and
 * its children; the escape stops a path containing % or _ from turning into a
 * wildcard that silently widens the scope — which would be invisible, because
 * a wider answer still looks like an answer.
 */
export function buildPrefixFilters(target: string): unknown[] {
  const url = new URL(target);
  const path = url.pathname.replace(/\/+$/, "");
  const escaped = `${url.origin}${path}`.replace(/[\\%_]/g, (match) => `\\${match}`);
  return [["url_to", "ilike", `${escaped}%`]];
}
