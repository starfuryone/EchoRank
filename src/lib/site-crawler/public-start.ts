// src/lib/site-crawler/public-start.ts
//
// Phase 3d-A: starting a crawl with an API key — shared by POST
// /api/public/v1/crawl and the MCP start_crawl tool. The callback URL check,
// the dashboard's start rate limit, then startCrawl (validation, plan caps,
// quota) with the key recorded on the crawl.

import "server-only";
import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { checkCallbackUrl } from "./callback";
import { queueEstimate } from "./public-api";
import { startCrawl, type StartCrawlOptions } from "./service";
import { START_RATE_LIMIT, START_RATE_WINDOW_MS, startRateKey, type StartCrawlBody } from "./start-body";

export class PublicStartError extends Error {
  constructor(
    readonly code: "invalid_callback_url" | "RATE_LIMITED",
    message: string,
    readonly reason?: string,
  ) {
    super(message);
    this.name = "PublicStartError";
  }
}

/** A callback URL as stored, or a PublicStartError. */
export function acceptCallbackUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const checked = checkCallbackUrl(raw);
  if (!checked.ok) throw new PublicStartError("invalid_callback_url", "callbackUrl must be an https URL on a public host.", checked.reason);
  return checked.url;
}

export async function startViaApi(
  auth: { tenantId: string; keyId: string },
  body: Pick<StartCrawlBody, "url" | "mode" | "urls" | "renderMode" | "config" | "saveAsDefault">,
  callbackUrl: string | null,
): Promise<{ crawlId: string }> {
  const tenant = await prisma.tenant.findUnique({ where: { id: auth.tenantId }, select: { planType: true } });
  if (!tenant) throw new Error("Workspace not found.");
  const limited = await rateLimit(startRateKey(auth.tenantId), START_RATE_LIMIT, START_RATE_WINDOW_MS);
  if (!limited.success) throw new PublicStartError("RATE_LIMITED", "Too many crawls in a row. Wait a minute.");
  const opts: StartCrawlOptions = {
    config: body.config,
    saveAsDefault: body.saveAsDefault,
    mode: body.mode,
    urls: body.urls,
    api: { apiKeyId: auth.keyId, callbackUrl },
  };
  const job = await startCrawl(auth.tenantId, tenant.planType as PlanType, body.url, body.renderMode, opts);
  return { crawlId: job.id };
}

/** { crawlId, status, queuePosition, estimatedStart } for a crawl just started (or replayed). */
export async function startedView(crawlId: string) {
  const row = await prisma.crawlJob.findUnique({ where: { id: crawlId }, select: { id: true, tenantId: true, status: true, createdAt: true, startedAt: true } });
  const estimate = row ? await queueEstimate(row) : { queuePosition: null, estimatedStart: null };
  return { crawlId, status: row?.status.toLowerCase() ?? "queued", ...estimate };
}
