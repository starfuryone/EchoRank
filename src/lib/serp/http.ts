// src/lib/serp/http.ts
//
// One error mapper for both SERP Checker route handlers, so an unauthenticated
// request gets a 401 rather than falling through to an opaque 500 (the shape
// src/lib/api-handler.ts and the /api/imports routes already establish).

import { NextResponse } from "next/server";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { seoErrorResponse } from "@/lib/dataforseo/metering";
import { SerpQuotaUnavailableError } from "./quota";
import { SerpQuotaExceededError } from "./service";

export function serpRouteError(err: unknown): NextResponse {
  // PaidPlanRequiredError -> 403, quota/plan errors -> their own statuses.
  const enforcement = enforcementErrorResponse(err);
  if (enforcement) return enforcement;

  if (err instanceof SerpQuotaExceededError) {
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

  if (err instanceof SerpQuotaUnavailableError) {
    return NextResponse.json(
      { error: err.message, code: "QUOTA_UNAVAILABLE" },
      { status: 503 },
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
