// src/lib/site-crawler/http.ts
//
// One error mapper for every Site Crawler route, mirroring site-audit/http.ts:
// an unauthenticated request gets 401 rather than an opaque 500, and a locked
// tier gets a 403 that names the plan rather than a generic refusal.

import { NextResponse } from "next/server";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
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

export function crawlRouteError(err: unknown): NextResponse {
  const enforcement = enforcementErrorResponse(err);
  if (enforcement) return enforcement;

  if (err instanceof InvalidCrawlListError) {
    return NextResponse.json(
      { error: err.message, code: "INVALID_LIST", reason: err.reason, cap: err.cap },
      { status: 400 },
    );
  }

  if (err instanceof InvalidCrawlConfigError) {
    return NextResponse.json(
      { error: err.message, code: "INVALID_CONFIG", problems: err.problems },
      { status: 400 },
    );
  }

  // crawl-config-secrets.ts: { keep: true } with no saved value. Matched by
  // name so this module stays importable without the server-only crypto.
  if (err instanceof Error && err.name === "MissingKeptSecretError") {
    return NextResponse.json({ error: err.message, code: "INVALID_CONFIG" }, { status: 400 });
  }

  if (err instanceof InvalidCrawlUrlError) {
    return NextResponse.json(
      { error: err.message, code: "INVALID_REQUEST", reason: err.reason },
      { status: 400 },
    );
  }

  if (err instanceof CrawlLockedError) {
    return NextResponse.json(
      { error: err.message, code: "PLAN_LOCKED", plan: err.plan, upgradeHref: "/billing" },
      { status: 403 },
    );
  }

  if (err instanceof CrawlQuotaExceededError) {
    return NextResponse.json(
      {
        error: err.message,
        code: "QUOTA_EXCEEDED",
        limit: err.limit,
        plan: err.plan,
        upgradeHref: "/billing",
      },
      { status: 429 },
    );
  }

  // requireTenant()'s sentinel — session missing or no membership.
  if (err instanceof Error && err.message.includes("Not authenticated")) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  return NextResponse.json(
    { error: "Something went wrong", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}
