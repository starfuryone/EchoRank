/**
 * POST /api/free/v1/ai-search-grader — an A–F grade for a domain's AI search
 * readiness.
 *
 * THIN CLIENT OVER THE SIDECAR. The grade comes from av-visibility's POST
 * /grade, which wraps the same audit_site() the paid audit uses. Duplicating
 * the scoring in the app would have produced a free tool that disagrees with
 * the paid product about the same site within a release or two.
 *
 * Limit 1/IP/day, matching the free audit — a grade is a real page fetch on
 * someone else's server, so it is rationed like one. Cached 24h per domain.
 *
 * PUBLIC BY DESIGN — /api/free/v1/ is in publicPaths; CSRF still applies.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { freeToolById } from "@/lib/free-tools";
import { FREE_TOOLS_COPY, guardFreeRun, jsonError } from "@/lib/free-tools/http";
import { refundDailyLimit } from "@/lib/free-tools/limits";
import { ONE_DAY, cacheKey, cached, writeCache } from "@/lib/free-tools/cache";
import { sidecarPost } from "@/lib/av-sidecar";
import { guardCheckUrl } from "@/lib/bot-analytics/url-guard";
import { registrableDomain } from "@/lib/registrable-domain";
import { logger } from "@/infrastructure/observability/logger";

const TOOL = freeToolById("ai_search_grader");

/** The sidecar fetches a page; give it room without hanging the request. */
const GRADE_TIMEOUT_MS = 25_000;

const BodySchema = z.object({
  domain: z.string().trim().min(3).max(253),
});

export interface GradeResponse {
  url: string;
  grade: string;
  score: number;
  engines: { name: string; allowed: boolean }[];
  topGaps: { label: string; lost: number; detail: string; fix: string }[];
}

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(FREE_TOOLS_COPY.badRequest, "INVALID_REQUEST", 400);
  }

  // The shared SSRF guard: no IP literals, private ranges, credentials or odd
  // ports. This endpoint makes the sidecar fetch a URL a stranger supplied.
  const guarded = guardCheckUrl(parsed.data.domain);
  if (!guarded.ok || !guarded.url) {
    return jsonError(FREE_TOOLS_COPY.badRequest, "INVALID_REQUEST", 400);
  }

  // Cache per registrable domain: example.com and www.example.com are one site,
  // and grading both would buy the same answer twice.
  const domain = registrableDomain(guarded.url);
  const key = cacheKey("grade", domain);

  const hit = await cached<GradeResponse>(key);
  if (hit.hit && hit.value) {
    return NextResponse.json({ ...hit.value, cached: true });
  }

  const guard = await guardFreeRun(request, TOOL.id, TOOL.dailyLimit ?? 1);
  if (!guard.ok) return guard.response;

  const res = await sidecarPost<GradeResponse & { error?: string }>(
    "/grade",
    { url: guarded.url },
    { timeoutMs: GRADE_TIMEOUT_MS },
  );

  if (res.status !== 200 || !res.data || res.data.error) {
    // The sidecar could not grade it, so the visitor keeps their one run.
    await refundDailyLimit(TOOL.id, guard.ip);
    logger.warn({ status: res.status, domain }, "free ai-search-grader sidecar refused");
    return jsonError(FREE_TOOLS_COPY.upstream, "UPSTREAM_UNAVAILABLE", 503);
  }

  await writeCache(key, res.data, ONE_DAY);
  return NextResponse.json({ ...res.data, cached: false });
}
