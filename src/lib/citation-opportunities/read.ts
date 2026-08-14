// src/lib/citation-opportunities/read.ts
//
// Server-side read model for /visibility/tools/citation-opportunities.
//
// ── The proof badge is a JOIN, not a column ─────────────────────────────────
// A DONE row means the customer says they got listed. The interesting question
// is whether it WORKED — whether the engines have since started citing that
// domain in an answer that names the brand. That is `brandCitations > 0` on the
// `sources` rows for the same domain, which is the identical predicate Citation
// Finder's "cites you" cell renders. Evaluated here, at read time, against the
// live rollup.
//
// It is deliberately not a `provenAt` column. A column would have to be written
// by something, and the only honest writer is the nightly citation rollup —
// which would mean this feature reaching into Citation Finder's aggregator to
// set a flag about itself. Deriving it costs one extra query on a page that
// already runs two, and it can never disagree with the Finder the customer will
// click through to check.
//
// ORDER COMES FROM THE DATABASE. `priority DESC` is an index
// (citation_opportunities_tenantId_priority_idx), and the list is the product:
// a client-side sort would rank whatever page happened to load.
//
// EVERY QUERY IS TENANT-SCOPED.

import { prisma } from "@/lib/prisma";
import type { CitationKind } from "@/generated/prisma";
import type { OpportunityEffort, OpportunityStatus } from "./score";

/**
 * Rows rendered at once.
 *
 * No pagination, deliberately, unlike Citation Finder's table. This is a
 * WORKLIST — the customer works down it from the top — and a list long enough
 * to paginate is a list nobody finishes. A tenant past this many opportunities
 * has a content strategy problem that page 2 does not solve, and the header
 * count says how many there are in total either way.
 */
export const OPPORTUNITY_LIST_LIMIT = 100;

export interface OpportunityRow {
  id: string;
  domain: string;
  kind: CitationKind;
  effort: OpportunityEffort;
  status: OpportunityStatus;
  /** English fallback. The client renders the localized template on `kind`. */
  howTo: string;
  /** Interpolated into the localized pitch templates. Null for other kinds. */
  theme: string | null;
  /**
   * True when this domain now cites the brand — the DONE row's proof.
   * Derived from `sources.brandCitations > 0`; never stored.
   */
  proven: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityPageData {
  /** False when this tenant has no opportunity row at all — drives the empty state. */
  hasData: boolean;
  rows: OpportunityRow[];
  /** Every row for this tenant, across statuses. The header's "N sources". */
  total: number;
  /** Rows still to do — OPEN plus IN_PROGRESS. */
  openCount: number;
  /** DONE rows whose domain has since started citing the brand. */
  provenCount: number;
  limit: number;
}

/**
 * Everything the page renders, for one tenant.
 *
 * Three queries: the worklist, its total, and the `sources` lookup that decides
 * which DONE rows have been proven. The third is scoped to the DONE domains
 * rather than run over the whole rollup — an OPEN row cannot be proven by
 * definition, since a domain that cites the brand is not a candidate.
 */
export async function loadOpportunityPageData(tenantId: string): Promise<OpportunityPageData> {
  const [rows, total] = await Promise.all([
    prisma.citationOpportunity.findMany({
      where: { tenantId },
      // Best first. Ties broken by domain so the order is stable across reads —
      // two rows scored from identical signals must not swap places between one
      // page load and the next while the customer is working down the list.
      orderBy: [{ priority: "desc" }, { domain: "asc" }],
      take: OPPORTUNITY_LIST_LIMIT,
      select: {
        id: true,
        domain: true,
        kind: true,
        effort: true,
        status: true,
        howTo: true,
        theme: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.citationOpportunity.count({ where: { tenantId } }),
  ]);

  const doneDomains = rows.filter((row) => row.status === "DONE").map((row) => row.domain);

  // The flip. `brandCitations > 0` is Citation Finder's "cites you", and the
  // tenantId filter is not redundant with the domain list: the domains came
  // from this tenant's rows, but `sources` is keyed by brand profile and the
  // same domain exists under every tenant that has ever been cited by it.
  const proven =
    doneDomains.length === 0
      ? new Set<string>()
      : new Set(
          (
            await prisma.source.findMany({
              where: { tenantId, domain: { in: doneDomains }, brandCitations: { gt: 0 } },
              distinct: ["domain"],
              select: { domain: true },
            })
          ).map((row) => row.domain),
        );

  return {
    hasData: total > 0,
    rows: rows.map((row) => ({
      id: row.id,
      domain: row.domain,
      kind: row.kind,
      effort: row.effort,
      status: row.status,
      howTo: row.howTo,
      theme: row.theme,
      proven: proven.has(row.domain),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    total,
    openCount: rows.filter((row) => row.status === "OPEN" || row.status === "IN_PROGRESS").length,
    provenCount: proven.size,
    limit: OPPORTUNITY_LIST_LIMIT,
  };
}
