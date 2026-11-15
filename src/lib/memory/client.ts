// src/lib/memory/client.ts
//
// The app's side of AI memory: calls to the sidecar's /memory/* routes
// (av-service memory/routes.py, same X-Internal-Secret as every sidecar call).
//
// TENANT ID: every function takes it as an argument, and every caller gets it
// from requireTenant()/requirePaidPlan() or the API key's lookup — never from a
// request body. The sidecar builds the scope ("t:<tenantId>") from it alone.
//
// TWO FAILURE POSTURES, on purpose:
//   - searchMemories() FAILS OPEN: 800 ms, then the caller proceeds with no
//     memories. Memory makes an answer better; it must never make one late or
//     missing.
//   - the writes (add, delete, purge) THROW, so the queue retries an add and a
//     deletion request is marked FAILED rather than leaving data behind.
//
// Env is read per call, not at module load (the trap src/lib/assistant/config.ts
// describes): a rotated secret takes effect on the next request.

import "server-only";

import { logger } from "@/infrastructure/observability/logger";
import { MEMORY_SEARCH_MAX, MEMORY_SEARCH_TIMEOUT_MS, type MemorySurface } from "./limits";

const log = logger.child({ module: "memory" });

const baseUrl = () => process.env.AV_SIDECAR_URL || "http://127.0.0.1:4500";
const secret = () => process.env.INTERNAL_API_SECRET || "";

export interface MemoryHit {
  id: string;
  memory: string;
  score: number | null;
  created_at: string | null;
  surface: string | null;
}

export interface MemoryItem {
  id: string;
  memory: string;
  created_at: string | null;
  surface: string | null;
  category: string;
}

export interface MemoryPage {
  items: MemoryItem[];
  nextCursor: number | null;
  total: number;
}

export interface MemorySettings {
  enabled: boolean;
  total: number;
}

export interface MemoryAddResult {
  added: { id: string; memory: string; category: string }[];
  dropped: number;
  usage: { input_tokens: number; output_tokens: number };
  /** "disabled" (tenant switched memory off) or "full" (maxStored reached). */
  skipped?: "disabled" | "full";
}

export class MemoryUnavailableError extends Error {
  readonly statusCode = 503;
  constructor(readonly upstreamStatus: number, detail?: string) {
    super(detail ? `Memory is unavailable (${upstreamStatus}: ${detail})` : `Memory is unavailable (${upstreamStatus})`);
    this.name = "MemoryUnavailableError";
  }
}

interface Raw<T> {
  status: number;
  data: T | null;
}

async function call<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<Raw<T>> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/memory${path}`, {
      method,
      headers: { "Content-Type": "application/json", "X-Internal-Secret": secret() },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { status: 502, data: null };
  }
  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

const detailOf = (data: unknown): string | undefined =>
  data && typeof data === "object" && "detail" in data && typeof (data as { detail: unknown }).detail === "string"
    ? (data as { detail: string }).detail
    : undefined;

function ok<T>(r: Raw<T>): T {
  if (r.status !== 200 || r.data === null) throw new MemoryUnavailableError(r.status, detailOf(r.data));
  return r.data;
}

const q = (params: Record<string, string | number>) =>
  new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

/**
 * The tenant's memories closest to `query`. Never throws: on a timeout, a
 * sidecar error or memory being off it returns `{ ok: false, results: [] }`
 * (ok: true with [] means "searched, nothing relevant").
 */
export async function searchMemories(input: {
  tenantId: string;
  query: string;
  surface?: MemorySurface;
  limit?: number;
  timeoutMs?: number;
}): Promise<{ ok: boolean; results: MemoryHit[] }> {
  const started = Date.now();
  const r = await call<{ results: MemoryHit[] }>(
    "POST",
    "/search",
    {
      tenantId: input.tenantId,
      query: input.query.slice(0, 2000),
      surface: input.surface,
      limit: Math.max(1, Math.min(input.limit ?? 5, MEMORY_SEARCH_MAX)),
    },
    input.timeoutMs ?? MEMORY_SEARCH_TIMEOUT_MS,
  );
  if (r.status !== 200 || !r.data || !Array.isArray(r.data.results)) {
    log.warn(
      { tenantId: input.tenantId, status: r.status, ms: Date.now() - started },
      "memory search failed open; proceeding without memories",
    );
    return { ok: false, results: [] };
  }
  return { ok: true, results: r.data.results.filter((h) => typeof h?.memory === "string" && h.memory.trim()) };
}

/** One extraction + store, synchronously. The memory-add worker's call; nothing else should make it. */
export async function addMemoryNow(input: {
  tenantId: string;
  surface: MemorySurface;
  messages?: { role: "user" | "assistant"; content: string }[];
  text?: string;
  metadata?: Record<string, string>;
  maxStored: number | null;
}): Promise<MemoryAddResult> {
  return ok(
    await call<MemoryAddResult>(
      "POST",
      "/add",
      {
        tenantId: input.tenantId,
        surface: input.surface,
        messages: input.messages,
        text: input.text,
        metadata: input.metadata ?? {},
        infer: true,
        ...(input.maxStored === null ? {} : { maxStored: input.maxStored }),
      },
      60_000,
    ),
  );
}

export async function listMemories(tenantId: string, cursor = 0): Promise<MemoryPage> {
  return ok(await call<MemoryPage>("GET", `/list?${q({ tenantId, cursor })}`, undefined, 5_000));
}

export async function getMemorySettings(tenantId: string): Promise<MemorySettings> {
  return ok(await call<MemorySettings>("GET", `/settings?${q({ tenantId })}`, undefined, 5_000));
}

export async function setMemoryEnabled(tenantId: string, enabled: boolean): Promise<MemorySettings> {
  return ok(await call<MemorySettings>("PUT", "/settings", { tenantId, enabled }, 5_000));
}

/** False when the sidecar has no such memory FOR THIS TENANT (another tenant's id included). */
export async function deleteMemory(tenantId: string, id: string): Promise<boolean> {
  const r = await call<unknown>("DELETE", `/item/${encodeURIComponent(id)}?${q({ tenantId })}`, undefined, 5_000);
  if (r.status === 404) return false;
  ok(r);
  return true;
}

export interface PurgeResult {
  purged: Record<string, number>;
  remaining: number;
}

/**
 * Everything the tenant has in memory. `forgetSettings` also drops the on/off
 * row (account deletion). Returns null when the store was never configured
 * on this deployment (nothing can have been stored); throws on anything else.
 */
export async function purgeTenantMemory(
  tenantId: string,
  opts: { forgetSettings?: boolean } = {},
): Promise<PurgeResult | null> {
  const path = `/tenant/${encodeURIComponent(tenantId)}${opts.forgetSettings ? "?forgetSettings=true" : ""}`;
  const r = await call<PurgeResult>("DELETE", path, undefined, 30_000);
  if (r.status === 503 && detailOf(r.data)?.startsWith("memory not configured")) return null;
  const out = ok(r);
  if (out.remaining !== 0) throw new MemoryUnavailableError(500, `${out.remaining} memories left after purge`);
  return out;
}
