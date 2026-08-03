/**
 * POST /api/ai/visibility/historical/wayback — list Internet Archive captures.
 * Body: { url }.
 *
 * Read-only lookup that powers the selectable import timeline. Returns [] when
 * the Archive is unreachable rather than erroring: an empty coverage list and a
 * down Archive are the same actionable state ("nothing to import right now"),
 * and the page must never depend on a third party being up.
 *
 * AUTHENTICATED — do not add /api/ai/visibility/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeSnapshotUrl } from "@/lib/historical/url";
import { listWaybackCaptures } from "@/lib/historical/wayback";
import { historicalRouteError } from "@/lib/historical/http";
import { IMPORT_RATE_LIMIT, IMPORT_RATE_WINDOW_MS } from "@/lib/historical/options";

const BodySchema = z.object({ url: z.string().trim().min(4).max(2000) });

export async function POST(request: Request) {
  try {
    const tenant = await requirePaidPlan();

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a URL to look up.", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    const guarded = normalizeSnapshotUrl(parsed.data.url);
    if (!guarded.ok || !guarded.url) {
      return NextResponse.json(
        {
          error: "That URL cannot be looked up. Use a public http:// or https:// address.",
          code: "INVALID_URL",
          reason: guarded.reason,
        },
        { status: 400 },
      );
    }

    const limited = await rateLimit(
      `historical-wayback:${tenant.tenantId}`,
      IMPORT_RATE_LIMIT,
      IMPORT_RATE_WINDOW_MS,
    );
    if (!limited.success) {
      return NextResponse.json(
        { error: "Too many lookups — try again in a minute.", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    const captures = await listWaybackCaptures(guarded.url);
    return NextResponse.json({
      url: guarded.url,
      captures: captures.map((c) => ({
        timestamp: c.timestamp,
        capturedAt: c.capturedAt.toISOString(),
        statusCode: c.statusCode,
      })),
    });
  } catch (err) {
    return historicalRouteError(err);
  }
}
