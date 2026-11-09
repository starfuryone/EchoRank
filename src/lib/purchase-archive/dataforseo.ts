// src/lib/purchase-archive/dataforseo.ts — the DataForSEO wrapper.
//
// Called from the one place every DataForSEO response passes through:
// request() in src/lib/dataforseo/client.ts, after the envelope has parsed as a
// success and before the caller gets it. So every endpoint, today's and any
// added later, is archived without its call site knowing — the guard test in
// tests/purchase-archive.test.ts fails if a DataForSEO call can reach the
// network any other way.
//
// What is kept: the envelope as received (DataForSEO echoes the task in
// tasks[0].data; credentials travel in the Authorization header, which never
// reaches this module). The request is the posted task, or for a GET read the
// echoed task. Policies (excluded, not purchased, personal data) are in
// ./config.ts. Fixture replays are not purchases and are never archived (the
// client does not call this in fixture mode).

import "server-only";

import { archivePurchase, type CaptureDeps } from "./capture";
import { PROVIDERS, dataforseoDecision } from "./config";
import { currentPurchaseContext } from "./context";
import { logger } from "@/infrastructure/observability/logger";

interface Envelope {
  tasks?: Array<{ id?: string; cost?: number; data?: unknown; result?: unknown }>;
}

function postedTask(body: string | undefined): unknown {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as unknown;
    return Array.isArray(parsed) ? (parsed[0] ?? null) : parsed;
  } catch {
    return null;
  }
}

/**
 * The site audit polls on_page/summary every tick while DataForSEO crawls, and
 * each poll is a success envelope with crawl_progress "in_progress". Only the
 * finished summary is the purchased result; the polls are not archived.
 */
export function isUnfinishedOnPagePoll(path: string, result: unknown): boolean {
  if (!/on_page\/summary/.test(path)) return false;
  const first = Array.isArray(result) ? (result[0] as { crawl_progress?: string } | undefined) : undefined;
  return first?.crawl_progress !== "finished";
}

/** Never throws, never awaits: archivePurchase defers everything. */
export function archiveDataforseoResponse(
  p: { method: "GET" | "POST"; path: string; body?: string; envelope: unknown },
  deps?: CaptureDeps,
): void {
  try {
    const decision = dataforseoDecision(p.path);
    if (!decision.archive) return;
    const task = (p.envelope as Envelope)?.tasks?.[0];
    if (!task) return;
    if (isUnfinishedOnPagePoll(p.path, task.result)) return;
    const taskRead = /\/task_get\//.test(p.path);
    const ctx = currentPurchaseContext();
    void archivePurchase(
      {
        provider: PROVIDERS.dataforseo,
        endpoint: p.path,
        request: p.method === "POST" ? postedTask(p.body) : (task.data ?? null),
        response: p.envelope,
        costUsd: typeof task.cost === "number" ? task.cost : null,
        providerTaskId: typeof task.id === "string" ? task.id : null,
        tenantId: ctx?.tenantId ?? null,
        purpose: ctx?.purpose ?? (taskRead ? "standard-queue" : "unattributed"),
      },
      { personalData: decision.personalData, resolveTask: taskRead },
      deps,
    );
  } catch (err) {
    logger.debug({ err }, "purchase-archive: dataforseo capture skipped");
  }
}
