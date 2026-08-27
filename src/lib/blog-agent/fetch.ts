// src/lib/blog-agent/fetch.ts
//
// Every outbound request the blog agent makes goes through here.
//
// FOUR THINGS, ALWAYS: the SSRF guard, a timeout, a byte cap, and robots.txt.
// The agent is a server-side fetch loop pointed at URLs it read out of a
// document, which is the SSRF shape exactly — and unlike the bot-analytics
// access check, whose URL comes from a tenant's own verified domain row, these
// URLs come from the open web. guardCheckUrl() is reused rather than
// reimplemented: it already refuses file://, credentials-in-URL, odd ports, IP
// literals and private suffixes, and a second copy of that logic is a second
// copy to keep correct.

import { guardCheckUrl } from "@/lib/bot-analytics/url-guard";
import { logger } from "@/infrastructure/observability/logger";

/** Identifies us to every server we touch, with a way to complain. */
export const BLOG_AGENT_UA =
  "Echorank-BlogAgent/1.0 (+https://echorank360.com; fredericd@echorank360.com)";

const TIMEOUT_MS = 10_000;

/**
 * Byte caps, and they are NOT the same number.
 *
 * THE BRIEF SAID 100KB PER PAGE. Measured against the actual sources on
 * 2026-08-21, that number does not survive contact with the modern web: a
 * Search Engine Journal article page is 226KB of HTML and an Ahrefs index is
 * 878KB, almost all of it inline CSS and script rather than prose. At 100KB the
 * research stage fetched three pages and extracted zero — every candidate was
 * refused as "too_large", and the pipeline aborted for want of sources while
 * looking, from the logs, like a robots.txt problem.
 *
 * The cap's job is to bound memory, not to be exactly 100KB. 1MB per page is
 * roughly four times the largest article we actually read and still small
 * enough that four concurrent fetches cannot hurt the worker.
 *
 * A FEED INDEX is a different object again. Search Engine Land and OpenAI News
 * both inline full article bodies in <description>, so their feeds run to
 * several hundred KB — the same live run showed both silently dropped.
 * Extraction is capped separately at MAX_EXTRACT_CHARS in research.ts, which is
 * what actually bounds what reaches the model; these two only bound the buffer.
 */
export const MAX_PAGE_BYTES = 1_000_000;
export const MAX_FEED_BYTES = 3_000_000;

export type FetchRejection =
  | "blocked_url"
  | "not_allowlisted"
  | "robots_disallowed"
  | "timeout"
  | "http_error"
  | "too_large"
  | "wrong_type";

export interface FetchResult {
  ok: boolean;
  url: string;
  body?: string;
  contentType?: string;
  status?: number;
  reason?: FetchRejection;
  /**
   * The thrown error's message, when there was one.
   *
   * "http_error" covers both a 4xx WITH a status and a connection that never
   * produced one — DNS failure, TLS rejection, a socket hangup. Without this the
   * two are indistinguishable in the logs, which is how a research stage that
   * could not resolve a host reads as a site returning an error.
   */
  detail?: string;
}

/**
 * Read a capped number of bytes and stop.
 *
 * Reading the whole body and then truncating means a hostile or merely careless
 * server can make us buffer a gigabyte before we notice. Cancelling the reader
 * at the cap is the difference between a byte limit and a wish.
 */
async function readCapped(response: Response, maxBytes: number): Promise<string | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;

  const reader = response.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let total = 0;
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
  return new TextDecoder("utf-8").decode(
    chunks.reduce<Uint8Array>((acc, c) => {
      const merged = new Uint8Array(acc.length + c.length);
      merged.set(acc);
      merged.set(c, acc.length);
      return merged;
    }, new Uint8Array()),
  );
}

/**
 * robots.txt, cached per origin for the life of the process.
 *
 * A job that fetches four pages from one publication should ask once. The cache
 * is process-lifetime because a worker restarts often enough that a stale
 * answer cannot persist for long, and because the alternative — a Redis key —
 * is more machinery than a politeness check warrants.
 */
const robotsCache = new Map<string, string | null>();

