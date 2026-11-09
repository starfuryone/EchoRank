// src/lib/purchase-archive/capture.ts — archivePurchase(): the one entry point
// every provider wrapper calls once a paid response has been accepted.
//
// ── IT NEVER FAILS OR SLOWS THE USER'S REQUEST ─────────────────────────────
// archivePurchase() returns void, synchronously, before doing anything: the
// work is scheduled with setImmediate, after the caller has its data. Inside,
// every failure is caught and logged:
//   prepare (scrub, hash, gzip) → enqueue a "store" job on purchase-archive
//   (retry + backoff in the worker) → or, when the body is too big for a job,
//   the queue is unreachable or slow (5 s), write the spool file instead → or,
//   when even the spool is unwritable, log and drop. A purchase that cannot be
//   archived is a log line, never an error the tenant sees.
//
// Archive off (PURCHASE_ARCHIVE_* not set) → returns at once, nothing runs.

import "server-only";

import { prepareObject, type PreparedObject, type PurchaseInput } from "./core";
import { ARCHIVE_APP, INLINE_MAX_BYTES, liveSecrets, purchaseArchiveEnabled } from "./config";
import { serializeObject, writeSpool, type SerializedObject } from "./spool";
import { logger } from "@/infrastructure/observability/logger";

export const PURCHASE_ARCHIVE_QUEUE = "purchase-archive";
export const STORE_JOB = "store";
const ENQUEUE_TIMEOUT_MS = 5_000;

export interface CaptureOptions {
  personalData: boolean;
  receivedAt?: Date;
  /**
   * A task read (task_get): look the task id up in the metering tables for the
   * tenant and the purchase's cost, which the free read does not carry.
   */
  resolveTask?: boolean;
}

export interface CaptureDeps {
  enabled: () => boolean;
  enqueue: (o: SerializedObject) => Promise<void>;
  spool: (o: PreparedObject) => Promise<unknown>;
  lookupTask: (taskId: string) => Promise<{ tenantId: string | null; costUsd: number | null } | null>;
  secrets: () => string[];
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export const defaultCaptureDeps: CaptureDeps = {
  enabled: () => purchaseArchiveEnabled(),
  async enqueue(o) {
    const [{ getQueue }, { queueJobId }] = await Promise.all([
      import("@/infrastructure/queue/registry"),
      import("@/infrastructure/queue/job-id"),
    ]);
    await withTimeout(
      getQueue(PURCHASE_ARCHIVE_QUEUE).add(STORE_JOB, { kind: "store", object: o }, { jobId: queueJobId("purchase", o.dedupeKey) }),
      ENQUEUE_TIMEOUT_MS,
    );
  },
  spool: (o) => writeSpool(o),
  async lookupTask(taskId) {
    const { lookupTaskPurchase } = await import("./prisma-index");
    return lookupTaskPurchase(taskId);
  },
  secrets: () => liveSecrets(),
};

export type CaptureOutcome = "queued" | "spooled" | "dropped";

/** The capture itself. Exported for the tests; production calls archivePurchase(). */
export async function runCapture(input: PurchaseInput, opts: CaptureOptions, deps: CaptureDeps): Promise<CaptureOutcome> {
  let inp = input;
  if (opts.resolveTask && inp.providerTaskId && (inp.tenantId === null || !inp.costUsd)) {
    try {
      const t = await deps.lookupTask(inp.providerTaskId);
      if (t) inp = { ...inp, tenantId: inp.tenantId ?? t.tenantId, costUsd: inp.costUsd || t.costUsd };
    } catch (err) {
      logger.debug({ err }, "purchase-archive: task lookup failed; archiving unattributed");
    }
  }

  let obj: PreparedObject;
  try {
    obj = await prepareObject(ARCHIVE_APP, inp, { personalData: opts.personalData, receivedAt: opts.receivedAt, secrets: deps.secrets() });
  } catch (err) {
    logger.warn({ err, provider: input.provider }, "purchase-archive: could not prepare an object; dropped");
    return "dropped";
  }

  if (obj.bytes <= INLINE_MAX_BYTES) {
    try {
      await deps.enqueue(serializeObject(obj));
      return "queued";
    } catch (err) {
      logger.warn({ err: (err as Error)?.message, provider: obj.provider, endpoint: obj.endpoint }, "purchase-archive: enqueue failed; spooling");
    }
  }
  try {
    await deps.spool(obj);
    return "spooled";
  } catch (err) {
    logger.error({ err: (err as Error)?.message, provider: obj.provider, endpoint: obj.endpoint }, "purchase-archive: spool unwritable; object dropped");
    return "dropped";
  }
}

/**
 * Archive one purchased response. Returns at once; never throws; never awaited.
 * The returned promise is for tests only (production ignores it).
 */
export function archivePurchase(input: PurchaseInput, opts: CaptureOptions, deps: CaptureDeps = defaultCaptureDeps): Promise<CaptureOutcome | "off"> {
  let enabled = false;
  try {
    enabled = deps.enabled();
  } catch {
    enabled = false;
  }
  if (!enabled) return Promise.resolve("off");
  const receivedAt = opts.receivedAt ?? new Date();
  return new Promise((resolve) => {
    setImmediate(() => {
      runCapture(input, { ...opts, receivedAt }, deps).then(resolve, (err) => {
        logger.error({ err }, "purchase-archive: capture failed");
        resolve("dropped");
      });
    });
  });
}
