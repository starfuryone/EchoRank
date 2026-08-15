// src/app/api/agency/funnels/[id]/route.ts
//
// Read, patch and delete one funnel.
//
// TENANT-SCOPED THROUGH THE STORE, never here. getFunnel/updateFunnel/
// deleteFunnel all take (tenantId, id) and resolve with findFirst({ where:
// { id, tenantId } }) — this route never calls prisma.funnelConfig directly,
// because findUnique({ where: { id } }) would hand another agency's embed key
// and lead configuration to anyone who guessed a cuid. See the header on
// src/lib/funnel/store.ts and the rule in CLAUDE.md.

import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { deleteFunnel, getFunnel, updateFunnel } from "@/lib/funnel/store";
import { sanitizeBrandingInput } from "@/lib/funnel/branding";
import { validateOriginList } from "@/lib/funnel/origins";
import { normalizeLeadEmail } from "@/lib/funnel/audit";
import { logger } from "@/infrastructure/observability/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const membership = await requireTenant();
    await requireFeature("whitelabel");

    const { id } = await params;
    const funnel = await getFunnel(membership.tenantId, id);
    // 404 rather than 403 for someone else's funnel. The scoping already makes
    // the two indistinguishable to the query; "forbidden" would confirm the id
    // exists.
    if (!funnel) return NextResponse.json({ error: "Funnel not found." }, { status: 404 });

    return NextResponse.json({ funnel });
  } catch (error) {
    const gated = enforcementErrorResponse(error);
    if (gated) return gated;
    logger.error({ err: error }, "[agency/funnels/:id GET]");
    return NextResponse.json({ error: "Could not load that funnel." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const membership = await requireTenant();
    await requireFeature("whitelabel");

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const input = body as Record<string, unknown>;

    // Every field is optional and only a field that was SENT is written — an
    // absent key must leave the stored value alone rather than clearing it,
    // which is what makes the toggle button able to send {active} and nothing
    // else without wiping the origin list.
    let origins: string[] | undefined;
    let rejected: ReturnType<typeof validateOriginList>["rejected"] = [];
    if (Array.isArray(input.allowedOrigins)) {
      const result = validateOriginList(
        (input.allowedOrigins as unknown[]).filter((v): v is string => typeof v === "string"),
      );
      origins = result.origins;
      rejected = result.rejected;
    }

    let notifyEmail: string | null | undefined;
    if (input.notifyEmail !== undefined) {
      const raw = typeof input.notifyEmail === "string" ? input.notifyEmail.trim() : "";
      if (!raw) {
        notifyEmail = null;
      } else {
        notifyEmail = normalizeLeadEmail(raw);
        if (!notifyEmail) {
          return NextResponse.json(
            { error: "That notification email is not valid." },
            { status: 400 },
          );
        }
      }
    }

    const funnel = await updateFunnel(membership.tenantId, id, {
      ...(typeof input.label === "string" ? { label: input.label } : {}),
      ...(origins !== undefined ? { allowedOrigins: origins } : {}),
      ...(input.branding !== undefined
        ? { branding: sanitizeBrandingInput(input.branding) }
        : {}),
      ...(notifyEmail !== undefined ? { notifyEmail } : {}),
      ...(typeof input.active === "boolean" ? { active: input.active } : {}),
    });
    if (!funnel) return NextResponse.json({ error: "Funnel not found." }, { status: 404 });

    return NextResponse.json({ funnel, rejected });
  } catch (error) {
    const gated = enforcementErrorResponse(error);
    if (gated) return gated;
    logger.error({ err: error }, "[agency/funnels/:id PATCH]");
    return NextResponse.json({ error: "Could not save that funnel." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const membership = await requireTenant();
    await requireFeature("whitelabel");

    const { id } = await params;
    // Cascades to every FunnelLead. That is destructive and irreversible, and
    // the confirmation for it lives in the UI — the API does what it is told.
    const removed = await deleteFunnel(membership.tenantId, id);
    if (!removed) return NextResponse.json({ error: "Funnel not found." }, { status: 404 });

    logger.info({ tenantId: membership.tenantId, funnelId: id }, "audit funnel deleted");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const gated = enforcementErrorResponse(error);
    if (gated) return gated;
    logger.error({ err: error }, "[agency/funnels/:id DELETE]");
    return NextResponse.json({ error: "Could not delete that funnel." }, { status: 500 });
  }
}
