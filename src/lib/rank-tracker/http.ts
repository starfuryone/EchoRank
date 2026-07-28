// src/lib/rank-tracker/http.ts
//
// One error mapper for every Rank Tracker route handler, so an unauthenticated
// request gets a 401 rather than falling through to an opaque 500 — the shape
// serp/http.ts and site-explorer/http.ts already establish.

import { NextResponse } from "next/server";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { seoErrorResponse } from "@/lib/dataforseo/metering";
import { InvalidDomainError } from "@/lib/site-explorer/domain";
import {
  RankCheckQuotaExceededError,
  RankKeywordCapExceededError,
  RankQuotaUnavailableError,
} from "./quota";
import {
  RankFrequencyNotAllowedError,
  RankPlanLockedError,
  RankProjectNotFoundError,
} from "./service";

export function rankTrackerRouteError(err: unknown): NextResponse {
  // PaidPlanRequiredError -> 403, plan errors -> their own statuses.
  const enforcement = enforcementErrorResponse(err);
  if (enforcement) return enforcement;

  if (err instanceof InvalidDomainError) {
    return NextResponse.json({ error: err.message, code: "INVALID_REQUEST" }, { status: 400 });
  }

  if (err instanceof RankProjectNotFoundError) {
    return NextResponse.json({ error: err.message, code: "NOT_FOUND" }, { status: 404 });
  }

  // The tool is not in this plan at all — the UI shows the locked card.
  if (err instanceof RankPlanLockedError) {
    return NextResponse.json(
      { error: err.message, code: "PLAN_LOCKED", plan: err.plan, upgradeHref: "/billing" },
      { status: 403 },
    );
  }

  if (err instanceof RankFrequencyNotAllowedError) {
    return NextResponse.json(
      {
        error: err.message,
        code: "FREQUENCY_NOT_ALLOWED",
        frequency: err.frequency,
        plan: err.plan,
        upgradeHref: "/billing",
      },
      { status: 403 },
    );
  }

  if (err instanceof RankKeywordCapExceededError) {
    return NextResponse.json(
      {
        error: err.message,
        code: "KEYWORD_CAP_EXCEEDED",
        limit: err.limit,
        requested: err.requested,
        plan: err.plan,
        upgradeHref: "/billing",
      },
      { status: 429 },
    );
  }

  if (err instanceof RankCheckQuotaExceededError) {
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

  if (err instanceof RankQuotaUnavailableError) {
    return NextResponse.json({ error: err.message, code: "QUOTA_UNAVAILABLE" }, { status: 503 });
  }

  // requireTenant()'s sentinel — session missing or no membership.
  if (err instanceof Error && err.message.includes("Not authenticated")) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { status, body } = seoErrorResponse(err);
  return NextResponse.json(body, { status });
}
