// src/app/api/intelligence/explain/route.ts
//
// AI Competitor Reverse Engineer — "why are they winning?".
//
//   GET  → what the confirm dialog needs: the rivals worth asking about, the
//          estimated cost of a run, and whether a stored report already exists
//   POST → serve the stored report if it is inside its window, else gather a
//          new one
//
// ── Tenant scoping, stated once ────────────────────────────────────────────
// requireTenant() resolves the caller's OWN active tenant from the session.
// No tenant id is ever accepted from the client, and the one client-supplied
// id that does exist — brandProfileId — is re-read with
// findFirst({ where: { id, tenantId } }) before anything is done with it, per
// CLAUDE.md. A brand profile belonging to another tenant therefore 404s rather
// than leaking whether it exists.
//
// ── Why GROWTH+ ────────────────────────────────────────────────────────────
// requirePlan("GROWTH") rather than requireFeature(): this is a paid research
// action that spends real upstream money per click, and the plan rank is what
// bounds who can spend it. AI-visibility SURFACES gate on features; this one
// gates on the tier that pays for the data.

import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requirePlan, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { csrfProtection } from "@/lib/csrf-protection";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { placesConfigured } from "@/lib/signals/competitors";
import { estimateRunCost } from "@/lib/explain/cost";
import { listRivals } from "@/lib/explain/rival";
import { isFresh, latestReport, normalizeRivalDomain } from "@/lib/explain/store";
import { runExplain } from "@/lib/explain/run";

export const dynamic = "force-dynamic";

function unauthorized(error: unknown): NextResponse | null {
  const enforcement = enforcementErrorResponse(error);
  if (enforcement) return enforcement;
  if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * The tenant's brand profile, or null.
 *
 * Takes the client's id when it supplies one and falls back to the tenant's
 * first profile when it does not — but ALWAYS through the tenant filter, so
 * the fallback cannot become a way to read someone else's default.
 */
async function resolveProfile(tenantId: string, brandProfileId?: string | null) {
  return prisma.brandProfile.findFirst({
    where: brandProfileId ? { id: brandProfileId, tenantId } : { tenantId },
    orderBy: brandProfileId ? undefined : { createdAt: "asc" },
    select: { id: true, name: true, website: true },
  });
}

// ─── GET: the confirm dialog's data ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const membership = await requireTenant();
    await requirePlan("GROWTH");
    const tenantId = membership.tenantId;

    const url = new URL(req.url);
    const profile = await resolveProfile(tenantId, url.searchParams.get("brandProfileId"));
    if (!profile) {
      // Not an error: a tenant on GROWTH with no brand profile yet simply has
      // nothing to compare, and the button stays hidden.
      return NextResponse.json({ available: false, rivals: [] });
    }

    const rivals = await listRivals({ tenantId, brandProfileId: profile.id });

    // Priced for what a run would actually buy: both domains, and Places only
    // if this deployment could use it. Quoting a Places line to a deployment
    // with no key would overstate the bill by nearly half.
    const estimate = estimateRunCost({
      domainsToPrice: profile.website ? 2 : 1,
      placesLookups: 0,
    });

    // One indexed read per rival that already has a report. Bounded by the
    // rival count, which is single digits by construction.
    const existing = await Promise.all(
      rivals
        .filter((rival) => rival.suggestedDomain)
        .map(async (rival) => {
          const report = await latestReport(tenantId, rival.suggestedDomain!);
          return report ? { domain: rival.suggestedDomain!, createdAt: report.createdAt } : null;
        }),
    );

    return NextResponse.json({
      available: rivals.length > 0,
      brandProfileId: profile.id,
      brandName: profile.name,
      brandWebsite: profile.website,
      placesConfigured: placesConfigured(),
      rivals,
      estimate,
      existing: existing.filter(Boolean),
    });
  } catch (error) {
    const handled = unauthorized(error);
    if (handled) return handled;
    logger.error(
      { err: error instanceof Error ? error.message : String(error) },
      "explain: GET failed",
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ─── POST: serve stored, or gather ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  const csrf = csrfProtection(req);
  if (csrf) return csrf;

  try {
    const membership = await requireTenant();
    await requirePlan("GROWTH");
    const tenantId = membership.tenantId;

    let body: { brandProfileId?: string; rivalName?: string; rivalDomain?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const rivalName = String(body.rivalName ?? "").trim().slice(0, 120);
    if (!rivalName) {
      return NextResponse.json({ error: "rival_name_required" }, { status: 400 });
    }

    const rivalDomain = normalizeRivalDomain(String(body.rivalDomain ?? ""));
    if (!rivalDomain) {
      // The domain is what the backlinks and site gatherers are keyed on, and
      // guessing one the customer did not confirm would spend their money on a
      // site they never named.
      return NextResponse.json({ error: "rival_domain_required" }, { status: 400 });
    }

    const profile = await resolveProfile(tenantId, body.brandProfileId);
    if (!profile) {
      return NextResponse.json({ error: "brand_profile_not_found" }, { status: 404 });
    }

    // ── The window, checked before anything is bought ────────────────────
    // A stored report inside seven days is SERVED, not refreshed. See the note
    // at the top of store.ts on why the window is a spend brake.
    const stored = await latestReport(tenantId, rivalDomain);
    if (stored && isFresh(stored)) {
      return NextResponse.json({ report: stored });
    }

    const yourDomain = profile.website ? normalizeRivalDomain(profile.website) : null;

    // No Places ids are passed, and that is deliberate rather than unfinished.
    // The rivals this surface compares are AI-visibility competitors named on
    // the brand profile and in the citation rollups — SaaS companies, which
    // have no Google Business listing. The `Competitor` table that does carry
    // placeIds holds LOCAL businesses and belongs to a different population
    // entirely (see the note on the Share of Voice page). gatherReviews
    // therefore reports "no_place_id", the factor says so in the customer's
    // own language, and nothing is bought from Places — which is also why the
    // GET estimate above prices zero Places lookups. The parameters exist so a
    // local-competitor caller can supply them without touching the gatherer.
    const report = await runExplain({
      tenantId,
      brandProfileId: profile.id,
      brandName: profile.name,
      yourDomain,
      rivalName,
      rivalDomain,
    });

    return NextResponse.json({ report });
  } catch (error) {
    const handled = unauthorized(error);
    if (handled) return handled;
    logger.error(
      { err: error instanceof Error ? error.message : String(error) },
      "explain: POST failed",
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
