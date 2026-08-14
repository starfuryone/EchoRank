// src/lib/citation-opportunities/listed.ts
//
// "Are we already listed there?" — the one question in this feature that costs
// money, and therefore the one with the most guard rails around it.
//
// ── The proxy, stated plainly ───────────────────────────────────────────────
// We cannot ask a directory whether it has a page about the customer. What we
// CAN ask is whether that domain links to the customer's site, which is what
// DataForSEO's backlinks/referring_domains answers. A claimed G2 profile links
// to your site; an unclaimed one does not. It is a proxy, it is a good one, and
// it is wrong in one direction we can live with: a listing that carries no link
// reads as "not listed", so the customer is shown a job they may already have
// done. The opposite error — hiding a real opportunity — never happens.
//
// ── Money ───────────────────────────────────────────────────────────────────
// Observed on the recorded envelope (fixtures/dataforseo/, target birdeye.com,
// limit 50): $0.0258 for the call. The four sibling backlinks endpoints landed
// between $0.024036 and $0.02508 for one row and for fifty alike, so this API's
// price is a REQUEST price with a rounding error of rows attached — roughly
// $0.024 of base and about $0.000036 a row. Two consequences drive the design
// below:
//
//   1. Rows are nearly free, so filtering the request to exactly the domains we
//      are asking about costs no more than asking for fifty arbitrary ones —
//      and unlike a rank-ordered top fifty, it actually answers the question. A
//      customer with 21,000 referring domains (which the fixture's target has)
//      would otherwise have every real listing fall off the end of the page and
//      be reported as an opportunity they have not taken.
//   2. Calls are expensive, so the unit to avoid is the CALL. Hence the cache
//      below is per (target, domain) rather than per target: a week where every
//      candidate is already answered spends nothing at all, and a week with
//      three new domains spends one call, not three.
//
// ── Three independent brakes, in this order ─────────────────────────────────
//   1. CACHE      — 7 days, per (tenant, target, domain). Free.
//   2. USD CAP    — checked HERE, before the request is even built. The metered
//                   client checks it too and would throw; we check first so a
//                   capped tenant's weekly sweep is a no-op with a log line
//                   rather than an exception path, and so the decision is
//                   visible in this file rather than three layers down.
//   3. METERING   — seoMeteredCallResult writes the SeoApiCall row and enforces
//                   the cap again. Never call postTask directly (integrations.md).
//
// ── Failing open ────────────────────────────────────────────────────────────
// Every failure here — cap reached, Redis down, DataForSEO 502, an upstream
// contract change — resolves to "we do not know", and an unknown domain is NOT
// skipped. The worklist is the product; degrading to a slightly longer worklist
// is correct, and degrading to an empty one because a third party had a bad
// minute is not.

import { getRedisConnection } from "@/infrastructure/redis/connection";
import { logger } from "@/infrastructure/observability/logger";
import { BACKLINKS } from "@/lib/dataforseo/endpoints";
import { seoMeteredCallResult, spentThisMonth, monthlyCapUsd } from "@/lib/dataforseo/metering";
import { parseReferringDomains } from "@/lib/backlinks/parse";
import { REFERRING_DOMAINS_LIMIT } from "@/lib/backlinks/options";

/** 7 days, as specified. The key self-cleans, so nothing sweeps it. */
export const LISTED_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Most domains asked about in one request.
 *
 * TIED TO THE PARSER'S OWN LIMIT, and it has to be. parseReferringDomains ends
 * with `.slice(0, REFERRING_DOMAINS_LIMIT)` — it is the Backlinks tool's table
 * parser and that tool renders fifty rows. Asking about more domains than the
 * parser will hand back would drop the overflow silently, and the overflow
 * would then read as "not listed" rather than "not answered": a FALSE NEGATIVE
 * in the one direction this check must never fail in, because it puts a job on
 * the worklist that the customer has already done.
 *
 * Importing the constant rather than restating 50 means a change to the
 * Backlinks table's page size cannot quietly reintroduce that bug here.
 *
 * It is well above any real week's new-candidate count — the whole corpus at
 * the time of writing is single-digit domains — so this is a backstop, not a
 * working limit. When it does bite, `checkListed` LOGS what it dropped and
 * marks the overflow `unknown`, which is not skipped and not cached, so the
 * next sweep asks about it once the head of the list is answered from cache.
 */
export const MAX_DOMAINS_PER_CALL = REFERRING_DOMAINS_LIMIT;

/** What we know about one domain, and how we came to know it. */
export type ListedVerdict = "listed" | "not_listed" | "unknown";

