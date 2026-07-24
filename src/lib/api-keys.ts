import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { hasPaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";

// Prisma is imported lazily inside each function so the pure helpers
// (parse/sha256/format) stay importable in DB-less contexts (node --test).

/**
 * Tenant public-API keys (SEO Tools "API access") for /api/public/v1/*.
 *
 * Mirrors the extension-token design (src/lib/extension-token.ts): opaque
 * bearer keys, SHA-256 of the secret at rest, constant-time confirm, instant
 * revocation, lazy lastUsedAt. Never log a full key anywhere.
 *
 * Wire format:  er_api_<24-hex-id>.<48-hex-secret>
 *   - id segment is public; its first 8 chars become `prefix` for the UI
 *   - only the secret segment's hash is persisted
 */

const KEY_PREFIX = "er_api_";
const ID_BYTES = 12;
const SECRET_BYTES = 24;

/** Per-key request budget for the public API (requests / minute). */
export const PUBLIC_API_RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function parse(key: string): { idPart: string; secret: string } | null {
  if (typeof key !== "string" || !key.startsWith(KEY_PREFIX)) return null;
  const body = key.slice(KEY_PREFIX.length);
  const dot = body.indexOf(".");
  if (dot <= 0 || dot >= body.length - 1) return null;
  const idPart = body.slice(0, dot);
  const secret = body.slice(dot + 1);
  if (!/^[0-9a-f]+$/.test(idPart) || !/^[0-9a-f]+$/.test(secret)) return null;
  return { idPart, secret };
}

export interface IssuedApiKey {
  /** Plaintext key — shown to the user exactly once. */
  key: string;
  id: string;
  prefix: string;
}

export async function createApiKey(tenantId: string, label: string): Promise<IssuedApiKey> {
  const { prisma } = await import("@/lib/prisma");
  const idPart = randomBytes(ID_BYTES).toString("hex");
  const secret = randomBytes(SECRET_BYTES).toString("hex");
  const key = `${KEY_PREFIX}${idPart}.${secret}`;
  const row = await prisma.apiKey.create({
    data: {
      tenantId,
      label: label.trim().slice(0, 120) || "API key",
      keyHash: sha256(secret),
      prefix: idPart.slice(0, 8),
    },
    select: { id: true, prefix: true },
  });
  return { key, id: row.id, prefix: row.prefix };
}

export async function listApiKeys(tenantId: string) {
  const { prisma } = await import("@/lib/prisma");
  return prisma.apiKey.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      prefix: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });
}

/** Revoke (idempotent), scoped to the owning tenant. */
export async function revokeApiKey(tenantId: string, keyId: string): Promise<boolean> {
  const { prisma } = await import("@/lib/prisma");
  const res = await prisma.apiKey.updateMany({
    where: { id: keyId, tenantId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

export interface VerifiedApiKey {
  keyId: string;
  tenantId: string;
}

export async function verifyApiKey(key: string): Promise<VerifiedApiKey | null> {
  const { prisma } = await import("@/lib/prisma");
  const parsed = parse(key);
  if (!parsed) return null;
  const presentedHash = sha256(parsed.secret);
  const row = await prisma.apiKey.findUnique({
    where: { keyHash: presentedHash },
    select: { id: true, tenantId: true, keyHash: true, revokedAt: true },
  });
  if (!row) return null;
  const a = Buffer.from(row.keyHash, "hex");
  const b = Buffer.from(presentedHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (row.revokedAt) return null;
  void prisma.apiKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return { keyId: row.id, tenantId: row.tenantId };
}

export type PublicAuthResult =
  | { ok: true; tenantId: string; keyId: string }
  | { ok: false; response: NextResponse };

/**
 * Full auth pipeline for /api/public/v1/*: Bearer key → tenant, paid-plan
 * check (parity with the in-app SEO Tools gate), per-key rate limit (Redis
 * sliding window via the repo's limiter, in-memory fallback).
 */
export async function authenticatePublicRequest(req: Request): Promise<PublicAuthResult> {
  const header = req.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!key) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "missing_bearer_key" },
        { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
      ),
    };
  }
  const verified = await verifyApiKey(key);
  if (!verified) {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid_or_revoked_key" }, { status: 401 }),
    };
  }
  if (!(await hasPaidPlan(verified.tenantId))) {
    return {
      ok: false,
      response: NextResponse.json({ error: "subscription_inactive" }, { status: 403 }),
    };
  }
  const rl = await rateLimit(`apikey:${verified.keyId}`, PUBLIC_API_RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: "rate_limited" }, { status: 429 }),
    };
  }
  return { ok: true, tenantId: verified.tenantId, keyId: verified.keyId };
}

export const __testing = { sha256, parse, KEY_PREFIX };
