// src/lib/ai-lens/service.ts
//
// AI Lens analysis path, shared by the POST route, the /visibility panel and the
// tests.
//
// Order of operations is deliberate and each step is cheaper than the next:
//   1. 24 h cache      — free, never touches the monthly allowance
//   2. monthly quota   — Redis reservation, released if no render happened
//   3. sidecar call    — the chromium render, ~16 s on a real page
//   4. persist row
//
// The reservation is taken BEFORE the render and released on every failure path.
// Reserving after would let concurrent submissions both pass the check and both
// render; not releasing would charge a tenant for a render that never ran.

import type { AiLensAnalysis, PlanType, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { sidecarPost } from "@/lib/av-sidecar";
import { AI_LENS_CACHE_TTL_MS, aiLensVerdict } from "./options";
import {
  aiLensLimit,
  releaseAiLensAnalysis,
  reserveAiLensAnalysis,
} from "./quota";
import type {
  AiLensAnalysisDto,
  AiLensMeta,
  MissingBlock,
  SidecarLensResult,
} from "./types";

/** The sidecar refused or failed. `statusCode` is what the route should return. */
export class AiLensFailedError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 502,
  ) {
    super(message);
    this.name = "AiLensFailedError";
  }
}

export function toDto(row: AiLensAnalysis): AiLensAnalysisDto {
  const blocks = (row.missingBlocks as unknown as MissingBlock[] | null) ?? [];
  // Decimal -> number at the boundary: Prisma's Decimal does not survive
  // JSON.stringify as a number and would reach the client as an object.
  const gapPercent = Number(row.gapPercent);
  return {
    id: row.id,
    url: row.url,
    gapPercent,
    verdict: aiLensVerdict(gapPercent),
    rawWordCount: row.rawWordCount,
    renderedWordCount: row.renderedWordCount,
    missingBlocks: blocks,
    missingBlocksTruncated:
      ((row.meta as unknown as { missing_blocks_truncated?: number } | null)
        ?.missing_blocks_truncated) ?? 0,
    missingWordCount:
      ((row.meta as unknown as { missing_word_count?: number } | null)
        ?.missing_word_count) ?? 0,
    meta: row.meta as unknown as AiLensMeta,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Newest analysis for this exact URL inside the cache window, or null. */
export async function findCached(
  tenantId: string,
  url: string,
  now = new Date(),
): Promise<AiLensAnalysis | null> {
  return prisma.aiLensAnalysis.findFirst({
    where: {
      tenantId,
      url,
      createdAt: { gte: new Date(now.getTime() - AI_LENS_CACHE_TTL_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
}

export interface RunResult {
  analysis: AiLensAnalysisDto;
  cached: boolean;
  usage: { used: number; limit: number };
}

/**
 * Analyze one already-normalized, already-authorized URL.
 *
 * `url` MUST have been through normalizeLensUrl and assertUrlAllowed. This
 * function does not re-check ownership — it is called from the /visibility panel
 * with the tenant's own audited domain, where that check is implicit.
 */
export async function runLensAnalysis(
  tenantId: string,
  plan: PlanType,
  url: string,
  now = new Date(),
): Promise<RunResult> {
  const cached = await findCached(tenantId, url, now);
  if (cached) {
    // A cache hit spends nothing, so the usage line reports the month's real
    // count rather than a reservation that never happened.
    const { aiLensAnalysesUsed } = await import("./quota");
    return {
      analysis: toDto(cached),
      cached: true,
      usage: { used: await aiLensAnalysesUsed(tenantId, now), limit: aiLensLimit(plan) },
    };
  }

  // Throws AiLensQuotaExceededError / AiLensQuotaUnavailableError.
  const reservation = await reserveAiLensAnalysis(tenantId, plan, now);

  let result: SidecarLensResult;
  try {
    const { status, data } = await sidecarPost<SidecarLensResult & { error?: string }>(
      "/internal/ai-lens",
      { url },
    );
    if (status !== 200 || !data || typeof data.gap_percent !== "number") {
      const message =
        (data as { error?: string } | null)?.error ??
        "The AI Lens service could not analyze that page.";
      // 429 from the sidecar means all render slots are busy — that is a retry,
      // not a spent analysis, so it must not consume the allowance either.
      throw new AiLensFailedError(message, status === 429 ? 429 : 502);
    }
    result = data;
  } catch (err) {
    await releaseAiLensAnalysis(tenantId, now);
    throw err;
  }

  const row = await prisma.aiLensAnalysis.create({
    data: {
      tenantId,
      url,
      gapPercent: result.gap_percent,
      rawWordCount: result.raw_word_count,
      renderedWordCount: result.rendered_word_count,
      missingBlocks: result.missing_blocks as unknown as Prisma.InputJsonValue,
      // The markdown documents are deliberately NOT persisted: hundreds of KB
      // per row, nothing in the product reads them back, and they would make the
      // table the largest in the database within a month.
      meta: {
        ...result.meta,
        // The gap's numerator. Stored rather than derived: renderedWordCount -
        // rawWordCount is NOT the same number (a raw fetch can carry extra
        // content of its own), and a "Missing" figure that disagreed with the
        // headline percentage would undermine both.
        missing_word_count: result.missing_word_count,
        missing_block_count: result.missing_block_count,
        missing_blocks_truncated: result.missing_blocks_truncated,
        raw_block_count: result.raw_block_count,
        rendered_block_count: result.rendered_block_count,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  // Capture path A for the Historical tool. The rendered markdown is already in
  // hand and was about to be discarded; persisting it costs one hash and, only
  // when the page actually changed, one object upload. Dedupe means a tenant
  // re-running Lens on an unchanged page writes nothing.
  //
  // Deliberately after the row is created and deliberately swallowed: an AI Lens
  // analysis must not fail because snapshot storage is unconfigured or briefly
  // down. Historical is a passenger here, not the point of the request.
  try {
    const { storeSnapshot } = await import("@/lib/historical/snapshots");
    const { isSpacesConfigured } = await import("@/lib/historical/spaces");
    if (isSpacesConfigured() && result.rendered_markdown?.trim()) {
      await storeSnapshot({
        tenantId,
        url,
        markdown: result.rendered_markdown,
        source: "ai_lens",
        capturedAt: row.createdAt,
      });
    }
  } catch (err) {
    console.error("[ai-lens] snapshot capture skipped:", err instanceof Error ? err.name : typeof err);
  }

  return {
    analysis: toDto(row),
    cached: false,
    usage: { used: reservation.used, limit: reservation.limit },
  };
}
