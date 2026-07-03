import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, requirePlan, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { prisma } from "@/lib/prisma";
import type { VisibilityCadence } from "@/generated/prisma";

/**
 * Scheduled visibility monitoring (GROWTH+). WEEKLY cadence on GROWTH,
 * DAILY requires AGENCY. The worker sweep picks up nextRunAt <= now, so a
 * new/reactivated monitor runs within ~15 minutes.
 */

function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim().replace(/\/+$/, "");
  if (!url || url.length > 300 || /\s/.test(url)) return null;
  return url;
}

async function resolveCadence(raw: unknown): Promise<VisibilityCadence> {
  if (raw === "DAILY") {
    await requirePlan("AGENCY");
    return "DAILY";
  }
  return "WEEKLY";
}

export async function GET() {
  try {
    const membership = await requireTenant();
    await requireFeature("ai_visibility");
    const tenantId = membership.tenantId;

    const [monitors, audits] = await Promise.all([
      prisma.visibilityMonitor.findMany({
        where: { tenantId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.visibilityAudit.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 60,
        select: { id: true, monitorId: true, url: true, score: true, grade: true, createdAt: true },
      }),
    ]);
    return NextResponse.json({ monitors, audits });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    console.error("[visibility/monitor GET]", error);
    return NextResponse.json({ error: "Failed to load monitors." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const membership = await requireTenant();
    await requireFeature("ai_visibility");
    const tenantId = membership.tenantId;

    const body = await req.json().catch(() => ({}));
    const url = normalizeUrl(body.url);
    if (!url) {
      return NextResponse.json({ error: "A valid url is required." }, { status: 400 });
    }
    const cadence = await resolveCadence(body.cadence);

    const monitor = await prisma.visibilityMonitor.upsert({
      where: { tenantId_url: { tenantId, url } },
      update: { active: true, cadence, nextRunAt: new Date() },
      create: { tenantId, url, cadence, nextRunAt: new Date() },
    });
    return NextResponse.json({ monitor }, { status: 201 });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    console.error("[visibility/monitor POST]", error);
    return NextResponse.json({ error: "Failed to save monitor." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const membership = await requireTenant();
    await requireFeature("ai_visibility");
    const tenantId = membership.tenantId;

    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const data: { active?: boolean; cadence?: VisibilityCadence; nextRunAt?: Date } = {};
    if (typeof body.active === "boolean") {
      data.active = body.active;
      if (body.active) data.nextRunAt = new Date();
    }
    if (body.cadence !== undefined) data.cadence = await resolveCadence(body.cadence);

    const result = await prisma.visibilityMonitor.updateMany({ where: { id, tenantId }, data });
    if (result.count === 0) {
      return NextResponse.json({ error: "Monitor not found." }, { status: 404 });
    }
    const monitor = await prisma.visibilityMonitor.findUnique({ where: { id } });
    return NextResponse.json({ monitor });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    console.error("[visibility/monitor PATCH]", error);
    return NextResponse.json({ error: "Failed to update monitor." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const membership = await requireTenant();
    await requireFeature("ai_visibility");
    const tenantId = membership.tenantId;

    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const result = await prisma.visibilityMonitor.deleteMany({ where: { id, tenantId } });
    if (result.count === 0) {
      return NextResponse.json({ error: "Monitor not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    console.error("[visibility/monitor DELETE]", error);
    return NextResponse.json({ error: "Failed to delete monitor." }, { status: 500 });
  }
}
