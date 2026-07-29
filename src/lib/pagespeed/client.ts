/**
 * src/lib/pagespeed/client.ts
 *
 * Google PageSpeed Insights API v5 client.
 *
 * Deliberately NOT DataForSEO: PSI is Google's own Lighthouse runner, it is
 * free, and it is the only source for CrUX field data. The error/timeout
 * discipline mirrors dataforseo/client.ts so both integrations fail the same
 * shape — typed error codes, a hard timeout, bounded retries, and truncated
 * upstream payloads in messages.
 *
 * Two things differ from the DataForSEO client, both because of PSI itself:
 *   - the timeout is 60 s, not 60 s-as-a-formality. A real PSI run takes
 *     10-30 s and a cold/slow origin can exceed that; anything less than ~45 s
 *     times out perfectly healthy audits.
 *   - a 429 is NOT retried. PSI's 429 is a quota decision, and retrying it
 *     burns the next slot too.
 *
 * Env: PAGESPEED_API_KEY (OPTIONAL). PSI works keyless at low volume; the key
 * only raises the shared-IP quota. Absence is a normal, supported state — see
 * hasApiKey() for the ops surface that reports it.
 */

import { fixturesEnabled, loadFixture, recordingEnabled, saveFixture } from "./fixtures";
import type { PsiStrategy } from "./strategies";

const API_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

/** PSI runs are slow by nature; this is a real budget, not a formality. */
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 1;
const RETRY_BACKOFF_MS = 2_000;
const MAX_ERROR_PAYLOAD = 1200;

export { PSI_STRATEGIES } from "./strategies";
export type { PsiStrategy } from "./strategies";

/** The four Lighthouse categories this tool reports. */
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;

export class PagespeedError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_URL"
      | "UNREACHABLE"
      | "RATE_LIMITED"
      | "TIMEOUT"
      | "UPSTREAM_UNAVAILABLE"
      | "INTERNAL",
  ) {
    super(message);
    this.name = "PagespeedError";
  }
}

/** True when PAGESPEED_API_KEY is configured. Keyless still works. */
export function hasApiKey(): boolean {
  return Boolean(process.env.PAGESPEED_API_KEY?.trim());
}

function truncate(text: string): string {
  return text.length > MAX_ERROR_PAYLOAD
    ? `${text.slice(0, MAX_ERROR_PAYLOAD)}... [truncated]`
    : text;
}

/**
 * Google's error body. PSI reports a failed *audit* (bad URL, origin refused
 * the connection) as an HTTP 4xx with this shape, so the message here is often
 * the only explanation of why a legitimate-looking URL did not work.
 */
type PsiErrorBody = {
  error?: { code?: number; message?: string; status?: string };
};

/** Fixture key for a (url, strategy) pair — stable and filesystem-safe. */
export function fixtureKeyFor(url: string, strategy: PsiStrategy): string {
  const slug = url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9.-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${slug}-${strategy}`;
}

/**
 * Runs one Lighthouse audit through PSI and returns the raw response.
 *
 * Parsing lives in lighthouse/parse.ts — this function's only job is to get
 * bytes back or throw a typed error.
 */
export async function runPagespeed(
  url: string,
  strategy: PsiStrategy,
  opts?: { signal?: AbortSignal },
): Promise<unknown> {
  const key = fixtureKeyFor(url, strategy);

  // PAGESPEED_FIXTURES=1 — serve a recorded response. PSI is free, so this is
  // about speed and determinism in tests, not cost.
  if (fixturesEnabled()) {
    const recorded = loadFixture(key);
    if (recorded) return recorded;
    throw new PagespeedError(
      `PAGESPEED_FIXTURES=1 but no fixture recorded for ${key}`,
      "INTERNAL",
    );
  }

  const params = new URLSearchParams({ url, strategy });
  for (const category of CATEGORIES) params.append("category", category);
  const apiKey = process.env.PAGESPEED_API_KEY?.trim();
  if (apiKey) params.set("key", apiKey);

  const signal = opts?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  let response: Response | undefined;
  for (let attempt = 0; ; attempt++) {
    try {
      response = await fetch(`${API_URL}?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal,
      });
    } catch (err) {
      // AbortSignal.timeout surfaces as TimeoutError; anything else is a
      // network fault. Both are worth one retry, then they are terminal.
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      if (!timedOut && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
        continue;
      }
      throw new PagespeedError(
        timedOut
          ? `PageSpeed Insights did not respond within ${REQUEST_TIMEOUT_MS / 1000}s`
          : `Could not reach PageSpeed Insights: ${err instanceof Error ? err.message : String(err)}`,
        timedOut ? "TIMEOUT" : "UPSTREAM_UNAVAILABLE",
      );
    }

    if (response.ok) break;

    // 429 is a quota decision — retrying spends the next slot for nothing.
    if (response.status >= 500 && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
      continue;
    }

    const raw = await response.text();
    let detail = truncate(raw);
    try {
      const parsed = JSON.parse(raw) as PsiErrorBody;
      if (parsed.error?.message) detail = truncate(parsed.error.message);
    } catch {
      // Non-JSON error body — the truncated raw text is the best we have.
    }

    throw new PagespeedError(
      `PageSpeed Insights HTTP ${response.status}: ${detail}`,
      response.status === 429
        ? "RATE_LIMITED"
        : response.status >= 500
          ? "UPSTREAM_UNAVAILABLE"
          : // 400/404 from PSI almost always means "we could not load that
            // page", not "your request was malformed" — the URL was validated
            // before we got here.
            "UNREACHABLE",
    );
  }

  const json: unknown = await response.json();

  // PAGESPEED_RECORD=1 — persist the response for later replay.
  if (recordingEnabled()) {
    try {
      saveFixture(key, json);
    } catch (err) {
      console.error(
        `[pagespeed] fixture record failed for ${key}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return json;
}
