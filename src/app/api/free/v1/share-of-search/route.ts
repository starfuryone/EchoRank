/**
 * POST /api/free/v1/share-of-search — brand search-volume shares.
 *
 * The spendiest free tool, so it is the strictest: 2 runs per IP per day, and
 * the shared daily USD cap is consulted before any brand is bought.
 *
 * PARTIAL CACHE HITS ARE THE COMMON CASE. Volumes are cached per BRAND, not per
 * brand-set, so overlapping comparisons reuse each other's lookups. The guard
 * therefore runs only when at least one brand is missing — a comparison whose
 * brands are all known costs the visitor nothing, which is the same rule every
 * other tool here follows.
 *
 * PUBLIC BY DESIGN — /api/free/v1/ is in publicPaths; CSRF still applies.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { freeToolById } from "@/lib/free-tools";
import { FREE_TOOLS_COPY, guardPaidRun, jsonError } from "@/lib/free-tools/http";
import { refundDailyLimit } from "@/lib/free-tools/limits";
import { SERP_LOCATION_CODES } from "@/lib/serp/options";
import {
  MAX_BRANDS,
  MIN_BRANDS,
  cacheBrand,
  computeShares,
  fetchMissingVolumes,
  normalizeBrand,
  readCachedBrands,
  type BrandVolume,
} from "@/lib/free-tools/share-of-search";
import { logger } from "@/infrastructure/observability/logger";

const TOOL = freeToolById("share_of_search");

const BodySchema = z.object({
  brands: z.array(z.string().trim().min(1).max(60)).min(MIN_BRANDS).max(MAX_BRANDS),
  locationCode: z.number().int(),
});

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(FREE_TOOLS_COPY.badRequest, "INVALID_REQUEST", 400);
  }
  const { locationCode } = parsed.data;
  if (!(SERP_LOCATION_CODES as readonly number[]).includes(locationCode)) {
    return jsonError(FREE_TOOLS_COPY.badRequest, "INVALID_REQUEST", 400);
  }

  // Duplicate brands would double-count a share; dedupe before anything else.
  const brands = [...new Map(parsed.data.brands.map((b) => [normalizeBrand(b), b])).values()];
  if (brands.length < MIN_BRANDS) {
    return jsonError(FREE_TOOLS_COPY.badRequest, "INVALID_REQUEST", 400);
  }

  // 1. What do we already know?
  const { known, missing } = await readCachedBrands(brands, locationCode);

  // 2. Everything cached — free for the visitor, no guard, no spend.
  if (missing.length === 0) {
    const ordered = brands.map((b) => known.get(normalizeBrand(b))!);
    return NextResponse.json(computeShares(ordered));
  }

  // 3. Something must be bought: attribute, limit, then check the budget.
  const guard = await guardPaidRun(request, TOOL.id, TOOL.dailyLimit ?? 2);
  if (!guard.ok) return guard.response;

  try {
    const fetched = await fetchMissingVolumes(missing, locationCode);

    for (const brand of missing) {
      const value = fetched.get(normalizeBrand(brand));
      if (!value) continue;
      await cacheBrand(brand, locationCode, value);
      known.set(normalizeBrand(brand), { brand, cached: false, ...value });
    }

    const ordered: BrandVolume[] = brands.map(
      (b) => known.get(normalizeBrand(b)) ?? { brand: b, volume: 0, monthly: null, cached: false },
    );
    return NextResponse.json(computeShares(ordered));
  } catch (err) {
    await refundDailyLimit(TOOL.id, guard.ip);
    logger.error({ err, tool: TOOL.id }, "free share-of-search lookup failed");
    return jsonError(FREE_TOOLS_COPY.upstream, "UPSTREAM_UNAVAILABLE", 503);
  }
}
