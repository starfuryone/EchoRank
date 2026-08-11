import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { prisma } from "@/lib/prisma";

/**
 * The ONLY write the dashboard performs: a prompt's tracking switch and its tags.
 *
 * NO DELETE. Removing a prompt would orphan its runs, its analyses and the
 * metrics computed from them — history that a customer paid for and that the
 * trend line still reads. `active: false` stops it being asked again and keeps
 * everything it has already told us. A delete flow is a data-retention decision,
 * not a dashboard button.
 *
 * SCOPED BY TENANT IN THE WHERE CLAUSE, not by a check-then-write. updateMany
 * with tenantId in the filter cannot be raced into touching another tenant's
 * row the way a findUnique followed by an update can.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const membership = await requireTenant();
    await requireFeature("ai_visibility");

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      active?: unknown;
      tags?: unknown;
    };

    const data: { active?: boolean; tags?: string[] } = {};
    if (typeof body.active === "boolean") data.active = body.active;
    if (Array.isArray(body.tags)) {
      // Trimmed, de-duplicated, bounded. Deliberately not validated against a
      // vocabulary: these are the customer's own labels for their own
      // filtering, and a taxonomy nobody chose is a taxonomy nobody uses.
      const seen = new Set<string>();
      data.tags = body.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim().slice(0, 40))
        .filter((tag) => {
          if (!tag || seen.has(tag.toLowerCase())) return false;
          seen.add(tag.toLowerCase());
          return true;
        })
        .slice(0, 20);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
    }

    const result = await prisma.trackedPrompt.updateMany({
      where: { id, tenantId: membership.tenantId },
      data,
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    const enforcement = enforcementErrorResponse(error);
    if (enforcement) return enforcement;
    throw error;
  }
}
