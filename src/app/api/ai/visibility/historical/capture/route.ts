/**
 * POST /api/ai/visibility/historical/capture — snapshot a live page now.
 * Body: { url }.
 *
 * Guard chain: requirePaidPlan (session + tenant + billing) → zod → SSRF guard
 * → rate limit (5/min/tenant) → sidecar fetch → size cap → dedupe → store →
 * prune.
 *
 * ANY PUBLIC URL, yours or a competitor's. There is no ownership check and
 * there should not be one — comparing your page against theirs is the point of
 * the tool. The per-tenant caps (500 snapshots, 300 KB each, 5 captures/min)
 * are what stop this being a general-purpose web archiver.
 *
 * SSRF: the URL is user-supplied and we fetch it server-side, which is the
 * textbook shape. normalizeSnapshotUrl reuses guardCheckUrl's verdict verbatim
 * (rejects non-http(s) schemes, credentials, non-standard ports, IP literals
 * and private/reserved hostnames) and restores the query string the probe-
 * oriented guard clears. The sidecar applies its own assert_fetchable() at the
 * socket — re-resolving every redirect hop and refusing any that leaves the
 * requested domain — which is the layer that catches a public hostname
 * resolving to a private address.
 *
 * AUTHENTICATED — do not add /api/ai/visibility/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeSnapshotUrl } from "@/lib/historical/url";
import { captureNow } from "@/lib/historical/capture";
import { historicalRouteError } from "@/lib/historical/http";
import { CAPTURE_RATE_LIMIT, CAPTURE_RATE_WINDOW_MS } from "@/lib/historical/options";

const BodySchema = z.object({ url: z.string().trim().min(4).max(2000) });

export async function POST(request: Request) {
  try {
    const tenant = await requirePaidPlan();

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a URL to capture.", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    // SSRF gate BEFORE the rate limiter: a rejected URL should not cost the
    // tenant one of their five captures a minute.
    const guarded = normalizeSnapshotUrl(parsed.data.url);
    if (!guarded.ok || !guarded.url) {
      return NextResponse.json(
        {
          error: "That URL cannot be captured. Use a public http:// or https:// address.",
          code: "INVALID_URL",
          reason: guarded.reason,
        },
        { status: 400 },
      );
    }

    const limited = await rateLimit(
      `historical-capture:${tenant.tenantId}`,
      CAPTURE_RATE_LIMIT,
      CAPTURE_RATE_WINDOW_MS,
    );
    if (!limited.success) {
      return NextResponse.json(
        { error: "Too many captures — try again in a minute.", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    const result = await captureNow(tenant.tenantId, guarded.url);
    return NextResponse.json(result);
  } catch (err) {
    return historicalRouteError(err);
  }
}
