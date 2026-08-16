// src/lib/action-agent/http.ts
//
// One error mapper for both Action Agent routes, the shape
// src/lib/marketing/http.ts establishes.
//
// IT DELEGATES RATHER THAN DUPLICATES. Every plan, key, upstream and auth case
// is already mapped for Marketing Studio and this feature spends Marketing
// Studio's budget, so re-deciding those status codes here would guarantee the
// two drift. Only the cases this feature has that Marketing Studio does not are
// handled before the delegation: the budget refusal that carries a reset date,
// and a page that could not be read.

import { NextResponse } from "next/server";
import { marketingRouteError } from "@/lib/marketing/http";
import { ActionAgentBudgetError } from "./generate";
import { PageUnreachableError } from "./context";

export function actionAgentRouteError(err: unknown): NextResponse {
  if (err instanceof ActionAgentBudgetError) {
    return NextResponse.json(
      {
        error: err.message,
        code: "BUDGET_EXCEEDED",
        limit: err.limit,
        plan: err.plan,
        // The one thing Marketing Studio's own 429 does not carry. The Action
        // Agent is reached from surfaces where the usage meter is nowhere in
        // sight, so the refusal has to say when it lifts.
        resetsAt: err.resetsAt.toISOString(),
        upgradeHref: "/billing",
      },
      { status: 429 },
    );
  }

  if (err instanceof PageUnreachableError) {
    // 422, not 502: the request was well-formed and we reached the network.
    // Somebody else's page will not be read, and no retry changes that — the
    // same distinction Historical's CaptureBlockedError draws.
    return NextResponse.json({ error: err.message, code: "PAGE_UNREACHABLE" }, { status: 422 });
  }

  return marketingRouteError(err);
}
