/**
 * POST /api/free/v1/serp-location — start a free SERP check for a location.
 *
 * ANONYMOUS, and it spends money, so it clears the full guard chain:
 * cache → IP → per-IP daily limit → shared daily USD cap → task_post.
 *
 * Returns 202 with a row id: the standard queue takes minutes, so nothing here
 * waits for it. The page polls GET /[id]; the existing serp sweep completes the
 * row without knowing it is free.
 *
 * PUBLIC BY DESIGN — /api/free/v1/ is in publicPaths. The CSRF origin check
 * still runs in front of this POST.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { freeToolById } from "@/lib/free-tools";
import { FREE_TOOLS_COPY, guardPaidRun, jsonError } from "@/lib/free-tools/http";
import { refundDailyLimit } from "@/lib/free-tools/limits";
import {
  findCachedCheck,
  isSupportedLocation,
  startFreeSerpCheck,
  toPublicResults,
} from "@/lib/free-tools/serp-location";
import { SERP_CACHE_TTL_MS } from "@/lib/serp/options";
import { logger } from "@/infrastructure/observability/logger";

const TOOL = freeToolById("serp_location");

const BodySchema = z.object({
  keyword: z.string().trim().min(2).max(120),
  locationCode: z.number().int(),
});

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isSupportedLocation(parsed.data.locationCode)) {
    return jsonError(FREE_TOOLS_COPY.badRequest, "INVALID_REQUEST", 400);
  }
  const { keyword, locationCode } = parsed.data;

  // 1. Cache first — 24h on (keyword, location, desktop). A hit costs the
  //    visitor neither an allowance nor a cent, so it precedes the guard.
  const cachedRow = await findCachedCheck(
    keyword,
    locationCode,
    new Date(Date.now() - SERP_CACHE_TTL_MS),
  );
  if (cachedRow) {
    return NextResponse.json({
      id: cachedRow.id,
      status: "completed",
      cached: true,
      results: toPublicResults(cachedRow.results),
    });
  }

  // 2. Attribute, limit, then check the shared budget.
  const guard = await guardPaidRun(request, TOOL.id, TOOL.dailyLimit ?? 3);
  if (!guard.ok) return guard.response;

  // 3. Spend.
  try {
    const started = await startFreeSerpCheck(keyword, locationCode);
    return NextResponse.json({ ...started, cached: false }, { status: 202 });
  } catch (err) {
    // Nothing was queued, so the visitor keeps their run.
    await refundDailyLimit(TOOL.id, guard.ip);
    logger.error({ err, tool: TOOL.id }, "free serp-location task_post failed");
    return jsonError(FREE_TOOLS_COPY.upstream, "UPSTREAM_UNAVAILABLE", 503);
  }
}
