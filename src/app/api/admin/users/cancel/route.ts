// POST /api/admin/users/cancel — staff only (PLATFORM_ADMIN_EMAILS; anyone
// else gets a 404, from the proxy and from here). Body: { tenantId, when }
// with when "period_end" (default in the UI) or "now". No refunds either way.
//
// The work is adminCancelTenant (src/lib/admin/users.ts), which reuses
// cancelTenantSubscription for a Stripe subscription and sets CANCELED by
// hand for a tenant without one. Always audited (admin.tenant.cancel).
//
// 200 { ok, path, changed, tenant } · 400 bad body · 403 wrong origin
// 404 not staff, or no such tenant · 409 nothing to cancel / already ended /
// subscription mismatch · 502 Stripe unreachable. Errors carry { error }.

import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformAdminApi } from "@/lib/platform-admin";
import { csrfProtection } from "@/lib/csrf-protection";
import { adminCancelTenant, parseCancelWhen } from "@/lib/admin/users";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const admin = await requirePlatformAdminApi();
  if (admin instanceof NextResponse) return admin;
  const csrf = csrfProtection(request);
  if (csrf) return csrf;

  const body = (await request.json().catch(() => null)) as { tenantId?: unknown; when?: unknown } | null;
  const tenantId = typeof body?.tenantId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(body.tenantId) ? body.tenantId : null;
  const when = parseCancelWhen(body?.when);
  if (!tenantId || !when) {
    return NextResponse.json({ error: "Send { tenantId, when: \"period_end\" | \"now\" }.", reason: "bad_request" }, { status: 400 });
  }

  const ipAddress = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const result = await adminCancelTenant(tenantId, when, { email: admin.email, userId: admin.userId, ipAddress });
  if (result.ok) return NextResponse.json(result, { status: 200 });
  const { status, ...rest } = result;
  return NextResponse.json(rest, { status });
}
