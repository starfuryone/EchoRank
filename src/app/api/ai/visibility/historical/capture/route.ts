/**
 * POST /api/ai/visibility/historical/capture — snapshot a live page now.
 * Body: { url }.
 *
 * Guard chain: requirePaidPlan (session + tenant + billing) → zod → SSRF guard
 * → rate limit (5/min/tenant) → sidecar fetch → size cap → dedupe → store →
 * prune.
 *
 * SSRF: the URL is user-supplied and we fetch it server-side, which is the
 * textbook shape. guardCheckUrl (bot-analytics/url-guard.ts) is reused rather
 * than reimplemented — it rejects non-http(s) schemes, credentials in the URL,
 * non-standard ports, IP literals and private/reserved hostnames. The sidecar
 * applies its own assert_fetchable() at the socket, which is the layer that can
 * catch a public hostname resolving to a private address.
 *
 * AUTHENTICATED — do not add /api/ai/visibility/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import { guardCheckUrl } from "@/lib/bot-analytics/url-guard";
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
    const guarded = guardCheckUrl(parsed.data.url);
    if (!guarded.ok || !guarded.url) {
      return NextResponse.json(
        { error: "That URL cannot be captured.", code: "INVALID_URL", reason: guarded.reason },
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
