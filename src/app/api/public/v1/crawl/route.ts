/**
 * /api/public/v1/crawl — the site crawler over the public API (Phase 3d-A).
 *
 *   POST  start a crawl. Body: the dashboard's start body (url, mode, urls,
 *         renderMode, config — opt-ins, extractors, segments, everything the
 *         Start view sends — saveAsDefault) plus an optional `callbackUrl`
 *         (https only, SSRF-guarded; see src/lib/site-crawler/callback.ts).
 *         Same validation, plan caps, start rate limit and quota as the UI.
 *         `Idempotency-Key` header: one crawl per key per 24 h.
 *         → 202 { crawlId, status, queuePosition, estimatedStart }
 *   GET   ?host=&limit= — the tenant's crawls, newest first (limit ≤ 100,
 *         default 20; host = an exact site). → { crawls: [...] }
 *
 * Auth: Bearer er_api_<id>.<secret> (authenticatePublicRequest — key, scope,
 * paid plan, 60 requests a minute). Tenant-scoped throughout.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatePublicRequest } from "@/lib/api-keys";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { IDEMPOTENCY_KEY_MAX, claimIdempotency, completeIdempotency, releaseIdempotency } from "@/lib/site-crawler/idempotency";
import { listPublicCrawls } from "@/lib/site-crawler/public-api";
import { PublicStartError, acceptCallbackUrl, startViaApi, startedView } from "@/lib/site-crawler/public-start";
import { StartCrawlBodySchema } from "@/lib/site-crawler/start-body";

const PublicStartBodySchema = StartCrawlBodySchema.extend({
  callbackUrl: z.string().trim().max(2048).optional(),
});

async function started(crawlId: string, replayed: boolean) {
  return NextResponse.json({ ...(await startedView(crawlId)), ...(replayed ? { replayed: true } : {}) }, { status: replayed ? 200 : 202 });
}

export async function POST(request: Request) {
  const auth = await authenticatePublicRequest(request);
  if (!auth.ok) return auth.response;

  const raw = await request.text();
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = PublicStartBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", code: "INVALID_REQUEST", issues: parsed.error.issues }, { status: 400 });
  }
  const { callbackUrl: rawCallback, ...body } = parsed.data;
  let callbackUrl: string | null;
  try {
    callbackUrl = acceptCallbackUrl(rawCallback);
  } catch (err) {
    const e = err as PublicStartError;
    return NextResponse.json({ error: "invalid_callback_url", reason: e.reason }, { status: 400 });
  }

  const idemKey = request.headers.get("idempotency-key")?.trim() || null;
  if (idemKey && idemKey.length > IDEMPOTENCY_KEY_MAX) {
    return NextResponse.json({ error: "invalid_idempotency_key" }, { status: 400 });
  }
  if (idemKey) {
    const claim = await claimIdempotency(auth.tenantId, idemKey, raw);
    if (claim.state === "mismatch") return NextResponse.json({ error: "idempotency_key_reused" }, { status: 422 });
    if (claim.state === "pending") return NextResponse.json({ error: "idempotency_in_progress" }, { status: 409 });
    if (claim.state === "done") return started(claim.crawlId, true);
  }

  try {
    const { crawlId } = await startViaApi(auth, body, callbackUrl);
    if (idemKey) await completeIdempotency(auth.tenantId, idemKey, raw, crawlId);
    return started(crawlId, false);
  } catch (err) {
    if (idemKey) await releaseIdempotency(auth.tenantId, idemKey).catch(() => undefined);
    if (err instanceof PublicStartError && err.code === "RATE_LIMITED") {
      return NextResponse.json({ error: err.message, code: "RATE_LIMITED" }, { status: 429 });
    }
    return crawlRouteError(err);
  }
}

export async function GET(request: Request) {
  const auth = await authenticatePublicRequest(request);
  if (!auth.ok) return auth.response;
  const params = new URL(request.url).searchParams;
  const limitRaw = params.get("limit");
  const limit = limitRaw === null ? null : Number.parseInt(limitRaw, 10);
  if (limitRaw !== null && !(Number.isInteger(limit) && limit! >= 1)) return NextResponse.json({ error: "invalid_limit" }, { status: 400 });
  return NextResponse.json({ crawls: await listPublicCrawls(auth.tenantId, { host: params.get("host"), limit }) });
}
