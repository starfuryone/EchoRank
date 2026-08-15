// src/app/api/agency/funnels/route.ts
//
// List and create white-label audit funnels.
//
// ── The gate ────────────────────────────────────────────────────────────────
// requireFeature("whitelabel"), which is the AGENCY+ line in PLAN_FEATURES.
// NOT requirePlan("AGENCY"): plan-enforcement.ts:16 says surfaces are gated
// per-feature, never by tier. `whitelabel` is also the honest key here rather
// than a convenient one — the entire artifact is a widget wearing somebody
// else's brand, so a tenant who cannot white-label has nothing to run.
//
// ── No quota is reserved by anything in this file ──────────────────────────
// Creating a funnel costs nothing; RUNNING one costs a sidecar call, and that
// is where the monthly counter is spent (src/app/api/public/funnel/audit).
// Metering configuration rather than usage would let an agency exhaust its
// month by editing a colour.

import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { createFunnel, listFunnels } from "@/lib/funnel/store";
import { sanitizeBrandingInput } from "@/lib/funnel/branding";
import { validateOriginList, MAX_ORIGINS } from "@/lib/funnel/origins";
import { funnelAuditLimit, funnelAuditsUsed } from "@/lib/funnel/quota";
import { normalizeLeadEmail } from "@/lib/funnel/audit";
import { logger } from "@/infrastructure/observability/logger";

/**
 * The funnel list, plus what the page needs to render itself.
 *
 * The quota figures come back on the GET rather than being computed in the
 * client: a hardcoded plan number in copy is exactly what CLAUDE.md forbids, so
 * the page prints "{used} of {limit}" from this response and FUNNEL_AUDIT_LIMITS
 * stays the only place those numbers exist.
 */
export async function GET() {
  try {
    const membership = await requireTenant();
    await requireFeature("whitelabel");

    const [funnels, used] = await Promise.all([
      listFunnels(membership.tenantId),
      funnelAuditsUsed(membership.tenantId),
    ]);

    return NextResponse.json({
      funnels,
      quota: { used, limit: funnelAuditLimit(membership.tenant.planType) },
      maxOrigins: MAX_ORIGINS,
    });
  } catch (error) {
    const gated = enforcementErrorResponse(error);
    if (gated) return gated;
    logger.error({ err: error }, "[agency/funnels GET]");
    return NextResponse.json({ error: "Could not load your funnels." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await requireTenant();
    await requireFeature("whitelabel");

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const input = body as Record<string, unknown>;

    // Rejections are RETURNED, never silently dropped. An agency that pasted
    // eight origins and got six saved has to be told which two did not stick
    // and why — see the note in origins.ts.
    const rawOrigins = Array.isArray(input.allowedOrigins)
      ? (input.allowedOrigins as unknown[]).filter((v): v is string => typeof v === "string")
      : [];
    const { origins, rejected } = validateOriginList(rawOrigins);

    // notifyEmail is the AGENCY's inbox, so it is validated with the same
    // syntax check as a lead's address. Empty clears it.
    const notifyEmail =
      typeof input.notifyEmail === "string" && input.notifyEmail.trim()
        ? normalizeLeadEmail(input.notifyEmail)
        : null;
    if (typeof input.notifyEmail === "string" && input.notifyEmail.trim() && !notifyEmail) {
      return NextResponse.json({ error: "That notification email is not valid." }, { status: 400 });
    }

    const funnel = await createFunnel({
      tenantId: membership.tenantId,
      label: typeof input.label === "string" ? input.label : "",
      allowedOrigins: origins,
      branding: sanitizeBrandingInput(input.branding),
      notifyEmail,
    });

    logger.info(
      { tenantId: membership.tenantId, funnelId: funnel.id, origins: origins.length },
      "audit funnel created",
    );

    return NextResponse.json({ funnel, rejected }, { status: 201 });
  } catch (error) {
    const gated = enforcementErrorResponse(error);
    if (gated) return gated;
    logger.error({ err: error }, "[agency/funnels POST]");
    return NextResponse.json({ error: "Could not create that funnel." }, { status: 500 });
  }
}
