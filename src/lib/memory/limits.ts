// src/lib/memory/limits.ts
//
// AI memory: the numbers, dependency-free (no server module, safe for a Client
// Component). The allowances themselves live in PLAN_CONFIGS[plan].memory;
// this file reads them and holds the constants every other memory module uses.

import type { PlanType } from "@/generated/prisma";
import { PLAN_CONFIGS, type MemoryAllowance } from "@/lib/plan-config";

/** Where a memory came from. The sidecar's agent_id; keep in step with its SURFACE_RE. */
export const MEMORY_SURFACES = ["mcp", "marketing_studio"] as const;
export type MemorySurface = (typeof MEMORY_SURFACES)[number];

/** search() gives up after this and the caller proceeds with no memories. */
export const MEMORY_SEARCH_TIMEOUT_MS = 800;
/** Memories injected into a prompt ("Known about this business"). */
export const MEMORY_PROMPT_LIMIT = 5;
/** Longest single memory injected into a prompt, in characters. */
export const MEMORY_PROMPT_FACT_CHARS = 300;
/** Sidecar ceiling on one search (av-service memory/config.py SEARCH_MAX). */
export const MEMORY_SEARCH_MAX = 10;
/** Longest text an add accepts (av-service memory/service.py TEXT_MAX). */
export const MEMORY_TEXT_MAX = 8000;

/**
 * MEM0_DAILY_TOKEN_BUDGET: extraction tokens (input + output) across ALL
 * tenants per UTC day. The kill switch: 0 stops every add. Default 2M tokens,
 * under $1 a day at Haiku 5.5's $0.10/$0.50 per MTok. TODO(fred): confirm.
 */
export const MEMORY_DAILY_TOKEN_BUDGET_ENV = "MEM0_DAILY_TOKEN_BUDGET";
export const DEFAULT_MEMORY_DAILY_TOKEN_BUDGET = 2_000_000;

export function memoryDailyTokenBudget(env: Record<string, string | undefined> = process.env): number {
  const raw = env[MEMORY_DAILY_TOKEN_BUDGET_ENV];
  if (raw === undefined || raw.trim() === "") return DEFAULT_MEMORY_DAILY_TOKEN_BUDGET;
  const n = Number(raw);
  // A typo must not hand out an unbounded budget: fall back to the default.
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_MEMORY_DAILY_TOKEN_BUDGET;
}

const NONE: MemoryAllowance = { addsPerMonth: 0, maxStored: 0 };

export function memoryAllowance(plan: PlanType | null | undefined): MemoryAllowance {
  if (!plan) return NONE;
  return PLAN_CONFIGS[plan]?.memory ?? NONE;
}

/** Does this plan include AI memory at all? (0 adds = not on the plan.) */
export function planHasMemory(plan: PlanType | null | undefined): boolean {
  return memoryAllowance(plan).addsPerMonth !== 0;
}
