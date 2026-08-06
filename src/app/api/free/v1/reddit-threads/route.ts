/**
 * POST /api/free/v1/reddit-threads — public Reddit search for a keyword.
 *
 * ANONYMOUS. No session, no tenant. Zero API cost, so the daily USD cap does
 * not apply — but the per-IP limit does, because the cost here is Reddit's
 * patience with our egress IP rather than money.
 *
 * ORDER: cache → IP → limit → upstream. A cached keyword costs the visitor
 * nothing, which is why the cache read happens before the limiter.
 *
 * PUBLIC BY DESIGN — /api/free/v1/ is in publicPaths in src/proxy.ts. The CSRF
 * origin check still runs in front of this POST.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { ONE_HOUR, cacheKey, cached, writeCache } from "@/lib/free-tools/cache";
import { FREE_TOOLS_COPY, guardFreeRun, jsonError } from "@/lib/free-tools/http";
import { refundDailyLimit } from "@/lib/free-tools/limits";
import { searchReddit, type RedditThread } from "@/lib/free-tools/reddit";
import { freeToolById } from "@/lib/free-tools";

const TOOL = freeToolById("reddit_threads");

const BodySchema = z.object({
  keyword: z.string().trim().min(2).max(120),
});

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(FREE_TOOLS_COPY.badRequest, "INVALID_REQUEST", 400);
  }
  const keyword = parsed.data.keyword;

  // 1. Cache first — a hit is free in every sense.
  const key = cacheKey("reddit", keyword);
  const hit = await cached<RedditThread[]>(key);
  if (hit.hit && hit.value) {
    return NextResponse.json({ threads: hit.value, cached: true });
  }

  // 2. Attribute and limit.
  const guard = await guardFreeRun(request, TOOL.id, TOOL.dailyLimit ?? 10);
  if (!guard.ok) return guard.response;

  // 3. Ask Reddit.
  const outcome = await searchReddit(keyword);

  if (outcome.status === "blocked") {
    // We delivered nothing, so the visitor keeps their run. Reddit refusing us
    // is our problem, not theirs.
    await refundDailyLimit(TOOL.id, guard.ip);
    return jsonError(FREE_TOOLS_COPY.upstream, "UPSTREAM_UNAVAILABLE", 503);
  }

  // An empty result is a real answer and is cached — otherwise every obscure
  // keyword would hit Reddit again on the next visit.
  await writeCache(key, outcome.threads, ONE_HOUR);

  return NextResponse.json({ threads: outcome.threads, cached: false });
}
