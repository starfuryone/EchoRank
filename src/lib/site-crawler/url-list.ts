// src/lib/site-crawler/url-list.ts
//
// List mode (Phase 4a): a pasted list or an uploaded .txt / .csv, one URL per
// line, first column of a CSV. Dependency-free: the start card parses the
// upload in the browser and the server parses again what it receives.
// Validation (the SSRF guard) is the server's job; this only splits.

/** Lines read from an upload before giving up: the plan cap is at most 25,000. */
export const MAX_LIST_LINES = 50_000;

/** The first field of a CSV line, unquoted. */
function firstField(line: string): string {
  const t = line.trim();
  if (t.startsWith('"')) {
    const end = t.indexOf('"', 1);
    return end > 0 ? t.slice(1, end) : t.slice(1);
  }
  return t.split(/[,;\t]/)[0] ?? "";
}

/**
 * Candidate URLs from a text: blank lines, # comments and a header row
 * ("url", "address", "loc"…, anything without a dot) dropped, duplicates
 * removed, order kept.
 */
export function parseUrlList(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/).slice(0, MAX_LIST_LINES)) {
    const v = firstField(line).trim();
    if (!v || v.startsWith("#") || !v.includes(".")) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
