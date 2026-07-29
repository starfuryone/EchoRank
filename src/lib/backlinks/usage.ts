// src/lib/backlinks/usage.ts
//
// The usage block every Backlinks route returns and the page header renders.
// Split out of service.ts so the routes can build it without importing the
// whole analysis path.

import type { PlanType } from "@/generated/prisma";
import { backlinksAnalysisLimit, planCanAnalyzeBacklinks } from "./options";
import { backlinksAnalysesUsed } from "./quota";
import type { BacklinksUsage } from "./types";

export async function buildUsage(tenantId: string, plan: PlanType): Promise<BacklinksUsage> {
  return {
    used: await backlinksAnalysesUsed(tenantId),
    limit: backlinksAnalysisLimit(plan),
    plan,
    canAnalyze: planCanAnalyzeBacklinks(plan),
  };
}
