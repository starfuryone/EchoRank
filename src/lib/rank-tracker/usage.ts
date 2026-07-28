// src/lib/rank-tracker/usage.ts
//
// The usage block every Rank Tracker route returns and the page header renders.
// Split out of service.ts so the routes can build it without importing the
// whole project lifecycle.

import type { PlanType } from "@/generated/prisma";
import {
  allowedFrequencies,
  checksPerMonthLimit,
  planCanTrack,
  trackedKeywordLimit,
} from "./options";
import { rankChecksUsed, trackedKeywordCount } from "./quota";
import type { RankUsage } from "./types";

export async function buildUsage(tenantId: string, plan: PlanType): Promise<RankUsage> {
  const [trackedKeywords, checksUsed] = await Promise.all([
    trackedKeywordCount(tenantId),
    rankChecksUsed(tenantId),
  ]);

  return {
    trackedKeywords,
    trackedKeywordLimit: trackedKeywordLimit(plan),
    checksUsed,
    checksLimit: checksPerMonthLimit(plan),
    plan,
    canTrack: planCanTrack(plan),
    allowedFrequencies: allowedFrequencies(plan),
  };
}
