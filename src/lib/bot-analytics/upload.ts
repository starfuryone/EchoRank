// src/lib/bot-analytics/upload.ts
//
// Reading an uploaded access log safely, and the per-plan upload allowance.
//
// The interesting part is the gzip guard. A 50MB cap on the UPLOAD says nothing
// about the cost of decompressing it: gzip reaches ratios past 1000:1 on
// repetitive input, and access logs are extremely repetitive, so a well-formed
// 40MB .gz can expand to tens of gigabytes. Piping it straight into a string is
// how a worker gets OOM-killed by a file that passed every check. So we count
// bytes as they come out and abort the stream the moment the total crosses the
// ceiling — the guard is on the OUTPUT, which is the number that can hurt us.

import { createGunzip } from "node:zlib";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import type { PlanType } from "@/generated/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";

/** Upload size ceiling, matching the copy in the dropzone hint. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Decompressed ceiling. Past this the file is refused, not truncated. */
export const MAX_DECOMPRESSED_BYTES = 200 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = [".log", ".txt", ".gz"] as const;

/**
 * Monthly upload allowance. STARTER is absent on purpose — it has no access to
 * this half at all and sees an upsell card instead, so there is no number to
 * enforce. AI_VISIBILITY sits below STARTER by price and likewise gets none.
 */
const UPLOADS_PER_MONTH: Partial<Record<PlanType, number>> = {
  GROWTH: 5,
  AGENCY: 20,
  ENTERPRISE: 20,
};

export function uploadLimit(plan: PlanType): number {
  return UPLOADS_PER_MONTH[plan] ?? 0;
}

export function canUploadLogs(plan: PlanType): boolean {
  return uploadLimit(plan) > 0;
}

export function hasAllowedExtension(filename: string): boolean {
  const lower = (filename ?? "").toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isGzip(filename: string): boolean {
  return (filename ?? "").toLowerCase().endsWith(".gz");
}

export class DecompressionLimitError extends Error {
  readonly statusCode = 413;
  constructor() {
    super("Decompressed log exceeds the size limit");
    this.name = "DecompressionLimitError";
  }
}

/**
 * Reads a file from disk into a string, gunzipping when needed, refusing to
 * exceed MAX_DECOMPRESSED_BYTES.
 *
 * Content is only ever concatenated as text. It is never executed, evaluated,
 * passed to a shell, or used as a path.
 */
export async function readLogFile(path: string, gzipped: boolean): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;

  const sink = new Writable({
    write(chunk: Buffer, _enc, cb) {
      total += chunk.length;
      if (total > MAX_DECOMPRESSED_BYTES) {
        // Destroying the sink propagates back through the gunzip stream, so the
        // decompressor stops doing work rather than finishing into a void.
        cb(new DecompressionLimitError());
        return;
      }
      chunks.push(chunk);
      cb();
    },
  });

  const source = createReadStream(path);
  if (gzipped) {
    await pipeline(source, createGunzip(), sink);
  } else {
    await pipeline(source, sink);
  }

  return Buffer.concat(chunks).toString("utf8");
}

// ─── Monthly upload cap ─────────────────────────────────────────────────────

const KEY_TTL_SECONDS = 40 * 24 * 60 * 60;

export function uploadMonthKey(now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

export function uploadQuotaKey(tenantId: string, now = new Date()): string {
  return `echorank:bot-analytics:uploads:${tenantId}:${uploadMonthKey(now)}`;
}

export class UploadQuotaUnavailableError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("Upload quota is temporarily unavailable");
    this.name = "UploadQuotaUnavailableError";
  }
}

export interface UploadQuotaDecision {
  allowed: boolean;
  used: number;
  limit: number;
}

/**
 * Reserves one upload. INCR-then-rollback, same as the access-check cap: reading
 * before writing races two concurrent uploads past the last slot.
 *
 * Fails closed — parsing a log costs a worker slot and real memory, so an
 * unenforced allowance is the worse failure.
 */
export async function reserveUpload(
  tenantId: string,
  plan: PlanType,
  now = new Date(),
): Promise<UploadQuotaDecision> {
  const limit = uploadLimit(plan);
  if (limit <= 0) return { allowed: false, used: 0, limit: 0 };

  const key = uploadQuotaKey(tenantId, now);
  let used: number;
  try {
    const redis = getRedisConnection();
    used = await redis.incr(key);
    await redis.expire(key, KEY_TTL_SECONDS);
  } catch {
    throw new UploadQuotaUnavailableError();
  }

  if (used > limit) {
    try {
      await getRedisConnection().decr(key);
    } catch {
      // Best-effort; the counter self-heals at the month boundary.
    }
    return { allowed: false, used: limit, limit };
  }
  return { allowed: true, used, limit };
}

/** Give a reserved upload back (nothing was queued). */
export async function releaseUpload(tenantId: string, now = new Date()): Promise<void> {
  try {
    await getRedisConnection().decr(uploadQuotaKey(tenantId, now));
  } catch {
    // Best-effort.
  }
}

export async function uploadsUsed(tenantId: string, now = new Date()): Promise<number> {
  try {
    const raw = await getRedisConnection().get(uploadQuotaKey(tenantId, now));
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}
