// src/lib/citation-opportunities/store.ts
//
// The database side of the Citation Opportunity Engine: which domains are
// candidates, which are already dealt with, and the upsert that writes the
// week's worklist.
//
// ── This module READS `sources`. It never writes it, and it never touches
//    `citations` at all ─────────────────────────────────────────────────────
// Which is the whole answer to the watermark question. Citation Finder's
// idempotency rests on Citation.sourceId — the rollup selects rows with a null
// sourceId, folds them in, and stamps them in the same transaction. This
// feature reads the ALREADY-ROLLED-UP `sources` table, so it neither selects
// nor stamps a Citation row and cannot advance, retard or race that watermark.
// A weekly sweep and a nightly rollup are independent by construction, not by
// scheduling luck. (That is also why the weekly cron sits well clear of 03:35:
// belt and braces, not a correctness requirement.)
//
// ── The grain lift, and where it happens ────────────────────────────────────
// `sources` is keyed (brandProfileId, domain). `citation_opportunities` is
// keyed (tenantId, domain), because getting listed on g2.com is ONE job however
// many brand profiles a tenant tracks. The lift happens HERE, before scoring,
// which matters for the predicate: a domain that cites brand A but not brand B
// is not an opportunity for this tenant, because the tenant IS cited there.
// Lifting after scoring would have produced two rows and then had to pick one.
//
// ── EVERY QUERY IS TENANT-SCOPED ────────────────────────────────────────────
// Including the ones a domain already narrows. Same bar CLAUDE.md sets and
// citations/store.ts documents: an id or a domain arriving from a request is
// attacker-controlled, and `findFirst({ id, tenantId })` is the shape.

import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { asCountMap } from "@/lib/citations/store";
import { registrableDomain } from "@/lib/registrable-domain";
import type { CitationKind, Prisma } from "@/generated/prisma";
import {
  scoreAll,
  type OpportunityCandidate,
  type OpportunityStatus,
  type ScoredOpportunity,
} from "./score";

/**
 * Most `sources` rows read into memory for one tenant's sweep.
 *
 * The rows have to be READ, not aggregated in SQL: engineSpread and rivalLift
 * come out of two Json columns, and Postgres cannot sum a JSONB object's values
 * into a GROUP BY without a query this codebase has nowhere else. The cap is
 * therefore a real bound on memory, taken from the most-cited end so that if it
 * ever bites, what falls off is the tail rather than the head. It is logged
 * when it does.
 */
export const CANDIDATE_ROW_CAP = 2_000;

/** One tenant with something to sweep. */
export interface OpportunityTenant {
  tenantId: string;
  /** The tenant's own site, registrable-domain normalised. Null when unset. */
  target: string | null;
  /** One of the brand's topics, for the pitch templates. Null when unset. */
  theme: string | null;
}

/**
 * Tenants whose brand profiles are actively tracked.
 *
 * Same `trackingActive` filter the checkup sweep, the SoV sweep and the
 * citation rollup use, so a brand paused in the wizard stops accruing
 * opportunities at the moment it stops accruing citations.
 *
 * `target` and `theme` come from the OLDEST tracked profile that has one. A
 * tenant with several brands has one backlink profile and one set of listings —
 * the point of the (tenantId, domain) grain — so a single target is the honest
 * choice, and taking the oldest makes it stable week to week rather than
 * dependent on row order.
 */
export async function listOpportunityTenants(tenantId?: string): Promise<OpportunityTenant[]> {
  const profiles = await prisma.brandProfile.findMany({
    where: { trackingActive: true, ...(tenantId ? { tenantId } : {}) },
    orderBy: { createdAt: "asc" },
    select: { tenantId: true, website: true, topics: true },
  });

  const byTenant = new Map<string, OpportunityTenant>();
  for (const profile of profiles) {
    const existing = byTenant.get(profile.tenantId) ?? {
      tenantId: profile.tenantId,
      target: null,
      theme: null,
    };
    if (existing.target === null && profile.website) {
      existing.target = safeDomain(profile.website);
    }
    if (existing.theme === null && profile.topics.length > 0) {
      existing.theme = profile.topics[0] ?? null;
    }
    byTenant.set(profile.tenantId, existing);
  }

  return [...byTenant.values()];
}

/** A website field is free text; a bad one must not throw the whole sweep. */
function safeDomain(website: string): string | null {
  try {
    const domain = registrableDomain(website);
    return domain.length > 0 ? domain : null;
  } catch {
    return null;
  }
}

