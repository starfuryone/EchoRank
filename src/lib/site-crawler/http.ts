// src/lib/site-crawler/http.ts
//
// One error mapper for every Site Crawler route, mirroring site-audit/http.ts:
// an unauthenticated request gets 401 rather than an opaque 500, and a locked
// tier gets a 403 that names the plan rather than a generic refusal.

import { NextResponse } from "next/server";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { archivedBody, crawlDataState, type DataStateRow } from "./data-state";

export {
  CrawlLockedError,
  CrawlPageAllowanceError,
  CrawlQuotaExceededError,
  InvalidCrawlConfigError,
  InvalidCrawlListError,
  InvalidCrawlUrlError,
} from "./errors";
import {
  CrawlLockedError,
  CrawlPageAllowanceError,
  CrawlQuotaExceededError,
  InvalidCrawlConfigError,
  InvalidCrawlListError,
  InvalidCrawlUrlError,
} from "./errors";

/** 409 ARCHIVED: the crawl's rows are in the archive (data-state.ts). */
export function archivedResponse(row: DataStateRow): NextResponse {
  return NextResponse.json(archivedBody(row), { status: 409 });
}

/**
 * The shared guard for a route about to read a crawl's child rows: a 409
 * ARCHIVED response when they are in the archive, null otherwise. A PURGED
 * crawl gets null too — each route keeps its own answer for that, unchanged.
 */
export function archivedGuard(row: DataStateRow): NextResponse | null {
  return crawlDataState(row) === "archived" ? archivedResponse(row) : null;
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

  // segment-filter.ts: ?segment=N the crawl does not have. Matched by name, as below.
  if (err instanceof Error && err.name === "InvalidSegmentError") {
    return NextResponse.json({ error: err.message, code: "INVALID_REQUEST" }, { status: 400 });
  }

  // schedule-service.ts (Phase 4c): plan cap or cadence; matched by name, same reason.
  if (err instanceof Error && err.name === "ScheduleRefusedError") {
    return NextResponse.json({ error: err.message, code: "SCHEDULE_REFUSED", reason: (err as Error & { reason: string }).reason }, { status: 400 });
  }

  // compare.ts (Phase 4c), matched by name for the same reason.
  if (err instanceof Error && err.name === "CompareError") {
    const e = err as Error & { code: string; status: number };
    return NextResponse.json({ error: "These crawls cannot be compared that way.", code: "COMPARE_ERROR", reason: e.code }, { status: e.status });
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

  if (err instanceof CrawlPageAllowanceError) {
    return NextResponse.json(
      {
        error: err.message,
        code: "PAGE_ALLOWANCE_EXCEEDED",
        limit: err.limit,
        used: err.used,
        resetsAt: err.resetsAt,
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
