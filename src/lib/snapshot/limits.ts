// src/lib/snapshot/limits.ts
//
// Who may start a NEW check. Each one spends real money on two paid search
// APIs, so the order is fixed (POST /api/free/v1/snapshot):
//   1. input + blocklist      — free, refuse junk before anything else;
//   2. Turnstile              — one network call, no spend;
//   3. 7-day domain cache     — a hit is served to anyone, costs nothing and
//                               counts against no allowance;
//   4. per-IP allowance       — 3 NEW runs per IP per UTC day;
//   5. per-domain start lock  — two visitors racing on one domain get one run.
//
// UNLIKE THE FREE AUDIT, REDIS DOWN FAILS CLOSED. That one calls no paid API,
// so letting it through protected nothing billable; this one is nothing but
// paid API calls.
import "server-only";

import { createHash } from "node:crypto";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { utcDay } from "@/infrastructure/queue/job-id";
import { normalizeDomain } from "./match";

export const RUNS_PER_IP_PER_DAY = 3;
const DAY_S = 86_400;
const LOCK_S = 120;

export function hashIp(ip: string): string {
  const salt = process.env.SNAPSHOT_IP_SALT ?? process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

const ipKey = (ipHash: string, now: Date) => `echorank:snapshot:ip:${utcDay(now)}:${ipHash}`;
const lockKey = (domain: string) => `echorank:snapshot:lock:${domain}`;

export type LimitOutcome = "ok" | "limited" | "unavailable";

/** Count one new run against the IP; "limited" past the allowance (the count is not kept). */
export async function takeIpAllowance(ipHash: string, now = new Date()): Promise<LimitOutcome> {
  try {
    const redis = getRedisConnection();
    const k = ipKey(ipHash, now);
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, DAY_S + 3600);
    if (n > RUNS_PER_IP_PER_DAY) {
      await redis.decr(k);
      return "limited";
    }
    return "ok";
  } catch (err) {
    console.error("[snapshot] IP allowance check failed, refusing", err);
    return "unavailable";
  }
}

/** Give the allowance back when the run could not be started after all. */
export async function refundIpAllowance(ipHash: string, now = new Date()): Promise<void> {
  try {
    await getRedisConnection().decr(ipKey(ipHash, now));
  } catch {
    // The visitor loses one of three runs for the day; not worth failing over.
  }
}

/** True when this caller now holds the domain's start lock. */
export async function lockDomain(domain: string): Promise<boolean> {
  try {
    return (await getRedisConnection().set(lockKey(domain), "1", "EX", LOCK_S, "NX")) === "OK";
  } catch {
    return false;
  }
}

export async function unlockDomain(domain: string): Promise<void> {
  await getRedisConnection()
    .del(lockKey(domain))
    .catch(() => undefined);
}

// ─── Blocklist ──────────────────────────────────────────────────────────────

/** Hosts that are not a business website. */
const BLOCKED_HOST = [
  /^localhost$/,
  /\.(local|internal|lan|home|test|example|invalid|onion)$/,
  /^\d+\.\d+\.\d+\.\d+$/,
];

/** Terms that mark a submission as abuse, matched on word boundaries in brand, domain and category. */
const BLOCKED_TERMS = [
  "porn", "xxx", "escort", "escorts", "camgirl", "onlyfans", "viagra", "cialis", "carding", "cvv", "fullz",
];

export type BlockReason = "invalid_domain" | "blocked";

/** Null when the input may be checked. SNAPSHOT_BLOCKLIST adds comma-separated domains or terms. */
export function blockReason(input: { brand: string; domain: string; category: string; city?: string | null }): BlockReason | null {
  const domain = normalizeDomain(input.domain);
  if (!domain || BLOCKED_HOST.some((re) => re.test(domain))) return "invalid_domain";
  const extra = (process.env.SNAPSHOT_BLOCKLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (extra.some((d) => d.includes(".") && (domain === d || domain.endsWith(`.${d}`)))) return "blocked";
  const words = new Set(
    `${input.brand} ${domain} ${input.category} ${input.city ?? ""}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
  );
  const terms = [...BLOCKED_TERMS, ...extra.filter((t) => !t.includes("."))];
  if (terms.some((t) => words.has(t))) return "blocked";
  // Text fields carry a name, not instructions or links.
  if ([input.brand, input.category, input.city ?? ""].some((f) => /https?:|www\.|[<>{}`]/i.test(f))) return "blocked";
  return null;
}

/** The prefill fetch is free but anonymous: 30 per IP per day keeps it from being a public fetcher. */
export const PREFILLS_PER_IP_PER_DAY = 30;

export async function takePrefillAllowance(ipHash: string, now = new Date()): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    const k = `echorank:snapshot:prefill:${utcDay(now)}:${ipHash}`;
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, DAY_S + 3600);
    return n <= PREFILLS_PER_IP_PER_DAY;
  } catch {
    return false;
  }
}
