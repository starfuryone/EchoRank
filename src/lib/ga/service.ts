// DB-aware GA4 service: connection lifecycle, access-token minting with the
// same 401 -> one-retry -> NEEDS_REAUTH contract as lib/gsc/service.ts, and
// the cached five-panel report build.
//
// Token crypto is REUSED from lib/gsc/crypto.ts rather than duplicated: same
// key, same v1:<iv>:<tag>:<ciphertext> format, one implementation to audit.

import { prisma } from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/gsc/crypto";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import {
  GaReauthError,
  listProperties,
  mintAccessToken,
  type GaProperty,
} from "./client";
import {
  buildChannels,
  buildHeadline,
  buildPages,
  buildReferrers,
  buildTraffic,
} from "./reports";
import {
  REPORT_CACHE_TTL_SECONDS,
  windowsFor,
  type GaRange,
} from "./options";
import type { GaReport } from "./types";
import type { GaConnection } from "@/generated/prisma";

export async function getConnection(tenantId: string): Promise<GaConnection | null> {
  return prisma.gaConnection.findUnique({ where: { tenantId } });
}

export async function saveConnection(params: {
  tenantId: string;
  refreshToken: string;
  propertyId: string | null;
  propertyName: string | null;
}): Promise<void> {
  const refreshTokenEnc = encryptToken(params.refreshToken);
  await prisma.gaConnection.upsert({
    where: { tenantId: params.tenantId },
    update: {
      refreshTokenEnc,
      propertyId: params.propertyId,
      propertyName: params.propertyName,
      status: "ACTIVE",
      connectedAt: new Date(),
    },
    create: {
      tenantId: params.tenantId,
      refreshTokenEnc,
      propertyId: params.propertyId,
      propertyName: params.propertyName,
    },
  });
}

export async function selectProperty(
  tenantId: string,
  propertyId: string,
  propertyName: string,
): Promise<void> {
  await prisma.gaConnection.update({
    where: { tenantId },
    data: { propertyId, propertyName },
  });
  // Reports are keyed by property, but clearing on switch avoids showing the
  // previous property's cached numbers under the new property's name.
  await clearReportCache(tenantId);
}

/** Deletes the connection, and with it the encrypted token. */
export async function disconnect(tenantId: string): Promise<void> {
  await prisma.gaConnection.deleteMany({ where: { tenantId } });
  await clearReportCache(tenantId);
}

async function markNeedsReauth(tenantId: string): Promise<void> {
  await prisma.gaConnection
    .updateMany({ where: { tenantId }, data: { status: "NEEDS_REAUTH" } })
    .catch(() => {});
}

/**
 * Runs `fn` with a freshly minted access token. On a 401 from the API, mints
 * once more and retries once; a dead refresh token (invalid_grant) marks the
 * connection NEEDS_REAUTH and rethrows GaReauthError.
 */
export async function withAccessToken<T>(
  conn: GaConnection,
  fn: (accessToken: string) => Promise<T>,
): Promise<T> {
  const refreshToken = decryptToken(conn.refreshTokenEnc);
  try {
    const token = await mintAccessToken(refreshToken);
    try {
      return await fn(token);
    } catch (err) {
      if (!(err instanceof GaReauthError)) throw err;
      const retryToken = await mintAccessToken(refreshToken);
      return await fn(retryToken);
    }
  } catch (err) {
    if (err instanceof GaReauthError) await markNeedsReauth(conn.tenantId);
    throw err;
  }
}

export async function listPropertiesFor(conn: GaConnection): Promise<GaProperty[]> {
  return withAccessToken(conn, (t) => listProperties(t));
}

// ─── Report cache ───────────────────────────────────────────────────────────

/**
 * Keyed by tenant AND property AND range: switching either must not serve the
 * other's numbers. The tenant prefix also makes the whole cache droppable on
 * disconnect with one SCAN.
 */
function cacheKey(tenantId: string, propertyId: string, range: GaRange): string {
  return `echorank:ga:report:${tenantId}:${propertyId}:${range}`;
}

async function clearReportCache(tenantId: string): Promise<void> {
  try {
    const redis = getRedisConnection();
    const pattern = `echorank:ga:report:${tenantId}:*`;
    // SCAN, not KEYS: KEYS blocks Redis for the whole keyspace scan and this
    // runs on a user action.
    let cursor = "0";
    do {
      const [next, keys] = (await redis.scan(cursor, "MATCH", pattern, "COUNT", 100)) as [
        string,
        string[],
      ];
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== "0");
  } catch {
    // A stale cache entry expires within the hour anyway; never turn a cache
    // cleanup failure into a failed disconnect.
  }
}

async function readCache(key: string): Promise<GaReport | null> {
  try {
    const raw = await getRedisConnection().get(key);
    return raw ? (JSON.parse(raw) as GaReport) : null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, report: GaReport): Promise<void> {
  try {
    await getRedisConnection().set(key, JSON.stringify(report), "EX", REPORT_CACHE_TTL_SECONDS);
  } catch {
    // Cache is an optimisation; a write failure must not fail the request.
  }
}

// ─── Report build ───────────────────────────────────────────────────────────

export class GaNoPropertyError extends Error {
  readonly statusCode = 400;
  constructor() {
    super("No Analytics property selected");
    this.name = "GaNoPropertyError";
  }
}

/**
 * The five panels for one range, from cache when warm.
 *
 * Panels run concurrently on ONE access token: they are independent GA4 reads
 * and the serial version would make a 90-day load feel broken.
 */
export async function getReport(
  conn: GaConnection,
  range: GaRange,
  opts?: { force?: boolean; now?: Date },
): Promise<GaReport> {
  if (!conn.propertyId) throw new GaNoPropertyError();
  const propertyId = conn.propertyId;
  const key = cacheKey(conn.tenantId, propertyId, range);

  if (!opts?.force) {
    const cached = await readCache(key);
    if (cached) return { ...cached, cached: true };
  }

  const { current, previous } = windowsFor(range, opts?.now ?? new Date());

  const report = await withAccessToken(conn, async (token) => {
    const [headline, traffic, channels, pages, referrers] = await Promise.all([
      buildHeadline(token, propertyId, current, previous),
      buildTraffic(token, propertyId, current),
      buildChannels(token, propertyId, current),
      buildPages(token, propertyId, current),
      buildReferrers(token, propertyId, current),
    ]);

    // "Empty" means the property genuinely has no traffic in the window — a
    // real state for a new property, and different from a failed load.
    const empty =
      traffic.every((point) => point.sessions === 0) &&
      channels.length === 0 &&
      pages.length === 0;

    return {
      propertyId,
      propertyName: conn.propertyName,
      range,
      startDate: current.startDate,
      endDate: current.endDate,
      previousStartDate: previous.startDate,
      previousEndDate: previous.endDate,
      headline,
      traffic,
      channels,
      pages,
      referrers,
      empty,
      generatedAt: new Date().toISOString(),
    } satisfies GaReport;
  });

  await writeCache(key, report);
  return report;
}
