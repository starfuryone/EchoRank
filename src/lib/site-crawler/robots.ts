// src/lib/site-crawler/robots.ts
//
// robots.txt: fetch once per crawl, then answer allow/deny per URL.
//
// POSTURE ON FAILURE. A robots.txt that 404s means "no rules" and the crawl
// proceeds — that is the standard reading and what every major crawler does. A
// robots.txt that times out or 5xxs is NOT the same thing: we asked and the
// site did not answer, so this treats it as disallow-all. Guessing permission
// from a server error is how a crawler ends up hammering a site that was trying
// to shed load.

import robotsParser, { type Robot } from "robots-parser";
import { CRAWLER_USER_AGENT } from "./constants";

/** Ceiling on an honored Crawl-delay, per spec. */
export const MAX_CRAWL_DELAY_SECONDS = 10;

/** robots.txt itself gets a shorter timeout than a page — it gates the crawl. */
const ROBOTS_TIMEOUT_MS = 10_000;
/** A robots.txt larger than this is not a rules file worth parsing. */
const MAX_ROBOTS_BYTES = 512 * 1024;

export interface RobotsRules {
  /** False when the fetch failed in a way that means "do not crawl". */
  allowAll: boolean;
  isAllowed(url: string): boolean;
  /** Seconds between requests requested by the site, already clamped. */
  crawlDelaySeconds: number;
}

/**
 * Clamp a site's Crawl-delay into something a crawl can actually finish under.
 *
 * A site asking for 30s between requests would cap a 500-URL crawl at four
 * hours, well past the wall clock. We honor up to 10s and no further; the
 * hard rate limit (2 req/s) applies underneath regardless.
 */
export function clampCrawlDelay(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, MAX_CRAWL_DELAY_SECONDS);
}

/** Rules that permit everything — used when robots.txt is absent (404/410). */
export function allowAllRules(): RobotsRules {
  return { allowAll: true, isAllowed: () => true, crawlDelaySeconds: 0 };
}

/** Rules that permit nothing — used when robots.txt could not be read. */
export function denyAllRules(): RobotsRules {
  return { allowAll: false, isAllowed: () => false, crawlDelaySeconds: 0 };
}

/** Wrap a parsed robots.txt body in the interface the crawler consumes. */
export function rulesFromBody(body: string, robotsUrl: string): RobotsRules {
  const parsed: Robot = robotsParser(robotsUrl, body);
  // robots-parser resolves the most specific matching group for this UA and
  // falls back to `*` itself, which is exactly the precedence we want.
  const delay = clampCrawlDelay(parsed.getCrawlDelay(CRAWLER_USER_AGENT));

  return {
    allowAll: false,
    isAllowed(url: string): boolean {
      // isAllowed returns undefined for a URL on a different host than the
      // robots.txt. Scope already prevents that; treat it as allowed rather
      // than silently dropping the URL.
      const verdict = parsed.isAllowed(url, CRAWLER_USER_AGENT);
      return verdict !== false;
    },
    crawlDelaySeconds: delay,
  };
}

/**
 * Fetch and parse robots.txt for the crawl root's origin.
 *
 * Never throws: every failure resolves to a rules object, because the crawl
 * must make a decision either way and an exception here would fail the job.
 */
export async function fetchRobots(rootUrl: string): Promise<RobotsRules> {
  let robotsUrl: string;
  try {
    robotsUrl = new URL("/robots.txt", rootUrl).toString();
  } catch {
    return denyAllRules();
  }

  try {
    const res = await fetch(robotsUrl, {
      headers: { "user-agent": CRAWLER_USER_AGENT, accept: "text/plain,*/*;q=0.8" },
      signal: AbortSignal.timeout(ROBOTS_TIMEOUT_MS),
      redirect: "follow",
    });

    // Absent robots.txt = no rules. This is the only branch that opens the
    // crawl up, and it requires an explicit "not here" from the server.
    if (res.status === 404 || res.status === 410) return allowAllRules();

    if (!res.ok) return denyAllRules();

    const body = await readCapped(res, MAX_ROBOTS_BYTES);
    if (body === null) return denyAllRules();
    // An empty robots.txt is a valid "everything allowed".
    if (body.trim() === "") return allowAllRules();

    return rulesFromBody(body, robotsUrl);
  } catch {
    // Timeout, DNS failure, connection reset — we asked and got no answer.
    return denyAllRules();
  }
}

/** Read a response body up to a byte ceiling, aborting past it. */
async function readCapped(res: Response, maxBytes: number): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;

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
