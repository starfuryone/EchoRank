// src/lib/rank-tracker/http.ts
//
// One error mapper for every Rank Tracker route handler, so an unauthenticated
// request gets a 401 rather than falling through to an opaque 500 — the shape
// serp/http.ts and site-explorer/http.ts already establish.

import { NextResponse } from "next/server";
import { SeoQuotaExceededError, TrackedKeywordLimitError, monthReset } from "@/lib/seo-quota";
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

  // Pooled monthly search quota / tracked-keyword cap. Typed body so the UI can
  // render the banner (limit, used, resetsAt) without parsing a message string.
  if (err instanceof SeoQuotaExceededError || err instanceof TrackedKeywordLimitError) {
    return NextResponse.json(err.toBody(), { status: err.statusCode });
  }

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
    // Same typed shape as the pooled search quota so one UI banner renders both:
    // `error: "quota_exceeded"`, limit, used, resetsAt, upgradeUrl. The older
    // keys are kept alongside because existing clients read `code` and
    // `upgradeHref`, and removing them would be a silent breaking change.
    //
    // resetsAt is the month boundary for shape consistency only — this cap is on
    // CURRENT STATE, so deleting keywords frees room immediately rather than
    // waiting for the reset.
    return NextResponse.json(
      {
        error: "quota_exceeded",
        limit: err.limit,
        used: err.requested,
        resetsAt: monthReset().toISOString(),
        upgradeUrl: "/billing",
        message: err.message,
        code: "KEYWORD_CAP_EXCEEDED",
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
