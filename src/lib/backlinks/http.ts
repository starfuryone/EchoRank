// src/lib/backlinks/http.ts
//
// One error mapper for every Backlinks route handler, so an unauthenticated
// request gets a 401 rather than falling through to an opaque 500 — the shape
// serp/http.ts, site-explorer/http.ts and rank-tracker/http.ts establish.

import { NextResponse } from "next/server";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { seoErrorResponse } from "@/lib/dataforseo/metering";
import { InvalidTargetError } from "./target";
import {
  BacklinksPlanLockedError,
  BacklinksQuotaExceededError,
  BacklinksQuotaUnavailableError,
} from "./quota";
import { BacklinksFailedError } from "./service";

export function backlinksRouteError(err: unknown): NextResponse {
  // PaidPlanRequiredError -> 403, plan errors -> their own statuses.
  const enforcement = enforcementErrorResponse(err);
  if (enforcement) return enforcement;

  if (err instanceof InvalidTargetError) {
    return NextResponse.json(
      { error: err.message, code: "INVALID_REQUEST", mode: err.mode },
      { status: 400 },
    );
  }

  // The tool is not in this plan at all — the UI shows the locked card.
  if (err instanceof BacklinksPlanLockedError) {
    return NextResponse.json(
      { error: err.message, code: "PLAN_LOCKED", plan: err.plan, upgradeHref: "/billing" },
      { status: 403 },
    );
  }

  if (err instanceof BacklinksQuotaExceededError) {
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

  if (err instanceof BacklinksQuotaUnavailableError) {
    return NextResponse.json(
      { error: err.message, code: "QUOTA_UNAVAILABLE" },
      { status: 503 },
    );
  }

  if (err instanceof BacklinksFailedError) {
    return NextResponse.json({ error: err.message, code: "TASK_FAILED" }, { status: 502 });
  }

  // requireTenant()'s sentinel — session missing or no membership.
  if (err instanceof Error && err.message.includes("Not authenticated")) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { status, body } = seoErrorResponse(err);
  return NextResponse.json(body, { status });
}
