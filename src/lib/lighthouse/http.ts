// src/lib/lighthouse/http.ts
//
// One error mapper for every Lighthouse route handler, so an unauthenticated
// request gets a 401 rather than falling through to an opaque 500 — the shape
// serp/, site-explorer/, rank-tracker/ and backlinks/http.ts establish.

import { NextResponse } from "next/server";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { PagespeedError } from "@/lib/pagespeed/client";
import { InvalidAuditUrlError } from "./url";
import { LighthouseRateLimitedError } from "./service";

export function lighthouseRouteError(err: unknown): NextResponse {
  // PaidPlanRequiredError -> 403, plan errors -> their own statuses.
  const enforcement = enforcementErrorResponse(err);
  if (enforcement) return enforcement;

  if (err instanceof InvalidAuditUrlError) {
    return NextResponse.json(
      { error: err.message, code: "INVALID_REQUEST", reason: err.reason },
      { status: 400 },
    );
  }

  if (err instanceof LighthouseRateLimitedError) {
    return NextResponse.json(
      { error: err.message, code: "RATE_LIMITED", limit: err.limit },
      { status: 429 },
    );
  }

  if (err instanceof PagespeedError) {
    switch (err.code) {
      case "UNREACHABLE":
        // PSI could not load the page. This is the user's URL being wrong or
        // the site blocking Google, not our failure — 400, not 502.
        return NextResponse.json(
          {
            error: "Could not load that page. Check the URL is public and try again.",
            code: "UNREACHABLE",
          },
          { status: 400 },
        );
      case "RATE_LIMITED":
        // Google's own quota, not our per-tenant limiter — distinct message so
        // support can tell the two 429s apart.
        return NextResponse.json(
          {
            error: "The speed-test service is busy right now. Try again in a few minutes.",
            code: "UPSTREAM_RATE_LIMITED",
          },
          { status: 429 },
        );
      case "TIMEOUT":
        return NextResponse.json(
          {
            error: "The audit took too long to finish. Try again, or test a lighter page.",
            code: "TIMEOUT",
          },
          { status: 504 },
        );
      case "UPSTREAM_UNAVAILABLE":
        return NextResponse.json(
          { error: "The speed-test service is unavailable. Try again shortly.", code: "UPSTREAM_UNAVAILABLE" },
          { status: 502 },
        );
      default:
        return NextResponse.json(
          { error: "Could not complete the audit.", code: "INTERNAL" },
          { status: 500 },
        );
    }
  }

  // requireTenant()'s sentinel — session missing or no membership.
  if (err instanceof Error && err.message.includes("Not authenticated")) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  return NextResponse.json({ error: "Internal error", code: "INTERNAL" }, { status: 500 });
}
