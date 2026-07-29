// src/lib/site-audit/http.ts
//
// One error mapper for every Site Audit route handler, so an unauthenticated
// request gets a 401 rather than falling through to an opaque 500 — the shape
// the other tools' http.ts modules establish.

import { NextResponse } from "next/server";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { seoErrorResponse } from "@/lib/dataforseo/metering";
import { InvalidDomainError } from "@/lib/site-explorer/domain";
import {
  SiteAuditQuotaExceededError,
  SiteAuditQuotaUnavailableError,
} from "./quota";

export function siteAuditRouteError(err: unknown): NextResponse {
  // PaidPlanRequiredError -> 403, plan errors -> their own statuses.
  const enforcement = enforcementErrorResponse(err);
  if (enforcement) return enforcement;

  if (err instanceof InvalidDomainError) {
    return NextResponse.json({ error: err.message, code: "INVALID_REQUEST" }, { status: 400 });
  }

  if (err instanceof SiteAuditQuotaExceededError) {
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

  if (err instanceof SiteAuditQuotaUnavailableError) {
    return NextResponse.json(
      { error: err.message, code: "QUOTA_UNAVAILABLE" },
      { status: 503 },
    );
  }

  // requireTenant()'s sentinel — session missing or no membership.
  if (err instanceof Error && err.message.includes("Not authenticated")) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { status, body } = seoErrorResponse(err);
  return NextResponse.json(body, { status });
}
