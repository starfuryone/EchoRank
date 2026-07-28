/**
 * GET    /api/seo/v1/rank-tracker/projects/[id] — full detail (keywords,
 *        positions, deltas, history). Costs nothing: this only reads rows.
 * PATCH  — edit name/domain/market/frequency and replace the keyword set.
 * DELETE — remove the project and (by cascade) its keywords and snapshots.
 *
 * Tenant-scoped by construction: every lookup filters on BOTH id and the
 * caller's tenantId, so another workspace's project id is a 404, never a leak.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import {
  deleteProject,
  getProjectDetail,
  updateProject,
} from "@/lib/rank-tracker/service";
import { rankTrackerRouteError } from "@/lib/rank-tracker/http";
import { buildUsage } from "@/lib/rank-tracker/usage";
import {
  RANK_DEVICES,
  RANK_FREQUENCIES,
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_LOCATION_CODE,
  DEFAULT_DEVICE,
  MAX_KEYWORDS_PER_REQUEST,
} from "@/lib/rank-tracker/options";

const PatchSchema = z.object({
  name: z.string().trim().max(120).default(""),
  domain: z.string().trim().min(1).max(253),
  keywords: z.array(z.string().trim().min(1).max(200)).min(1).max(MAX_KEYWORDS_PER_REQUEST),
  locationCode: z.number().int().positive().default(DEFAULT_LOCATION_CODE),
  languageCode: z.string().trim().min(2).max(5).default(DEFAULT_LANGUAGE_CODE),
  device: z.enum(RANK_DEVICES).default(DEFAULT_DEVICE),
  frequency: z.enum(RANK_FREQUENCIES),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;
    const project = await getProjectDetail(tenant.tenantId, id);
    const usage = await buildUsage(tenant.tenantId, tenant.tenant.planType);
    return NextResponse.json({ project, usage });
  } catch (err) {
    return rankTrackerRouteError(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;

    const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", code: "INVALID_REQUEST", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const project = await updateProject(
      tenant.tenantId,
      tenant.tenant.planType,
      id,
      parsed.data,
    );
    const usage = await buildUsage(tenant.tenantId, tenant.tenant.planType);

    return NextResponse.json({ project, usage });
  } catch (err) {
    return rankTrackerRouteError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;
    await deleteProject(tenant.tenantId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return rankTrackerRouteError(err);
  }
}
