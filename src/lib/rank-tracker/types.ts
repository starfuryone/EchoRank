// src/lib/rank-tracker/types.ts
//
// Wire shapes shared by the Rank Tracker routes and the client component.
// These are OUR persisted/normalized shapes; the DataForSEO-side shapes live
// in dataforseo/endpoints.ts.

import type { RankDevice, RankFrequency } from "./options";

export type RankSnapshotStatus = "queued" | "completed" | "failed";

/** One point on a keyword's history chart. */
export interface RankPoint {
  /** YYYY-MM-DD, UTC. */
  date: string;
  /** null = the domain was not in the top 100 that run. */
  position: number | null;
}

/** One row of the project-detail keywords table. */
export interface RankKeywordRow {
  id: string;
  keyword: string;
  /** Latest completed position; null = not in the top 100. */
  position: number | null;
  /** Best-ranking URL at the latest position. */
  url: string | null;
  /**
   * Position change vs the previous run. Positive = improved (moved toward #1).
   * null when there is no comparable pair (first run, or either end unranked).
   */
  deltaPrevious: number | null;
  /** Same, vs the closest run at least 30 days old. */
  delta30d: number | null;
  /** True while this keyword has a run in flight. */
  pending: boolean;
  /** Oldest-to-newest completed history, for the sparkline. */
  history: RankPoint[];
}

export interface RankProjectSummary {
  id: string;
  name: string;
  domain: string;
  locationCode: number;
  languageCode: string;
  device: RankDevice;
  frequency: RankFrequency;
  active: boolean;
  /** Plan cap exceeded (usually after a downgrade) — runs are skipped. */
  overCap: boolean;
  keywordCount: number;
  lastRunAt: string | null;
  createdAt: string;
  /** Runs currently in flight for this project. */
  pendingCount: number;
  /** Mean of the latest completed positions, ignoring unranked keywords. */
  averagePosition: number | null;
}

export interface RankProjectDetail extends RankProjectSummary {
  keywords: RankKeywordRow[];
  /** Project-wide average position per run date, oldest first. */
  chart: RankPoint[];
  /** Total billed for every snapshot in this project. */
  totalCostUsd: number;
}

export interface RankUsage {
  /** Keywords tracked across all this tenant's projects. */
  trackedKeywords: number;
  trackedKeywordLimit: number;
  /** Keyword checks posted this month. */
  checksUsed: number;
  checksLimit: number;
  plan: string;
  /** False for STARTER — the locked upsell card. */
  canTrack: boolean;
  allowedFrequencies: readonly RankFrequency[];
}
