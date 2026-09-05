// src/lib/ai-citations/options.ts
//
// Config, caps and the verification flag for the AI Citations tool. Kept out
// of service.ts so the DB-less tests can import it without pulling in Prisma —
// the same split serp/, backlinks/ and site-explorer/options.ts already make.

// The PURE module, not dataforseo/endpoints — this file is imported by the
// tool page, and endpoints reaches "server-only" through ./client.
import { LLM_PLATFORMS, isLlmPlatform, type LlmPlatform } from "./platforms";

export { LLM_PLATFORMS, isLlmPlatform };
export type { LlmPlatform };

/**
 * ── THE FLAG ────────────────────────────────────────────────────────────────
 *
 * Nobody has confirmed that Echorank's DataForSEO account has the AI
 * Optimization product enabled. The porting session ran as `deploy`, which
 * cannot read `.env` (600 echorank), so no probe was possible and none was
 * faked. Until someone runs one, every billable path in this feature is closed
 * and the tool page renders its scaffold.
 *
 * TO FLIP IT LIVE, in this order:
 *
 *  1. Probe the account (as `echorank` or root — the credentials never leave
 *     the box, and never appear in a transcript):
 *
 *       sudo -u echorank bash -c 'set -a; . /opt/echorank/app/.env; set +a;
 *       curl -s -u "$DATAFORSEO_LOGIN:$DATAFORSEO_PASSWORD" \
 *         -H "Content-Type: application/json" \
 *         -X POST https://api.dataforseo.com/v3/ai_optimization/llm_mentions/aggregated_metrics/live \
 *         -d "[{\"target\":[{\"domain\":\"echorank360.com\",\"include_subdomains\":true,\"search_filter\":\"include\",\"search_scope\":[\"any\"]}],\"platform\":\"chat_gpt\",\"location_code\":2840,\"language_code\":\"en\",\"internal_list_limit\":10}]" \
 *         | head -c 800'
 *
 *     `tasks[0].status_code` 20000 means the product is enabled. Anything in
 *     the 402xx range means it is not, and the answer is a DataForSEO account
 *     change rather than a code change. Record `tasks[0].cost` — that number is
 *     the input to the funding decision below.
 *
 *  2. Set AI_CITATIONS_VERIFIED=1 in .env.
 *
 *  3. Remove the scaffold branch from
 *     src/app/(dashboard)/visibility/tools/ai-citations/page.tsx, drop
 *     `comingSoon: true` from the ai_citations entry in seo-tools.ts, and
 *     update the live/coming-soon counts in src/lib/__tests__/seo-tools.test.ts.
 *     Those three move together by construction: that test asserts the flag
 *     against the route file precisely so a shipped tool cannot be advertised
 *     as a placeholder, or a placeholder as shipped.
 *
 * ── THE FUNDING DECISION, FLAGGED ───────────────────────────────────────────
 *
 * Implemented default: a lookup draws ONE search from the pooled
 * `seoSearchesPerMonth` allowance and its spend counts against the tenant's
 * DataForSEO USD cap — the same treatment a domain overview gets. The
 * alternative is its own per-plan allowance like the Keyword Opportunity
 * Finder's. That call cannot be made honestly until step 1 reports a real
 * per-call cost: if a lookup lands near a backlinks analysis rather than near
 * a domain overview, it wants its own ceiling. See the notes on `ai_citations`
 * in dataforseo/client.ts and seo-quota.ts.
 */
export function aiCitationsEnabled(): boolean {
  const raw = process.env.AI_CITATIONS_VERIFIED?.trim().toLowerCase();
  return raw === "1" || raw === "true";
}

/**
 * ── THE CACHE IS A UTC DAY BUCKET, NOT A ROLLING WINDOW ─────────────────────
 *
 * The Backlinks and Site Explorer tools use a rolling 24h window; the Keyword
 * Opportunity Finder uses a UTC day bucket. This follows KOF, and the reason
 * is the one stated in keyword-opportunity/entitlement.ts: with a rolling
 * window, whether a lookup costs anything depends on the MINUTE the customer
 * last clicked, which is not a rule anyone can hold in their head. With a day
 * bucket the rule is "one lookup of one target per day", which is.
 *
 * The bucket is part of the cache key, so freshness is encoded in the key
 * rather than compared against a timestamp.
 */
export function dateBucket(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The cache key for one lookup.
 *
 * PLATFORMS ARE IN THE KEY, SORTED. A lookup of one platform and a lookup of
 * two are different purchases with different answers, and an unsorted list
 * would make ["google","chat_gpt"] miss a stored ["chat_gpt","google"] — one
 * cache miss, one needless charge, for the same question.
 */
export function cacheKeyFor(
  targetKey: string,
  platforms: readonly LlmPlatform[],
  now: Date = new Date(),
): string {
  return `${targetKey}|${[...platforms].sort().join(",")}|${dateBucket(now)}`;
}

/** Milliseconds until the bucket rolls — what "re-run available in" counts down. */
export function msUntilNextBucket(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(0, next - now.getTime());
}

/**
 * Cited sources kept PER PLATFORM.
 *
 * Per-platform rather than overall, because Google's mention volume dwarfs
 * ChatGPT's (which is US/en only) and a single global cap would return a table
 * with no ChatGPT rows in it at all — the platform the customer most wants to
 * see.
 */
export const SOURCES_PER_PLATFORM = 25;

/** Example prompts attached to one cited source. */
export const PROMPTS_PER_SOURCE = 5;

/** Rows requested from llm_mentions/search, the prompt-example sample. */
export const MENTIONS_SAMPLE_LIMIT = 100;

/** items_list_limit for top_pages. The provider caps this at 10. */
export const TOP_PAGES_LIST_LIMIT = 10;

/** Competitors comparable in one cross_aggregated call. Provider: 2..10 groups. */
export const MAX_COMPETITORS = 5;

/** Longest URL kept in a result row. */
export const MAX_URL_LENGTH = 2048;

/** Longest example prompt kept. These are questions, not essays. */
export const MAX_QUESTION_LENGTH = 500;

/** Default market for `google`. ChatGPT is pinned to US/en by the provider. */
export const DEFAULT_LOCATION_CODE = 2840;
export const DEFAULT_LANGUAGE_CODE = "en";
