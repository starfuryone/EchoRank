import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyExtensionToken } from "@/lib/extension-token";
import { addJob } from "@/infrastructure/queue/registry";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import { generateCorrelationId } from "@/infrastructure/observability/tracing";
import { logger } from "@/infrastructure/observability/logger";
import { createAuditLog } from "@/lib/audit";
import {
  extensionImportSchema,
  type ExtensionPlatform,
} from "@/monitoring/import/extension-schema";
import type { MonitoringPlatform } from "@/generated/prisma";

/**
 * POST /api/extension/import
 *
 * Bearer-authenticated ingest endpoint for the browser extension. Extension
 * input is UNTRUSTED: the request only authenticates, validates, rate-limits,
 * enforces idempotency, and STAGES the batch. All review shaping (ids, dedup
 * keys, rating clamping, sanitization) happens server-side in the worker.
 *
 * Security hardening (vs the naive first pass):
 *  - CORS reflected from an allowlist, never `*`. (The service worker POSTs
 *    under host_permissions and is not CORS-bound anyway; this is defense in
 *    depth for the content-script path.)
 *  - Two-dimension rate limit: requests/min AND reviews/min per token.
 *  - Idempotency enforced via X-Idempotency-Key / batchId (Redis SET NX); a
 *    retried batch returns the original importId instead of re-ingesting.
 */

const PLATFORM_LABELS: Record<ExtensionPlatform, string> = {
  GOOGLE: "Google",
  FACEBOOK: "Facebook",
  TRUSTPILOT: "Trustpilot",
};

// ── Limits (overridable via env) ────────────────────────────────────────────
const RATE_REQUESTS_MAX = Number(process.env.EXTENSION_RATE_REQUESTS ?? 12); // per window
const RATE_REVIEWS_MAX = Number(process.env.EXTENSION_RATE_REVIEWS ?? 1500); // per window
const RATE_WINDOW_SEC = Number(process.env.EXTENSION_RATE_WINDOW_SEC ?? 60);
const MAX_BODY_BYTES = 1_048_576; // 1MB
const IDEMPOTENCY_TTL_SEC = 86_400;

