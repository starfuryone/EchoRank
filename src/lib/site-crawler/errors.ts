// src/lib/site-crawler/errors.ts
//
// The crawler's typed errors, dependency-free. They lived in http.ts, which
// imports next/server — fine for routes, fatal for the workers process
// (tsx under react-server), which now reaches startCrawl through the
// Phase 4c scheduler. http.ts re-exports them, so instanceof is unchanged.

import type { ConfigProblem } from "./crawl-config";

export class InvalidCrawlUrlError extends Error {
  readonly statusCode = 400;
  constructor(readonly reason: string, message = "Enter a public http(s) URL, like https://example.com") {
    super(message);
    this.name = "InvalidCrawlUrlError";
  }
}

export class CrawlQuotaExceededError extends Error {
  readonly statusCode = 429;
  constructor(
    readonly limit: number,
    readonly plan: string,
  ) {
    super(`You have used all ${limit} crawls included this month.`);
    this.name = "CrawlQuotaExceededError";
  }
}

/** The month's page allowance is spent (page-allowance.ts). Resets on the 1st, UTC. */
export class CrawlPageAllowanceError extends Error {
  readonly statusCode = 429;
  constructor(
    readonly limit: number,
    readonly used: number,
    readonly resetsAt: string,
  ) {
    super(`Monthly allowance reached: ${used.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")} pages this month.`);
    this.name = "CrawlPageAllowanceError";
  }
}

export class CrawlLockedError extends Error {
  readonly statusCode = 403;
  constructor(readonly plan: string) {
    super("Site Crawler is not included in your plan.");
    this.name = "CrawlLockedError";
  }
}

/** A CrawlConfig that cannot be honoured (Phase 4a): bad pattern, reserved header, verified-only option. */
export class InvalidCrawlConfigError extends Error {
  readonly statusCode = 400;
  constructor(readonly problems: ConfigProblem[]) {
    super("Some crawl settings cannot be used.");
    this.name = "InvalidCrawlConfigError";
  }
}

/** List mode (Phase 4a): no usable URL, or more than the plan's URLs per crawl. */
export class InvalidCrawlListError extends Error {
  readonly statusCode = 400;
  constructor(
    readonly reason: "empty" | "too_long",
    readonly cap: number,
  ) {
    super(reason === "empty" ? "The list has no public http(s) URL." : `The list is longer than your plan's ${cap} URLs per crawl.`);
    this.name = "InvalidCrawlListError";
  }
}
