// src/lib/billing/action-route.ts — the shared shell of POST /api/billing/cancel
// and POST /api/billing/resume: CSRF, session, actor, JSON out.
//
// CSRF IS CHECKED HERE AS WELL AS IN THE PROXY. src/proxy.ts already rejects a
// cross-origin POST to /api/*, but these two routes change what a customer is
// charged, so they do not rely on a single layer (same as the report routes
// that call csrfProtection themselves).

//
// THE TENANT IS THE SESSION'S. The handler gets the membership's tenantId and
// role; nothing in the body names a tenant, and a tenantId sent anyway is
// never read.
//
// RATE LIMITED per tenant and user in Redis (src/lib/rate-limit.ts): each call
// is a Stripe read and maybe a write, so a stuck button or a script cannot
// hammer the payment provider. 429 with the same { error } shape.

import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@/generated/prisma";
import { csrfProtection } from "@/lib/csrf-protection";
import { getCurrentTenant } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";
import type { BillingActionResult } from "./cancellation";

/** Who asks, from the session: a member of exactly one tenant. */
export interface BillingActor {
  tenantId: string;
  userId: string;
  role: Role;
  ipAddress: string | null;
}

/** Cancel + resume calls per tenant member per window. */
export const BILLING_ACTION_LIMIT = 10;
export const BILLING_ACTION_WINDOW_MS = 10 * 60_000;

function clientIp(request: NextRequest): string | null {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

export async function billingActionRoute(
  request: NextRequest,
  run: (actor: BillingActor, body: unknown) => Promise<BillingActionResult>,
): Promise<NextResponse> {
  const csrf = csrfProtection(request);
  if (csrf) return csrf;

  let membership: Awaited<ReturnType<typeof getCurrentTenant>> = null;
  try {
    membership = await getCurrentTenant();
  } catch {
    membership = null;
  }
  if (!membership) {
    return NextResponse.json({ error: "Sign in required.", reason: "unauthenticated" }, { status: 401 });
  }

  const limited = await rateLimit(
    `billing-action:${membership.tenantId}:${membership.userId}`,
    BILLING_ACTION_LIMIT,
    BILLING_ACTION_WINDOW_MS,
  );
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again.", reason: "rate_limited" },
      { status: 429 },
    );
  }

  // An empty body is a valid request: the reason is optional.
  let body: unknown = {};
  try {
    const raw = await request.text();
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }

  const result = await run(
    {
      tenantId: membership.tenantId,
      userId: membership.userId,
      role: membership.role,
      ipAddress: clientIp(request),
    },
    body,
  );
  if (result.ok) {
    return NextResponse.json({ ok: true, changed: result.changed, state: result.state }, { status: 200 });
  }
  const { status, ...rest } = result;
  return NextResponse.json(rest, { status });
}
