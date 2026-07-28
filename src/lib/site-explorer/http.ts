// src/lib/site-explorer/http.ts
//
// One error mapper for all three Site Explorer route handlers, so an
// unauthenticated request gets a 401 rather than falling through to an opaque
// 500 — the same shape src/lib/serp/http.ts and the /api/imports routes use.

import { NextResponse } from "next/server";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { seoErrorResponse } from "@/lib/dataforseo/metering";
import { InvalidDomainError } from "./domain";
import {
  SiteExplorerQuotaExceededError,
  SiteExplorerQuotaUnavailableError,
} from "./quota";
import { SiteExplorerFailedError } from "./service";

export function siteExplorerRouteError(err: unknown): NextResponse {
  // PaidPlanRequiredError -> 403, plan errors -> their own statuses.
  const enforcement = enforcementErrorResponse(err);
  if (enforcement) return enforcement;

  if (err instanceof InvalidDomainError) {
    return NextResponse.json(
      { error: err.message, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  if (err instanceof SiteExplorerQuotaExceededError) {
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

  if (err instanceof SiteExplorerQuotaUnavailableError) {
    return NextResponse.json(
      { error: err.message, code: "QUOTA_UNAVAILABLE" },
      { status: 503 },
    );
  }

  if (err instanceof SiteExplorerFailedError) {
    return NextResponse.json(
      { error: err.message, code: "TASK_FAILED" },
      { status: 502 },
    );
  }

  // requireTenant()'s sentinel — session missing or no membership.
  if (err instanceof Error && err.message.includes("Not authenticated")) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  // DataforseoError and anything else.
  const { status, body } = seoErrorResponse(err);
  return NextResponse.json(body, { status });
}
