// src/lib/revenue/store.ts
//
// AI Revenue Dashboard — every database read and write.
//
// EVERY QUERY IS TENANT-SCOPED. There is no findUnique-by-id anywhere in this
// module: the rollup table's natural key is (tenantId, month, model, mode) and
// every read filters on tenantId first, so no shape here can reach across
// tenants even if a caller passes an id it should not have.

import { prisma } from "@/lib/prisma";
import {
  ATTRIBUTION_MODELS,
  SHARE_FLOOR,
  type AttributionModel,
  type LeadCredits,
  type RevenueAssumptions,
  type RevenueMode,
  type Touch,
  creditLeads,
  computeRollup,
  preferMeasured,
} from "./model";

/** "YYYY-MM" for a Date, in UTC. The month key everything here is stored under. */
export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** [start, end) for a "YYYY-MM" key, in UTC. */
export function monthRange(month: string): { start: Date; end: Date } {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

/** The month before `month`, as a key. */
export function previousMonth(month: string): string {
  const { start } = monthRange(month);
  start.setUTCMonth(start.getUTCMonth() - 1);
  return monthKey(start);
}

/**
 * The touches one month's leads are counted from, and the mode they imply.
 *
 * THIS IS WHERE THE LEADS RULING LIVES. It returns ONE tagged set, never a
 * merge, so nothing downstream is capable of adding a measured lead to a proxy
 * lead — the mode is decided here, once, and travels with the data.
 *
 * The order is the ruling's: measured if AI-source conversions exist for the
 * month, otherwise the proxy. `measured` binds to AiConversion, which
 * attribution P2 has not shipped — so the first branch is unreachable today and
 * is written as a lookup that returns nothing rather than as a TODO, because
 * the day the table lands this function should start returning measured without
 * anybody having to remember it exists.
 *
 * FunnelLead IS NOT CONSULTED, deliberately. See the header on model.ts: it
 * carries no source, no visitorId and no referrer, and it is captured on a
 * different domain from the er_vid cookie, so there is no join key. Counting
 * funnel captures here would book walk-in traffic as AI revenue.
 */
export async function loadTouches(
  tenantId: string,
  month: string,
): Promise<{ mode: RevenueMode; touches: Touch[] }> {
  const { start, end } = monthRange(month);

  const measured = await loadMeasuredTouches(tenantId, start, end);
  if (measured !== null) return { mode: "measured", touches: measured };

  // Proxy: distinct AI-attributed visitors. ai_visits already collapses a
  // visitor's repeat arrivals on one page from one assistant into a single row,
  // so this counts distinct (visitor, source, page) and creditLeads() groups it
  // down to distinct visitors. `hits` is deliberately not read — a page-view
  // count presented as a lead count is the kind of inflation nobody notices
  // until a customer does.
  const visits = await prisma.aiVisit.findMany({
    where: { tenantId, firstSeen: { gte: start, lt: end } },
    select: { visitorId: true, source: true, firstSeen: true, lastSeen: true },
  });

  return {
    mode: "proxy",
    touches: visits.map((v) => ({
      visitorId: v.visitorId,
      source: v.source as string,
      firstSeen: v.firstSeen,
      lastSeen: v.lastSeen,
    })),
  };
}

/**
 * Measured AI-source conversions for the window, or null when the concept does
 * not exist yet.
 *
 * Returns null — not [] — when AiConversion is absent, because the two mean
 * different things: [] would be "measured mode, and this tenant converted
 * nobody", which is a real state worth writing a measured row for, while null
 * is "measured mode is not available at all, fall through to proxy".
 */
async function loadMeasuredTouches(
  tenantId: string,
  start: Date,
  end: Date,
): Promise<Touch[] | null> {
  // Attribution P2 has not shipped: there is no aiConversion delegate on the
  // client. Probed rather than hard-coded to null so that the day the model
  // lands and `prisma generate` runs, this starts returning measured rows with
  // no further edit here.
  const delegate = (
    prisma as unknown as {
      aiConversion?: {
        findMany: (args: unknown) => Promise<
          { visitorId: string; source: string; convertedAt: Date }[]
        >;
      };
    }
  ).aiConversion;
  if (!delegate) return null;

  const rows = await delegate.findMany({
    where: { tenantId, convertedAt: { gte: start, lt: end } },
    select: { visitorId: true, source: true, convertedAt: true },
  });

  return rows.map((r) => ({
    visitorId: r.visitorId,
    source: r.source,
    firstSeen: r.convertedAt,
    lastSeen: r.convertedAt,
  }));
}

/** The two assumptions, with the schema defaults standing in for a missing tenant. */
export async function loadAssumptions(tenantId: string): Promise<RevenueAssumptions> {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { convRate: true, avgSaleValue: true },
  });
  return {
    convRate: tenant?.convRate ?? 0.3,
    avgSaleValue: tenant?.avgSaleValue ?? 450,
  };
}

