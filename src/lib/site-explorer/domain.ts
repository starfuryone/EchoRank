// src/lib/site-explorer/domain.ts
//
// Domain normalization for Site Explorer. DataForSEO's `target` for the Labs
// and Backlinks endpoints is a bare hostname — no scheme, no path, no port.
// Users paste all three, so normalize before anything else: the normalized
// form is what we send upstream AND what the 24 h cache keys on, so
// "https://Example.com/pricing" and "example.com" must collapse to one row
// instead of two paid analyses.
//
// www. is stripped deliberately. DataForSEO resolves the apex for Labs data
// anyway, and backlinks/summary is called with include_subdomains, so keeping
// the www. prefix would only split the cache.

/** Hostname labels: alphanumeric + hyphen, no leading/trailing hyphen. */
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Longest hostname Postgres/DataForSEO will sensibly take. */
const MAX_LENGTH = 253;

export class InvalidDomainError extends Error {
  readonly statusCode = 400;
  constructor(readonly input: string) {
    super("Enter a domain like example.com");
    this.name = "InvalidDomainError";
  }
}

/**
 * "HTTPS://WWW.Example.co.uk/blog?x=1" -> "example.co.uk".
 *
 * Throws InvalidDomainError for anything that is not a resolvable-looking
 * public hostname (IPs, single labels, localhost, spaces, punctuation).
 */
export function normalizeDomain(input: string): string {
  let value = input.trim().toLowerCase();
  if (!value) throw new InvalidDomainError(input);

  // Scheme, then userinfo, then everything from the first /, ?, or #.
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  value = value.replace(/^[^/@]*@/, "");
  value = value.split(/[/?#]/)[0];
  // Port, and a trailing root dot ("example.com.").
  value = value.split(":")[0].replace(/\.$/, "");
  value = value.replace(/^www\./, "");

  if (!value || value.length > MAX_LENGTH) throw new InvalidDomainError(input);

  // Bare IPv4 is a valid host but never a valid Labs/Backlinks target.
  if (/^\d+(\.\d+)*$/.test(value)) throw new InvalidDomainError(input);

  const labels = value.split(".");
  // Needs at least one dot — "localhost" and typos like "examplecom" are out.
  if (labels.length < 2) throw new InvalidDomainError(input);
  if (!labels.every((label) => LABEL.test(label))) throw new InvalidDomainError(input);
  // The TLD is letters only (and IDN "xn--" punycode, which LABEL already allows).
  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,}$/.test(tld) && !tld.startsWith("xn--")) {
    throw new InvalidDomainError(input);
  }

  return value;
}

/** Non-throwing form, for the client's submit-button enable check. */
export function isValidDomain(input: string): boolean {
  try {
    normalizeDomain(input);
    return true;
  } catch {
    return false;
  }
}