async function robotsFor(origin: string): Promise<string | null> {
  if (robotsCache.has(origin)) return robotsCache.get(origin) ?? null;
  let body: string | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "user-agent": BLOG_AGENT_UA, accept: "text/plain" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    // A 404 means "no rules", which is permission. Only a served file binds us.
    body = res.ok ? await res.text() : null;
  } catch {
    // A robots.txt we cannot fetch is treated as absent rather than as a
    // refusal: the alternative is that one flaky request silently disables a
    // source for the rest of the process's life.
    body = null;
  }
  robotsCache.set(origin, body);
  return body;
}

/**
 * Whether robots.txt permits `path` for our user-agent.
 *
 * A deliberately small parser: it reads the `*` group and any group naming us,
 * takes the longest matching Disallow/Allow prefix, and lets Allow win ties —
 * which is the resolution order the standard specifies. robots-parser is in the
 * tree, but it is wired into the site-crawler's own conventions; twenty lines
 * here keeps this module free of that coupling.
 */
export function robotsAllows(robotsTxt: string | null, path: string, ua = "echorank-blogagent"): boolean {
  if (!robotsTxt) return true;

  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      // Consecutive User-agent lines share one rule block.
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "disallow" || key === "allow") {
      current.rules.push({ allow: key === "allow", path: value });
    }
  }

  const applicable = groups.filter((g) =>
    g.agents.some((a) => a === "*" || ua.includes(a) || a.includes(ua)),
  );
  // A named group wins over the wildcard, per the standard.
  const named = applicable.filter((g) => !g.agents.includes("*"));
  const rules = (named.length ? named : applicable).flatMap((g) => g.rules);

  let best: { allow: boolean; length: number } | null = null;
  for (const rule of rules) {
    // An empty Disallow is an explicit "everything is allowed" and matches
    // nothing; treating it as a zero-length prefix would block the whole site.
    if (rule.path === "") continue;
    if (!path.startsWith(rule.path)) continue;
    if (!best || rule.path.length > best.length || (rule.path.length === best.length && rule.allow)) {
      best = { allow: rule.allow, length: rule.path.length };
    }
  }
  return best ? best.allow : true;
}

export interface GuardedFetchOptions {
  /** Origins this call may reach. Nothing outside the list is attempted. */
  allowedOrigins: readonly string[];
  accept: string;
  /** Skip the robots check. Only ever true for robots.txt itself. */
  skipRobots?: boolean;
  /** Defaults to the page cap. Feed fetches pass MAX_FEED_BYTES. */
  maxBytes?: number;
}

/**
 * Fetch one URL, or refuse with a reason.
 *
 * Never throws for an expected refusal — a dead feed, a 403, an oversized page
 * and a robots block are all normal outcomes of pointing a job at the open web,
 * and a discover run must survive all four without failing the job.
 */
export async function guardedFetch(
  rawUrl: string,
  options: GuardedFetchOptions,
): Promise<FetchResult> {
  const guard = guardCheckUrl(rawUrl);
  if (!guard.ok || !guard.url) {
    // The guard's own reason, carried through: "blocked_url" alone does not say
    // whether the URL was malformed, a private address or an odd port.
    return { ok: false, url: rawUrl, reason: "blocked_url", detail: guard.reason };
  }
  const url = guard.url;
  const parsed = new URL(url);

  if (!options.allowedOrigins.includes(parsed.origin)) {
    return { ok: false, url, reason: "not_allowlisted" };
  }

  if (!options.skipRobots) {
    const robots = await robotsFor(parsed.origin);
    if (!robotsAllows(robots, parsed.pathname)) {
      logger.info({ url }, "blog-agent: robots.txt disallows");
      return { ok: false, url, reason: "robots_disallowed" };
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": BLOG_AGENT_UA, accept: options.accept },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, url, status: response.status, reason: "http_error" };
    }
    const contentType = response.headers.get("content-type") ?? "";
    const body = await readCapped(response, options.maxBytes ?? MAX_PAGE_BYTES);
    if (body === null) {
      return { ok: false, url, status: response.status, reason: "too_large" };
    }
    return { ok: true, url, body, contentType, status: response.status };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      url,
      reason: timedOut ? "timeout" : "http_error",
      detail: timedOut
        ? `no response within ${TIMEOUT_MS}ms`
        : err instanceof Error
          ? `${err.name}: ${err.message}`
          : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Test seam: robots answers are memoized per process. */
export function clearRobotsCache(): void {
  robotsCache.clear();
}
