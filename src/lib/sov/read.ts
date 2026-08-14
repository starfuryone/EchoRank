// src/lib/sov/read.ts
//
// Server-side read model for /visibility/tools/share-of-voice.
//
// DERIVED, NOT STORED. The headline ("you own X%, {rival} owns Y%") and the 30-day
// delta are computed here from SovSnapshot rows. They get no table and no column
// of their own on purpose: both are one subtraction away from data that already
// exists, and a stored headline is a number that can disagree with the chart
// underneath it after a re-run.
//
// EVERY QUERY IS TENANT-SCOPED, including the ones a promptSetId already
// narrows — promptSetId arrives from a query string.

import { prisma } from "@/lib/prisma";
import { SOV_WINDOW_DAYS } from "./store";

/** How far back the delta looks, and the trend line's span. */
export const SOV_DELTA_DAYS = 30;

/**
 * A delta needs two points far enough apart to mean something. A tenant whose
 * oldest snapshot is four days old gets "not enough history" rather than a
 * "30-day" change measured over four days.
 */
export const MIN_DELTA_SPAN_DAYS = 14;

/** How many named entities the stacked bar shows before it pools the tail. */
export const MAX_STACK_BRANDS = 6;

export interface SovBrandShare {
  brand: string;
  /** 0..100, percentage points — the unit everything on the page renders in. */
  share: number;
  mentionWeighted: number;
  /** True for the tracked brand's own row. Drives colour and the headline. */
  isYou: boolean;
  /** True for the pooled "everyone else" remainder, which is not an entity. */
  isOther?: boolean;
}

export interface SovEngineBreakdown {
  engine: string;
  promptCount: number;
  /** Biggest first, with the tail pooled into a trailing "Other" row. */
  brands: SovBrandShare[];
}

export interface SovTrendPoint {
  /** ISO date, YYYY-MM-DD, UTC. */
  date: string;
  /** The tracked brand's share in points, or null on a day with no snapshot. */
  share: number | null;
}

export interface SovHeadline {
  /** The tracked brand's share now, in points. */
  you: number;
  /** The largest rival, or null when nobody else was observed. */
  topRival: { brand: string; share: number } | null;
  /** Points gained or lost over SOV_DELTA_DAYS, or null without the history. */
  delta: number | null;
  /** How many days the delta actually spans, for honest copy. */
  deltaSpanDays: number | null;
}

export interface SovPromptSetOption {
  id: string;
  name: string;
}

export interface SovPageData {
  /** False when this tenant has no snapshot at all — drives the empty state. */
  hasData: boolean;
  windowDays: number;
  brandName: string | null;
  promptSets: SovPromptSetOption[];
  selectedPromptSetId: string | null;
  /** Engines this prompt set has snapshots for, on the latest date. */
  engines: string[];
  /** Null means "all engines pooled". */
  selectedEngine: string | null;
  /** ISO date of the newest snapshot, or null. */
  latestDate: string | null;
  byEngine: SovEngineBreakdown[];
  trend: SovTrendPoint[];
  headline: SovHeadline;
}

export interface SovPageQuery {
  promptSetId?: string | null;
  engine?: string | null;
}