// ── CORS allowlist ──────────────────────────────────────────────────────────
function appOrigin(): string {
  try {
    return new URL(process.env.AUTH_URL ?? "https://echorank360.com").origin;
  } catch {
    return "https://echorank360.com";
  }
}
function allowedOrigins(): Set<string> {
  const fromEnv = (process.env.EXTENSION_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set<string>([appOrigin(), ...fromEnv]);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Idempotency-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  // Reflect ONLY an allowlisted origin. chrome-extension://<id> origins must be
  // added to EXTENSION_ALLOWED_ORIGINS (the packed extension id is stable).
  if (origin && allowedOrigins().has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(body: unknown, status: number, origin: string | null): NextResponse {
  return NextResponse.json(body, { status, headers: corsHeaders(origin) });
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

// ── Rate limiting (requests + review budget) ─────────────────────────────────
async function checkRequestRate(tokenId: string): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    const key = `${REDIS_CONFIG.namespace}ratelimit:ext-req:${tokenId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_WINDOW_SEC);
    return count > RATE_REQUESTS_MAX;
  } catch (err) {
    logger.warn({ err }, "extension request rate-limiter unavailable; allowing");
    return false;
  }
}
async function checkReviewBudget(tokenId: string, n: number): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    const key = `${REDIS_CONFIG.namespace}ratelimit:ext-reviews:${tokenId}`;
    const total = await redis.incrby(key, n);
    if (total === n) await redis.expire(key, RATE_WINDOW_SEC);
    return total > RATE_REVIEWS_MAX;
  } catch (err) {
    logger.warn({ err }, "extension review-budget limiter unavailable; allowing");
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  const correlationId = generateCorrelationId();

  // ── 1. Bearer auth ────────────────────────────────────────────────────────
  const authz = request.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!token) return json({ error: "Missing bearer token" }, 401, origin);

  const verified = await verifyExtensionToken(token);
  if (!verified) return json({ error: "Invalid or revoked token" }, 401, origin);
  const { tenantId, userId, tokenId } = verified;

  // ── 2. Cheap per-request flood guard (before parsing the body) ────────────
  if (await checkRequestRate(tokenId)) {
    return json({ error: "Too many requests; slow down" }, 429, origin);
  }

  // ── 3. Body size + parse ──────────────────────────────────────────────────
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413, origin);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Malformed JSON" }, 400, origin);
  }

  // ── 4. Validate (zod, .strict, https-only urls, length caps) ──────────────
  const parsed = extensionImportSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Validation failed", details: parsed.error.flatten() }, 400, origin);
  }
  const { platform, pageUrl, businessName, reviews, batchId } = parsed.data;

  // ── 5. Idempotency (enforced) ─────────────────────────────────────────────
  const idemKey = (request.headers.get("x-idempotency-key") ?? batchId ?? "").trim();
  if (!idemKey || idemKey.length > 128) {
    return json(
      { error: "Idempotency key required (X-Idempotency-Key header or batchId)" },
      400,
      origin,
    );
  }
  const idemRedisKey = `${REDIS_CONFIG.namespace}idem:ext:${tokenId}:${idemKey}`;
  let idemAcquired = false;
  try {
    const redis = getRedisConnection();
    const res = await redis.set(idemRedisKey, "pending", "EX", IDEMPOTENCY_TTL_SEC, "NX");
    idemAcquired = res === "OK";
    if (!idemAcquired) {
      const prior = await redis.get(idemRedisKey);
      if (prior && prior !== "pending") {
        // Replay of a completed submission — return the original result.
        return json(
          { data: { importId: prior, status: "QUEUED", received: reviews.length, idempotent: true } },
          200,
          origin,
        );
      }
      // A concurrent identical batch is still in flight.
      return json({ error: "Duplicate batch already being processed" }, 409, origin);
    }
  } catch (err) {
    // Idempotency store down: proceed (fail open) but log; review-level dedup
    // downstream still prevents duplicate ExternalReview rows.
    logger.warn({ err, correlationId }, "extension idempotency store unavailable; proceeding");
  }

  // ── 6. Review-count budget (now that batch size is known) ─────────────────
  if (await checkReviewBudget(tokenId, reviews.length)) {
    if (idemAcquired) await getRedisConnection().del(idemRedisKey).catch(() => {});
    return json({ error: "Review import budget exceeded; slow down" }, 429, origin);
  }

  try {
    // ── 7. Upsert synthetic per-(tenant,platform) extension source ──────────
    const EXTERNAL_ID = "extension-import";
    const sourceName = `Extension Import (${PLATFORM_LABELS[platform]})`;
    const source = await prisma.monitoringSource.upsert({
      where: {
        tenantId_platform_externalId: {
          tenantId,
          platform: platform as MonitoringPlatform,
          externalId: EXTERNAL_ID,
        },
      },
      update: { name: sourceName, isActive: true, url: pageUrl },
      create: {
        tenantId,
        platform: platform as MonitoringPlatform,
        externalId: EXTERNAL_ID,
        name: sourceName,
        url: pageUrl,
        credentials: {},
        checkInterval: 86_400,
        isActive: true,
      },
    });

    // ── 8. Stage as ImportJob; worker shapes + ingests ──────────────────────
    const importJob = await prisma.importJob.create({
      data: {
        tenantId,
        sourceId: source.id,
        filename: businessName?.trim()
          ? `${businessName.trim()} — ${PLATFORM_LABELS[platform]} (extension)`
          : `${PLATFORM_LABELS[platform]} extension import`,
        format: "EXTENSION",
        platform: platform as MonitoringPlatform,
        status: "QUEUED",
        hasHeaderRow: false,
        rawContent: JSON.stringify({ platform, pageUrl, reviews }),
        totalRows: reviews.length,
        createdById: userId,
      },
      select: { id: true },
    });

    // Record the import id against the idempotency key for replay.
    if (idemAcquired) {
      await getRedisConnection()
        .set(idemRedisKey, importJob.id, "EX", IDEMPOTENCY_TTL_SEC)
        .catch(() => {});
    }

    await addJob("extension-import", "import", {
      tenantId,
      importJobId: importJob.id,
      correlationId,
    });

    await createAuditLog({
      tenantId,
      userId,
      action: "CREATE",
      entity: "ImportJob",
      entityId: importJob.id,
      details: { platform, source: "extension", received: reviews.length, pageUrl, idemKey },
    });

    logger.info(
      { tenantId, importJobId: importJob.id, platform, received: reviews.length, correlationId },
      "extension import accepted",
    );

    return json(
      { data: { importId: importJob.id, status: "QUEUED", received: reviews.length } },
      202,
      origin,
    );
  } catch (err) {
    if (idemAcquired) await getRedisConnection().del(idemRedisKey).catch(() => {});
    logger.error({ err, tenantId, correlationId }, "extension import failed");
    const message = err instanceof Error ? err.message : "Internal server error";
    return json({ error: message }, 500, origin);
  }
}

export const dynamic = "force-dynamic";
