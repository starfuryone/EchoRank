// src/lib/ga/types.ts
//
// Wire shapes shared by the Web Analytics routes and the client component.
// These are OUR normalized shapes; the GA4 response shapes live in client.ts.

import type { GaRange } from "./options";

/** The six headline metrics, in render order. */
export const HEADLINE_METRICS = [
  "sessions",
  "totalUsers",
  "newUsers",
  "engagementRate",
  "avgEngagementTime",
  "conversions",
] as const;

export type HeadlineMetricKey = (typeof HEADLINE_METRICS)[number];

export interface HeadlineMetric {
  key: HeadlineMetricKey;
  value: number;
  /** Same metric over the preceding window of equal length. */
  previous: number;
  /** Percent change; null when the previous window was zero. */
  change: number | null;
  /**
   * True when GA4 did not return this metric at all — distinct from a real
   * zero. `conversions` is the case in practice: older properties expose
   * `conversions`, newer ones only `keyEvents`.
   */
  unavailable?: boolean;
}

/** One point on the traffic chart. */
export interface TrafficPoint {
  /** YYYY-MM-DD. */
  date: string;
  sessions: number;
  users: number;
}

/** One row of the acquisition table. */
export interface ChannelRow {
  channel: string;
  sessions: number;
  /** Share of total sessions, 0–1, for the proportional bar. */
  share: number;
}

/** One row of the top-pages table. */
export interface PageRow {
  path: string;
  views: number;
  sessions: number;
  engagementRate: number;
}

/** One row of the referrers table. */
export interface ReferrerRow {
  source: string;
  sessions: number;
}

export interface GaReport {
  propertyId: string;
  propertyName: string | null;
  range: GaRange;
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  headline: HeadlineMetric[];
  traffic: TrafficPoint[];
  channels: ChannelRow[];
  pages: PageRow[];
  referrers: ReferrerRow[];
  /** True when every panel came back empty — a real state for a new property. */
  empty: boolean;
  /** ISO timestamp the report was built; the UI shows "updated X ago". */
  generatedAt: string;
  /** True when served from the 1 h Redis cache rather than freshly queried. */
  cached?: boolean;
}

/** Connection state the page renders before any report exists. */
export interface GaConnectionStatusDto {
  connected: boolean;
  status?: "ACTIVE" | "NEEDS_REAUTH";
  propertyId?: string | null;
  propertyName?: string | null;
  connectedAt?: string;
  /** Present only while no property is chosen — the picker's options. */
  properties?: { propertyId: string; displayName: string; accountName: string }[];
}