/** Rows as the queries below select them. */
interface SnapshotRow {
  engine: string;
  brand: string;
  share: number;
  mentionWeighted: number;
  promptCount: number;
  date: Date;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Pool a set of per-engine rows into one distribution.
 *
 * WEIGHTED BY VOLUME, not a mean of the per-engine shares. Averaging shares
 * would give an engine we asked four questions the same say as one we asked
 * forty, so a brand that owns a quiet engine outright could outrank one that
 * owns most of the busy one. Re-normalising the stored `mentionWeighted` sums
 * is the same arithmetic the aggregator did per engine, one level up — and it
 * needs no column the table does not already have.
 */
function pool(rows: readonly SnapshotRow[]): Map<string, number> {
  const weights = new Map<string, number>();
  for (const row of rows) {
    weights.set(row.brand, (weights.get(row.brand) ?? 0) + row.mentionWeighted);
  }
  const total = [...weights.values()].reduce((sum, w) => sum + w, 0);
  if (total <= 0) return new Map();
  return new Map([...weights].map(([brand, weight]) => [brand, (weight / total) * 100]));
}

/**
 * Biggest first, tail pooled.
 *
 * The brand's own row is ALWAYS kept, wherever it ranks. A share-of-voice page
 * that drops you into "Other" because eight rivals outrank you has hidden the
 * one fact the reader came for, and that is exactly the situation in which the
 * fact matters most.
 */
function toStack(
  rows: readonly SnapshotRow[],
  brandName: string | null,
  promptCount: number,
  engine: string,
): SovEngineBreakdown {
  const shares = pool(rows);
  const all: SovBrandShare[] = [...shares]
    .map(([brand, share]) => ({
      brand,
      share,
      mentionWeighted: rows
        .filter((row) => row.brand === brand)
        .reduce((sum, row) => sum + row.mentionWeighted, 0),
      isYou: brandName !== null && brand === brandName,
    }))
    .sort((a, b) => b.share - a.share || a.brand.localeCompare(b.brand));

  if (all.length <= MAX_STACK_BRANDS) {
    return { engine, promptCount, brands: all };
  }

  const head = all.slice(0, MAX_STACK_BRANDS);
  const tail = all.slice(MAX_STACK_BRANDS);
  // Rescue the brand's own row out of the tail, at the cost of the last head row.
  const you = tail.find((row) => row.isYou);
  if (you) {
    head[head.length - 1] = you;
    tail.splice(tail.indexOf(you), 1);
    tail.push(all[MAX_STACK_BRANDS - 1]);
  }

  const otherShare = tail.reduce((sum, row) => sum + row.share, 0);
  return {
    engine,
    promptCount,
    brands: [
      ...head,
      {
        brand: "",
        share: otherShare,
        mentionWeighted: tail.reduce((sum, row) => sum + row.mentionWeighted, 0),
        isYou: false,
        isOther: true,
      },
    ],
  };
}

/**
 * Everything the page renders, for one tenant.
 *
 * One trip for the prompt-set list, one for the latest date, one for the
 * window's rows. The trend and the headline are both computed from that last
 * result set rather than re-queried — they are views of the same rows, and two
 * queries could land either side of a nightly write and disagree.
 */
export async function loadSovPageData(
  tenantId: string,
  query: SovPageQuery = {},
): Promise<SovPageData> {
  const empty: SovPageData = {
    hasData: false,
    windowDays: SOV_WINDOW_DAYS,
    brandName: null,
    promptSets: [],
    selectedPromptSetId: null,
    engines: [],
    selectedEngine: null,
    latestDate: null,
    byEngine: [],
    trend: [],
    headline: { you: 0, topRival: null, delta: null, deltaSpanDays: null },
  };

  // The picker lists brand profiles, not distinct snapshot ids: a set that has
  // not been rolled up yet should still be selectable and explain itself,
  // rather than being missing from a filter with no way to ask why.
  const profiles = await prisma.brandProfile.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (profiles.length === 0) return empty;

  const promptSets = profiles.map((p) => ({ id: p.id, name: p.name }));
  // An unknown or foreign id falls back to the first set rather than throwing:
  // the value comes from a query string, and a stale bookmark should show the
  // page, not a 500. Tenant scoping above is what makes the fallback safe.
  const selected =
    promptSets.find((set) => set.id === query.promptSetId) ?? promptSets[0];
  const brandName = selected.name;

  const latest = await prisma.sovSnapshot.findFirst({
    where: { tenantId, promptSetId: selected.id },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!latest) {
    return { ...empty, promptSets, selectedPromptSetId: selected.id, brandName };
  }

  const from = new Date(latest.date);
  from.setUTCDate(from.getUTCDate() - SOV_DELTA_DAYS);

  const rows: SnapshotRow[] = await prisma.sovSnapshot.findMany({
    where: {
      tenantId,
      promptSetId: selected.id,
      date: { gte: from, lte: latest.date },
    },
    orderBy: { date: "asc" },
    select: {
      engine: true,
      brand: true,
      share: true,
      mentionWeighted: true,
      promptCount: true,
      date: true,
    },
  });

  const latestKey = isoDay(latest.date);
  const onLatest = rows.filter((row) => isoDay(row.date) === latestKey);
  const engines = [...new Set(onLatest.map((row) => row.engine))].sort();

  // An engine filter naming an engine this set has no rows for is ignored
  // rather than rendering an empty page.
  const selectedEngine =
    query.engine && engines.includes(query.engine) ? query.engine : null;
  const inScope = (row: SnapshotRow) =>
    selectedEngine === null || row.engine === selectedEngine;

  const scopedLatest = onLatest.filter(inScope);

  const byEngine: SovEngineBreakdown[] = (
    selectedEngine === null ? engines : [selectedEngine]
  ).map((engine) => {
    const engineRows = onLatest.filter((row) => row.engine === engine);
    return toStack(engineRows, brandName, engineRows[0]?.promptCount ?? 0, engine);
  });

  // ── Trend: the brand's own pooled share, day by day ──
  const byDate = new Map<string, SnapshotRow[]>();
  for (const row of rows) {
    if (!inScope(row)) continue;
    const key = isoDay(row.date);
    const bucket = byDate.get(key) ?? [];
    bucket.push(row);
    byDate.set(key, bucket);
  }

  const trend: SovTrendPoint[] = [...byDate.keys()]
    .sort()
    .map((date) => ({
      date,
      share: pool(byDate.get(date)!).get(brandName) ?? 0,
    }));

  const you = pool(scopedLatest).get(brandName) ?? 0;

  const rivals = [...pool(scopedLatest)]
    .filter(([brand]) => brand !== brandName)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const topRival = rivals.length > 0 ? { brand: rivals[0][0], share: rivals[0][1] } : null;

  // ── Delta: earliest point in the window, when it is far enough back ──
  let delta: number | null = null;
  let deltaSpanDays: number | null = null;
  const dates = [...byDate.keys()].sort();
  if (dates.length >= 2) {
    const oldest = dates[0];
    const span = Math.round(
      (Date.parse(latestKey) - Date.parse(oldest)) / (24 * 60 * 60 * 1000),
    );
    if (span >= MIN_DELTA_SPAN_DAYS) {
      delta = you - (pool(byDate.get(oldest)!).get(brandName) ?? 0);
      deltaSpanDays = span;
    }
  }

  return {
    hasData: onLatest.length > 0,
    windowDays: SOV_WINDOW_DAYS,
    brandName,
    promptSets,
    selectedPromptSetId: selected.id,
    engines,
    selectedEngine,
    latestDate: latestKey,
    byEngine,
    trend,
    headline: { you, topRival, delta, deltaSpanDays },
  };
}
