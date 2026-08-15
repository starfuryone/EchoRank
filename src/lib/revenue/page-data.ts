// src/lib/revenue/page-data.ts
//
// Server-side read model for /visibility/tools/revenue.
//
// ── STORED HEADLINE, DERIVED BREAKDOWN ──────────────────────────────────────
// The two headline numbers come from the RevenueRollup row the nightly job
// wrote: that row is the record, and it is what a customer screenshots into a
// client report. The per-source and per-engine tables are computed here from
// the same ai_visits and sov_snapshots rows, because storing a distribution
// beside its own total is how a table ends up disagreeing with the number above
// it after a re-run.
//
// The cost of that split is that the two can drift between a settings edit and
// the next nightly run, so this module computes the live figures as well and
// reports `stale` when they differ. Saying "tonight's run will restate this" is
// better than either showing a number nobody can reproduce or quietly
// recomputing the record on read.

import {
  ATTRIBUTION_MODELS,
  computeRollup,
  creditLeads,
  lostByEngine,
  wonBySource,
  type AttributionModel,
  type RevenueAssumptions,
  type RevenueMode,
} from "./model";
import {
  loadAssumptions,
  loadShares,
  loadTouches,
  monthKey,
  readRollup,
  type MonthShares,
} from "./store";

export interface SourceRow {
  source: string;
  leads: number;
  wonRevenue: number;
}

export interface EngineRow {
  engine: string;
  /** Fractions 0..1, as stored. The client renders them as points. */
  ownShare: number;
  topRivalShare: number;
  lostRevenueEst: number;
}

export interface RevenuePageData {
  /** False when this tenant has no AI visit and no snapshot — drives the empty state. */
  hasData: boolean;
  month: string;
  /** Every month with either a stored rollup or live touches, newest first. */
  months: string[];
  model: AttributionModel;
  models: readonly AttributionModel[];

  /**
   * THE MODE OF EVERY FIGURE BELOW. Rendered inline beside each number, never
   * as a footnote and never as a tooltip — a reader who does not know whether
   * "$4,050" was counted or inferred has been told nothing useful.
   */
  mode: RevenueMode;
  /** True when a measured row is shown and a proxy row for the month survives. */
  alsoHasProxy: boolean;

  wonRevenue: number;
  lostRevenueEst: number;
  leads: number;
  /** Leads the tenant would see at its top rival's share. */
  addressable: number;

  /** True when the stored row no longer matches today's assumptions. */
  stale: boolean;
  /** False when nothing has been rolled up yet and the figures are live. */
  fromRollup: boolean;

  assumptions: RevenueAssumptions;
  shares: {
    ownShare: number;
    topRivalShare: number;
    topRivalBrand: string | null;
    brandName: string | null;
    asOf: string | null;
  };

  bySource: SourceRow[];
  byEngine: EngineRow[];
}

export function currentMonth(now: Date = new Date()): string {
  return monthKey(now);
}

/** The months a tenant can look at: every one with a stored rollup, plus this one. */
async function listMonths(tenantId: string, thisMonth: string): Promise<string[]> {
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.revenueRollup.findMany({
    where: { tenantId },
    select: { month: true },
    distinct: ["month"],
    orderBy: { month: "desc" },
  });
  const months = new Set<string>(rows.map((r) => r.month));
  months.add(thisMonth);
  return [...months].sort().reverse();
}

export function emptyRevenuePageData(
  month: string,
  model: AttributionModel,
  assumptions: RevenueAssumptions = { convRate: 0.3, avgSaleValue: 450 },
): RevenuePageData {
  return {
    hasData: false,
    month,
    months: [month],
    model,
    models: ATTRIBUTION_MODELS,
    mode: "proxy",
    alsoHasProxy: false,
    wonRevenue: 0,
    lostRevenueEst: 0,
    leads: 0,
    addressable: 0,
    stale: false,
    fromRollup: false,
    assumptions,
    shares: {
      ownShare: 0,
      topRivalShare: 0,
      topRivalBrand: null,
      brandName: null,
      asOf: null,
    },
    bySource: [],
    byEngine: [],
  };
}

export async function loadRevenuePageData(
  tenantId: string,
  query: { month?: string | null; model?: string | null } = {},
): Promise<RevenuePageData> {
  const thisMonth = currentMonth();

  // Both come off a query string. An unknown value falls back to the default
  // rather than throwing — a stale bookmark should show the page, not a 500.
  const model: AttributionModel = ATTRIBUTION_MODELS.includes(
    query.model as AttributionModel,
  )
    ? (query.model as AttributionModel)
    : "last";
  const month = /^\d{4}-\d{2}$/.test(query.month ?? "") ? (query.month as string) : thisMonth;

  const [months, assumptions, { mode, touches }, shares, stored] = await Promise.all([
    listMonths(tenantId, thisMonth),
    loadAssumptions(tenantId),
    loadTouches(tenantId, month),
    loadShares(tenantId, month),
    readRollup(tenantId, month, model),
  ]);

  // Live figures, under today's assumptions. Also the fallback headline for a
  // month the nightly job has not reached yet.
  const credits = creditLeads(touches, model, mode);
  const live = computeRollup(credits, assumptions, {
    ownShare: shares.ownShare,
    topRivalShare: shares.topRivalShare,
  });

  const fromRollup = stored.shown !== null;
  const wonRevenue = stored.shown?.wonRevenue ?? live.wonRevenue;
  const lostRevenueEst = stored.shown?.lostRevenueEst ?? live.lostRevenueEst;

  return {
    hasData: touches.length > 0 || shares.asOf !== null,
    month,
    months,
    model,
    models: ATTRIBUTION_MODELS,
    // The stored row's mode wins when there is one: it is the mode the shown
    // numbers were computed under, and labelling them with today's mode would
    // caption an August proxy figure as "measured" the day P2 ships.
    mode: stored.shown?.mode ?? mode,
    alsoHasProxy: stored.alsoHasProxy,
    wonRevenue,
    lostRevenueEst,
    leads: live.leads,
    addressable: live.addressable,
    stale:
      fromRollup &&
      (stored.shown!.wonRevenue !== live.wonRevenue ||
        stored.shown!.lostRevenueEst !== live.lostRevenueEst),
    fromRollup,
    assumptions,
    shares: {
      ownShare: shares.ownShare,
      topRivalShare: shares.topRivalShare,
      topRivalBrand: shares.topRivalBrand,
      brandName: shares.brandName,
      asOf: shares.asOf,
    },
    bySource: wonBySource(credits, assumptions),
    byEngine: lostByEngine(credits, assumptions, engineInputs(shares)),
  };
}

function engineInputs(shares: MonthShares) {
  return shares.byEngine.map((e) => ({
    engine: e.engine,
    ownShare: e.ownShare,
    topRivalShare: e.topRivalShare,
  }));
}