/**
 * Candidate domains for one tenant, aggregated to the tenant grain.
 *
 * The predicate is Citation Finder's `opportunity` preset lifted a grain:
 *
 *   - CITES RIVALS: at least one `sources` row for the domain has
 *     competitorCitations > 0. Filtered in SQL, on the column rather than on
 *     the citesCompetitors JSON — the aggregator writes the two together and
 *     only one of them is indexable. (citations/read.ts makes the same call for
 *     the same reason.)
 *   - NEVER CITES US: no `sources` row for the domain, for ANY of this tenant's
 *     brand profiles, has brandCitations > 0. DERIVED, not read from a column —
 *     there is no citesYou column and the schema explains at length why there
 *     must not be one.
 *
 * The two halves are two queries rather than one because the second is a
 * distinct-domain exclusion set, and expressing "no sibling row anywhere in
 * this tenant has brandCitations > 0" as a single Prisma filter would need a
 * correlated subquery this client cannot express without raw SQL.
 */
export async function loadCandidates(tenantId: string): Promise<OpportunityCandidate[]> {
  const scope: Prisma.SourceWhereInput = { tenantId };

  const [rows, cited] = await Promise.all([
    prisma.source.findMany({
      where: { ...scope, competitorCitations: { gt: 0 } },
      // Most-cited first, so the cap below drops the tail and not the head.
      orderBy: { citationCount: "desc" },
      take: CANDIDATE_ROW_CAP + 1,
      select: {
        domain: true,
        kind: true,
        citationCount: true,
        enginesSeen: true,
        citesCompetitors: true,
      },
    }),
    // Every domain that has EVER named this tenant, across every brand profile.
    prisma.source.findMany({
      where: { ...scope, brandCitations: { gt: 0 } },
      distinct: ["domain"],
      select: { domain: true },
    }),
  ]);

  if (rows.length > CANDIDATE_ROW_CAP) {
    logger.warn(
      { tenantId, cap: CANDIDATE_ROW_CAP },
      "citation-opportunities: candidate rows hit the cap; the least-cited tail is not scored this week",
    );
  }

  const citesUs = new Set(cited.map((row) => row.domain));

  // domain -> the tenant-grain aggregate.
  const merged = new Map<string, OpportunityCandidate & { engines: Set<string> }>();

  for (const row of rows.slice(0, CANDIDATE_ROW_CAP)) {
    if (citesUs.has(row.domain)) continue;

    const rivals = asCountMap(row.citesCompetitors);
    const rivalLift = Object.values(rivals).reduce((sum, count) => sum + count, 0);
    const engines = Object.keys(asCountMap(row.enginesSeen));

    const existing = merged.get(row.domain);
    if (existing) {
      existing.seenCount += row.citationCount;
      existing.rivalLift += rivalLift;
      for (const engine of engines) existing.engines.add(engine);
      // Two brand profiles can classify the same domain identically — the
      // classifier is a pure function of the domain — so a disagreement means
      // one row predates a classifier change. Keep the more specific answer.
      if (existing.kind === "OTHER" && row.kind !== "OTHER") existing.kind = row.kind;
      continue;
    }

    merged.set(row.domain, {
      domain: row.domain,
      kind: row.kind,
      seenCount: row.citationCount,
      engineSpread: 0, // filled from the union below
      rivalLift,
      engines: new Set(engines),
    });
  }

  return [...merged.values()].map((entry) => ({
    domain: entry.domain,
    kind: entry.kind as CitationKind,
    seenCount: entry.seenCount,
    // The UNION across brand profiles, not the sum: an engine that cited this
    // domain for two of the tenant's brands is still one engine.
    engineSpread: entry.engines.size,
    rivalLift: entry.rivalLift,
  }));
}

/**
 * Domains this tenant has already settled by hand.
 *
 * DONE and DISMISSED both count. The customer has told us either "I did this"
 * or "not for us", and a weekly job that re-raised either would be arguing with
 * them once a week forever. OPEN and IN_PROGRESS are re-scored normally: their
 * numbers should move as the engines keep citing.
 */
export async function loadManualSkips(tenantId: string): Promise<Set<string>> {
  const rows = await prisma.citationOpportunity.findMany({
    where: { tenantId, status: { in: ["DONE", "DISMISSED"] } },
    select: { domain: true },
  });
  return new Set(rows.map((row) => row.domain));
}

export interface UpsertResult {
  /** Domains that did not exist before this sweep. */
  created: string[];
  /** Domains whose scores were refreshed. */
  updated: string[];
}

/**
 * Write the week's worklist.
 *
 * UPSERT ON (tenantId, domain), which is the unique index, so a re-run restates
 * the week rather than doubling it — the same property that makes the worker
 * safe to retry.
 *
 * `status` is written ONLY on create. An update that reset it would undo the
 * customer's own click every Monday morning, which is the single worst thing
 * this job could do. `howTo`, `kind`, `theme` and the scores ARE refreshed: the
 * advice should track a reclassified domain, and the scores must track the
 * citations that have accrued since.
 */
