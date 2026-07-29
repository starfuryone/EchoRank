// src/lib/ga/http.ts
//
// One error mapper for every Web Analytics route handler, so an
// unauthenticated request gets a 401 rather than an opaque 500 — the shape the
// other tools' http.ts modules establish.
//
// The three GA-specific failures each get their own code because each has a
// DIFFERENT fix: reconnect (user), wait (transient), or change the Cloud
// Console (operator). Collapsing them into one "error" message would send
// everyone down the wrong path.

import { NextResponse } from "next/server";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { GaQuotaError, GaReauthError, GaScopeError } from "./client";
import { GaNoPropertyError } from "./service";

export function gaRouteError(err: unknown): NextResponse {
  const enforcement = enforcementErrorResponse(err);
  if (enforcement) return enforcement;

  if (err instanceof GaReauthError) {
    // The UI swaps in the reconnect card, matching GSC's NEEDS_REAUTH flow.
    return NextResponse.json(
      { error: err.message, code: "NEEDS_REAUTH" },
      { status: 409 },
    );
  }

  if (err instanceof GaQuotaError) {
    return NextResponse.json(
      { error: err.message, code: "QUOTA_EXCEEDED" },
      { status: 429 },
    );
  }

  if (err instanceof GaScopeError) {
    // Operator-fixable: the consent screen is missing analytics.readonly.
    return NextResponse.json(
      { error: err.message, code: "MISSING_SCOPE" },
      { status: 403 },
    );
  }

  if (err instanceof GaNoPropertyError) {
    return NextResponse.json({ error: err.message, code: "NO_PROPERTY" }, { status: 400 });
  }

  if (err instanceof Error && err.message === "Not authenticated or no tenant access") {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  console.error("[web-analytics]", err instanceof Error ? err.message : err);
  return NextResponse.json({ error: "Internal error", code: "INTERNAL" }, { status: 500 });
}
