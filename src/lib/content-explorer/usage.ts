// src/lib/content-explorer/usage.ts
//
// The usage block every Content Explorer route returns and the page header
// renders. Split out of service.ts so the routes can build it without importing
// the whole search path.
//
// The UI reads the limit from here rather than hardcoding a plan number into
// copy — the quota line in the help modal is live data, per the tool-page rules.

import type { PlanType } from "@/generated/prisma";
import { contentSearchLimit, planCanSearchContent } from "./options";
import { contentSearchesUsed } from "./quota";
import type { ContentExplorerUsage } from "./types";

export async function buildUsage(
  tenantId: string,
  plan: PlanType,
): Promise<ContentExplorerUsage> {
  return {
    used: await contentSearchesUsed(tenantId),
    limit: contentSearchLimit(plan),
    plan,
    canSearch: planCanSearchContent(plan),
  };
}
