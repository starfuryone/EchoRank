import { NextResponse } from "next/server";
import {
  getCurrentTenant,
  listMemberships,
  setActiveTenant,
} from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";
import { logger } from "@/infrastructure/observability/logger";

const log = logger.child({ module: "tenant-switch" });

/**
 * GET — list every tenant the current user can switch to, plus the one that
 * is currently active.
 */
export async function GET() {
  const current = await getCurrentTenant();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await listMemberships();

  return NextResponse.json({
    activeTenantId: current.tenantId,
    tenants: memberships.map((m) => ({
      tenantId: m.tenantId,
      role: m.role,
      tenant: m.tenant,
    })),
  });
}

/**
 * POST — switch the active tenant. Body: { tenantId: string }.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = body?.tenantId;

    if (!tenantId || typeof tenantId !== "string") {
      return NextResponse.json(
        { error: "tenantId is required" },
        { status: 400 }
      );
    }

    const membership = await setActiveTenant(tenantId);

    await createAuditLog({
      tenantId: membership.tenantId,
      userId: membership.userId,
      action: "UPDATE",
      entity: "ActiveTenant",
      entityId: membership.tenantId,
      details: { tenantId: membership.tenantId },
    });

    return NextResponse.json({
      activeTenantId: membership.tenantId,
      role: membership.role,
      tenant: {
        id: membership.tenant.id,
        name: membership.tenant.name,
        slug: membership.tenant.slug,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      error.message === "Not a member of the requested tenant"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    log.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to switch active tenant"
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
