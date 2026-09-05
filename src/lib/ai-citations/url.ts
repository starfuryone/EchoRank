// Portions adapted from every-app/open-seo (MIT)
//
// src/lib/ai-citations/url.ts
//
// Scheme allow-listing for URLs that came from outside.
//
// WHY THIS IS NOT PARANOIA. The cited-source URLs on this surface arrive from
// DataForSEO, which got them from LLM answers — text produced by other
// vendors' models, which a crafted prompt can coax into emitting
// `javascript:` or `data:` payloads. Those URLs are rendered as `<a href>`
// inside an authenticated session. Without this filter, a link in that table
// is a click away from script execution on the dashboard's origin.
//
// Returns the string unchanged when it is safe, and null otherwise. Callers
// DROP null rather than rendering it — see cited-sources.ts.

/** An http(s) URL with no embedded credentials, or null. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // `user:pass@host` — the hostname a reader sees in the link text can differ
    // from the host the browser authenticates against.
    if (url.username || url.password) return null;
    return value;
  } catch {
    return null;
  }
}

/** Bare hostname without a leading `www.`, or null for anything unsafe. */
export function safeHostname(value: string | null | undefined): string | null {
  const url = safeHttpUrl(value);
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
