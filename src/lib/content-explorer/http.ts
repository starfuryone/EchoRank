// src/lib/content-explorer/http.ts
//
// One error mapper for every Content Explorer route handler, so an
// unauthenticated request gets a 401 rather than falling through to an opaque
// 500 — the shape backlinks/http.ts and site-explorer/http.ts establish.

import { NextResponse } from "next/server";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { seoErrorResponse } from "@/lib/dataforseo/metering";
import {
  ContentPlanLockedError,
  ContentQuotaExceededError,
  ContentQuotaUnavailableError,
} from "./quota";
import { ContentSearchFailedError } from "./service";

export function contentRouteError(err: unknown): NextResponse {
  // PaidPlanRequiredError -> 403, plan errors -> their own statuses.
  const enforcement = enforcementErrorResponse(err);
  if (enforcement) return enforcement;

  if (err instanceof ContentPlanLockedError) {
    return NextResponse.json(
      { error: err.message, code: "PLAN_LOCKED", plan: err.plan, upgradeHref: "/billing" },
      { status: 403 },
    );
  }

  if (err instanceof ContentQuotaExceededError) {
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

  if (err instanceof ContentQuotaUnavailableError) {
    return NextResponse.json(
      { error: err.message, code: "QUOTA_UNAVAILABLE" },
      { status: 503 },
    );
  }

  if (err instanceof ContentSearchFailedError) {
    return NextResponse.json({ error: err.message, code: "TASK_FAILED" }, { status: 502 });
  }

  // requireTenant()'s sentinel — session missing or no membership.
  if (err instanceof Error && err.message.includes("Not authenticated")) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { status, body } = seoErrorResponse(err);
  return NextResponse.json(body, { status });
}
