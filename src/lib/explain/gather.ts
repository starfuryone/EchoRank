// src/lib/explain/gather.ts
//
// The six gatherers behind "why are they winning?". Each answers one question
// about one rival, each is independently failable, and none of them can throw:
// a gatherer that cannot answer returns { ok: false, reason }, which becomes a
// factor that says out loud why it has no numbers. See types.ts for why that
// is a field rather than an omission.
//
// ── Two brakes on spend, both from the Prompt-4 pattern ─────────────────────
// 1. A 7-day Redis cache per (tenant, subject), checked first. Two rivals
//    compared in the same week share the tenant's OWN domain lookups, which is
//    where most of the saving is: your authority and your site readiness do not
//    change because you asked about a different competitor.
// 2. The monthly USD cap, checked BEFORE the request is built — not merely
//    before the fetch. A capped tenant still gets a report; it just gets one
//    with the bought factors marked "cap_reached", which the log line says out
//    loud. This is the same shape as citation-opportunities/listed.ts.
//
// EVERY QUERY IS TENANT-SCOPED, and every cache key carries the tenant id. A
// domain's backlink profile is public data, so a global cache would leak
// nothing — but it would let one tenant's spend silently subsidise another's,
// which makes the SeoApiCall rows stop describing what each tenant bought.

import { prisma } from "@/lib/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { logger } from "@/infrastructure/observability/logger";
import { BACKLINKS } from "@/lib/dataforseo/endpoints";
import { backlinksSummaryTask, parseBacklinksSummary } from "@/lib/dataforseo/backlinks-summary";
import {
  seoMeteredCallResult,
  spentThisMonth as defaultSpent,
  monthlyCapUsd as defaultCap,
  recordCall,
} from "@/lib/dataforseo/metering";
import { fetchPlace, placesConfigured } from "@/lib/signals/competitors";
import { PLACES_DETAILS_USD } from "./cost";
import type {
  AuthorityStanding,
  EntityPresence,
  GatherOutcome,
  ReviewStanding,
  RivalSource,
  SiteReadiness,
  SovGap,
} from "./types";

/** Re-exported so callers of the gatherers do not need a second import for
 *  the window they run under. Defined in window.ts — see the note there on why
 *  the report's re-run window and this TTL are derived from one number. */
export { EXPLAIN_CACHE_TTL_SECONDS } from "./window";
import { EXPLAIN_CACHE_TTL_SECONDS } from "./window";

const SIDECAR_URL = process.env.AV_SIDECAR_URL ?? "http://127.0.0.1:4500";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

/** Long enough for the sidecar's passive fetch, short enough that a hung rival
 *  site cannot hold a report open. The sidecar's own crawl is off (crawl:false),
 *  so this is one page fetch plus parsing. */
const SIDECAR_TIMEOUT_MS = 20_000;
const ENTITY_TIMEOUT_MS = 6_000;

// ─── Cache ──────────────────────────────────────────────────────────────────

function cacheKey(kind: string, tenantId: string, subject: string): string {
  return `echorank:explain:${kind}:${tenantId}:${subject}`;
}

/**
 * A cached value, or null.
 *
 * A Redis outage returns null rather than throwing: the caller then buys an
 * answer it might already have had. Spending a few cents to survive a Redis
 * blip is the right trade — the same one listed.ts makes and for the same
 * reason.
 */
async function readCache<T>(kind: string, tenantId: string, subject: string): Promise<T | null> {
  try {
    const raw = await getRedisConnection().get(cacheKey(kind, tenantId, subject));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    logger.warn(
      { tenantId, kind, subject, err: err instanceof Error ? err.message : String(err) },
      "explain: cache unreadable, treating as a miss",
    );
    return null;
  }
}

/**
 * Persist a value for the cache window.
 *
 * Never throws, and written immediately after the call it describes returns —
 * a crash later in the gather cannot cause the next run to buy the same answer
 * twice. A failure that could not be written is one we will pay for again in a
 * week; a report that died writing a cache is a report the customer never got.
 */
async function writeCache(
  kind: string,
  tenantId: string,
  subject: string,
  value: unknown,
): Promise<void> {
  try {
    await getRedisConnection().set(
      cacheKey(kind, tenantId, subject),
      JSON.stringify(value),
      "EX",
      EXPLAIN_CACHE_TTL_SECONDS,
    );
  } catch (err) {
    logger.warn(
      { tenantId, kind, subject, err: err instanceof Error ? err.message : String(err) },
      "explain: cache unwritable, the next run will re-ask",
    );
  }
}

