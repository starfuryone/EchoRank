// src/lib/purchase-archive/reuse.ts — reuse before re-buying
// (ECHORANK-DATA-ARCHIVE.md Phase 2).
//
// Before a paid DataForSEO live call, look in purchase_archive for the same
// provider + endpoint + request hash stored inside that endpoint's freshness
// window; on a hit, read the object from the bucket and serve its envelope
// instead of buying again.
//
// ── WHERE IT SITS ──────────────────────────────────────────────────────────
// Inside the metered call (dataforseo/client.ts meteredCallResult, and the
// Keyword Opportunity meter), i.e. BEHIND every hot cache: the tools check
// their own 24 h cache and the shared Spaces cache before they reserve an
// allowance or reach the metered call, so a cache hit never gets here and
// pays no extra latency. A lookup is one indexed query; a hit adds one GET.
//
// ── QUOTAS: UNCHANGED ──────────────────────────────────────────────────────
// Today a cache hit is served before any allowance is reserved and consumes
// none. An archive hit happens after the tool has already reserved its
// allowance (it is inside the call that allowance was reserved for), so to the
// tenant it is exactly a purchase: the same allowance, the same SeoApiCall row
// (ok, resultAt set) counted by the pooled search quota — at costUsd 0, so it
// never draws on the USD cap. Neither cache policy changes.
//
// ── FRESHNESS ──────────────────────────────────────────────────────────────
// Days per endpoint-slug prefix; the longest matching prefix wins; no match is
// 0 (never reused). Defaults from the brief: SERP 1, Labs and Keywords Data
// 30, Backlinks 7, LLM answers 0. PURCHASE_ARCHIVE_TTL_DAYS_JSON overrides or
// adds prefixes, per provider ({"dataforseo": {"serp-": 0}}) or for all
// providers at once ({"content_analysis-": 7}).
//
// Standard-queue (task_post) purchases are not reused: their result is read
// later by the queue drain, not returned by the call. Fails open: any error is
// a miss and the purchase goes ahead.

import "server-only";

import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import type { Readable } from "node:stream";
import { canonicalJson, endpointSlug, requestHash } from "./core";
import { PROVIDERS, purchaseArchiveEnabled } from "./config";
import { logger } from "@/infrastructure/observability/logger";
import type { ObjectStore } from "@/lib/spaces/client";

const gunzipAsync = promisify(gunzip);

/** Days, by provider and endpoint-slug prefix. */
export const DEFAULT_TTL_DAYS: Readonly<Record<string, Record<string, number>>> = {
  dataforseo: {
    "serp-": 1,
    "dataforseo_labs-": 30,
    "keywords_data-": 30,
    "backlinks-": 7,
    // LLM answers: always fresh.
    "ai_optimization-": 0,
  },
  openai: { "": 0 },
  gemini: { "": 0 },
  anthropic: { "": 0 },
};

export function ttlDaysFor(provider: string, endpoint: string, env: NodeJS.ProcessEnv = process.env): number {
  let table: Record<string, number> = { ...(DEFAULT_TTL_DAYS[provider] ?? {}) };
  try {
    const extra = env.PURCHASE_ARCHIVE_TTL_DAYS_JSON ? (JSON.parse(env.PURCHASE_ARCHIVE_TTL_DAYS_JSON) as Record<string, unknown>) : null;
    const forProvider = extra && typeof extra[provider] === "object" ? (extra[provider] as Record<string, unknown>) : extra;
    if (forProvider) {
      for (const [k, v] of Object.entries(forProvider)) if (typeof v === "number" && v >= 0) table = { ...table, [k]: v };
    }
  } catch {
    // A malformed override keeps the defaults.
  }
  const slug = endpointSlug(endpoint);
  const key = Object.keys(table)
    .filter((k) => slug.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key === undefined ? 0 : table[key]!;
}

export interface ArchivedRow {
  id: string;
  s3Key: string;
  costUsd: number | null;
  provider: string;
  endpoint: string;
}

export interface ReuseDeps {
  enabled: () => boolean;
  find: (q: { provider: string; endpoint: string; requestHash: string; since: Date }) => Promise<ArchivedRow | null>;
  store: () => Promise<ObjectStore | null>;
  recordHit: (h: { row: ArchivedRow; tenantId: string | null; purpose: string }) => Promise<void>;
  now: () => Date;
}

async function streamToBuffer(s: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of s) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

export const defaultReuseDeps: ReuseDeps = {
  enabled: () => purchaseArchiveEnabled(),
  async find(q) {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.purchaseArchive.findFirst({
      where: { provider: q.provider, endpoint: q.endpoint, requestHash: q.requestHash, storedAt: { not: null }, createdAt: { gte: q.since } },
      orderBy: { createdAt: "desc" },
      select: { id: true, s3Key: true, costUsd: true, provider: true, endpoint: true },
    });
    return row ? { ...row, costUsd: row.costUsd === null ? null : Number(row.costUsd) } : null;
  },
  // Lazy: the store module loads the S3 SDK, which the DataForSEO client's
  // importers should not pay for until a lookup actually needs it.
  store: async () => (await import("./store")).purchaseStore(),
  async recordHit(h) {
    const { prisma } = await import("@/lib/prisma");
    await prisma.purchaseArchiveHit.create({
      data: { archiveId: h.row.id, provider: h.row.provider, endpoint: h.row.endpoint, tenantId: h.tenantId, purpose: h.purpose, savedUsd: h.row.costUsd },
    });
  },
  now: () => new Date(),
};

/**
 * The archived DataForSEO envelope for this exact request, or null (off, TTL
 * 0, miss, or any error). On a hit, the hit is recorded for the report.
 */
export async function reuseDataforseo(
  path: string,
  task: Record<string, unknown>,
  ctx: { tenantId: string | null; purpose: string },
  deps: ReuseDeps = defaultReuseDeps,
): Promise<{ envelope: unknown; row: ArchivedRow } | null> {
  try {
    if (!deps.enabled()) return null;
    const endpoint = endpointSlug(path);
    const days = ttlDaysFor(PROVIDERS.dataforseo, endpoint);
    if (days <= 0) return null;
    // The hash the capture stored: the task as it went over the wire.
    const hash = requestHash(JSON.parse(canonicalJson(task)) as unknown);
    const since = new Date(deps.now().getTime() - days * 86_400_000);
    const row = await deps.find({ provider: PROVIDERS.dataforseo, endpoint, requestHash: hash, since });
    if (!row) return null;
    const store = await deps.store();
    if (!store) return null;
    const body = JSON.parse((await gunzipAsync(await streamToBuffer(await store.get(row.s3Key)))).toString("utf8")) as { response?: unknown };
    if (!body?.response) return null;
    await deps.recordHit({ row, tenantId: ctx.tenantId, purpose: ctx.purpose }).catch((err) => logger.debug({ err }, "purchase-archive: hit not recorded"));
    return { envelope: body.response, row };
  } catch (err) {
    logger.debug({ err: (err as Error)?.message }, "purchase-archive: reuse lookup failed; buying");
    return null;
  }
}
