/**
 * GET /api/free/v1/serp-volatility — the 30-day volatility series.
 *
 * NO RATE LIMIT, deliberately. Every visitor gets byte-identical data that a
 * daily worker already paid for, so a per-IP counter would ration a cached
 * read for no benefit — the only cost is one Redis GET behind a 1h cache.
 *
 * Until two consecutive days exist there is nothing to compare, and the
 * response says so rather than returning zeroes: "nothing moved" and "we have
 * no data yet" are different claims.
 *
 * PAUSED. With VOLATILITY_POLL_ENABLED off no new samples arrive, so a window
 * ending today would empty itself within a month. The window instead ends at
 * the last stored sample — the last snapshot, served as it was — and the
 * response says `paused: true` so the page can say "Updates paused".
 *
 * PUBLIC BY DESIGN — /api/free/v1/ is in publicPaths.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ONE_HOUR, cacheKey, cached, writeCache } from "@/lib/free-tools/cache";
import { volatilityPollEnabled } from "@/lib/free-tools/volatility-flag";
import {
  VOLATILITY_LOCATION_CODE,
  overallScore,
  scoreDay,
  type DaySample,
} from "@/lib/free-tools/volatility";

const WINDOW_DAYS = 30;

export interface VolatilityDay {
  date: string;
  overall: number | null;
  categories: Record<string, number | null>;
}

export interface VolatilityResponse {
  collecting: boolean;
  /** VOLATILITY_POLL_ENABLED is off: the days are the last stored snapshot. */
  paused: boolean;
  days: VolatilityDay[];
  latest: VolatilityDay | null;
}

export async function GET() {
  const paused = !volatilityPollEnabled();
  // The state is in the key: flipping the switch must not serve the other
  // state's cached body for up to an hour.
  const key = cacheKey("volatility", WINDOW_DAYS, VOLATILITY_LOCATION_CODE, paused ? "paused" : "live");
  const hit = await cached<VolatilityResponse>(key);
  if (hit.hit && hit.value) return NextResponse.json(hit.value);

  let end = Date.now();
  if (paused) {
    const last = await prisma.serpVolatilitySample.findFirst({
      where: { locationCode: VOLATILITY_LOCATION_CODE },
      orderBy: { sampledOn: "desc" },
      select: { sampledOn: true },
    });
    if (last) end = last.sampledOn.getTime() + 86_400_000;
  }
  const since = new Date(end - (WINDOW_DAYS + 1) * 86_400_000);
  const rows = await prisma.serpVolatilitySample.findMany({
    where: { locationCode: VOLATILITY_LOCATION_CODE, sampledOn: { gte: since } },
    orderBy: { sampledOn: "asc" },
    select: { sampledOn: true, category: true, keyword: true, topDomains: true },
  });

  // Group by day. One day is at most 30 rows, so the whole window is 930 —
  // small enough to shape in memory, and it is cached for an hour after.
  const byDay = new Map<string, DaySample[]>();
  for (const row of rows) {
    const day = row.sampledOn.toISOString().slice(0, 10);
    const list = byDay.get(day) ?? [];
    list.push({
      keyword: row.keyword,
      category: row.category,
      topDomains: Array.isArray(row.topDomains) ? (row.topDomains as string[]) : [],
    });
    byDay.set(day, list);
  }

  const dayKeys = [...byDay.keys()].sort();
  const days: VolatilityDay[] = [];

  // Start at the second day: the first has nothing to be compared against.
  for (let i = 1; i < dayKeys.length; i++) {
    const today = byDay.get(dayKeys[i]!)!;
    const yesterday = byDay.get(dayKeys[i - 1]!)!;
    const categories = scoreDay(today, yesterday);
    days.push({ date: dayKeys[i]!, overall: overallScore(categories), categories });
  }

  const payload: VolatilityResponse = {
    collecting: days.length === 0,
    paused,
    days: days.slice(-WINDOW_DAYS),
    latest: days.length > 0 ? days[days.length - 1]! : null,
  };

  await writeCache(key, payload, ONE_HOUR);
  return NextResponse.json(payload);
}
