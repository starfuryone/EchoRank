// POST /api/free/v1/reddit-threads/csv — the email gate on the CSV export.
// Body: { email, consent?, keyword, country, time?, locale? }.
//
// Serves only a search that is already cached (it never buys): run the search,
// then download. Stores the lead (free_crawl_leads, source "reddit-threads";
// a consented one goes to Brevo by double opt-in), 20 downloads per IP a day.
//
// Blocked-country rule (src/lib/geo/blocked-countries.ts): the tool stays open
// everywhere, but a lead from the EU/EEA/UK is not stored (no row, no Brevo).

import { z } from "zod";
import { consumeDailyLimit, visitorIp } from "@/lib/free-tools/limits";
import { cfCountry, isBlockedCountry } from "@/lib/geo/blocked-countries";
import { logger } from "@/infrastructure/observability/logger";
import { CSV_PER_IP_PER_DAY, REDDIT_SLUG, isTimeFilter, normalizeKeyword, redditCountry } from "@/lib/reddit-threads/config";
import { redditLocale } from "@/lib/reddit-threads/copy";
import { threadsCsv } from "@/lib/reddit-threads/parse";
import { cachedSearch, recordRedditLead, searchHash } from "@/lib/reddit-threads/service";
import { redditError } from "@/lib/reddit-threads/http";

const Body = z.object({
  email: z.string().trim().max(254).email(),
  consent: z.boolean().optional(),
  keyword: z.string().max(400),
  country: z.union([z.number(), z.string().max(10)]),
  time: z.string().max(10).optional(),
  locale: z.string().max(10).optional(),
});

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const locale = raw && typeof raw === "object" && typeof (raw as { locale?: unknown }).locale === "string" ? (raw as { locale: string }).locale : undefined;
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return redditError(locale, "invalid_email", 400);

  const keyword = normalizeKeyword(parsed.data.keyword);
  const country = redditCountry(parsed.data.country);
  if (!keyword || !country) return redditError(locale, "expired", 404);
  const time = isTimeFilter(parsed.data.time) ? parsed.data.time : "any";

  const ip = visitorIp(request);
  if (!ip) return redditError(locale, "no_ip", 403);
  const allowance = await consumeDailyLimit(`${REDDIT_SLUG}-csv`, ip, CSV_PER_IP_PER_DAY);
  if (!allowance.ok) {
    return redditError(locale, allowance.reason === "rate_limited" ? "rate_limited" : "unavailable", allowance.reason === "rate_limited" ? 429 : 503);
  }

  const input = { keyword, country, time };
  const result = await cachedSearch(input);
  if (!result) return redditError(locale, "expired", 404);

  if (!isBlockedCountry(cfCountry(request.headers))) {
    try {
      await recordRedditLead({
        token: searchHash(input),
        keyword,
        email: parsed.data.email,
        locale: redditLocale(locale) === "fr" ? "fr" : "en",
        consent: parsed.data.consent === true,
      });
    } catch (err) {
      // The visitor still gets the file; the lost lead is logged.
      logger.warn({ err }, "reddit threads: lead not stored");
    }
  }

  const name = `reddit-threads-${keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "search"}.csv`;
  return new Response(threadsCsv(result.threads), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
