// GET  /api/keyword-opportunities  — the latest analysis and where the tenant stands
// POST /api/keyword-opportunities  — start one
//
// ── THE ROLLOUT GATE IS CHECKED ON BOTH VERBS ───────────────────────────────
//
// A tenant who is not allowlisted sees the AcmeCRM worked example on the tool
// page. That is a rendering decision, and rendering decisions are not security:
// without a gate here, guessing this URL would buy a real analysis with real
// money for a tenant the feature is not switched on for. So the POST refuses,
// and the GET reports `live: false` so the page knows to keep showing the demo
// rather than an empty state that looks like a broken product.
//
// ── THE ORDER OF THE CHECKS IS THE PRODUCT ──────────────────────────────────
//
// Cache first, then allowance, then credits. A repeat request for a domain
// analysed in the last 24 hours costs NOTHING and must be answered before any
// entitlement is consulted — checking allowance first would refuse a free
// result to a tenant at their ceiling, which is the one case where refusing is
// most obviously wrong.

import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/tenant";
import { registrableDomain } from "@/lib/registrable-domain";
import { prisma } from "@/lib/prisma";
import { kofEnabledFor } from "@/lib/keyword-opportunity/rollout";
import { fundingFor } from "@/lib/keyword-opportunity/entitlement";
import { reserveCredit } from "@/lib/keyword-opportunity/credits";
import { OPPORTUNITY_SCORE_VERSION } from "@/lib/keyword-opportunity/score";
import {
  cachedAnalysisId,
  createAnalysis,
  createCacheHit,
  entitlementFor,
} from "@/lib/keyword-opportunity/store";
import { enqueueAnalysis } from "@/infrastructure/queue/workers/keyword-opportunity.worker";
import { readAnalysis, readLatestAnalysis } from "@/lib/keyword-opportunity/read";

export const dynamic = "force-dynamic";

/** The brand profile a domain analysis hangs off, and its domain. */
async function resolveProject(tenantId: string, brandProfileId?: string | null) {
  const profile = brandProfileId
    ? // Tenant-scoped by construction: findFirst with both ids, never
      // findUnique on the id alone. CLAUDE.md's rule for every :id route.
      await prisma.brandProfile.findFirst({
        where: { id: brandProfileId, tenantId },
        select: { id: true, name: true, website: true },
      })
    : await prisma.brandProfile.findFirst({
        where: { tenantId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, website: true },
      });

  if (!profile) return null;
  const domain = profile.website ? registrableDomain(profile.website) : "";
  if (!domain) return null;
  return { id: profile.id, name: profile.name, domain };
}

export async function GET(request: Request) {
  const membership = await getCurrentTenant();
  if (!membership) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const tenantId = membership.tenant.id;
  const plan = membership.tenant.planType;
  const live = kofEnabledFor(tenantId);

  const url = new URL(request.url);
  const project = await resolveProject(tenantId, url.searchParams.get("brandProfileId"));

  if (!live || !project) {
    // No live runs, or no brand profile with a usable domain. Either way the
    // page falls back to the worked example, which is a real experience rather
    // than an error.
    return NextResponse.json({ live: false, analysis: null, entitlement: null });
  }

  const analysisId = url.searchParams.get("analysisId");
  const analysis = analysisId
    ? await readAnalysis(tenantId, analysisId)
    : await readLatestAnalysis(tenantId, project.id);

  return NextResponse.json({
    live: true,
    brandProfileId: project.id,
    brandName: project.name,
    domain: project.domain,
    entitlement: await entitlementFor(tenantId, plan, project.domain),
    analysis,
  });
}

export async function POST(request: Request) {
  const membership = await getCurrentTenant();
  if (!membership) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const tenantId = membership.tenant.id;
  const plan = membership.tenant.planType;

  if (!kofEnabledFor(tenantId)) {
    return NextResponse.json(
      { error: "Domain analyses are not enabled for this account", code: "NOT_ENABLED" },
      { status: 403 },
    );
  }

  let body: { brandProfileId?: string } = {};
  try {
    body = (await request.json()) as { brandProfileId?: string };
  } catch {
    // An empty body is fine — the tenant's first brand profile is the default.
  }

  const project = await resolveProject(tenantId, body.brandProfileId);
  if (!project) {
    return NextResponse.json(
      { error: "No project with a usable domain", code: "NO_PROJECT" },
      { status: 400 },
    );
  }

  const entitlement = await entitlementFor(tenantId, plan, project.domain);
  const funding = fundingFor(entitlement);

  // ── Cache: free, and answered before any entitlement is touched ──────────
  if (funding.funding === "cache") {
    const sourceId = await cachedAnalysisId(project.domain);
    if (sourceId) {
      const id = await createCacheHit({
        tenantId,
        brandProfileId: project.id,
        domain: project.domain,
        scoreVersion: OPPORTUNITY_SCORE_VERSION,
        sourceAnalysisId: sourceId,
      });
      return NextResponse.json({ analysisId: id, funding: "cache", cached: true }, { status: 200 });
    }
    // The cache disappeared between the probe and here. Fall through and run
    // it properly rather than reporting a hit we cannot serve.
  }

  if (!funding.canRun) {
    // 402 rather than 403: this is "you have run out", not "you may not". The
    // Phase 2 insufficient-allowance state is what renders it.
    return NextResponse.json(
      {
        error: "No domain analyses left this month",
        code: "NO_ALLOWANCE",
        entitlement,
      },
      { status: 402 },
    );
  }

  const id = await createAnalysis({
    tenantId,
    brandProfileId: project.id,
    domain: project.domain,
    scoreVersion: OPPORTUNITY_SCORE_VERSION,
  });

  // A credit is HELD AT SUBMIT, before the worker starts, so two requests
  // arriving together cannot both spend the same credit. The allowance needs no
  // equivalent hold: it is counted from completed rows, and two concurrent runs
  // that both complete both count.
  if (funding.funding === "credits") {
    const reserved = await reserveCredit(tenantId, id);
    if (!reserved) {
      return NextResponse.json(
        { error: "No domain analyses left this month", code: "NO_ALLOWANCE", entitlement },
        { status: 402 },
      );
    }
    await prisma.keywordOpportunityAnalysis.update({
      where: { id },
      data: { fundingSource: "credits" },
    });
  }

  await enqueueAnalysis(id);

  return NextResponse.json({ analysisId: id, funding: funding.funding }, { status: 202 });
}