export interface EngineShare {
  engine: string;
  ownShare: number;
  topRivalShare: number;
  topRivalBrand: string | null;
}

export interface MonthShares {
  /** Pooled across engines, as fractions 0..1. */
  ownShare: number;
  topRivalShare: number;
  topRivalBrand: string | null;
  byEngine: EngineShare[];
  /** ISO day of the snapshot these came from, or null when the month has none. */
  asOf: string | null;
  brandName: string | null;
}

/**
 * Pool per-engine rows into one distribution, as FRACTIONS.
 *
 * Weighted by mentionWeighted, not a mean of the stored shares — the same
 * arithmetic src/lib/sov/read.ts does one level up, and for the same reason:
 * averaging shares would give an engine we asked four questions the same say as
 * one we asked forty. Fractions rather than the percentage points that module
 * returns, because SHARE_FLOOR is 0.01 and mixing the two units here would
 * silently move the divide-by-zero guard by a factor of a hundred.
 */
function poolFractions(
  rows: readonly { brand: string; mentionWeighted: number }[],
): Map<string, number> {
  const weights = new Map<string, number>();
  for (const row of rows) {
    weights.set(row.brand, (weights.get(row.brand) ?? 0) + row.mentionWeighted);
  }
  const total = [...weights.values()].reduce((sum, w) => sum + w, 0);
  if (total <= 0) return new Map();
  return new Map([...weights].map(([brand, weight]) => [brand, weight / total]));
}

function splitOwnAndRival(
  shares: Map<string, number>,
  brandName: string | null,
): { ownShare: number; topRivalShare: number; topRivalBrand: string | null } {
  const ownShare = (brandName !== null ? shares.get(brandName) : undefined) ?? 0;
  const rivals = [...shares]
    .filter(([brand]) => brand !== brandName)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    ownShare,
    topRivalShare: rivals[0]?.[1] ?? 0,
    topRivalBrand: rivals[0]?.[0] ?? null,
  };
}

/**
 * Share of voice for a month, as of the last snapshot that CLOSED inside it.
 *
 * One dated snapshot rather than an average across the month: a SovSnapshot row
 * is already a 28-day rolling window, so averaging thirty of them would be a
 * window over a window and would weight the first week of the month into the
 * figure four times. The last one in the month is the month's as-of position,
 * which is what "what did the gap cost us in August" is asking.
 *
 * The prompt set is the tenant's first BrandProfile, matching the default the
 * Share of Voice page opens on, and `brand` is that profile's name — the same
 * identity the aggregator wrote the rows under.
 */