// ─── 1. Share of voice ──────────────────────────────────────────────────────

/**
 * Engines where the rival's share beats the tenant's, on the newest snapshot.
 *
 * Reads the LATEST date only, not the window: the report is a statement about
 * where things stand, and mixing two dates would let a rival's good Tuesday
 * argue with your good Thursday. The trend belongs on the Share of Voice page,
 * which already draws it.
 *
 * An empty `sov_snapshots` is the expected state for a tenant whose nightly
 * aggregation has not run yet, and is reported as awaiting_first_aggregation
 * rather than as "they beat you nowhere" — the two are opposite conclusions
 * from the same absence of rows.
 */
export async function gatherSovGaps(input: {
  tenantId: string;
  brandProfileId: string;
  brandName: string;
  rivalName: string;
}): Promise<GatherOutcome<SovGap[]>> {
  const { tenantId, brandProfileId, brandName, rivalName } = input;

  const latest = await prisma.sovSnapshot.findFirst({
    where: { tenantId, promptSetId: brandProfileId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!latest) return { ok: false, reason: "awaiting_first_aggregation", costUsd: 0 };

  const rows = await prisma.sovSnapshot.findMany({
    where: { tenantId, promptSetId: brandProfileId, date: latest.date },
    select: { engine: true, brand: true, share: true, promptCount: true },
  });

  // Case-insensitive, exactly as the aggregator groups entities and as
  // topCompetitors() in ai-monitor/metrics.ts does. "Otterly.AI" and
  // "Otterly.ai" are one rival, and a case-sensitive match here would show a
  // customer two rows for one company on a page that shows one.
  const byEngine = new Map<string, { theirs: number; yours: number; promptCount: number }>();
  for (const row of rows) {
    const slot = byEngine.get(row.engine) ?? { theirs: 0, yours: 0, promptCount: row.promptCount };
    if (row.brand.toLowerCase() === rivalName.toLowerCase()) slot.theirs = row.share * 100;
    else if (row.brand.toLowerCase() === brandName.toLowerCase()) slot.yours = row.share * 100;
    byEngine.set(row.engine, slot);
  }

  const gaps: SovGap[] = [];
  for (const [engine, slot] of byEngine) {
    if (slot.theirs <= slot.yours) continue;
    gaps.push({
      engine,
      theirShare: slot.theirs,
      yourShare: slot.yours,
      promptCount: slot.promptCount,
    });
  }
  // Worst gap first — the engine the customer is losing hardest is the one the
  // evidence line should name.
  gaps.sort((a, b) => b.theirShare - b.yourShare - (a.theirShare - a.yourShare));
  return { ok: true, value: gaps, costUsd: 0 };
}

// ─── 2. Cited sources ───────────────────────────────────────────────────────

/**
 * Domains that cite the rival, with the tenant's own standing on each.
 *
 * `citesCompetitors` is the per-rival split Citation Finder's preset filter
 * reads — a JSON object keyed by the rival name as the engine spelled it. The
 * filtering is done in JS rather than SQL because the key is a rival NAME
 * inside a JSONB object and Prisma cannot express a case-insensitive key
 * lookup against it; the row count here is small by construction (one row per
 * cited domain per brand profile).
 *
 * The interesting rows are the ones where they are cited and you are not, so
 * those sort first — but a source citing you both is still evidence and is
 * kept, because "they get 12 mentions there and you get 1" is a real finding.
 */
export async function gatherRivalSources(input: {
  tenantId: string;
  brandProfileId: string;
  rivalName: string;
}): Promise<GatherOutcome<RivalSource[]>> {
  const { tenantId, brandProfileId, rivalName } = input;

  const rows = await prisma.source.findMany({
    where: { tenantId, brandProfileId, competitorCitations: { gt: 0 } },
    select: {
      domain: true,
      brandCitations: true,
      distinctEngines: true,
      citesCompetitors: true,
    },
  });

  const wanted = rivalName.toLowerCase();
  const found: RivalSource[] = [];
  for (const row of rows) {
    const split = (row.citesCompetitors ?? {}) as Record<string, unknown>;
    // Summed across spellings, not first-match: the aggregator stores whatever
    // casing each engine used, so "Otterly.AI": 12 and "Otterly.ai": 1 are the
    // same rival and taking one would under-report them by an order of
    // magnitude on exactly the domains that matter most.
    let citations = 0;
    for (const [name, count] of Object.entries(split)) {
      if (name.toLowerCase() === wanted && typeof count === "number") citations += count;
    }
    if (citations > 0) {
      found.push({
        domain: row.domain,
        rivalCitations: citations,
        brandCitations: row.brandCitations,
        distinctEngines: row.distinctEngines,
      });
    }
  }

  // Sources that cite them and never you, first; then by how heavily they cite
  // them. This is the order the fix link walks to pick a domain to point at.
  found.sort((a, b) => {
    if ((a.brandCitations === 0) !== (b.brandCitations === 0)) return a.brandCitations === 0 ? -1 : 1;
    return b.rivalCitations - a.rivalCitations;
  });
  return { ok: true, value: found, costUsd: 0 };
}

// ─── 3. Reviews (METERED — Google Places) ───────────────────────────────────

/**
 * Places standing for the rival and the tenant.
 *
 * METERED, and metered by a CONSTANT rather than from the response, because
 * Places does not return a price the way DataForSEO does. See cost.ts for the
 * SKU that fixes the rate. The SeoApiCall row is written under feature
 * "local_seo" — the existing CreditFeature that already covers Google local
 * surfaces — so this spend shows up in the same monthly total the cap is
 * computed from, which is what makes the cap check below meaningful.
 *
 * `no_place_id` is the ordinary outcome for an AI-visibility rival: a SaaS
 * competitor has no Google Business listing, and saying so is more useful than
 * a zero that reads like a bad rating.
 */
export async function gatherReviews(input: {
  tenantId: string;
  rivalPlaceId: string | null;
  yourPlaceId: string | null;
  spent?: (tenantId: string) => Promise<number>;
  cap?: (tenantId: string) => Promise<number>;
  fetchDetails?: typeof fetchPlace;
}): Promise<GatherOutcome<{ them: ReviewStanding; you: ReviewStanding }>> {
  const {
    tenantId,
    rivalPlaceId,
    yourPlaceId,
    spent = defaultSpent,
    cap = defaultCap,
    fetchDetails = fetchPlace,
  } = input;

  if (!rivalPlaceId) return { ok: false, reason: "no_place_id", costUsd: 0 };
  if (!placesConfigured()) return { ok: false, reason: "not_configured", costUsd: 0 };

  const needed = [rivalPlaceId, yourPlaceId].filter((id): id is string => Boolean(id));
  const cached = new Map<string, ReviewStanding>();
  for (const id of needed) {
    const hit = await readCache<ReviewStanding>("reviews", tenantId, id);
    if (hit) cached.set(id, hit);
  }
  const toBuy = needed.filter((id) => !cached.has(id));

  if (toBuy.length > 0) {
    // ── The cap, checked BEFORE anything is built or fetched ──────────────
    const [spentUsd, capUsd] = await Promise.all([spent(tenantId), cap(tenantId)]);
    if (spentUsd >= capUsd) {
      logger.warn(
        { tenantId, spentUsd, capUsd, wanted: toBuy.length },
        "explain: monthly budget reached, Places review comparison skipped",
      );
      return { ok: false, reason: "cap_reached", costUsd: 0 };
    }
  }

  let costUsd = 0;
  for (const id of toBuy) {
    const result = await fetchDetails(id);
    // Billed either way where a request actually left the building. A failed
    // Places call is still a Places call, and a row that omits it would make
    // the cap under-count real spend.
    costUsd += PLACES_DETAILS_USD;
    await recordCall({
      tenantId,
      feature: "local_seo",
      path: "places.googleapis.com/v1/places/details",
      costUsd: PLACES_DETAILS_USD,
      ok: result.ok,
    });
    if (!result.ok) {
      logger.warn({ tenantId, placeId: id, err: result.error }, "explain: Places lookup failed");
      continue;
    }
    const standing: ReviewStanding = {
      rating: result.place.rating ?? null,
      reviewCount: result.place.reviewCount ?? null,
    };
    cached.set(id, standing);
    await writeCache("reviews", tenantId, id, standing);
  }

  const them = cached.get(rivalPlaceId);
  if (!them) return { ok: false, reason: "upstream_failed", costUsd };

  return {
    ok: true,
    value: {
      them,
      you: (yourPlaceId ? cached.get(yourPlaceId) : null) ?? { rating: null, reviewCount: null },
    },
    costUsd,
  };
}

// ─── 4. Site readiness (av-visibility sidecar, free) ────────────────────────

/**
 * The sidecar's passive AI-readiness read of both domains.
 *
 * Calls the sidecar DIRECTLY rather than through /api/av/audit. That route is
 * the PUBLIC free-tier proxy: it is capped at one audit per IP per day in an
 * in-process Map, which would mean the second rival a customer asked about got
 * a 429 caused by the first. This is an authenticated, tenant-scoped,
 * server-side call to the same sidecar endpoint, with crawl:false so it stays
 * one page fetch.
 */
export async function gatherSite(input: {
  tenantId: string;
  rivalDomain: string;
  yourDomain: string | null;
  fetchImpl?: typeof fetch;
}): Promise<GatherOutcome<{ them: SiteReadiness; you: SiteReadiness }>> {
  const { tenantId, rivalDomain, yourDomain, fetchImpl = fetch } = input;

  const audit = async (domain: string): Promise<SiteReadiness | null> => {
    const hit = await readCache<SiteReadiness>("site", tenantId, domain);
    if (hit) return hit;
    try {
      const res = await fetchImpl(`${SIDECAR_URL}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Secret": INTERNAL_SECRET },
        body: JSON.stringify({ url: domain, crawl: false }),
        signal: AbortSignal.timeout(SIDECAR_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as {
        score?: number;
        checks?: unknown[];
      };
      // A check is (name, points, max, detail, recommendation) — the tuple
      // ai_visibility_audit.py builds. Anything scoring below its own maximum
      // is a failure worth naming in the evidence line.
      const failures = (body.checks ?? [])
        .filter(
          (check): check is [string, number, number, ...unknown[]] =>
            Array.isArray(check) &&
            typeof check[0] === "string" &&
            typeof check[1] === "number" &&
            typeof check[2] === "number",
        )
        .filter((check) => check[1] < check[2])
        .map((check) => check[0]);
      const standing: SiteReadiness = {
        score: typeof body.score === "number" ? body.score : null,
        failures,
      };
      await writeCache("site", tenantId, domain, standing);
      return standing;
    } catch (err) {
      logger.warn(
        { tenantId, domain, err: err instanceof Error ? err.message : String(err) },
        "explain: sidecar audit failed",
      );
      return null;
    }
  };

  const [them, you] = await Promise.all([
    audit(rivalDomain),
    yourDomain ? audit(yourDomain) : Promise.resolve(null),
  ]);

  if (!them) return { ok: false, reason: "upstream_failed", costUsd: 0 };
  return {
    ok: true,
    value: { them, you: you ?? { score: null, failures: [] } },
    costUsd: 0,
  };
}

// ─── 5. Authority (METERED — DataForSEO backlinks) ──────────────────────────

/**
 * backlinks/summary for both domains.
 *
 * The most expensive gatherer (~$0.025 per domain) and the one the cap check
 * exists for. Cached per domain, which is where the saving lands: comparing
 * three rivals in one week buys your own domain once, not three times.
 *
 * Billed from the RESPONSE via seoMeteredCallResult, never from cost.ts — the
 * constants there are for the estimate shown before the run. See the note at
 * the top of cost.ts.
 */
export async function gatherAuthority(input: {
  tenantId: string;
  rivalDomain: string;
  yourDomain: string | null;
  spent?: (tenantId: string) => Promise<number>;
  cap?: (tenantId: string) => Promise<number>;
  call?: typeof seoMeteredCallResult;
}): Promise<GatherOutcome<{ them: AuthorityStanding; you: AuthorityStanding }>> {
  const {
    tenantId,
    rivalDomain,
    yourDomain,
    spent = defaultSpent,
    cap = defaultCap,
    call = seoMeteredCallResult,
  } = input;

  const needed = [rivalDomain, yourDomain].filter((d): d is string => Boolean(d));
  const standings = new Map<string, AuthorityStanding>();
  for (const domain of needed) {
    const hit = await readCache<AuthorityStanding>("authority", tenantId, domain);
    if (hit) standings.set(domain, hit);
  }
  const toBuy = needed.filter((domain) => !standings.has(domain));

  if (toBuy.length > 0) {
    // ── The cap, checked BEFORE the request is built ──────────────────────
    // Not merely before the fetch. A capped tenant's report still renders; the
    // authority row just says why it is empty.
    const [spentUsd, capUsd] = await Promise.all([spent(tenantId), cap(tenantId)]);
    if (spentUsd >= capUsd) {
      logger.warn(
        { tenantId, spentUsd, capUsd, wanted: toBuy.length },
        "explain: monthly SEO budget reached, authority comparison skipped",
      );
      return { ok: false, reason: "cap_reached", costUsd: 0 };
    }
  }

  let costUsd = 0;
  for (const domain of toBuy) {
    try {
      const result = await call<{ tasks?: { result?: unknown[] }[] }>(
        tenantId,
        BACKLINKS.summary,
        backlinksSummaryTask(domain, { includeSubdomains: true }),
      );
      costUsd += result.billing.costUsd;
      const parsed = parseBacklinksSummary(
        result.data as Parameters<typeof parseBacklinksSummary>[0],
      );
      const standing: AuthorityStanding = {
        referringDomains: parsed.referringDomains,
        rank: parsed.rank,
      };
      standings.set(domain, standing);
      await writeCache("authority", tenantId, domain, standing);
    } catch (err) {
      // Fail closed for THIS domain only, and do not retry: a retry is a second
      // call and a second charge for an answer we already failed to get — the
      // same reasoning listed.ts records.
      logger.error(
        { tenantId, domain, err: err instanceof Error ? err.message : String(err) },
        "explain: backlinks summary failed",
      );
    }
  }

  const them = standings.get(rivalDomain);
  if (!them) return { ok: false, reason: "upstream_failed", costUsd };

  return {
    ok: true,
    value: {
      them,
      you: (yourDomain ? standings.get(yourDomain) : null) ?? { referringDomains: 0, rank: 0 },
    },
    costUsd,
  };
}

// ─── 6. Entities (HEAD checks, free) ────────────────────────────────────────

/**
 * Whether the knowledge graph knows each brand.
 *
 * HEAD requests against canonical slug URLs — no page is read, nothing is
 * parsed, and no API key is involved. Presence must be POSITIVELY confirmed:
 * anything that is not a clear hit counts as absent, because a 403 from a
 * bot-blocking host is not evidence that an entity exists.
 *
 * Wikidata has no slug URL of its own, so the check goes through
 * Special:ItemByTitle, which 3xx-redirects to the item when one exists and
 * renders a 200 error page when it does not. Redirect following is therefore
 * off, and a 3xx IS the positive answer.
 */
export async function gatherEntities(input: {
  rivalName: string;
  brandName: string;
  fetchImpl?: typeof fetch;
}): Promise<GatherOutcome<{ them: EntityPresence; you: EntityPresence }>> {
  const { rivalName, brandName, fetchImpl = fetch } = input;

  const present = async (url: string, redirectIsHit: boolean): Promise<boolean> => {
    try {
      const res = await fetchImpl(url, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(ENTITY_TIMEOUT_MS),
      });
      if (redirectIsHit) return res.status >= 300 && res.status < 400;
      return res.status === 200;
    } catch {
      return false;
    }
  };

  const check = async (name: string): Promise<EntityPresence> => {
    const slug = encodeURIComponent(name.trim().replace(/\s+/g, "_"));
    const org = encodeURIComponent(name.trim().toLowerCase().replace(/\s+/g, "-"));
    const [wikipedia, wikidata, crunchbase] = await Promise.all([
      present(`https://en.wikipedia.org/wiki/${slug}`, false),
      present(`https://www.wikidata.org/wiki/Special:ItemByTitle/enwiki/${slug}`, true),
      present(`https://www.crunchbase.com/organization/${org}`, false),
    ]);
    return { wikipedia, wikidata, crunchbase };
  };

  const [them, you] = await Promise.all([check(rivalName), check(brandName)]);
  return { ok: true, value: { them, you }, costUsd: 0 };
}

/** How many of the three an entity presence carries. The factor's unit. */
export function entityCount(presence: EntityPresence): number {
  return Number(presence.wikipedia) + Number(presence.wikidata) + Number(presence.crunchbase);
}
