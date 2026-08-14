// src/lib/attribution/keys.ts
//
// PUBLISHABLE site keys for AI Lead Attribution: `er_pub_<24hex>.<48hex>`.
//
// ── Why this is not an er_api_ key ──────────────────────────────────────────
//
// It would have been one line to reuse src/lib/api-keys.ts. We do not, because
// the two keys have opposite threat models and only one of them is a secret:
//
//   er_api_  Bearer, server-side, never leaves the customer's backend. Grants
//            READ access to /api/public/v1/* — keyword suggestions, the latest
//            site audit, the visibility summary. Compromise leaks tenant data.
//   er_pub_  Pasted into a <script src> on a public page. It is in the HTML of
//            every page it measures, visible in view-source to anyone. It grants
//            exactly one verb: append a visit row to its own tenant. Compromise
//            gets an attacker the ability to write junk analytics into the
//            tenant they targeted — which the rate limiter bounds — and nothing
//            else.
//
// Sharing a key class between those would publish a read key on every customer
// page. So: separate prefix, separate table, separate verifier. verifyApiKey()
// cannot see an er_pub_ row and verifyAttributionKey() cannot see an er_api_
// one, and that is a property of the schema rather than of anyone's discipline.
//
// The SHA-256-at-rest and constant-time-confirm pattern is still inherited from
// api-keys.ts. It buys less here (the key is public by construction) but it
// costs nothing and it keeps one habit for both classes. The consequence the UI
// has to live with: we cannot show a key a second time, so the snippet is
// displayed once at mint and rotation is the way to recover it.

import { createHash, randomBytes, timingSafeEqual } from "crypto";

// Prisma and Redis are imported lazily so the pure helpers (parse/format) stay
// importable with no database and no connection — same reason as api-keys.ts.

const KEY_PREFIX = "er_pub_";
const ID_BYTES = 12;
const SECRET_BYTES = 24;

/** Exact wire format. Used to reject junk before it ever reaches Postgres. */
export const ATTRIBUTION_KEY_PATTERN = /^er_pub_[0-9a-f]{24}\.[0-9a-f]{48}$/;

/** How long a resolved key stays cached in Redis. */
const KEY_CACHE_TTL_SECONDS = 300;
/** Negative results are cached too, briefly — a wrong key on a live site
 *  retries on every page view, and each one should not cost a query. */
const KEY_CACHE_NEGATIVE_TTL_SECONDS = 60;
const NEGATIVE_MARKER = "!";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Structural parse. Does NOT prove the key exists. */
export function parseAttributionKey(key: unknown): { idPart: string; secret: string } | null {
  if (typeof key !== "string" || !ATTRIBUTION_KEY_PATTERN.test(key)) return null;
  const body = key.slice(KEY_PREFIX.length);
  const dot = body.indexOf(".");
  return { idPart: body.slice(0, dot), secret: body.slice(dot + 1) };
}

export interface IssuedAttributionKey {
  /** Plaintext key. Shown once; it then lives in the customer's page source. */
  key: string;
  id: string;
  prefix: string;
}

export async function createAttributionKey(
  tenantId: string,
  label: string,
): Promise<IssuedAttributionKey> {
  const { prisma } = await import("@/lib/prisma");
  const idPart = randomBytes(ID_BYTES).toString("hex");
  const secret = randomBytes(SECRET_BYTES).toString("hex");
  const key = `${KEY_PREFIX}${idPart}.${secret}`;
  const row = await prisma.attributionKey.create({
    data: {
      tenantId,
      label: label.trim().slice(0, 120) || "Website",
      keyHash: sha256(secret),
      prefix: idPart.slice(0, 8),
    },
    select: { id: true, prefix: true },
  });
  return { key, id: row.id, prefix: row.prefix };
}

export async function listAttributionKeys(tenantId: string) {
  const { prisma } = await import("@/lib/prisma");
  return prisma.attributionKey.findMany({
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
export async function revokeAttributionKey(tenantId: string, keyId: string): Promise<boolean> {
  const { prisma } = await import("@/lib/prisma");
  const row = await prisma.attributionKey.findFirst({
    where: { id: keyId, tenantId, revokedAt: null },
    select: { id: true, keyHash: true },
  });
  if (!row) return false;
  await prisma.attributionKey.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });
  // The collector caches key→tenant for KEY_CACHE_TTL_SECONDS. Without this the
  // revoked key keeps writing for up to five minutes, which is exactly the
  // window someone revoking a key is trying to close.
  await dropCachedKey(row.keyHash);
  return true;
}

async function cacheRead(hash: string): Promise<string | null> {
  try {
    const { getRedisConnection } = await import("@/infrastructure/redis/connection");
    return await getRedisConnection().get(`attrkey:${hash}`);
  } catch {
    return null;
  }
}

async function cacheWrite(hash: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    const { getRedisConnection } = await import("@/infrastructure/redis/connection");
    await getRedisConnection().set(`attrkey:${hash}`, value, "EX", ttlSeconds);
  } catch {
    /* Redis down: every beacon costs a query instead. Degraded, not broken. */
  }
}

async function dropCachedKey(hash: string): Promise<void> {
  try {
    const { getRedisConnection } = await import("@/infrastructure/redis/connection");
    await getRedisConnection().del(`attrkey:${hash}`);
  } catch {
    /* See cacheWrite. The TTL bounds the staleness regardless. */
  }
}

export interface VerifiedAttributionKey {
  keyId: string;
  tenantId: string;
}

/**
 * Resolve a publishable key to its tenant.
 *
 * Hot path — this runs once per page view across every customer site — so a
 * resolved key is cached in Redis for five minutes. The cache stores only the
 * tenant id against the hash; the hash is not reversible to a key, so the cache
 * is not a place a key can leak from.
 */
export async function verifyAttributionKey(key: unknown): Promise<VerifiedAttributionKey | null> {
  const parsed = parseAttributionKey(key);
  if (!parsed) return null;
  const presentedHash = sha256(parsed.secret);

  const cached = await cacheRead(presentedHash);
  if (cached === NEGATIVE_MARKER) return null;
  if (cached) {
    const [keyId, tenantId] = cached.split(":");
    if (keyId && tenantId) return { keyId, tenantId };
  }

  const { prisma } = await import("@/lib/prisma");
  const row = await prisma.attributionKey.findUnique({
    where: { keyHash: presentedHash },
    select: { id: true, tenantId: true, keyHash: true, revokedAt: true },
  });
  if (!row || row.revokedAt) {
    await cacheWrite(presentedHash, NEGATIVE_MARKER, KEY_CACHE_NEGATIVE_TTL_SECONDS);
    return null;
  }
  const a = Buffer.from(row.keyHash, "hex");
  const b = Buffer.from(presentedHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  await cacheWrite(presentedHash, `${row.id}:${row.tenantId}`, KEY_CACHE_TTL_SECONDS);

  // lastUsedAt rides the cache MISS, not the request. A busy site would
  // otherwise turn one bookkeeping column into a write per page view; on the
  // miss path it is at most one write per key per KEY_CACHE_TTL_SECONDS.
  // Fire-and-forget — a beacon must never wait on this.
  void prisma.attributionKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { keyId: row.id, tenantId: row.tenantId };
}

export const __testing = { sha256, KEY_PREFIX, KEY_CACHE_TTL_SECONDS };
