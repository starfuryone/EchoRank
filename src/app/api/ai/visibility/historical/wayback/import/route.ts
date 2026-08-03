/**
 * POST /api/ai/visibility/historical/wayback/import — import selected captures.
 * Body: { url, timestamps: string[] }.
 *
 * Capped at MAX_WAYBACK_IMPORT per call (enforced again in the service, not
 * just here) and rate limited to 2 imports/min/tenant. Per-snapshot failures
 * are reported, not thrown — see importWaybackCaptures.
 *
 * AUTHENTICATED — do not add /api/ai/visibility/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeSnapshotUrl } from "@/lib/historical/url";
import { importWaybackCaptures } from "@/lib/historical/capture";
import { historicalRouteError } from "@/lib/historical/http";
import {
  IMPORT_RATE_LIMIT,
  IMPORT_RATE_WINDOW_MS,
  MAX_WAYBACK_IMPORT,
} from "@/lib/historical/options";

const BodySchema = z.object({
  url: z.string().trim().min(4).max(2000),
  timestamps: z.array(z.string().regex(/^\d{14}$/)).min(1).max(MAX_WAYBACK_IMPORT),
});

export async function POST(request: Request) {
  try {
    const tenant = await requirePaidPlan();

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Select between 1 and ${MAX_WAYBACK_IMPORT} snapshots to import.`, code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    const guarded = normalizeSnapshotUrl(parsed.data.url);
    if (!guarded.ok || !guarded.url) {
      return NextResponse.json(
        {
          error: "That URL cannot be imported. Use a public http:// or https:// address.",
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
        { error: "Too many imports — try again in a minute.", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    const result = await importWaybackCaptures(
      tenant.tenantId,
      guarded.url,
      parsed.data.timestamps,
    );
    return NextResponse.json(result);
  } catch (err) {
    return historicalRouteError(err);
  }
}
