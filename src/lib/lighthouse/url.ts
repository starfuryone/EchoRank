// src/lib/lighthouse/url.ts
//
// URL validation for Lighthouse audits.
//
// Unlike the other tools, this one audits a PAGE, not a domain: the scheme and
// path are the subject, not noise. "example.com" and "example.com/pricing" get
// wildly different Lighthouse scores, so nothing is collapsed the way
// site-explorer/domain.ts collapses a domain.
//
// PSI has to fetch the page itself, so the URL must be publicly reachable —
// localhost, private ranges and non-HTTP schemes are rejected here rather than
// sent upstream to fail 20 seconds later with a vaguer message.

/** Hostname labels: alphanumeric + hyphen, no leading/trailing hyphen. */
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const MAX_URL_LENGTH = 2000;

/** Hosts PSI can never reach from Google's infrastructure. */
const PRIVATE_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const PRIVATE_IPV4 =
  /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

export class InvalidAuditUrlError extends Error {
  readonly statusCode = 400;
  constructor(
    readonly input: string,
    readonly reason: "malformed" | "not_public",
  ) {
    super(
      reason === "not_public"
        ? "That address is not reachable from the public internet"
        : "Enter a full URL like https://example.com/pricing",
    );
    this.name = "InvalidAuditUrlError";
  }
}

/**
 * Normalizes a user-entered address into the URL PSI will fetch.
 *
 * Kept: scheme (defaulted to https), host, port, path, query.
 * Dropped: the fragment — never sent to a server, so it cannot change what
 * Lighthouse measures, and keeping it would split the cache.
 */
export function normalizeAuditUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
    throw new InvalidAuditUrlError(input, "malformed");
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new InvalidAuditUrlError(input, "malformed");
  }

  // Lighthouse audits a web page; ftp:, file: and data: are not pages.
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidAuditUrlError(input, "malformed");
  }

  const host = url.hostname.toLowerCase();
  if (!host) throw new InvalidAuditUrlError(input, "malformed");

  // ── Publicly reachable? ────────────────────────────────────────────────
  if (PRIVATE_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new InvalidAuditUrlError(input, "not_public");
  }
  if (/^\d+(\.\d+){3}$/.test(host)) {
    // A bare public IP is technically auditable, but a private one is not and
    // is the overwhelmingly common case for a pasted address.
    if (PRIVATE_IPV4.test(host)) throw new InvalidAuditUrlError(input, "not_public");
  } else {
    const labels = host.split(".");
    // Needs a dot and a real TLD — "localhost" is caught above, "myserver" here.
    if (labels.length < 2) throw new InvalidAuditUrlError(input, "not_public");
    if (!labels.every((label) => LABEL.test(label))) {
      throw new InvalidAuditUrlError(input, "malformed");
    }
    const tld = labels[labels.length - 1];
    if (!/^[a-z]{2,}$/.test(tld) && !tld.startsWith("xn--")) {
      throw new InvalidAuditUrlError(input, "malformed");
    }
  }

  url.hash = "";
  const rendered = url.toString();
  // URL.toString() appends "?" for an empty query; that is not part of the
  // address and would split the cache.
  return rendered.endsWith("?") ? rendered.slice(0, -1) : rendered;
}

/** Non-throwing form, for the client's submit-button enable check. */
export function isValidAuditUrl(input: string): boolean {
  try {
    normalizeAuditUrl(input);
    return true;
  } catch {
    return false;
  }
}
