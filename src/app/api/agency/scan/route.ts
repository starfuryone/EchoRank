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
import { createBatch, deleteBatch, listBatches } from "@/lib/opportunity-scanner/store";
import { canAfford } from "@/lib/credits/ledger";
import { creditBalance, releaseReservation, reserveCredits } from "@/lib/credits/store";
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

    const [batches, used, credits] = await Promise.all([
      listBatches(membership.tenantId),
      scanBatchesUsed(membership.tenantId),
      creditBalance(membership.tenantId),
    ]);

    return NextResponse.json({
      batches,
      quota: {
        used,
        limit: batchLimit(membership.tenant.planType),
      },
      maxRows: MAX_BATCH_ROWS,
      /**
       * Lookups this tenant holds. The form renders the estimate against this
       * — "N lookups (M remaining after)" — and never against a dollar figure.
       */
      credits,
      /**
       * Per-domain Places rate. NOT rendered any more: the estimate is counted
       * in lookups now, because a customer who has prepaid should be told what
       * a batch costs in the units they bought. Kept on the response because
       * it is the honest per-row cost and removing it from the API would break
       * any consumer reading it; the client simply stops showing it.
       */
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
  // Mirrors `reserved` exactly, for the credit hold. Set once the ledger row
  // is written, cleared once the batch is safely enqueued, and released in the
  // catch if anything between the two throws — the same discipline this file's
  // header describes for the Redis slot, and for the same reason: a stranded
  // hold is invisible until a customer says "it says I have 0 and I've run 1".
  let creditsHeld: { tenantId: string; batchId: string; rowCount: number } | null = null;

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

    // ── 3a. The credit gate, BEFORE the batch slot is spent. ───────────────
    //
    // Checked first because it is the cheaper refusal: a tenant who cannot
    // afford the lookups should not burn one of their monthly batch slots
    // finding that out. The hold itself cannot be written yet — it is keyed on
    // the batch id, which does not exist until step 4 — so this is a read, and
    // the authoritative check is the serializable transaction in reserveCredits
    // below. Two batches racing are settled there, not here.
    //
    // PLACES OFF COSTS NOTHING AND IS NEVER GATED. A batch with the box
    // unticked spends no credits, so a tenant with a zero balance can still run
    // every scan they are entitled to — the dialog says so, and this is where
    // that promise is kept.
    const balance = placesEnabled ? await creditBalance(membership.tenantId) : 0;
    if (placesEnabled && !canAfford(balance, parsed.domains.length)) {
      return NextResponse.json(
        {
          error: `Not enough prospect lookups (${balance} available, ${parsed.domains.length} needed).`,
          code: "InsufficientCreditsError",
          credits: { balance, required: parsed.domains.length },
        },
        { status: 402 },
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

    // ── 4a. Hold the credits, now that there is a batch id to key them on.
    //
    // AFTER createBatch and BEFORE enqueueBatch, which is the only window that
    // works: the ledger row's `ref` is the batch id, and holding after the
    // workers are running would let the first rows spend credits that were
    // never reserved.
    //
    // A refusal here is the concurrent-batch case — another submit took the
    // credits between the read above and this transaction. The batch row is
    // already committed, so it is released back through `creditsHeld` in the
    // catch along with the Redis slot, and the customer is told the same thing
    // the pre-check would have told them.
    if (placesEnabled) {
      const hold = await reserveCredits({
        tenantId: membership.tenantId,
        batchId: batch.id,
        rowCount: parsed.domains.length,
      });
      if (!hold.ok) {
        await deleteBatch(batch.id, membership.tenantId);
        await releaseScanBatch(membership.tenantId);
        reserved = null;
        return NextResponse.json(
          {
            error: `Not enough prospect lookups (${hold.balance} available, ${parsed.domains.length} needed).`,
            code: "InsufficientCreditsError",
            credits: { balance: hold.balance, required: parsed.domains.length },
          },
          { status: 402 },
        );
      }
      creditsHeld = {
        tenantId: membership.tenantId,
        batchId: batch.id,
        rowCount: parsed.domains.length,
      };
    }

    // Enqueued AFTER the rows are committed. The fan-out job reads `queued`
    // rows out of the database, so enqueueing first would race a worker against
    // the transaction that creates the rows it is looking for and fan out an
    // empty batch.
    await enqueueBatch(batch.id);
    reserved = null;
    // The hold is now the workers' responsibility: settleBatchCredits gives
    // back whatever the batch does not spend when it reaches a terminal state.
    creditsHeld = null;

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
    // Released before the error is classified, so every failure path below —
    // gated, quota, or an unexpected throw — gives the credits back.
    if (creditsHeld) await releaseReservation(creditsHeld);

    const gated = enforcementErrorResponse(error);
    if (gated) return gated;
    if (error instanceof ScanQuotaUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error({ err: error }, "[agency/scan POST]");
    return NextResponse.json({ error: "Could not start that scan." }, { status: 500 });
  }
}
