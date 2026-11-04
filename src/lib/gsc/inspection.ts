// src/lib/gsc/inspection.ts
//
// Search Console URL Inspection (Phase 4g, crawl.inspection): what Google
// reports for one URL of a property the tenant's connection holds. The
// webmasters.readonly scope the GSC connection already has is enough.
//
// QUOTA, enforced here before every call (Redis, per property): Google
// allows 2,000 inspections a day and 600 a minute per property. reserve()
// counts the call first; at the minute limit the caller waits for the next
// minute, at the daily limit it stops and says so. The day is a UTC day:
// Google resets on Pacific time, so the counter can be up to a few hours out
// of step — conservative only if the tenant used none of it elsewhere.

import "server-only";
import { createHash } from "node:crypto";
import type Redis from "ioredis";
import { GscReauthError } from "./client";
import type { InspectionMetric } from "@/lib/site-crawler/metrics-shared";

export const INSPECTIONS_PER_DAY = 2_000;
export const INSPECTIONS_PER_MINUTE = 600;
const TIMEOUT_MS = 30_000;

export class InspectionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "InspectionError";
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- API payload, read defensively */
export function parseInspection(d: any): InspectionMetric {
  const r = d?.inspectionResult ?? {};
  const idx = r.indexStatusResult ?? {};
  const s = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    verdict: s(idx.verdict),
    coverageState: s(idx.coverageState),
    indexingState: s(idx.indexingState),
    robotsTxtState: s(idx.robotsTxtState),
    pageFetchState: s(idx.pageFetchState),
    googleCanonical: s(idx.googleCanonical),
    lastCrawlTime: s(idx.lastCrawlTime),
    mobileUsability: s(r.mobileUsabilityResult?.verdict),
    richResults: s(r.richResultsResult?.verdict),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function inspectUrl(accessToken: string, siteUrl: string, inspectionUrl: string, f: typeof fetch = fetch): Promise<InspectionMetric> {
  const res = await f("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inspectionUrl, siteUrl, languageCode: "en-US" }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 401) throw new GscReauthError();
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new InspectionError(`URL Inspection failed: ${res.status}`, res.status);
  }
  return parseInspection(await res.json());
}

const propKey = (siteUrl: string) => createHash("sha256").update(siteUrl).digest("hex").slice(0, 16);
export const inspectionDayKey = (siteUrl: string, now = new Date()) => `gsc-inspect:${propKey(siteUrl)}:${now.toISOString().slice(0, 10)}`;
export const inspectionMinuteKey = (siteUrl: string, now = new Date()) => `gsc-inspect:${propKey(siteUrl)}:${now.toISOString().slice(0, 16)}`;

export type Reservation = { ok: true } | { ok: false; reason: "daily_quota" } | { ok: false; reason: "minute"; waitMs: number };

/** Count one inspection against the property's limits; refuse (and give it back) when either is reached. */
export async function reserveInspection(redis: Pick<Redis, "incr" | "decr" | "expire">, siteUrl: string, now = new Date()): Promise<Reservation> {
  const day = inspectionDayKey(siteUrl, now);
  const used = await redis.incr(day);
  if (used === 1) await redis.expire(day, 2 * 24 * 60 * 60);
  if (used > INSPECTIONS_PER_DAY) {
    await redis.decr(day);
    return { ok: false, reason: "daily_quota" };
  }
  const minute = inspectionMinuteKey(siteUrl, now);
  const inMinute = await redis.incr(minute);
  if (inMinute === 1) await redis.expire(minute, 120);
  if (inMinute > INSPECTIONS_PER_MINUTE) {
    await redis.decr(minute);
    await redis.decr(day);
    return { ok: false, reason: "minute", waitMs: 60_000 - (now.getUTCSeconds() * 1000 + now.getUTCMilliseconds()) + 1_000 };
  }
  return { ok: true };
}
