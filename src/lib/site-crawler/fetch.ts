// src/lib/site-crawler/fetch.ts
//
// One polite HTTP fetch, plus the token bucket that paces them.
//
// Redirects are followed MANUALLY (`redirect: "manual"`) rather than by the
// runtime, because the crawler has to report on the chain itself: which URL the
// first hop pointed at, and how many hops there were. `redirect: "follow"`
// would give us the final response and throw that away.
//
// The body is never returned whole from a stream we did not bound. readCapped()
// stops at MAX_RESPONSE_BYTES, so a misconfigured server streaming a gigabyte
// costs us two megabytes and an abort.

import {
  CRAWLER_USER_AGENT,
  FETCH_TIMEOUT_MS,
  MAX_REDIRECT_HOPS,
  MAX_RESPONSE_BYTES,
  MAX_REQUESTS_PER_SECOND,
} from "./constants";

/**
 * Token bucket: at most MAX_REQUESTS_PER_SECOND starts per second, per crawl.
 *
 * One instance per crawl, shared by all FETCH_CONCURRENCY workers, so the
 * concurrency setting controls how many requests are in flight while this
 * controls how fast new ones begin. Both are needed: concurrency alone would
 * let four instant requests land on a slow server every time it replied.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly ratePerMs: number;
  private readonly capacity: number;

  constructor(
    ratePerSecond: number = MAX_REQUESTS_PER_SECOND,
    /** Extra seconds between requests requested by robots.txt. */
    private readonly extraDelayMs = 0,
  ) {
    this.capacity = Math.max(1, ratePerSecond);
    this.tokens = this.capacity;
    this.ratePerMs = ratePerSecond / 1000;
    this.lastRefill = Date.now();
  }

  /** Resolves when the caller may start a request. */
  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.tokens = Math.min(
        this.capacity,
        this.tokens + (now - this.lastRefill) * this.ratePerMs,
      );
      this.lastRefill = now;

      if (this.tokens >= 1) {
        this.tokens -= 1;
        if (this.extraDelayMs > 0) await sleep(this.extraDelayMs);
        return;
      }

      const waitMs = Math.ceil((1 - this.tokens) / this.ratePerMs);
      await sleep(Math.max(waitMs, 5));
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchOutcome {
  /** Final URL after redirects. */
  finalUrl: string;
  statusCode: number | null;
  /** Location of the FIRST hop only, when there was one. */
  redirectTarget: string | null;
  redirectHops: number;
  contentType: string | null;
  /** Present only for text/html within the size cap. */
  html: string | null;
  /** X-Robots-Tag of the final response, lowercased. */
  xRobotsTag: string | null;
  fetchMs: number;
  /** Set when the request never produced a response at all. */
  error: string | null;
}

/** True for a Content-Type this crawler will parse. */
export function isHtmlContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const type = contentType.split(";")[0]!.trim().toLowerCase();
  return type === "text/html" || type === "application/xhtml+xml";
}

/**
 * Fetch one URL, following redirects by hand.
 *
 * Never throws: transport failures come back as `error` with a null status, so
 * one unreachable page cannot end a crawl.
 */
export async function fetchPage(url: string): Promise<FetchOutcome> {
  const started = Date.now();
  let current = url;
  let redirectTarget: string | null = null;
  let hops = 0;

  try {
    for (;;) {
      const res = await fetch(current, {
        headers: {
          "user-agent": CRAWLER_USER_AGENT,
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "accept-language": "en",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      const location = res.headers.get("location");
      const isRedirect = res.status >= 300 && res.status < 400 && location;

      if (isRedirect) {
        let next: string;
        try {
          next = new URL(location, current).toString();
        } catch {
          // A Location we cannot resolve ends the chain; report the redirect.
          return {
            finalUrl: current,
            statusCode: res.status,
            redirectTarget: redirectTarget ?? location,
            redirectHops: hops,
            contentType: res.headers.get("content-type"),
            html: null,
            xRobotsTag: lowerOrNull(res.headers.get("x-robots-tag")),
            fetchMs: Date.now() - started,
            error: null,
          };
        }

        if (hops === 0) redirectTarget = next;
        hops += 1;

        if (hops > MAX_REDIRECT_HOPS) {
          return {
            finalUrl: current,
            statusCode: res.status,
            redirectTarget,
            redirectHops: hops,
            contentType: res.headers.get("content-type"),
            html: null,
            xRobotsTag: lowerOrNull(res.headers.get("x-robots-tag")),
            fetchMs: Date.now() - started,
            error: "too_many_redirects",
          };
        }

        // Drain the redirect body so the connection can be reused.
        await res.body?.cancel().catch(() => {});
        current = next;
        continue;
      }

      const contentType = res.headers.get("content-type");
      const xRobotsTag = lowerOrNull(res.headers.get("x-robots-tag"));

      // Non-HTML: record the status and content type, read nothing.
      if (!isHtmlContentType(contentType)) {
        await res.body?.cancel().catch(() => {});
        return {
          finalUrl: current,
          statusCode: res.status,
          redirectTarget,
          redirectHops: hops,
          contentType,
          html: null,
          xRobotsTag,
          fetchMs: Date.now() - started,
          error: null,
        };
      }

      const html = await readCapped(res, MAX_RESPONSE_BYTES);
      return {
        finalUrl: current,
        statusCode: res.status,
        redirectTarget,
        redirectHops: hops,
        contentType,
        html,
        xRobotsTag,
        fetchMs: Date.now() - started,
        error: html === null ? "response_too_large" : null,
      };
    }
  } catch (err) {
    return {
      finalUrl: current,
      statusCode: null,
      redirectTarget,
      redirectHops: hops,
      contentType: null,
      html: null,
      xRobotsTag: null,
      fetchMs: Date.now() - started,
      error: err instanceof Error ? err.name || err.message : "fetch_failed",
    };
  }
}

function lowerOrNull(v: string | null): string | null {
  return v ? v.toLowerCase() : null;
}

/** Read a body up to a ceiling; null means the ceiling was hit. */
async function readCapped(res: Response, maxBytes: number): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(joined);
}