export interface ListedResult {
  /** domain -> verdict. Every requested domain appears exactly once. */
  verdicts: Map<string, ListedVerdict>;
  /** USD actually billed by this call. 0 when nothing was bought. */
  costUsd: number;
  /** True when a live call was made — for the worker's log line. */
  called: boolean;
  /** Why no call happened, when none did. */
  skipReason?: "all_cached" | "no_target" | "cap_reached" | "no_candidates";
}

function cacheKey(tenantId: string, target: string): string {
  return `echorank:citation-opps:referring:${tenantId}:${target}`;
}

/**
 * Cached verdicts for these domains, as a partial map.
 *
 * A Redis outage returns an empty map rather than throwing: the caller then
 * treats every domain as unanswered, which costs one call it did not strictly
 * need. Spending $0.026 to survive a Redis blip is the right trade; failing the
 * weekly sweep is not.
 */
async function readCache(
  tenantId: string,
  target: string,
  domains: readonly string[],
): Promise<Map<string, ListedVerdict>> {
  const found = new Map<string, ListedVerdict>();
  if (domains.length === 0) return found;

  try {
    const redis = getRedisConnection();
    const values = await redis.hmget(cacheKey(tenantId, target), ...domains);
    domains.forEach((domain, index) => {
      const value = values[index];
      if (value === "1") found.set(domain, "listed");
      else if (value === "0") found.set(domain, "not_listed");
    });
  } catch (err) {
    logger.warn(
      { tenantId, target, err: err instanceof Error ? err.message : String(err) },
      "citation-opportunities: listed cache unreadable, treating every domain as unanswered",
    );
  }
  return found;
}

/**
 * Persist the verdicts a live call produced.
 *
 * Written IMMEDIATELY after the call returns and before anything else happens,
 * so a crash later in the sweep cannot cause next week's run to buy the same
 * answer twice. The TTL is refreshed on every write, which is what makes this a
 * rolling 7-day cache rather than one that expires mid-answer.
 *
 * Never throws. A cache we could not write is a call we will make again in a
 * week; a sweep that died writing a cache is a worklist the customer never got.
 */
