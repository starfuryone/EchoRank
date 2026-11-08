// POST /api/free/v1/reddit-threads — find the Reddit threads Google ranks
// for a keyword in one country. Body: { keyword, country, time?, turnstileToken, locale? }.
//
// Order, cheapest refusal first and the cache before any allowance:
//   validate → IP (no cf-connecting-ip → 403) → Turnstile → cache (7 days,
//   free, no allowance) → daily budget ("back tomorrow") → IP limit
//   (10 new searches a day) → buy (DataForSEO live, depth 10) → cache → result.
// The budget is read BEFORE the allowance is consumed, and a failed purchase
// refunds it. Nothing is fetched from reddit.com.
// PUBLIC: /api/free/v1/ is in publicPaths; CSRF still applies.

import { z } from "zod";
import { verifyTurnstile } from "@/lib/snapshot/turnstile";
import { consumeDailyLimit, refundDailyLimit, visitorIp } from "@/lib/free-tools/limits";
import { logger } from "@/infrastructure/observability/logger";
import { DataforseoError } from "@/lib/dataforseo/client";
import {
  REDDIT_SLUG,
  SEARCHES_PER_IP_PER_DAY,
  isTimeFilter,
  normalizeKeyword,
  redditCountry,
} from "@/lib/reddit-threads/config";
import { budgetState, buySearch, cachedSearch } from "@/lib/reddit-threads/service";
import { redditError, redditJson } from "@/lib/reddit-threads/http";

const Body = z.object({
  keyword: z.string().max(400),
  country: z.union([z.number(), z.string().max(10)]),
  time: z.string().max(10).optional(),
  turnstileToken: z.string().max(2048).optional(),
  locale: z.string().max(10).optional(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  const locale = parsed.success ? parsed.data.locale : undefined;
  if (!parsed.success) return redditError(locale, "invalid_keyword", 400);

  const keyword = normalizeKeyword(parsed.data.keyword);
  if (!keyword) return redditError(locale, "invalid_keyword", 400);
  const country = redditCountry(parsed.data.country);
  if (!country) return redditError(locale, "invalid_country", 400);
  const time = isTimeFilter(parsed.data.time) ? parsed.data.time : "any";

  const ip = visitorIp(request);
  if (!ip) return redditError(locale, "no_ip", 403);
  const turnstile = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (turnstile === "unconfigured") return redditError(locale, "unavailable", 503);
  if (turnstile !== "ok") return redditError(locale, "turnstile", 403);

  const input = { keyword, country, time };
  const now = new Date();
  const hit = await cachedSearch(input, now);
  if (hit) return redditJson({ ...hit, cached: true });

  if ((await budgetState(now)).exhausted) return redditError(locale, "budget", 429);
  const limit = await consumeDailyLimit(REDDIT_SLUG, ip, SEARCHES_PER_IP_PER_DAY);
  if (!limit.ok) {
    if (limit.reason === "rate_limited") return redditError(locale, "rate_limited", 429);
    return redditError(locale, limit.reason === "no_ip" ? "no_ip" : "unavailable", limit.reason === "no_ip" ? 403 : 503);
  }
  try {
    const result = await buySearch(input, now);
    return redditJson({ ...result, cached: false });
  } catch (err) {
    await refundDailyLimit(REDDIT_SLUG, ip);
    // The metering's monthly cap on this tool's id is a budget day too.
    if (err instanceof DataforseoError && err.code === "RATE_LIMITED") return redditError(locale, "budget", 429);
    logger.error({ err, keyword }, "reddit threads: DataForSEO search failed");
    return redditError(locale, "upstream", 503);
  }
}
