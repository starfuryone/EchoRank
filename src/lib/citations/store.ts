// src/lib/citations/store.ts
//
// The database side of Citation Finder: the citations the rollup has not seen
// yet, and the upsert that folds them into `sources`.
//
// ── Citation.sourceId IS the watermark ──────────────────────────────────────
// The schema already said so — "Set by the Source aggregator. Null until a
// domain has been rolled up." — and nothing had ever set it. This module is
// that aggregator. Selecting `sourceId: null`, rolling those rows up, and
// stamping them in the same transaction gives idempotency by construction:
//
//   - No window arithmetic. Share of Voice recomputes a rolling 28 days and
//     OVERWRITES, so overlapping windows are harmless there. These counters
//     ACCUMULATE, so an overlapping window would double-count and a
//     non-overlapping one would silently drop every citation written while the
//     job was down. A watermark has neither failure mode.
//   - A retry after a partial write is safe: the rows the first attempt
//     stamped are no longer selected, and the rows it did not stamp were never
//     committed, because the upsert and the stamp share one transaction.
//   - The backfill is not a special code path. Every pre-existing citation has
//     a null sourceId, so scripts/backfill-citation-sources.ts is this same
//     function with a bigger budget.
//
// EVERY QUERY IS TENANT-SCOPED, including the ones a brandProfileId already
// narrows — a brand profile id is a cuid an attacker could hold from another
// tenant. Same bar CLAUDE.md sets and sov/store.ts documents.

import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { countsAsEntity } from "@/lib/sov/observations";
import { aggregateCitations, mergeRollup, type CitationObservation } from "./aggregate";

/**
 * Citations folded into `sources` per transaction.
 *
 * Bounds both the memory the aggregation holds and the time the transaction
 * keeps rows locked. A brand's nightly volume is far below this, so the normal
 * case is one batch; the backfill is the case that actually loops.
 */
export const ROLLUP_BATCH = 2_000;

/** One brand profile the rollup has to sweep. */
export interface CitationBrandProfile {
  brandProfileId: string;
  tenantId: string;
  brandName: string;
}

/**
 * Brand profiles with tracking on, for one tenant or all of them.
 *
 * Same filter the checkup sweep and the SoV sweep use, so a brand paused in the
 * wizard stops accruing sources at the moment it stops accruing runs.
 */
export async function listCitationBrandProfiles(
  tenantId?: string,
): Promise<CitationBrandProfile[]> {
  const rows = await prisma.brandProfile.findMany({
    where: { trackingActive: true, ...(tenantId ? { tenantId } : {}) },
    select: { id: true, tenantId: true, name: true },
  });

  return rows.map((row) => ({
    brandProfileId: row.id,
    tenantId: row.tenantId,
    brandName: row.name,
  }));
}

/** A citation row with the answer-level facts it inherits from its run. */
interface UnrolledCitation extends CitationObservation {
  id: string;
}

/**
 * Citations for one brand profile that no rollup has claimed.
 *
 * OLDEST FIRST, so firstSeenAt on a brand-new source row is the genuine first
 * sighting even when the backfill processes a decade of history in batches.
 *
 * Scoped through the PROMPT's brand profile rather than the checkup's, so runs
 * from the pre-checkup scheduler (null checkupId) are included — the same
 * choice loadWindowRuns() makes and for the same reason.
 *
 * ONLY status OK. A failed or spend-capped run has no answer, so any citation
 * hanging off it is debris rather than an observation.
 */
