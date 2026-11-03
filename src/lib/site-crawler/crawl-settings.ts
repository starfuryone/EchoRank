// src/lib/site-crawler/crawl-settings.ts
//
// A decrypted CrawlConfig turned into what the runner uses: the request
// options (user agent, credentials, and which hosts may see them), the
// admission test every discovered URL passes before the frontier, and the
// robots.txt rules the crawl obeys (plus the draft judged in test mode).
// Pure apart from Buffer; the runner owns the I/O.

import "server-only";
import { CRAWLER_USER_AGENT } from "./constants";
import { GOOGLEBOT_UA, applyQueryMode, robotsToken, urlFilter, type RuntimeCrawlConfig } from "./crawl-config";
import type { FetchOptions } from "./fetch";
import { allowAllRules, rulesFromBody, type RobotsRules } from "./robots";
import { isFetchableUrl, isInScope } from "./url";

export interface CrawlSettings {
  userAgent: string;
  /** The robots.txt group token the crawl obeys. */
  agent: string;
  fetchOpts: FetchOptions;
  /** A discovered URL (already normalised) → the URL to enqueue, or null when it stays out. */
  admit: (url: string) => string | null;
  /** Same scope as admit, without the include/exclude patterns: where credentials may go. */
  inScope: (url: string) => boolean;
  /** The query-string option alone: how a link target is keyed to match a crawled page's URL. */
  canonical: (url: string) => string;
  maxDepth: number | null;
  followNofollow: boolean;
}

function host(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function crawlSettings(cfg: RuntimeCrawlConfig, rootUrl: string): CrawlSettings {
  const userAgent =
    cfg.userAgent === "echorank"
      ? CRAWLER_USER_AGENT
      : cfg.userAgent === "custom"
        ? cfg.customUserAgent || CRAWLER_USER_AGENT
        : GOOGLEBOT_UA[cfg.userAgent];
  const agent = robotsToken(cfg.userAgent, cfg.customUserAgent, CRAWLER_USER_AGENT);
  const rootHost = host(rootUrl);
  const inScope = (url: string) => (cfg.crawlSubdomains ? isInScope(url, rootUrl) : host(url) === rootHost);
  const filter = urlFilter(cfg.include, cfg.exclude);

  const extra: Record<string, string> = {};
  for (const h of cfg.headers) extra[h.name.toLowerCase()] = h.value;
  if (cfg.cookies) extra.cookie = cfg.cookies;
  if (cfg.basicAuth) {
    extra.authorization = `Basic ${Buffer.from(`${cfg.basicAuth.user}:${cfg.basicAuth.password}`).toString("base64")}`;
  }

  return {
    userAgent,
    agent,
    fetchOpts: {
      userAgent,
      ...(Object.keys(extra).length ? { extraHeaders: extra, credentialsFor: inScope } : {}),
    },
    admit(url) {
      const u = applyQueryMode(url, cfg.queryStrings, cfg.stripParams);
      return inScope(u) && isFetchableUrl(u) && filter(u) ? u : null;
    },
    inScope,
    canonical: (url) => applyQueryMode(url, cfg.queryStrings, cfg.stripParams),
    maxDepth: cfg.maxDepth,
    followNofollow: cfg.followNofollow,
  };
}

/**
 * The rules the crawl obeys, and the draft to judge against in test mode.
 *
 *   respectRobots off (verified sites)      → allow everything, no crawl-delay;
 *   custom robots.txt, mode "replace"       → the draft replaces the live file;
 *   custom robots.txt, mode "test"          → obey the live file, judge the draft;
 *   otherwise                               → the live file.
 *
 * Sitemap: lines keep coming from the live file unless the draft declares its own.
 */
export function resolveRobots(
  live: RobotsRules,
  cfg: Pick<RuntimeCrawlConfig, "respectRobots" | "customRobots" | "customRobotsMode">,
  robotsUrl: string,
  agent: string,
): { obey: RobotsRules; test: RobotsRules | null } {
  if (!cfg.respectRobots) return { obey: { ...allowAllRules(), sitemaps: live.sitemaps, body: live.body }, test: null };
  if (!cfg.customRobots) return { obey: live, test: null };
  const draft = rulesFromBody(cfg.customRobots, robotsUrl, agent);
  if (cfg.customRobotsMode === "replace") {
    return { obey: { ...draft, sitemaps: draft.sitemaps.length ? draft.sitemaps : live.sitemaps }, test: null };
  }
  return { obey: live, test: draft };
}
