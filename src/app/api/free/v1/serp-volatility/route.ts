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
 * PUBLIC BY DESIGN — /api/free/v1/ is in publicPaths.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ONE_HOUR, cacheKey, cached, writeCache } from "@/lib/free-tools/cache";
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
  days: VolatilityDay[];
  latest: VolatilityDay | null;
}

export async function GET() {
  const key = cacheKey("volatility", WINDOW_DAYS, VOLATILITY_LOCATION_CODE);
  const hit = await cached<VolatilityResponse>(key);
  if (hit.hit && hit.value) return NextResponse.json(hit.value);

  const since = new Date(Date.now() - (WINDOW_DAYS + 1) * 86_400_000);
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
    days: days.slice(-WINDOW_DAYS),
    latest: days.length > 0 ? days[days.length - 1]! : null,
  };

  await writeCache(key, payload, ONE_HOUR);
  return NextResponse.json(payload);
}