export async function loadShares(tenantId: string, month: string): Promise<MonthShares> {
  const { start, end } = monthRange(month);
  const empty: MonthShares = {
    ownShare: 0,
    topRivalShare: 0,
    topRivalBrand: null,
    byEngine: [],
    asOf: null,
    brandName: null,
  };

  const profile = await prisma.brandProfile.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!profile) return empty;

  const latest = await prisma.sovSnapshot.findFirst({
    where: { tenantId, promptSetId: profile.id, date: { gte: start, lt: end } },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!latest) return { ...empty, brandName: profile.name };

  const rows = await prisma.sovSnapshot.findMany({
    where: { tenantId, promptSetId: profile.id, date: latest.date },
    select: { engine: true, brand: true, mentionWeighted: true },
  });

  const pooled = splitOwnAndRival(poolFractions(rows), profile.name);

  const engines = [...new Set(rows.map((r) => r.engine))].sort();
  const byEngine: EngineShare[] = engines.map((engine) => {
    const split = splitOwnAndRival(
      poolFractions(rows.filter((r) => r.engine === engine)),
      profile.name,
    );
    return { engine, ...split };
  });

  return {
    ...pooled,
    byEngine,
    asOf: latest.date.toISOString().slice(0, 10),
    brandName: profile.name,
  };
}

/**
 * Compute and store one tenant-month, one row per attribution model.
 *
 * FOUR ROWS, ONE MODE. Every row written by a single call shares the mode
 * `loadTouches` returned, because they are all credited from the same touch
 * set — the models differ in how they divide it, not in what it is. A month
 * cannot end up with a measured `first` row beside a proxy `linear` row from
 * one run, and the unique key means a later run in the other mode adds four
 * more rows rather than overwriting these.
 */
export async function writeRollups(
  tenantId: string,
  month: string,
): Promise<{ mode: RevenueMode; leads: number; written: number }> {
  const [{ mode, touches }, assumptions, shares] = await Promise.all([
    loadTouches(tenantId, month),
    loadAssumptions(tenantId),
    loadShares(tenantId, month),
  ]);

  let written = 0;
  let leads = 0;

  for (const model of ATTRIBUTION_MODELS) {
    const credits = creditLeads(touches, model, mode);
    const figures = computeRollup(credits, assumptions, {
      ownShare: shares.ownShare,
      topRivalShare: shares.topRivalShare,
    });
    leads = figures.leads;

    await prisma.revenueRollup.upsert({
      where: {
        tenantId_month_model_mode: { tenantId, month, model, mode },
      },
      create: {
        tenantId,
        month,
        model,
        mode,
        wonRevenue: figures.wonRevenue,
        lostRevenueEst: figures.lostRevenueEst,
      },
      update: {
        wonRevenue: figures.wonRevenue,
        lostRevenueEst: figures.lostRevenueEst,
      },
    });
    written += 1;
  }

  return { mode, leads, written };
}

export interface StoredRollup {
  month: string;
  model: AttributionModel;
  mode: RevenueMode;
  wonRevenue: number;
  lostRevenueEst: number;
}

/**
 * A month's stored rows for one attribution model, measured preferred.
 *
 * Returns the row the reader should see plus whether a proxy row survives
 * underneath it, so the page can say "this month flipped to measured" rather
 * than quietly changing a number between two visits.
 */
export async function readRollup(
  tenantId: string,
  month: string,
  model: AttributionModel,
): Promise<{ shown: StoredRollup | null; alsoHasProxy: boolean }> {
  const rows = await prisma.revenueRollup.findMany({
    where: { tenantId, month, model },
    select: {
      month: true,
      model: true,
      mode: true,
      wonRevenue: true,
      lostRevenueEst: true,
    },
  });

  const typed = rows as StoredRollup[];
  const shown = preferMeasured(typed);
  return {
    shown,
    alsoHasProxy: shown?.mode === "measured" && typed.some((r) => r.mode === "proxy"),
  };
}

/** Every tenant with a workspace, for the nightly sweep. */
export async function listTenantIds(): Promise<string[]> {
  const rows = await prisma.tenant.findMany({ select: { id: true } });
  return rows.map((r) => r.id);
}

export { SHARE_FLOOR };
export type { LeadCredits, RevenueAssumptions, RevenueMode, AttributionModel, Touch };