async function writeCache(
  tenantId: string,
  target: string,
  verdicts: ReadonlyMap<string, ListedVerdict>,
): Promise<void> {
  const entries: Record<string, string> = {};
  for (const [domain, verdict] of verdicts) {
    if (verdict === "listed") entries[domain] = "1";
    else if (verdict === "not_listed") entries[domain] = "0";
    // `unknown` is deliberately NOT cached. Caching an unknown for a week would
    // turn one bad minute at DataForSEO into seven days of not asking again.
  }
  if (Object.keys(entries).length === 0) return;

  try {
    const redis = getRedisConnection();
    const key = cacheKey(tenantId, target);
    await redis.hset(key, entries);
    await redis.expire(key, LISTED_CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn(
      { tenantId, target, err: err instanceof Error ? err.message : String(err) },
      "citation-opportunities: listed cache unwritable, next sweep will re-ask",
    );
  }
}

export interface CheckListedInput {
  tenantId: string;
  /** The customer's own registrable domain — the backlink TARGET. */
  target: string | null;
  /** Candidate domains, highest priority first. */
  domains: readonly string[];
  /** Injected for tests; defaults to the real metered client. */
  fetchReferring?: typeof fetchReferringDomains;
  /** Injected for tests; defaults to the real spend aggregate. */
  spent?: (tenantId: string) => Promise<number>;
  /** Injected for tests; defaults to the real cap. */
  cap?: (tenantId: string) => Promise<number>;
}

/**
 * One metered referring_domains call, filtered to the domains we are asking
 * about.
 *
 * `filters` rather than a rank-ordered page, for the reason this file's header
 * gives: the answer to "does g2.com link to us" must not depend on whether
 * g2.com happens to be in the customer's fifty highest-ranked referring
 * domains. `include_subdomains` is on because a listing lives at
 * www.g2.com/products/... and the registrable domain is what we hold.
 *
 * Returns the domains upstream confirmed as referring. Anything absent from the
 * response is absent because it does not link to the target — that is the whole
 * point of asking with a filter.
 */
export async function fetchReferringDomains(
  tenantId: string,
  target: string,
  domains: readonly string[],
): Promise<{ referring: Set<string>; costUsd: number }> {
  // The envelope type is taken FROM the parser rather than restated, so a
  // change to the upstream row shape is a compile error here instead of a
  // silently-empty result set — which is the failure mode integrations.md warns
  // about for exactly these endpoints.
  const { data, billing } = await seoMeteredCallResult<
    NonNullable<Parameters<typeof parseReferringDomains>[0]>
  >(tenantId, BACKLINKS.referringDomains, {
    target,
    // One row per domain we asked about, at most. The limit is a guard against
    // a filter that upstream silently ignores, not a page size we expect to hit.
    limit: Math.max(domains.length, 1),
    include_subdomains: true,
    backlinks_status_type: "live",
    filters: [["domain", "in", [...domains]]],
  });

  const section = parseReferringDomains(data);
  // parseReferringDomains already lowercases and strips a leading www., which
  // is the same normalisation the candidate domains carry.
  return {
    referring: new Set(section.items.map((row) => row.domain)),
    costUsd: billing.costUsd,
  };
}

/**
 * The listed verdict for every candidate domain.
 *
 * Cache first, then at most ONE live call for whatever the cache could not
 * answer, then never more than that in a single sweep.
 */
export async function checkListed(input: CheckListedInput): Promise<ListedResult> {
  const {
    tenantId,
    target,
    domains,
    fetchReferring = fetchReferringDomains,
    spent = spentThisMonth,
    cap = monthlyCapUsd,
  } = input;

  const verdicts = new Map<string, ListedVerdict>();

  if (domains.length === 0) {
    return { verdicts, costUsd: 0, called: false, skipReason: "no_candidates" };
  }

  // No website on any brand profile means no backlink target, which means the
  // question is unanswerable rather than answered "no". Every domain stays
  // unknown and nothing is skipped.
  if (!target) {
    for (const domain of domains) verdicts.set(domain, "unknown");
    logger.info(
      { tenantId, domains: domains.length },
      "citation-opportunities: no brand website, skipping the listed check entirely",
    );
    return { verdicts, costUsd: 0, called: false, skipReason: "no_target" };
  }

  const cached = await readCache(tenantId, target, domains);
  for (const [domain, verdict] of cached) verdicts.set(domain, verdict);

  const unanswered = domains.filter((domain) => !verdicts.has(domain));
  if (unanswered.length === 0) {
    return { verdicts, costUsd: 0, called: false, skipReason: "all_cached" };
  }

  // ── Brake 2: the USD cap, checked BEFORE the request is built ────────────
  // Not merely before the fetch — before we spend any effort at all. A capped
  // tenant's sweep still produces a worklist; it just produces one that has not
  // been filtered for listings, which the log line says out loud.
  const [spentUsd, capUsd] = await Promise.all([spent(tenantId), cap(tenantId)]);
  if (spentUsd >= capUsd) {
    for (const domain of unanswered) verdicts.set(domain, "unknown");
    logger.warn(
      { tenantId, spentUsd, capUsd, unanswered: unanswered.length },
      "citation-opportunities: monthly SEO budget reached, listed check skipped this week",
    );
    return { verdicts, costUsd: 0, called: false, skipReason: "cap_reached" };
  }

  const asked = unanswered.slice(0, MAX_DOMAINS_PER_CALL);
  const dropped = unanswered.slice(MAX_DOMAINS_PER_CALL);
  if (dropped.length > 0) {
    // Said out loud on purpose. A truncation nobody logs becomes a coverage
    // claim nobody can check.
    logger.warn(
      { tenantId, asked: asked.length, dropped: dropped.length },
      "citation-opportunities: more candidates than one call can carry; the remainder stay unchecked until next week",
    );
    for (const domain of dropped) verdicts.set(domain, "unknown");
  }

  try {
    const { referring, costUsd } = await fetchReferring(tenantId, target, asked);
    for (const domain of asked) {
      verdicts.set(domain, referring.has(domain) ? "listed" : "not_listed");
    }

    // Before anything else can fail. See writeCache's comment.
    await writeCache(tenantId, target, verdicts);

    logger.info(
      { tenantId, target, asked: asked.length, listed: referring.size, costUsd },
      "citation-opportunities: listed check complete",
    );
    return { verdicts, costUsd, called: true };
  } catch (err) {
    // Fail OPEN. Includes the case where `filters` is rejected outright
    // (DataforseoError INVALID_FIELD) — which would be an upstream contract
    // change worth seeing in the log, and is deliberately NOT retried with a
    // different request shape, because a retry is a second call and a second
    // charge for an answer we already failed to get.
    for (const domain of asked) verdicts.set(domain, "unknown");
    logger.error(
      { tenantId, target, asked: asked.length, err: err instanceof Error ? err.message : String(err) },
      "citation-opportunities: listed check failed, no domain will be skipped this week",
    );
    return { verdicts, costUsd: 0, called: true };
  }
}

/** True only for a domain upstream positively confirmed as already linking. */
export function isListed(verdicts: ReadonlyMap<string, ListedVerdict>, domain: string): boolean {
  return verdicts.get(domain) === "listed";
}
