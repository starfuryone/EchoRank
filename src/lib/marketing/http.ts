// src/lib/marketing/http.ts
//
// One error mapper for every Marketing Studio route, the shape
// content-explorer/http.ts establishes — so an unauthenticated request gets a
// 401 rather than falling through to an opaque 500.

import { NextResponse } from "next/server";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { MarketingValidationError } from "./prompt";
import { MarketingKeyMissingError, MarketingUpstreamError } from "./client";
import {
  MarketingBudgetExceededError,
  MarketingBudgetUnavailableError,
  MarketingPlanLockedError,
} from "./quota";

export function marketingRouteError(err: unknown): NextResponse {
  // PaidPlanRequiredError -> 403, plan errors -> their own statuses.
  const enforcement = enforcementErrorResponse(err);
  if (enforcement) return enforcement;

  if (err instanceof MarketingValidationError) {
    return NextResponse.json({ error: err.message, code: "INVALID_REQUEST" }, { status: 400 });
  }

  if (err instanceof MarketingPlanLockedError) {
    return NextResponse.json(
      { error: err.message, code: "PLAN_LOCKED", plan: err.plan, upgradeHref: "/billing" },
      { status: 403 },
    );
  }

  if (err instanceof MarketingBudgetExceededError) {
    return NextResponse.json(
      {
        error: err.message,
        code: "BUDGET_EXCEEDED",
        limit: err.limit,
        plan: err.plan,
        upgradeHref: "/billing",
      },
      { status: 429 },
    );
  }

  if (err instanceof MarketingBudgetUnavailableError) {
    return NextResponse.json({ error: err.message, code: "BUDGET_UNAVAILABLE" }, { status: 503 });
  }

  if (err instanceof MarketingKeyMissingError) {
    return NextResponse.json({ error: err.message, code: "NOT_CONFIGURED" }, { status: 503 });
  }

  if (err instanceof MarketingUpstreamError) {
    return NextResponse.json({ error: err.message, code: "UPSTREAM_FAILED" }, { status: 502 });
  }

  // requireTenant()'s sentinel — session missing or no membership.
  if (err instanceof Error && err.message.includes("Not authenticated")) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  // Nothing recognised. Log the class, never the prompt or the values.
  console.error("[marketing] unhandled error:", err instanceof Error ? err.name : typeof err);
  return NextResponse.json(
    { error: "Something went wrong generating that.", code: "INTERNAL" },
    { status: 500 },
  );
}
