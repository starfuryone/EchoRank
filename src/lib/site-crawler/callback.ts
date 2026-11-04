// src/lib/site-crawler/callback.ts
//
// Phase 3d-A: the completion callback of a crawl started through the public
// API with a callbackUrl. When the crawl ends (completed, failed, cancelled)
// the worker POSTs
//
//   {"crawlId": "...", "status": "completed", "summary": {...}}
//
// with header  X-Echorank-Signature: <hex HMAC-SHA256 of the exact body>,
// keyed with the API key's secret hash — sha256(secret) as lowercase hex,
// which the key's holder can compute and nobody else can. A receiver
// recomputes the HMAC over the raw body and compares in constant time.
//
// One retry: a non-2xx answer or a network error schedules a second attempt
// a minute later on the site-crawl queue; a second failure is logged and
// dropped (the crawl itself is unaffected, and GET /crawl/{id} still answers).
// A revoked or deleted key sends nothing. The URL is guarded again at
// delivery, redirects are not followed, and the request times out after 10 s.

import "server-only";
import { createHmac } from "node:crypto";
import { guardCheckUrl } from "@/lib/bot-analytics/url-guard";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { PUBLIC_CRAWL_SELECT, publicCrawlDetail } from "./public-api";

export const CALLBACK_JOB_NAME = "callback";
export const CALLBACK_RETRY_DELAY_MS = 60_000;
export const CALLBACK_TIMEOUT_MS = 10_000;
export const SIGNATURE_HEADER = "X-Echorank-Signature";

/** Hex HMAC-SHA256 of `body`, keyed with the API key's secret hash (hex). */
export function signCallback(body: string, keyHash: string): string {
  return createHmac("sha256", keyHash).update(body).digest("hex");
}

/** A callback URL the API accepts: https, a public host, no credentials (url-guard.ts). Returns the normalised URL or a reason. */
export function checkCallbackUrl(raw: string): { ok: true; url: string } | { ok: false; reason: string } {
  const trimmed = raw.trim();
  if (!/^https:\/\//i.test(trimmed)) return { ok: false, reason: "https_only" };
  const g = guardCheckUrl(trimmed);
  if (!g.ok) return { ok: false, reason: g.reason ?? "not_a_url" };
  return { ok: true, url: new URL(trimmed).toString() };
}

export type CallbackOutcome = "sent" | "skipped" | "retry" | "failed";

export interface CallbackDeps {
  fetch: typeof fetch;
  /** Schedules the second attempt. */
  retry: (crawlJobId: string, delayMs: number) => Promise<unknown>;
}

export async function deliverCrawlCallback(crawlJobId: string, attempt: 1 | 2, deps: CallbackDeps): Promise<CallbackOutcome> {
  const job = await prisma.crawlJob.findUnique({ where: { id: crawlJobId }, select: { ...PUBLIC_CRAWL_SELECT, tenantId: true, callbackUrl: true } });
  if (!job?.callbackUrl || !job.apiKeyId) return "skipped";
  if (job.status === "QUEUED" || job.status === "RUNNING") return "skipped";
  const key = await prisma.apiKey.findFirst({ where: { id: job.apiKeyId, tenantId: job.tenantId }, select: { keyHash: true, revokedAt: true } });
  if (!key || key.revokedAt) {
    logger.info({ crawlJobId }, "crawl callback skipped: key revoked or gone");
    return "skipped";
  }
  const checked = checkCallbackUrl(job.callbackUrl);
  if (!checked.ok) {
    logger.warn({ crawlJobId, reason: checked.reason }, "crawl callback skipped: URL refused at delivery");
    return "skipped";
  }

  const detail = await publicCrawlDetail(job);
  const body = JSON.stringify({
    crawlId: detail.crawlId,
    status: detail.status,
    summary: { ...detail.summary, stoppedReason: detail.stoppedReason, progress: detail.progress, health: detail.health, totals: detail.totals },
  });
  let ok = false;
  let status: number | null = null;
  try {
    const res = await deps.fetch(checked.url, {
      method: "POST",
      headers: { "content-type": "application/json", [SIGNATURE_HEADER]: signCallback(body, key.keyHash), "user-agent": "Echorank360-Callback/1" },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(CALLBACK_TIMEOUT_MS),
    });
    status = res.status;
    ok = res.status >= 200 && res.status < 300;
  } catch {
    ok = false;
  }
  if (ok) return "sent";
  if (attempt === 1) {
    await deps.retry(crawlJobId, CALLBACK_RETRY_DELAY_MS);
    logger.info({ crawlJobId, status }, "crawl callback failed; one retry scheduled");
    return "retry";
  }
  logger.warn({ crawlJobId, status }, "crawl callback failed twice; dropped");
  return "failed";
}
