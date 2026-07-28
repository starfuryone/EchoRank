/**
 * GET  /api/seo/v1/rank-tracker/projects — this tenant's projects + usage.
 * POST /api/seo/v1/rank-tracker/projects — create one.
 *
 * Guard chain on POST: requirePaidPlan (session + tenant + ACTIVE billing) →
 * zod → domain normalization → plan gate (STARTER/AI_VISIBILITY are locked) →
 * frequency gate → tracked-keyword cap. Creating a project costs nothing; the
 * spend gate is the monthly check quota, enforced when a run is posted.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { createProject, listProjects } from "@/lib/rank-tracker/service";
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

const BodySchema = z.object({
  name: z.string().trim().max(120).default(""),
  domain: z.string().trim().min(1).max(253),
  keywords: z.array(z.string().trim().min(1).max(200)).min(1).max(MAX_KEYWORDS_PER_REQUEST),
  locationCode: z.number().int().positive().default(DEFAULT_LOCATION_CODE),
  languageCode: z.string().trim().min(2).max(5).default(DEFAULT_LANGUAGE_CODE),
  device: z.enum(RANK_DEVICES).default(DEFAULT_DEVICE),
  frequency: z.enum(RANK_FREQUENCIES),
});

export async function GET() {
  try {
    const tenant = await requirePaidPlan();
    const [projects, usage] = await Promise.all([
      listProjects(tenant.tenantId),
      buildUsage(tenant.tenantId, tenant.tenant.planType),
    ]);
    return NextResponse.json({ projects, usage });
  } catch (err) {
    return rankTrackerRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requirePaidPlan();

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", code: "INVALID_REQUEST", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const project = await createProject(tenant.tenantId, tenant.tenant.planType, parsed.data);
    const usage = await buildUsage(tenant.tenantId, tenant.tenant.planType);

    return NextResponse.json({ project, usage }, { status: 201 });
  } catch (err) {
    return rankTrackerRouteError(err);
  }
}
