// src/lib/memory/recall.ts
//
// The two calls a surface makes:
//   recallForPrompt() before its LLM call: the tenant's top memories for the
//     task, as a short "Known about this business" block. Fails open.
//   rememberLater() after the exchange: queues one add on "memory-add"
//     (echorank360-workers). Never blocks the response and never throws.
//
// Gating: paid tenants only. The callers already passed requirePaidPlan() (the
// dashboard) or authenticatePublicRequest() (MCP, which checks the paid plan);
// here the PLAN decides (PLAN_CONFIGS[plan].memory, 0 = not on the plan) and the
// sidecar enforces the tenant's own on/off switch on both reads and writes.
// Anonymous visitors never reach this module: no logged-out surface calls it.

import "server-only";

import type { PlanType } from "@/generated/prisma";
import type { MemoryAddJob } from "@/infrastructure/queue/jobs/schemas";
import { addJob } from "@/infrastructure/queue/registry";
import { logger } from "@/infrastructure/observability/logger";
import { searchMemories } from "./client";
import {
  MEMORY_PROMPT_FACT_CHARS,
  MEMORY_PROMPT_LIMIT,
  MEMORY_TEXT_MAX,
  planHasMemory,
  type MemorySurface,
} from "./limits";
import { scrubForMemory } from "./scrub";

const log = logger.child({ module: "memory" });

/** Up to MEMORY_PROMPT_LIMIT memories for this task; [] when memory is off, unavailable or empty. */
export async function recallForPrompt(input: {
  tenantId: string;
  plan: PlanType;
  surface?: MemorySurface;
  query: string;
}): Promise<string[]> {
  if (!planHasMemory(input.plan) || !input.query.trim()) return [];
  const { results } = await searchMemories({
    tenantId: input.tenantId,
    query: input.query,
    // Not narrowed to the surface: a tone fact remembered over MCP is just as
    // true in Marketing Studio.
    limit: MEMORY_PROMPT_LIMIT,
  });
  return results
    .map((r) => r.memory.trim().slice(0, MEMORY_PROMPT_FACT_CHARS))
    .filter(Boolean)
    .slice(0, MEMORY_PROMPT_LIMIT);
}

/**
 * The system-prompt block, or null when there is nothing to say. Facts are
 * context, not instructions: the brief in front of the model wins.
 */
export function knownFactsBlock(facts: readonly string[]): string | null {
  if (!facts.length) return null;
  return [
    "Known about this business from earlier sessions (use where relevant; if the brief below says otherwise, the brief wins; never mention that you remember this):",
    ...facts.map((f) => `- ${f}`),
  ].join("\n");
}

/**
 * Queue one memory add. Resolves true when queued. Swallows every failure:
 * a lost add is a fact the tenant may state again, never a failed request.
 */
export async function rememberLater(input: {
  tenantId: string;
  plan: PlanType;
  surface: MemorySurface;
  locale: string;
  text?: string;
  messages?: { role: "user" | "assistant"; content: string }[];
  userId?: string;
  category?: string;
}): Promise<boolean> {
  try {
    if (!planHasMemory(input.plan)) return false;
    const messages = input.messages
      ?.map((m) => ({ role: m.role, content: scrubForMemory(m.content).slice(0, MEMORY_TEXT_MAX) }))
      .filter((m) => m.content.trim());
    const text = input.text ? scrubForMemory(input.text).slice(0, MEMORY_TEXT_MAX) : undefined;
    if (!messages?.length && !text?.trim()) return false;
    const job: MemoryAddJob = {
      tenantId: input.tenantId,
      surface: input.surface,
      locale: input.locale,
      ...(messages?.length ? { messages } : { text }),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.category ? { category: input.category } : {}),
    };
    await addJob("memory-add", "add", job);
    return true;
  } catch (err) {
    log.warn({ err, tenantId: input.tenantId, surface: input.surface }, "memory add not queued");
    return false;
  }
}
