// src/app/api/agency/scan/route.ts
//
// Submit a bulk prospect scan, and list the batches already submitted.
//
// ── The gate ────────────────────────────────────────────────────────────────
// requireFeature("whitelabel"), which is the AGENCY+ line in PLAN_FEATURES.
// NOT requirePlan("AGENCY"): plan-enforcement.ts:16 says surfaces are gated
// per-feature and never by tier, and the one route in this codebase that does
// otherwise is the exception rather than the pattern. `whitelabel` is also the
// honest key — the artifact this whole tool exists to produce is a white-labeled
// outreach PDF, so a tenant who cannot white-label cannot use the output.
//
// ── The order of the guards is load-bearing ─────────────────────────────────
//   1. Feature gate      — cheapest, and answers "may you at all".
//   2. Parse and validate — free, and decides how many rows there actually are.
//   3. Quota reserve     — a Redis INCR, released on any failure below it.
//   4. Create + enqueue  — the only step that commits anything.
//
// Reserving before parsing would burn a monthly batch slot on a paste that
// turned out to contain no valid domains. Parsing after creating would mean a
// batch row with a total nobody can trust. Every early return below step 3
// releases the reservation, and the test suite asserts that on each path —
// a leaked slot is invisible until a customer says "it says I've used 20 and
// I've run 6".

import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { parseDomainList, MAX_BATCH_ROWS } from "@/lib/opportunity-scanner/parse";
import {
  reserveScanBatch,
  releaseScanBatch,
  scanBatchesUsed,
  batchLimit,
  ScanQuotaUnavailableError,
} from "@/lib/opportunity-scanner/quota";
import { estimateBatchUsd } from "@/lib/opportunity-scanner/places";
import { createBatch, listBatches } from "@/lib/opportunity-scanner/store";
import { enqueueBatch } from "@/infrastructure/queue/workers/opportunity-scan.worker";
import { logger } from "@/infrastructure/observability/logger";

/**
 * The batch list, plus what the submit form needs to render itself.
 *
 * The quota figures come back on the GET rather than being computed in the
 * client, because a hardcoded plan number in copy is exactly what CLAUDE.md
 * forbids — the form prints "n of m used this month" from this response.
 */
export async function GET() {
  try {
    const membership = await requireTenant();
    await requireFeature("whitelabel");

    const [batches, used] = await Promise.all([
      listBatches(membership.tenantId),
      scanBatchesUsed(membership.tenantId),
    ]);

    return NextResponse.json({
      batches,
      quota: {
        used,
        limit: batchLimit(membership.tenant.planType),
      },
      maxRows: MAX_BATCH_ROWS,
      /** Per-domain Places rate, so the form can price any row count live. */
      placesUnitUsd: estimateBatchUsd(1, true),
    });
  } catch (error) {
    const gated = enforcementErrorResponse(error);
    if (gated) return gated;
    logger.error({ err: error }, "[agency/scan GET]");
    return NextResponse.json({ error: "Could not load scans." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let reserved: { tenantId: string } | null = null;

  try {
    const membership = await requireTenant();
    await requireFeature("whitelabel");

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    // One field for both input paths. The client reads an uploaded file and
    // posts its text here rather than multipart — tokenize() in parse.ts
    // handles a CSV and a paste identically, so a second transport would buy
    // nothing but a second thing to validate.
    const raw = typeof (body as { domains?: unknown }).domains === "string"
      ? (body as { domains: string }).domains
      : "";
    const placesEnabled = (body as { placesEnabled?: unknown }).placesEnabled === true;

    // ── 2. Parse. Free, and it decides whether there is anything to reserve.
    const parsed = parseDomainList(raw);
    if (parsed.domains.length === 0) {
      return NextResponse.json(
        {
          error: "No usable domains in that list.",
          rejected: parsed.rejected.slice(0, 50),
          seen: parsed.seen,
        },
        { status: 400 },
      );
    }

    // ── 3. Reserve. Everything below this releases on failure. ─────────────
    const decision = await reserveScanBatch(membership.tenantId, membership.tenant.planType);
    if (!decision.allowed) {
      return NextResponse.json(
        {
          error: `Monthly scan limit reached (${decision.limit} batches).`,
          code: "ScanQuotaExceededError",
          quota: { used: decision.used, limit: decision.limit },
        },
        { status: 429 },
      );
    }
    reserved = { tenantId: membership.tenantId };

    // ── 4. Commit. ──────────────────────────────────────────────────────────
    const batch = await createBatch({
      tenantId: membership.tenantId,
      domains: parsed.domains,
      placesEnabled,
    });

    // Enqueued AFTER the rows are committed. The fan-out job reads `queued`
    // rows out of the database, so enqueueing first would race a worker against
    // the transaction that creates the rows it is looking for and fan out an
    // empty batch.
    await enqueueBatch(batch.id);
    reserved = null;

    logger.info(
      {
        tenantId: membership.tenantId,
        batchId: batch.id,
        accepted: parsed.domains.length,
        rejected: parsed.rejected.length,
        placesEnabled,
        estimateUsd: estimateBatchUsd(parsed.domains.length, placesEnabled),
      },
      "prospect scan submitted",
    );

    return NextResponse.json(
      {
        batch,
        // Reported, never silently dropped: a submit that quietly discarded 188
        // of 1,000 lines looks identical to one that took them all.
        rejected: parsed.rejected.slice(0, 50),
        rejectedTotal: parsed.rejected.length,
        estimateUsd: estimateBatchUsd(parsed.domains.length, placesEnabled),
      },
      { status: 201 },
    );
  } catch (error) {
    if (reserved) await releaseScanBatch(reserved.tenantId);

    const gated = enforcementErrorResponse(error);
    if (gated) return gated;
    if (error instanceof ScanQuotaUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error({ err: error }, "[agency/scan POST]");
    return NextResponse.json({ error: "Could not start that scan." }, { status: 500 });
  }
}