export async function upsertOpportunities(
  tenantId: string,
  scored: readonly ScoredOpportunity[],
): Promise<UpsertResult> {
  const created: string[] = [];
  const updated: string[] = [];

  for (const row of scored) {
    // Read before write so "is this new" is answerable — Prisma's upsert does
    // not report which branch it took. Scoped by the unique key, which is
    // tenant-scoped, so this cannot see another tenant's row.
    const existing = await prisma.citationOpportunity.findUnique({
      where: { tenantId_domain: { tenantId, domain: row.domain } },
      select: { id: true },
    });

    await prisma.citationOpportunity.upsert({
      where: { tenantId_domain: { tenantId, domain: row.domain } },
      create: {
        tenantId,
        domain: row.domain,
        impact: row.impact,
        priority: row.priority,
        effort: row.effort,
        kind: row.kind,
        howTo: row.howTo,
        theme: row.theme,
      },
      update: {
        impact: row.impact,
        priority: row.priority,
        effort: row.effort,
        kind: row.kind,
        howTo: row.howTo,
        theme: row.theme,
        // status deliberately absent — see this function's comment.
      },
    });

    if (existing) updated.push(row.domain);
    else created.push(row.domain);
  }

  return { created, updated };
}

/**
 * Retire opportunities whose domain has stopped qualifying.
 *
 * A domain that finally cited the brand, or whose rival citations aged out of
 * the rollup, is no longer a job. It is DELETED rather than flagged: the row
 * carries no history worth keeping (every number on it is recomputed weekly)
 * and leaving it would mean the worklist shows work that is not work.
 *
 * DONE and DISMISSED rows are exempt. A DONE row is the record of a job the
 * customer finished, and it is the row the "proof" badge hangs off when the
 * citation finally flips — deleting it at the moment it succeeded would erase
 * the only evidence the tool ever worked.
 */
export async function retireStaleOpportunities(
  tenantId: string,
  liveDomains: readonly string[],
): Promise<number> {
  const { count } = await prisma.citationOpportunity.deleteMany({
    where: {
      tenantId,
      status: { in: ["OPEN", "IN_PROGRESS"] },
      domain: { notIn: [...liveDomains] },
    },
  });
  return count;
}

/**
 * One tenant's whole sweep: candidates in, worklist out.
 *
 * Pure orchestration — the arithmetic is ./score.ts, the spend is ./listed.ts,
 * and the queries are above. Returns what the worker needs for its log line and
 * for the p75 notification pass.
 */
export interface SweepInput {
  tenant: OpportunityTenant;
  /** Domains confirmed as already linking to the tenant. */
  listed: ReadonlySet<string>;
}

export interface SweepResult {
  scored: ScoredOpportunity[];
  created: string[];
  updated: string[];
  retired: number;
  /** Candidates dropped because they were already listed or already settled. */
  skippedListed: number;
  skippedManual: number;
}

export async function sweepTenant(input: SweepInput): Promise<SweepResult> {
  const { tenant, listed } = input;
  const { tenantId } = tenant;

  const [candidates, manualSkips] = await Promise.all([
    loadCandidates(tenantId),
    loadManualSkips(tenantId),
  ]);

  let skippedListed = 0;
  let skippedManual = 0;

  const live = candidates.filter((candidate) => {
    if (manualSkips.has(candidate.domain)) {
      skippedManual += 1;
      return false;
    }
    if (listed.has(candidate.domain)) {
      skippedListed += 1;
      return false;
    }
    return true;
  });

  const scored = scoreAll(live, tenant.theme);
  const { created, updated } = await upsertOpportunities(tenantId, scored);
  const retired = await retireStaleOpportunities(
    tenantId,
    scored.map((row) => row.domain),
  );

  return { scored, created, updated, retired, skippedListed, skippedManual };
}

// ─── Status transitions ─────────────────────────────────────────────────────

/**
 * Every status can move to every other one, and that is a decision.
 *
 * A worklist is not a workflow. A customer who marks something DONE and then
 * realises the listing never went live has to be able to put it back, and one
 * who DISMISSES a directory and then changes their mind should not have to wait
 * for a weekly job to re-raise it. The only thing a transition is not allowed
 * to be is a value outside the enum, which is what this guard is for.
 */
export function isOpportunityStatus(value: unknown): value is OpportunityStatus {
  return (
    value === "OPEN" || value === "IN_PROGRESS" || value === "DONE" || value === "DISMISSED"
  );
}

/**
 * Set one opportunity's status.
 *
 * SCOPED BY TENANT IN THE WHERE CLAUSE, not by a check-then-write: updateMany
 * with tenantId in the filter cannot be raced into touching another tenant's
 * row the way a findUnique followed by an update can. Same shape the tracked
 * prompt PATCH route uses.
 *
 * Returns false when the id does not belong to this tenant — the route turns
 * that into a 404, which is the same answer a genuinely missing id gets, so the
 * endpoint cannot be used to probe for other tenants' ids.
 */
export async function setOpportunityStatus(
  tenantId: string,
  id: string,
  status: OpportunityStatus,
): Promise<boolean> {
  const { count } = await prisma.citationOpportunity.updateMany({
    where: { id, tenantId },
    data: { status },
  });
  return count > 0;
}
