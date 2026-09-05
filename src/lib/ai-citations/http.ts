// src/lib/ai-citations/http.ts
//
// One error mapper for the AI Citations route handlers, so every typed failure
// reaches the client as a status and a code it can branch on rather than an
// opaque 500. Same shape as serp/http.ts, backlinks/http.ts and
// site-explorer/http.ts.

import { NextResponse } from "next/server";
import { SeoQuotaExceededError } from "@/lib/seo-quota";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { seoErrorResponse } from "@/lib/dataforseo/metering";
import { InvalidCitationTargetError } from "./target";
import {
  AiCitationsFailedError,
  AiCitationsNotEnabledError,
  AiCitationsPlanLockedError,
} from "./service";

export function aiCitationsRouteError(err: unknown): NextResponse {
  const enforcement = enforcementErrorResponse(err);
  if (enforcement) return enforcement;

  // The pooled monthly search quota. Typed body so the banner can render the
  // limit, the usage and the reset date without parsing a message string.
  if (err instanceof SeoQuotaExceededError) {
    return NextResponse.json(err.toBody(), { status: err.statusCode });
  }

  // NOT_ENABLED is 503 rather than 404 on purpose: the feature exists and the
  // route is real; what is missing is a product on the connected data account.
  // A 404 would send someone looking for a broken link.
  if (
    err instanceof AiCitationsNotEnabledError ||
    err instanceof AiCitationsPlanLockedError ||
    err instanceof AiCitationsFailedError
  ) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.statusCode },
    );
  }

  if (err instanceof InvalidCitationTargetError) {
    return NextResponse.json(
      { error: err.message, code: "INVALID_REQUEST" },
      { status: err.statusCode },
    );
  }

  // requireTenant()'s sentinel — session missing or no membership.
  if (err instanceof Error && err.message.includes("Not authenticated")) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { status, body } = seoErrorResponse(err);
  return NextResponse.json(body, { status });
}
