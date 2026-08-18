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
import { startAnalysis } from "@/lib/keyword-opportunity/start";
import { SeedSetError } from "@/lib/keyword-opportunity/seeds";
import { entitlementFor } from "@/lib/keyword-opportunity/store";
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

  let body: { brandProfileId?: string; seedKeywords?: unknown } = {};
  try {
    body = (await request.json()) as { brandProfileId?: string; seedKeywords?: unknown };
  } catch {
    // An empty body is fine — the tenant's first brand profile is the default.
  }

  // SEEDED MODE, from the Keyword Explorer bridge. Absent means discovery,
  // which is what every caller before the bridge sent.
  const seedKeywords = Array.isArray(body.seedKeywords)
    ? body.seedKeywords.filter((k): k is string => typeof k === "string")
    : undefined;

  const project = await resolveProject(tenantId, body.brandProfileId);
  if (!project) {
    return NextResponse.json(
      { error: "No project with a usable domain", code: "NO_PROJECT" },
      { status: 400 },
    );
  }

  // ONE FUNCTION DECIDES, HERE AND IN THE DOGFOOD SCRIPT. This used to be four
  // decisions written out at this call site, which is how a second entry point
  // came to skip the cache and pay twice for one domain. See
  // keyword-opportunity/start.ts.
  let outcome;
  try {
    outcome = await startAnalysis({
      tenantId,
      plan,
      brandProfileId: project.id,
      domain: project.domain,
      seedKeywords,
    });
  } catch (err) {
    // An unusable seed set is the caller's mistake, not a server fault, and it
    // is thrown before anything is consulted or spent. 400 with the reason, so
    // the Explorer can say "you selected 140, the limit is 100" rather than
    // "something went wrong".
    if (err instanceof SeedSetError) {
      return NextResponse.json(
        { error: err.message, code: err.code, count: err.count ?? null },
        { status: 400 },
      );
    }
    throw err;
  }

  if (outcome.kind === "denied") {
    // 402 rather than 403: this is "you have run out", not "you may not". The
    // insufficient-allowance state is what renders it.
    return NextResponse.json(
      {
        error: "No domain analyses left this month",
        code: "NO_ALLOWANCE",
        entitlement: outcome.entitlement,
      },
      { status: 402 },
    );
  }

  if (outcome.kind === "cached") {
    // Already COMPLETED, pointing at the run that was paid for. Enqueueing it
    // would re-run work somebody already has.
    return NextResponse.json(
      { analysisId: outcome.analysisId, funding: "cache", cached: true },
      { status: 200 },
    );
  }

  await enqueueAnalysis(outcome.analysisId);

  return NextResponse.json(
    { analysisId: outcome.analysisId, funding: outcome.funding },
    { status: 202 },
  );
}
