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
 *
 * Auth: Bearer er_api_<id>.<secret> (authenticatePublicRequest — key, scope,
 * paid plan, 60 requests a minute). Tenant-scoped throughout.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatePublicRequest } from "@/lib/api-keys";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import type { PlanType } from "@/generated/prisma";
import { checkCallbackUrl } from "@/lib/site-crawler/callback";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { IDEMPOTENCY_KEY_MAX, claimIdempotency, completeIdempotency, releaseIdempotency } from "@/lib/site-crawler/idempotency";
import { queueEstimate } from "@/lib/site-crawler/public-api";
import { startCrawl } from "@/lib/site-crawler/service";
import { START_RATE_LIMIT, START_RATE_WINDOW_MS, StartCrawlBodySchema, startRateKey } from "@/lib/site-crawler/start-body";

const PublicStartBodySchema = StartCrawlBodySchema.extend({
  callbackUrl: z.string().trim().max(2048).optional(),
});

async function started(crawlId: string, replayed: boolean) {
  const row = await prisma.crawlJob.findUnique({ where: { id: crawlId }, select: { id: true, status: true, createdAt: true, startedAt: true } });
  const estimate = row ? await queueEstimate(row) : { queuePosition: null, estimatedStart: null };
  return NextResponse.json(
    { crawlId, status: row?.status.toLowerCase() ?? "queued", ...estimate, ...(replayed ? { replayed: true } : {}) },
    { status: replayed ? 200 : 202 },
  );
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
  let callbackUrl: string | null = null;
  if (rawCallback) {
    const checked = checkCallbackUrl(rawCallback);
    if (!checked.ok) return NextResponse.json({ error: "invalid_callback_url", reason: checked.reason }, { status: 400 });
    callbackUrl = checked.url;
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
    const tenant = await prisma.tenant.findUnique({ where: { id: auth.tenantId }, select: { planType: true } });
    if (!tenant) throw new Error("tenant not found");
    const limited = await rateLimit(startRateKey(auth.tenantId), START_RATE_LIMIT, START_RATE_WINDOW_MS);
    if (!limited.success) {
      if (idemKey) await releaseIdempotency(auth.tenantId, idemKey);
      return NextResponse.json({ error: "Too many crawls in a row. Wait a minute.", code: "RATE_LIMITED" }, { status: 429 });
    }
    const job = await startCrawl(auth.tenantId, tenant.planType as PlanType, body.url, body.renderMode, {
      config: body.config,
      saveAsDefault: body.saveAsDefault,
      mode: body.mode,
      urls: body.urls,
      api: { apiKeyId: auth.keyId, callbackUrl },
    });
    if (idemKey) await completeIdempotency(auth.tenantId, idemKey, raw, job.id);
    return started(job.id, false);
  } catch (err) {
    if (idemKey) await releaseIdempotency(auth.tenantId, idemKey).catch(() => undefined);
    return crawlRouteError(err);
  }
}
