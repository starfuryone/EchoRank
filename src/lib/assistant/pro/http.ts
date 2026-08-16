// src/lib/assistant/pro/http.ts
//
// One error mapper for every Pro assistant route, the same shape
// src/lib/ai-lens/http.ts uses.
//
// WHY A MAPPER AT ALL: without one, `requirePaidPlan()` throwing on an
// unauthenticated request falls through to an opaque 500, and the client
// cannot tell "sign in again" from "we broke". Each error class below carries
// its own status and its own visitor-safe sentence.

import { NextResponse } from "next/server";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { AssistantKeyMissingError, AssistantUpstreamError } from "../model";
import { AssistantBudgetExceededError, AssistantBudgetUnavailableError } from "./quota";

/** Every response from these routes is uncacheable — answers are per-tenant. */
export function assistantJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function assistantError(
  message: string,
  code: string,
  status: number,
  extra: Record<string, unknown> = {},
): NextResponse {
  return assistantJson({ error: message, code, ...extra }, status);
}

export function proRouteError(err: unknown): NextResponse {
  // PaidPlanRequiredError -> 403, plan/quota errors -> their own statuses.
  const enforcement = enforcementErrorResponse(err);
  if (enforcement) return enforcement;

  if (err instanceof AssistantBudgetExceededError) {
    return assistantError(err.message, "BUDGET_REACHED", err.statusCode, {
      limit: err.limit,
      upgradeHref: "/billing",
    });
  }
  if (err instanceof AssistantBudgetUnavailableError) {
    return assistantError(err.message, "BUDGET_UNAVAILABLE", err.statusCode);
  }
  if (err instanceof AssistantKeyMissingError) {
    return assistantError(
      "The assistant is offline for maintenance. Try again shortly.",
      "ASSISTANT_DISABLED",
      503,
    );
  }
  if (err instanceof AssistantUpstreamError) {
    return assistantError(err.message, "UPSTREAM_UNAVAILABLE", 502);
  }

  // requireTenant()'s sentinel — session missing or no membership.
  if (err instanceof Error && err.message.includes("Not authenticated")) {
    return assistantError("Unauthorized", "UNAUTHORIZED", 401);
  }

  // Never logged with the request body: it carries the customer's question and
  // whatever their own data said back.
  console.error("[assistant-pro]", err);
  return assistantError(
    "The assistant is briefly unavailable. Try again in a few minutes.",
    "UNAVAILABLE",
    503,
  );
}