export async function loadUnrolledCitations(
  brandProfileId: string,
  tenantId: string,
  take: number = ROLLUP_BATCH,
): Promise<UnrolledCitation[]> {
  const rows = await prisma.citation.findMany({
    where: {
      tenantId,
      sourceId: null,
      promptRun: {
        tenantId,
        status: "OK",
        prompt: { brandProfileId },
      },
    },
    orderBy: { createdAt: "asc" },
    take,
    select: {
      id: true,
      domain: true,
      createdAt: true,
      promptRun: {
        select: {
          engine: true,
          brandMentioned: true,
          analysis: { select: { brandMentioned: true } },
          competitorMentions: { select: { name: true, classification: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    domain: row.domain,
    engine: row.promptRun.engine,
    // MentionAnalysis is the richer record and the one the scorer writes, but
    // the relation is optional; PromptRun.brandMentioned is not null and is
    // written by the same pass. Preferring the analysis and falling back keeps
    // rows from before the analysis table existed readable instead of silently
    // counting them as "the brand was absent".
    brandMentioned: row.promptRun.analysis?.brandMentioned ?? row.promptRun.brandMentioned,
    competitors: row.promptRun.competitorMentions
      .filter((mention) => countsAsEntity(mention.classification))
      .map((mention) => mention.name),
    createdAt: row.createdAt,
  }));
}

/** What one batch did, for the log line and the script's report. */
export interface RollupResult {
  citations: number;
  domains: number;
}

/**
 * Fold one batch of citations into `sources`, and stamp them.
 *
 * THE UPSERT AND THE STAMP SHARE A TRANSACTION. That is the whole idempotency
 * argument: if the stamp does not commit, neither does the count it came from,
 * so the next run reprocesses exactly the rows that did not land. Splitting
 * them would make a crash between the two double-count on retry.
 *
 * Reads the stored row inside the transaction and merges in memory rather than
 * using an atomic `{ increment }` update, because two of the columns —
 * enginesSeen and citesCompetitors — are JSON maps that Postgres cannot
 * increment key-wise. Doing half the columns atomically and half read-modify-
 * write would be strictly worse: it would look safe. Concurrency is handled
 * instead by the caller running one job per brand profile, keyed so it cannot
 * overlap itself.
 */
export async function rollUpBatch(
  profile: CitationBrandProfile,
  batch: readonly UnrolledCitation[],
): Promise<RollupResult> {
  if (batch.length === 0) return { citations: 0, domains: 0 };

  const rows = aggregateCitations(batch, profile.brandName);

  await prisma.$transaction(async (tx) => {
    for (const fresh of rows) {
      const stored = await tx.source.findUnique({
        where: {
          brandProfileId_domain: { brandProfileId: profile.brandProfileId, domain: fresh.domain },
        },
        select: {
          id: true,
          citationCount: true,
          enginesSeen: true,
          brandCitations: true,
          competitorCitations: true,
          citesCompetitors: true,
          brandsSupported: true,
          firstSeenAt: true,
          lastSeenAt: true,
        },
      });

      const merged = stored
        ? mergeRollup(
            {
              citationCount: stored.citationCount,
              enginesSeen: asCountMap(stored.enginesSeen),
              brandCitations: stored.brandCitations,
              competitorCitations: stored.competitorCitations,
              citesCompetitors: asCountMap(stored.citesCompetitors),
              brandsSupported: stored.brandsSupported,
              firstSeenAt: stored.firstSeenAt,
              lastSeenAt: stored.lastSeenAt,
            },
            fresh,
          )
        : fresh;

      const values = {
        kind: merged.kind,
        citationCount: merged.citationCount,
        enginesSeen: merged.enginesSeen,
        distinctEngines: merged.distinctEngines,
        brandCitations: merged.brandCitations,
        competitorCitations: merged.competitorCitations,
        citesCompetitors: merged.citesCompetitors,
        brandsSupported: merged.brandsSupported,
        firstSeenAt: merged.firstSeenAt,
        lastSeenAt: merged.lastSeenAt,
      };

      const source = await tx.source.upsert({
        where: {
          brandProfileId_domain: { brandProfileId: profile.brandProfileId, domain: fresh.domain },
        },
        create: {
          tenantId: profile.tenantId,
          brandProfileId: profile.brandProfileId,
          domain: fresh.domain,
          ...values,
        },
        update: values,
        select: { id: true },
      });

      // Stamp only this domain's citations. The tenant scope is redundant given
      // the id list came from a tenant-scoped read, and it stays: a stray id
      // must not be able to reach across tenants even through a bug upstream.
      const ids = batch.filter((c) => c.domain === fresh.domain).map((c) => c.id);
      await tx.citation.updateMany({
        where: { id: { in: ids }, tenantId: profile.tenantId },
        data: { sourceId: source.id },
      });
    }
  });

  return { citations: batch.length, domains: rows.length };
}

/**
 * Roll up one brand profile until it runs dry, or until `maxBatches` is spent.
 *
 * The cap is a safety rail for the nightly job, which should never have more
 * than a batch or two of work and must not be able to spend a whole night
 * grinding through a backfill that belongs in a script. The script passes
 * Infinity deliberately.
 */
export async function rollUpBrandProfile(
  profile: CitationBrandProfile,
  maxBatches = 5,
): Promise<RollupResult> {
  const total: RollupResult = { citations: 0, domains: 0 };
  const domains = new Set<string>();

  for (let i = 0; i < maxBatches; i += 1) {
    const batch = await loadUnrolledCitations(profile.brandProfileId, profile.tenantId);
    if (batch.length === 0) break;

    const result = await rollUpBatch(profile, batch);
    total.citations += result.citations;
    for (const citation of batch) domains.add(citation.domain);

    // A short batch means the query is drained; another round trip would only
    // confirm it.
    if (batch.length < ROLLUP_BATCH) break;

    if (i === maxBatches - 1) {
      logger.warn(
        { brandProfileId: profile.brandProfileId, tenantId: profile.tenantId, maxBatches },
        "citation rollup hit its batch cap — a backlog remains for the next run",
      );
    }
  }

  total.domains = domains.size;
  return total;
}

/** How many citations are waiting, for the backfill script's report. */
export async function countUnrolledCitations(tenantId?: string): Promise<number> {
  return prisma.citation.count({
    where: { sourceId: null, ...(tenantId ? { tenantId } : {}) },
  });
}

/**
 * A Prisma Json column as the count map this feature stores in it.
 *
 * Defensive because the column is Json: it can legally hold an array, a string
 * or a null, and a row written by hand or by an older shape must degrade to an
 * empty map rather than crash the night's rollup. Non-numeric values are
 * dropped for the same reason.
 */
export function asCountMap(value: unknown): Record<string, number> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "number" && Number.isFinite(entry)) out[key] = entry;
  }
  return out;
}
