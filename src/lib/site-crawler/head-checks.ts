// src/lib/site-crawler/head-checks.ts
//
// The bounded HEAD checks behind the external-link and image rules
// (response_codes.external_4xx/5xx, links.external_to_redirect,
// images.broken / images.over_100kb).
//
// BOUNDED THREE WAYS: a per-page cap (EXTERNAL_CHECKS_PER_PAGE,
// IMAGE_CHECKS_PER_PAGE), a per-crawl Redis cache so a logo on every page is
// checked once, and the SSRF guard on every URL. Same-host images go through
// the crawl's politeness limiter — they hit the customer's server; external
// links do not, since each is a different host and one request.
//
// Inconclusive answers are not findings. 401/403/429 from another site is
// usually bot protection, not a broken link, and a server that refuses HEAD
// (405/501) has told us nothing; both count as checked, not as errors.

import "server-only";
import type Redis from "ioredis";
import type { ImageCheckFacts, LinkCheckFacts, PageFacts } from "@/lib/crawl-rules";
import {
  CRAWLER_USER_AGENT,
  EXTERNAL_CHECKS_PER_PAGE,
  HEAD_TIMEOUT_MS,
  IMAGE_CHECKS_PER_PAGE,
  IMAGE_MAX_BYTES,
  REDIS_KEY_TTL_SECONDS,
} from "./constants";
import type { RateLimiter } from "./fetch";
import { isFetchableUrl, isInScope } from "./url";

export interface HeadResult {
  status: number | null;
  bytes: number | null;
}

const INCONCLUSIVE = new Set([401, 403, 405, 429, 501]);

export async function head(url: string): Promise<HeadResult> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "user-agent": CRAWLER_USER_AGENT },
      redirect: "manual",
      signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
    });
    const len = Number(res.headers.get("content-length"));
    return { status: res.status, bytes: Number.isFinite(len) && len > 0 ? len : null };
  } catch {
    return { status: null, bytes: null };
  }
}

export interface HeadCheckDeps {
  redis: Redis;
  cacheKey: string;
  limiter: Pick<RateLimiter, "acquire">;
  /** Injected for tests. */
  headFn?: (url: string) => Promise<HeadResult>;
}

async function cached(url: string, deps: HeadCheckDeps, polite: boolean): Promise<HeadResult> {
  const hit = await deps.redis.hget(deps.cacheKey, url);
  if (hit !== null) {
    const [s, b] = hit.split("|");
    return { status: s ? Number(s) : null, bytes: b ? Number(b) : null };
  }
  if (polite) await deps.limiter.acquire();
  const r = await (deps.headFn ?? head)(url);
  await deps.redis.hset(deps.cacheKey, url, `${r.status ?? ""}|${r.bytes ?? ""}`);
  await deps.redis.expire(deps.cacheKey, REDIS_KEY_TTL_SECONDS);
  return r;
}

const distinct = (urls: string[]) => [...new Set(urls)];

/** Run the page's HEAD checks and attach them to `facts`. Never throws. */
export async function attachHeadChecks(facts: PageFacts, rootUrl: string, deps: HeadCheckDeps): Promise<void> {
  const html = facts.html;
  if (!html) return;
  try {
    const external = distinct(
      html.anchors.filter((a) => !a.internal && /^https?:\/\//i.test(a.href)).map((a) => a.href),
    )
      .filter(isFetchableUrl)
      .slice(0, EXTERNAL_CHECKS_PER_PAGE);
    if (external.length) {
      const out: LinkCheckFacts = { checked: 0, clientErrors: 0, serverErrors: 0, redirects: 0, sample: null };
      const results = await Promise.all(external.map(async (u) => [u, await cached(u, deps, false)] as const));
      for (const [u, r] of results) {
        out.checked += 1;
        if (r.status === null || INCONCLUSIVE.has(r.status)) continue;
        if (r.status >= 500) out.serverErrors += 1;
        else if (r.status >= 400) out.clientErrors += 1;
        else if (r.status >= 300) out.redirects += 1;
        else continue;
        out.sample ??= u;
      }
      facts.externalLinkChecks = out;
    }

    const images = distinct(html.images.map((i) => i.src))
      .filter((u) => /^https?:\/\//i.test(u) && isInScope(u, rootUrl) && isFetchableUrl(u))
      .slice(0, IMAGE_CHECKS_PER_PAGE);
    if (images.length) {
      const out: ImageCheckFacts = { checked: 0, broken: 0, oversize: 0, sample: null };
      for (const u of images) {
        const r = await cached(u, deps, true);
        out.checked += 1;
        if (r.status !== null && r.status >= 400 && !INCONCLUSIVE.has(r.status)) {
          out.broken += 1;
          out.sample ??= u;
        } else if (r.bytes !== null && r.bytes > IMAGE_MAX_BYTES) {
          out.oversize += 1;
          out.sample ??= u;
        }
      }
      facts.imageChecks = out;
    }
  } catch {
    // A failed check run leaves the page without check facts; the rules that
    // need them simply do not fire.
  }
}
