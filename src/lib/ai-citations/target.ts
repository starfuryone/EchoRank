// Portions adapted from every-app/open-seo (MIT)
//
// src/lib/ai-citations/target.ts
//
// What a lookup is ABOUT, and how narrowly.
//
// ── WHY THIS EXISTS SEPARATELY FROM backlinks/target.ts ────────────────────
// The Backlinks tool has two modes (a whole domain, or one exact URL) because
// DataForSEO's Backlinks API accepts both and answers each natively. The LLM
// Mentions API accepts NEITHER a URL nor a path: its `target` is a domain or a
// keyword, and nothing narrower.
//
// So a URL-scoped question here is answered by asking about the DOMAIN and then
// FILTERING the cited page URLs that come back. That is the whole reason this
// module has a `scope` at all, and the reason cited-sources.ts applies the
// filter BEFORE its per-platform cap: filtering after the cap would let 25
// out-of-scope pages crowd out the in-scope ones the customer asked about, and
// return an empty table for a domain that has plenty of them.
//
// PURE — no fs, no prisma, no provider. Imported by the client component for
// its scope labels, so it must stay that way.

/**
 * How narrowly a target is read.
 *
 *  subdomains — the hostname and everything under it. The default for a bare
 *               domain, and the only scope the provider answers natively.
 *  domain     — that exact hostname, excluding its subdomains.
 *  subfolder  — a path and its children. `/blog` matches `/blog/post`, and
 *               deliberately NOT `/blogging`.
 *  exact_url  — one page.
 */
export const CITATION_SCOPES = ["subdomains", "domain", "subfolder", "exact_url"] as const;

export type CitationScope = (typeof CITATION_SCOPES)[number];

export interface CitationTarget {
  scope: CitationScope;
  /** Lowercased hostname with a leading `www.` stripped. */
  hostname: string;
  /**
   * Normalised path: `""` for the root, otherwise `/like/This`. Casing and
   * percent-encoding are preserved (a path is case-sensitive on most servers);
   * a trailing slash, the query and the fragment are stripped, because none of
   * them makes a different page for this purpose.
   */
  path: string;
  /** What to show the user: hostname, plus the path when the scope uses one. */
  display: string;
}

export class InvalidCitationTargetError extends Error {
  readonly statusCode = 400;
  constructor(message = "Enter a domain like example.com, or a URL on it.") {
    super(message);
    this.name = "InvalidCitationTargetError";
  }
}

const MAX_INPUT_LENGTH = 2000;

function normalizePath(pathname: string): string {
  if (pathname === "/") return "";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "" : trimmed;
}

/** A subfolder needs a path; every other scope works for any input. */
export function isScopeAllowedForPath(scope: CitationScope, path: string): boolean {
  return !(scope === "subfolder" && path === "") && !(scope === "exact_url" && path === "");
}

/** Root inputs default to the whole domain; an input with a path to that path. */
export function defaultScopeForPath(path: string): CitationScope {
  return path === "" ? "subdomains" : "subfolder";
}

/**
 * Parse a user-entered target.
 *
 * Rejects credentials in the URL (the hostname a reader sees would differ from
 * where the browser authenticates), non-http(s) schemes, and hosts that are not
 * plausibly public domains. The charset check is doing real work: `my_site.com`
 * is accepted by `URL()` and rejected by DataForSEO with an opaque "Invalid
 * Field" AFTER billing the call, so catching it here saves money.
 */
export function parseCitationTarget(
  input: string,
  requestedScope?: CitationScope,
): CitationTarget {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_INPUT_LENGTH) {
    throw new InvalidCitationTargetError();
  }

  const withScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new InvalidCitationTargetError();
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidCitationTargetError();
  }
  if (url.username || url.password) {
    throw new InvalidCitationTargetError(
      "URLs with an embedded username or password are not supported.",
    );
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (
    !hostname ||
    !hostname.includes(".") ||
    hostname.startsWith(".") ||
    hostname.endsWith(".") ||
    !/^[a-z\d.-]+$/.test(hostname) ||
    // A bare IP is not a domain the provider can answer about.
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  ) {
    throw new InvalidCitationTargetError();
  }

  const path = normalizePath(url.pathname);

  if (requestedScope && !isScopeAllowedForPath(requestedScope, path)) {
    throw new InvalidCitationTargetError(
      "That scope needs a path — try example.com/blog.",
    );
  }

  const scope = requestedScope ?? defaultScopeForPath(path);
  const usesPath = scope === "exact_url" || scope === "subfolder";

  return {
    scope,
    hostname,
    path,
    display: usesPath ? `${hostname}${path}` : hostname,
  };
}

/** Non-throwing form, for a submit button's enable check. */
export function isValidCitationTarget(input: string, scope?: CitationScope): boolean {
  try {
    parseCitationTarget(input, scope);
    return true;
  } catch {
    return false;
  }
}

/**
 * The provider only widens or narrows by subdomain. Everything else is
 * post-filtered, so only this one bit reaches the request.
 */
export function includeSubdomainsFor(scope: CitationScope): boolean {
  return scope === "subdomains";
}

function hostMatches(candidateHost: string, target: CitationTarget): boolean {
  const host = candidateHost.toLowerCase().replace(/^www\./, "");
  if (target.scope === "subdomains") {
    return host === target.hostname || host.endsWith(`.${target.hostname}`);
  }
  return host === target.hostname;
}

/**
 * Does a cited page URL belong to this target?
 *
 * The post-filter the whole module exists for. Subfolder matching covers the
 * path and its children but excludes a similarly named sibling: `/blog`
 * matches `/blog` and `/blog/post`, and not `/blogging`. Getting that wrong in
 * the obvious direction (`startsWith(path)`) silently widens every subfolder
 * lookup, which is invisible until someone checks a result by hand.
 */
export function urlMatchesTarget(url: string, target: CitationTarget): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!hostMatches(parsed.hostname, target)) return false;

  const path = normalizePath(parsed.pathname);
  switch (target.scope) {
    case "exact_url":
      return path === target.path;
    case "subfolder":
      return path === target.path || path.startsWith(`${target.path}/`);
    default:
      return true;
  }
}

/**
 * The cache key's target component: scope and target together.
 *
 * Both, because two lookups of the same hostname at different scopes are
 * different questions with different answers — and a key that dropped the
 * scope would serve one as the other.
 */
export function targetCacheKey(target: CitationTarget): string {
  return `${target.scope}:${target.hostname}${target.path}`;
}
