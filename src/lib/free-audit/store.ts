// src/lib/free-audit/store.ts — what a free AI Readiness Audit leaves behind
// (ECHORANK-AI-VISIBILITY-PAGES.md Phase 2, owner's decision of 2026-11-10):
//
//   - the full result in Redis for FREE_AUDIT_RESULT_DAYS, under an
//     unguessable id, for the permalink /free-audit/r/{id} and the emailed PDF;
//   - one score-only row in Postgres (score, scoreVersion, time: no domain, no
//     IP) for the benchmark.
//
// Both writes are fail-open: a visitor whose audit ran gets the result even
// when the permalink or the benchmark row could not be written (the result
// then simply has no permalink).

import "server-only";

import { randomBytes } from "node:crypto";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { logger } from "@/infrastructure/observability/logger";
import { prisma } from "@/lib/prisma";
import { FREE_AUDIT_RESULT_DAYS, RESULT_ID_RE } from "./limits";

const TTL_SECONDS = FREE_AUDIT_RESULT_DAYS * 24 * 60 * 60;
/** A stored result is the sidecar's serialized audit; this caps a pathological one. */
const MAX_RESULT_BYTES = 200 * 1024;

export function resultKey(id: string): string {
  return `echorank:free-audit:result:${id}`;
}

export function newResultId(): string {
  return randomBytes(18).toString("base64url");
}

export interface StoredResult {
  id: string;
  createdAt: string;
  expiresAt: string;
  audit: Record<string, unknown>;
}

/** Store the result for the permalink. Returns its id and expiry, or null when it could not be stored. */
export async function saveResult(audit: Record<string, unknown>, now = new Date()): Promise<{ id: string; expiresAt: string } | null> {
  const id = newResultId();
  const expiresAt = new Date(now.getTime() + TTL_SECONDS * 1000).toISOString();
  const value = JSON.stringify({ id, createdAt: now.toISOString(), expiresAt, audit } satisfies StoredResult);
  if (Buffer.byteLength(value, "utf8") > MAX_RESULT_BYTES) {
    logger.warn({ bytes: Buffer.byteLength(value, "utf8") }, "free audit: result too large for a permalink");
    return null;
  }
  try {
    await getRedisConnection().set(resultKey(id), value, "EX", TTL_SECONDS);
    return { id, expiresAt };
  } catch (err) {
    logger.warn({ err }, "free audit: result not stored (no permalink)");
    return null;
  }
}

/** The stored result, or null when the id is malformed, unknown or past its 7 days. */
export async function getResult(id: string): Promise<StoredResult | null> {
  if (!RESULT_ID_RE.test(id)) return null;
  try {
    const raw = await getRedisConnection().get(resultKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredResult;
    // Redis expires the key; this guards a key whose TTL was lost.
    if (Date.parse(parsed.expiresAt) <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** One score-only benchmark row. Never throws. */
export async function recordScore(score: number, scoreVersion: number): Promise<void> {
  if (!Number.isInteger(score) || score < 0 || score > 100 || !Number.isInteger(scoreVersion)) return;
  try {
    await prisma.freeAuditScore.create({ data: { score, scoreVersion } });
  } catch (err) {
    logger.warn({ err }, "free audit: benchmark row not written");
  }
}
