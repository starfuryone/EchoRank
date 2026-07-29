// src/lib/ai-lens/http.ts
//
// One error mapper for all three AI Lens route handlers, so an unauthenticated
// request gets a 401 rather than falling through to an opaque 500 — the same
// shape src/lib/site-explorer/http.ts uses.

import { NextResponse } from "next/server";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { ForeignDomainError, InvalidUrlError } from "./url";
import { AiLensQuotaExceededError, AiLensQuotaUnavailableError } from "./quota";
import { AiLensFailedError } from "./service";

export function aiLensRouteError(err: unknown): NextResponse {
  // PaidPlanRequiredError -> 403, plan errors -> their own statuses.
  const enforcement = enforcementErrorResponse(err);
  if (enforcement) return enforcement;

  if (err instanceof InvalidUrlError) {
    return NextResponse.json(
      { error: err.message, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  if (err instanceof ForeignDomainError) {
    return NextResponse.json(
      {
        error: err.message,
        code: "FOREIGN_DOMAIN",
        plan: err.plan,
        knownDomains: err.knownDomains,
        upgradeHref: "/billing",
      },
      { status: 403 },
    );
  }

  if (err instanceof AiLensQuotaExceededError) {
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

  if (err instanceof AiLensQuotaUnavailableError) {
    return NextResponse.json(
      { error: err.message, code: "QUOTA_UNAVAILABLE" },
      { status: 503 },
    );
  }

  if (err instanceof AiLensFailedError) {
    return NextResponse.json(
      {
        error: err.message,
        code: err.statusCode === 429 ? "RENDER_BUSY" : "ANALYSIS_FAILED",
      },
      { status: err.statusCode },
    );
  }

  // requireTenant()'s sentinel — session missing or no membership.
  if (err instanceof Error && err.message.includes("Not authenticated")) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  console.error("[ai-lens]", err);
  return NextResponse.json(
    { error: "Something went wrong analyzing that page.", code: "INTERNAL" },
    { status: 500 },
  );
}
